/**
 * WhatsApp chat parser
 * Usage: node scripts/parse-whatsapp.cjs <input.txt> [output.json] [maxMessages]
 * If output omitted, writes to public/imported-chat.json
 * If maxMessages omitted, takes last 5000 messages
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node scripts/parse-whatsapp.cjs <input.txt> [output.json] [maxMessages]');
  process.exit(1);
}

const outputFile = process.argv[3] || path.join(__dirname, '..', 'public', 'imported-chat.json');
const maxMessages = parseInt(process.argv[4], 10) || 0;

const raw = fs.readFileSync(inputFile, 'utf-8');
const lines = raw.split(/\r?\n/);

// DD/MM/YYYY, H:MM am/pm - Sender: message
const messageRegex = /^(\d{1,2}\/\d{1,2}\/\d{4}),\s(\d{1,2}:\d{2}[ ]?[apAP][mM])\s-\s(.+?):\s(.+)/;

const allMessages = [];
let current = null;
let skippedSystem = 0;

for (const line of lines) {
  if (!line.trim()) continue;

  if (line.includes('end-to-end encrypted') || line.includes('created this group') || line.includes('added') || line.includes('left') || line.includes('changed this group')) {
    skippedSystem++;
    continue;
  }

  const match = line.match(messageRegex);
  if (match) {
    if (current) allMessages.push(current);

    const timePart = match[2].replace(/[ ]/g, ' ');
    const sender = match[3].trim();
    let text = match[4].trim();
    const timeNormalized = timePart.replace(/[APap][Mm]/, (m) => m.toUpperCase());

    current = [
      match[1],                // d: date
      timeNormalized,          // t: time
      sender,                  // s: sender
      text,                    // m: message
      text === '<Media omitted>' ? 1 : 0,  // media flag
    ];
  } else if (current) {
    current[3] += '\n' + line.trim();
  }
}

if (current) allMessages.push(current);

// Take only the most recent messages (if limit specified)
const recent = maxMessages > 0 ? allMessages.slice(-maxMessages) : allMessages;

// Get unique senders
const senderMap = {};
for (const m of allMessages) {
  senderMap[m[2]] = (senderMap[m[2]] || 0) + 1;
}

const output = JSON.stringify({
  total: allMessages.length,
  senders: Object.entries(senderMap)
    .sort((a, b) => b[1] - a[1])
    .map(e => ({ n: e[0], c: e[1] })),
  msgs: recent,
});

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, output, 'utf-8');
const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(1);
console.log(`Parsed ${allMessages.length} messages (skipped ${skippedSystem} system msgs)`);
console.log(`Exported last ${recent.length} messages (${sizeMB} MB) to ${outputFile}`);
