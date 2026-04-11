require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';
const ENV_PATH = path.join(__dirname, '.env');

// Ensure ENCRYPTION_KEY exists
let keyHex = process.env.ENCRYPTION_KEY;

if (!keyHex || keyHex.length !== 64) {
  const newKey = crypto.randomBytes(32).toString('hex');
  if (fs.existsSync(ENV_PATH)) {
    fs.appendFileSync(ENV_PATH, `\nENCRYPTION_KEY=${newKey}\n`);
  } else {
    fs.writeFileSync(ENV_PATH, `ENCRYPTION_KEY=${newKey}\n`);
  }
  keyHex = newKey;
  process.env.ENCRYPTION_KEY = keyHex; // Set for current run
  console.log('⚠️ Generated new ENCRYPTION_KEY in .env. Please back this up securely!');
}

const key = Buffer.from(keyHex, 'hex');

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Return iv:encrypted
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text || !text.includes(':')) {
    // Return original, might be plaintext legacy config
    return text;
  }
  
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch(err) {
    console.error("Encryption decode failed (returning raw text).", err.message);
    return text;
  }
}

module.exports = { encrypt, decrypt };
