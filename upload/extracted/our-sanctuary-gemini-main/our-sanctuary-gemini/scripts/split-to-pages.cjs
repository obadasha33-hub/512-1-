/**
 * Reads the full imported-chat.json and splits it into page files.
 * Usage: node scripts/split-to-pages.cjs <input.json> [msgsPerPage]
 * Output: public/imported-pages/ (index.json + p0.json ... pN.json)
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile) { console.error('Usage: node scripts/split-to-pages.cjs <input.json> [msgsPerPage]'); process.exit(1); }

const msgsPerPage = parseInt(process.argv[3], 10) || 500;

console.log('Reading', inputFile, '...');
const raw = fs.readFileSync(inputFile, 'utf-8');
const data = JSON.parse(raw);
const allMsgs = data.msgs || [];
const total = data.total || allMsgs.length;
const senders = data.senders || [];

console.log(`Total: ${total}, loaded: ${allMsgs.length}`);

const pagesDir = path.join(__dirname, '..', 'public', 'imported-pages');
fs.mkdirSync(pagesDir, { recursive: true });

let pageIndex = 0;
// Messages are in chronological order (oldest first).
// Page 0 = most recent msgsPerPage, Page 1 = previous msgsPerPage, etc.
for (let start = allMsgs.length; start > 0; start -= msgsPerPage) {
  const begin = Math.max(0, start - msgsPerPage);
  const chunk = allMsgs.slice(begin, start);
  fs.writeFileSync(
    path.join(pagesDir, `p${pageIndex}.json`),
    JSON.stringify(chunk),
    'utf-8'
  );
  pageIndex++;
}

const totalPages = pageIndex;

fs.writeFileSync(
  path.join(pagesDir, 'index.json'),
  JSON.stringify({ total, totalPages, perPage: msgsPerPage, senders }),
  'utf-8'
);

console.log(`Wrote ${totalPages} page files (${msgsPerPage} msgs each)`);
console.log(`Page 0 = most recent ${msgsPerPage} messages`);
console.log(`Page ${totalPages - 1} = oldest messages`);
console.log('Index at public/imported-pages/index.json');

// Clean up: delete old single-file
const oldFile = path.join(__dirname, '..', 'public', 'imported-chat.json');
if (fs.existsSync(oldFile)) {
  fs.unlinkSync(oldFile);
  console.log('Deleted old single-file imported-chat.json');
}
