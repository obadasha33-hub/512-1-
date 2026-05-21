import http from 'http';

const data = JSON.stringify({
  userMessage: "مرحبا بك يا دليلي",
  names: { me: "Batman", partner: "Princess" },
  aiMemory: {}
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/sanctuary/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
