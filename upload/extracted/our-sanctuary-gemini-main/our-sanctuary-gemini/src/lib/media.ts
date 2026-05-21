import { SUPABASE_MEDIA_BUCKET, supabase } from './supabase';

export async function uploadMedia(file: File, vaultId?: string): Promise<string> {
  if (!vaultId) {
    if (file.type.startsWith('image/')) return readAsDataUrl(file);
    throw new Error('Media upload requires a vault id.');
  }

  try {
    const processed = await prepareFile(file);
    const randomId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${vaultId}/${new Date().toISOString().slice(0, 10)}/${randomId}.${processed.extension}`;
    const { error } = await supabase.storage
      .from(SUPABASE_MEDIA_BUCKET)
      .upload(path, processed.blob, {
        contentType: processed.contentType,
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(SUPABASE_MEDIA_BUCKET)
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (error) {
    console.error('Firebase Storage upload failed:', error);
    if (file.type.startsWith('image/') && file.size < 750_000) return readAsDataUrl(file);
    throw new Error('Media upload failed. Enable Firebase Storage and deploy storage.rules.');
  }
}

function fileExtension(file: File, fallback: string) {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type.split('/')[1] || fallback;
}

async function prepareFile(file: File) {
  if (!file.type.startsWith('image/')) {
    return { blob: file, contentType: file.type || 'application/octet-stream', extension: fileExtension(file, 'bin') };
  }

  const img = await loadImage(await readAsDataUrl(file));
  const maxSize = 1280;
  let width = img.width;
  let height = img.height;

  if (width > height && width > maxSize) {
    height *= maxSize / width;
    width = maxSize;
  } else if (height > maxSize) {
    width *= maxSize / height;
    height = maxSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Image compression failed')), 'image/jpeg', 0.78);
  });

  return { blob, contentType: 'image/jpeg', extension: 'jpg' };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
