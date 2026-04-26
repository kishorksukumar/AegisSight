const crypto = require('crypto');

const DEFAULT_ITERATIONS = 600000;

function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  // Store iterations in the format so we can change it later without breaking old hashes
  return `${salt}:${iterations}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!password || typeof password !== 'string') return false;
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  
  let salt, iterations, hash;
  
  if (parts.length === 3) {
    // New format: salt:iterations:hash
    salt = parts[0];
    iterations = parseInt(parts[1], 10);
    hash = parts[2];
  } else if (parts.length === 2) {
    // Legacy format: salt:hash
    salt = parts[0];
    iterations = 1000; // Assume legacy 1000 iterations for pre-migration users
    hash = parts[1];
  } else {
    return false;
  }
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  const storedHashBuffer = Buffer.from(hash, 'hex');
  
  if (verifyHash.length !== storedHashBuffer.length) return false;
  return crypto.timingSafeEqual(verifyHash, storedHashBuffer);
}

module.exports = { hashPassword, verifyPassword };
