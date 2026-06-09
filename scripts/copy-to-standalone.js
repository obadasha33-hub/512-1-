const { cpSync, mkdirSync, copyFileSync } = require('fs');
const { join, basename } = require('path');

const PROJECT_ROOT = process.cwd();
const STANDALONE_DIR = join(PROJECT_ROOT, '.next', 'standalone');

// Files and directories to copy from project root
const ROOT_COPIES = [
  'server.js',
  'lib',
  '.env',
  '.env.local',
  'public/uploads',
];

// Static build assets (already handled)
function copyStaticAssets() {
  try {
    cpSync(join(PROJECT_ROOT, '.next', 'static'), join(STANDALONE_DIR, '.next', 'static'), { recursive: true });
    cpSync(join(PROJECT_ROOT, 'public'), join(STANDALONE_DIR, 'public'), { recursive: true });
    console.log('✓ Copied static files to standalone');
  } catch (e) {
    console.warn('Copy warning:', e.message);
  }
}

function copyRootFiles() {
  for (const item of ROOT_COPIES) {
    const src = join(PROJECT_ROOT, item);
    const dest = join(STANDALONE_DIR, basename(item));
    try {
      const stat = cpSync(src, dest, { recursive: true });
      console.log(`✓ Copied ${item}`);
    } catch (e) {
      // Skip missing files/directories silently
    }
  }
}

copyStaticAssets();
copyRootFiles();
console.log('Done copying standalone assets');
