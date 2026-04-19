require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GCM_ALGORITHM = 'aes-256-gcm';
const CBC_ALGORITHM = 'aes-256-cbc';
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
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // Return explicitly versioned GCM payload
  return `gcm:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(text) {
  if (!text || typeof text !== 'string') return text;
  
  try {
    if (text.startsWith('gcm:')) {
      const parts = text.split(':');
      if (parts.length !== 4) throw new Error('Invalid GCM payload');
      const iv = Buffer.from(parts[1], 'hex');
      const authTag = Buffer.from(parts[2], 'hex');
      const encryptedText = Buffer.from(parts[3], 'hex');
      
      const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } else if (text.startsWith('cbc:')) {
      const parts = text.split(':');
      const iv = Buffer.from(parts[1], 'hex');
      const encryptedText = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } else if (text.includes(':')) {
      // Legacy implicit cbc
      const textParts = text.split(':');
      if (textParts.length === 2 && textParts[0].length === 32) {
        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');
        const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
      }
    }
  } catch(err) {
    console.error("Encryption decode failed:", err.message);
    return null; // Safe explicit failure
  }
  
  // Do NOT return raw text — if it doesn't match a known encrypted format, treat it as a decryption failure
  return null;
}

module.exports = { encrypt, decrypt };
