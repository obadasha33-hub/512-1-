// ─── Media Compression Utilities ──────────────────────────────────────────
// Client-side compression for images and videos before upload.
// Keeps files small to fit Railway's free-tier constraints and speeds up sync.

export type CompressionProgress = (stage: 'compressing' | 'uploading', pct: number) => void;

const MAX_IMAGE_DIMENSION = 1920;     // Resize so the longest side is at most this
const MAX_IMAGE_QUALITY = 0.85;       // JPEG/WebP quality
const MAX_THUMBNAIL_DIMENSION = 320;  // For inline previews
const MAX_VIDEO_DIMENSION = 1280;     // Cap video to 720p-ish for uploads
const MAX_VIDEO_BITRATE = 800_000;    // 800 kbps
const MAX_AUDIO_BITRATE = 64_000;     // 64 kbps for voice notes

// ─── Image compression ────────────────────────────────────────────────────
// Uses canvas API to resize + re-encode images. No external deps needed.
export async function compressImage(
  file: File | Blob,
  opts: { maxDim?: number; quality?: number; mime?: string } = {}
): Promise<{ blob: Blob; width: number; height: number; originalSize: number; compressedSize: number }> {
  const maxDim = opts.maxDim ?? MAX_IMAGE_DIMENSION;
  const quality = opts.quality ?? MAX_IMAGE_QUALITY;
  const mime = opts.mime ?? 'image/jpeg';

  const originalSize = file.size;

  // Skip compression for very small images or animated formats (gif)
  if (file.size < 80 * 1024 || (file instanceof File && file.type === 'image/gif')) {
    return { blob: file, width: 0, height: 0, originalSize, compressedSize: originalSize };
  }

  const bitmap = await blobToBitmap(file);
  let { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(targetW, targetH)
    : Object.assign(document.createElement('canvas'), { width: targetW, height: targetH });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob = await canvasToBlob(canvas, mime, quality);
  return { blob, width: targetW, height: targetH, originalSize, compressedSize: blob.size };
}

function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob);
  }
  // Fallback for older browsers / WebView
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img as unknown as ImageBitmap); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, mime: string, quality: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), mime, quality);
  });
}

// ─── Generate thumbnail (small) for inline previews ───────────────────────
export async function generateThumbnail(file: File | Blob, maxDim = MAX_THUMBNAIL_DIMENSION): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null;
  if (file.size < 30 * 1024) return file;
  try {
    const result = await compressImage(file, { maxDim, quality: 0.7, mime: 'image/jpeg' });
    return result.blob;
  } catch {
    return null;
  }
}

// ─── Video compression ────────────────────────────────────────────────────
// Uses MediaRecorder API to transcode videos to a lower bitrate/resolution.
export async function compressVideo(
  file: File | Blob,
  onProgress?: (pct: number) => void
): Promise<{ blob: Blob; mime: string; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;

  // If the file is small (< 2MB) or already a tiny video, skip compression
  if (file.size < 2 * 1024 * 1024) {
    return { blob: file, mime: (file as File).type || 'video/mp4', originalSize, compressedSize: originalSize };
  }

  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    return { blob: file, mime: (file as File).type || 'video/mp4', originalSize, compressedSize: originalSize };
  }

  // Pick a codec the device can record
  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const url = URL.createObjectURL(file);
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Video load failed'));
  });

  // Scale down to MAX_VIDEO_DIMENSION
  const scale = Math.min(1, MAX_VIDEO_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(url);
    return { blob: file, mime: (file as File).type || 'video/mp4', originalSize, compressedSize: originalSize };
  }

  // Pick a supported bitrate
  const stream = (canvas as HTMLCanvasElement).captureStream(30);
  let bitrate = MAX_VIDEO_BITRATE;

  const recorder = new MediaRecorder(stream, mime
    ? { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 64_000 }
    : { videoBitsPerSecond: bitrate });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const outMime = recorder.mimeType || mime || 'video/webm';
      const blob = new Blob(chunks, { type: outMime });
      resolve(blob);
    };
  });

  // Draw video frames
  recorder.start(200);
  video.currentTime = 0;
  await video.play();

  const totalDur = video.duration || 1;
  let lastTick = 0;
  const drawFrame = (now: number) => {
    if (recorder.state === 'inactive') return;
    ctx.drawImage(video, 0, 0, w, h);
    if (now - lastTick > 100) {
      lastTick = now;
      onProgress?.(Math.min(99, Math.round((video.currentTime / totalDur) * 100)));
    }
    if (video.ended || video.currentTime >= totalDur) {
      recorder.stop();
      video.pause();
    } else {
      requestAnimationFrame(drawFrame);
    }
  };
  requestAnimationFrame(drawFrame);

  // Safety timeout (max 5 minutes)
  const timeout = setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, 5 * 60 * 1000);

  const compressed = await done;
  clearTimeout(timeout);
  URL.revokeObjectURL(url);
  onProgress?.(100);

  // If compressed is larger, return original
  if (compressed.size >= originalSize) {
    return { blob: file, mime: (file as File).type || 'video/mp4', originalSize, compressedSize: originalSize };
  }
  return { blob: compressed, mime: recorder.mimeType || mime, originalSize, compressedSize: compressed.size };
}

// ─── Audio compression (for voice notes already in webm) ──────────────────
export async function compressAudio(file: File | Blob): Promise<{ blob: Blob; mime: string; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;
  // Most Android voice recordings are already in webm/opus at low bitrate.
  // We just re-encode using a MediaRecorder if the file is large.
  if (file.size < 200 * 1024 || typeof MediaRecorder === 'undefined') {
    return { blob: file, mime: (file as File).type || 'audio/webm', originalSize, compressedSize: originalSize };
  }

  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  if (!mime) return { blob: file, mime: (file as File).type || 'audio/webm', originalSize, compressedSize: originalSize };

  try {
    const arrayBuf = await file.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    const offline = new OfflineAudioContext(1, decoded.length, decoded.sampleRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();

    const rendered = await offline.startRendering();
    const dest = ctx.createMediaStreamDestination();
    const recorder = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: MAX_AUDIO_BITRATE });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });
    recorder.start();
    const bufSrc = ctx.createBufferSource();
    bufSrc.buffer = rendered;
    bufSrc.connect(dest);
    bufSrc.start();
    bufSrc.onended = () => recorder.stop();
    const compressed = await done;
    ctx.close();
    if (compressed.size >= originalSize) {
      return { blob: file, mime: (file as File).type || 'audio/webm', originalSize, compressedSize: originalSize };
    }
    return { blob: compressed, mime, originalSize, compressedSize: compressed.size };
  } catch {
    return { blob: file, mime: (file as File).type || 'audio/webm', originalSize, compressedSize: originalSize };
  }
}

// ─── Format helper ────────────────────────────────────────────────────────
export function formatBytes(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
