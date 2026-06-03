import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
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

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

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
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, outBytes);

    const url = `/uploads/${filename}`;
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
