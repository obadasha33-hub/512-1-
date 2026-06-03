import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { authenticateRequest } from '@/lib/api-auth';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'application/json',
]);

async function uploadToCloudinary(fileBuffer: Buffer, fileName: string, mimeType: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || 'our_sanctuary';

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  try {
    const timestamp = Math.round(Date.now() / 1000).toString();
    const params: Record<string, string> = {
      folder,
      timestamp,
    };

    // Generate SHA1 signature
    const sortedKeys = Object.keys(params).sort();
    const paramStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const signature = crypto
      .createHash('sha1')
      .update(paramStr + apiSecret)
      .digest('hex');

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, fileName);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('folder', folder);
    formData.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Cloudinary] Upload failed response:', errText);
      return null;
    }

    const json = await res.json();
    return json.secure_url || json.url || null;
  } catch (error) {
    console.error('[Cloudinary] Upload error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `File type "${file.type}" is not allowed` }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    let outBytes: Buffer = bytes;
    let outMime: string = file.type || 'application/octet-stream';
    let outExt = path.extname(file.name) || '';

    // Server-side image optimization (optional — if sharp is not installed, just use original)
    if (file.type && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      try {
        const sharp = (await import('sharp')).default;
        const pipeline = sharp(bytes).rotate();
        const meta = await pipeline.metadata();
        if (meta.width && meta.height && Math.max(meta.width, meta.height) > 4096) {
          pipeline.resize({ width: meta.width >= meta.height ? 4096 : undefined, height: meta.height > meta.width ? 4096 : undefined, fit: 'inside' });
        }
        outBytes = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        outMime = 'image/jpeg';
        outExt = '.jpg';
      } catch (e) {
        // Sharp not available or optimization failed — use the original file
        outBytes = bytes;
        outMime = file.type || 'application/octet-stream';
        outExt = path.extname(file.name) || '';
      }
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${outExt}`;

    // 1. Try Cloudinary Upload first (if configured)
    let url = await uploadToCloudinary(outBytes, filename, outMime);

    // 2. Fallback to local disk storage if Cloudinary is not configured or fails
    if (!url) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, filename);
      await writeFile(filePath, outBytes);
      url = `/uploads/${filename}`;
    }

    return NextResponse.json({
      url,
      fileUrl: url,
      path: url,
      mime: outMime,
      size: outBytes.length,
      originalSize: bytes.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
