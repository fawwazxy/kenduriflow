'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const selfsigned = require('selfsigned');

// A secure (https) address on the local network, so the guard's phone allows the camera.
// Phone browsers only open the camera on https. On the Wi-Fi address KenduriFlow makes its own certificate,
// valid for this computer's addresses. Phones show a warning the first time; the guard accepts it once.
// Online behind a real https host (TRUST_PROXY=1) this is not needed and does not start.

const DIR = path.join(__dirname, '..', 'data', 'certs');
const KEY = path.join(DIR, 'key.pem');
const CERT = path.join(DIR, 'cert.pem');
const HOSTS = path.join(DIR, 'hosts.json');

// Re-uses the saved certificate while it still covers every address and has a month left; otherwise makes a new one.
async function certificate(ips) {
  const want = ['localhost', '127.0.0.1', ...ips].sort();
  try {
    const saved = JSON.parse(fs.readFileSync(HOSTS, 'utf8'));
    if (want.every((h) => saved.hosts.includes(h)) && saved.expires > Date.now() + 30 * 86400000) {
      return { key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) };
    }
  } catch (e) { /* none yet */ }
  const expires = new Date(Date.now() + 825 * 86400000);   // the longest phones accept
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'KenduriFlow local' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: expires,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, ...['127.0.0.1', ...ips].map((ip) => ({ type: 7, ip }))] }
    ]
  });
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(KEY, pems.private);
  fs.writeFileSync(CERT, pems.cert);
  fs.writeFileSync(HOSTS, JSON.stringify({ hosts: want, expires: expires.getTime() }));
  return { key: pems.private, cert: pems.cert };
}

async function start(app, port, ips) {
  const creds = await certificate(ips);
  const server = https.createServer(creds, app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  return server;
}

module.exports = { start };
