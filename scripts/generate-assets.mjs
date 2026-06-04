import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function makeIconSvg(size, text) {
  const fontSize = Math.round(size * 0.5);
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="none"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial,Helvetica,sans-serif" font-weight="bold"
        font-size="${fontSize}" fill="#FFFFFF">${text}</text>
</svg>`;
}

const densities = {
  'mdpi': 48,
  'hdpi': 72,
  'xhdpi': 96,
  'xxhdpi': 144,
  'xxxhdpi': 192,
};

async function generateIcons() {
  for (const [density, size] of Object.entries(densities)) {
    const dir = path.join(root, 'android/app/src/main/res/mipmap-' + density);
    const svgForeground = makeIconSvg(size, '512');
    await sharp(Buffer.from(svgForeground)).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));

    const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#7C3AED" rx="${Math.round(size*0.15)}"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial,Helvetica,sans-serif" font-weight="bold"
        font-size="${Math.round(size * 0.5)}" fill="#FFFFFF">512</text>
</svg>`;
    await sharp(Buffer.from(bgSvg)).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(Buffer.from(bgSvg)).resize(size, size).png().toFile(path.join(dir, 'ic_launcher_round.png'));
    console.log('Generated ' + density);
  }
}

const splashSizes = {
  'drawable': { w: 480, h: 800 },
  'drawable-land-mdpi': { w: 800, h: 480 },
  'drawable-land-hdpi': { w: 1280, h: 720 },
  'drawable-land-xhdpi': { w: 1600, h: 960 },
  'drawable-land-xxhdpi': { w: 1920, h: 1152 },
  'drawable-land-xxxhdpi': { w: 2560, h: 1536 },
  'drawable-port-mdpi': { w: 480, h: 800 },
  'drawable-port-hdpi': { w: 720, h: 1280 },
  'drawable-port-xhdpi': { w: 960, h: 1600 },
  'drawable-port-xxhdpi': { w: 1152, h: 1920 },
  'drawable-port-xxxhdpi': { w: 1536, h: 2560 },
};

async function generateSplash() {
  for (const [dirName, dims] of Object.entries(splashSizes)) {
    const fontSize = Math.round(Math.min(dims.w, dims.h) * 0.15);
    const svg = `<svg width="${dims.w}" height="${dims.h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
  </defs>
  <rect width="${dims.w}" height="${dims.h}" fill="url(#bg)"/>
  <text x="50%" y="48%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial,Helvetica,sans-serif" font-weight="bold"
        font-size="${fontSize}" fill="#FFFFFF">512</text>
  <text x="50%" y="60%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial,Helvetica,sans-serif" font-size="${Math.round(fontSize*0.25)}" fill="rgba(255,255,255,0.7)">Our Sanctuary</text>
</svg>`;
    const dir = path.join(root, 'android/app/src/main/res', dirName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await sharp(Buffer.from(svg)).resize(dims.w, dims.h).png().toFile(path.join(dir, 'splash.png'));
    console.log('Generated ' + dirName);
  }
}

generateIcons().then(generateSplash).catch(console.error);
