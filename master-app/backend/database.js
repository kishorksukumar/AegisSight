const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const { hashPassword } = require('./auth-util');

const dbPath = path.join(__dirname, 'aegissight.sqlite');
const db = new Database(dbPath); // Removed verbose for cleaner startup logs

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    hostname TEXT,
    ip_address TEXT,
    platform TEXT,
    status TEXT DEFAULT 'offline',
    token_hash TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS destinations (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT, -- 's3', 'ftp', 'sftp', 'scp'
    config TEXT -- JSON encoded credentials/host
  );

  CREATE TABLE IF NOT EXISTS backup_jobs (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    name TEXT,
    source_paths TEXT, -- JSON encoded array of file/folder paths
    s3_bucket TEXT,
    s3_region TEXT,
    cron_schedule TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS backup_history (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    status TEXT, -- 'running', 'success', 'failed'
    progress INTEGER DEFAULT 0,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    file_size INTEGER,
    logs TEXT,
    archive_name TEXT,
    FOREIGN KEY(job_id) REFERENCES backup_jobs(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Run migrations for existing databases
try {
  db.prepare('ALTER TABLE backup_history ADD COLUMN archive_name TEXT').run();
} catch (e) {
  // Ignore if column already exists
}

// Seed default settings
const settingsDefaults = {
  domain: process.env.DOMAIN || 'localhost',
  ssl_enabled: 'false',
  app_version: '0.4.1',
  letsencrypt_email: process.env.LETSENCRYPT_EMAIL || ''
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(settingsDefaults)) {
  insertSetting.run(key, value);
}

try { db.exec(`ALTER TABLE backup_jobs ADD COLUMN destination_id TEXT REFERENCES destinations(id);`); } catch(e) {}
try { db.exec(`ALTER TABLE backup_jobs ADD COLUMN backup_type TEXT DEFAULT 'full';`); } catch(e) {}
try { db.exec(`ALTER TABLE agents ADD COLUMN cpu_load TEXT;`); } catch(e) {}
try { db.exec(`ALTER TABLE agents ADD COLUMN ram_usage TEXT;`); } catch(e) {}
try { db.exec(`ALTER TABLE agents ADD COLUMN uptime INTEGER;`); } catch(e) {}
try { db.exec(`ALTER TABLE agents ADD COLUMN token_hash TEXT;`); } catch(e) {}

// Password hashing consolidated in auth-util.js

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const seedUsername = process.env.ADMIN_USERNAME || 'admin';
  const seedPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
    .run(`user_${Date.now()}`, seedUsername, hashPassword(seedPassword));
  console.log(`=============================================================`);
  console.log(`✓ Created initial admin user: ${seedUsername}`);
  console.log(`✓ Default password: ${seedPassword}`);
  console.log(`⚠️ Please write this down. It will not be shown again.`);
  console.log(`=============================================================`);
}

module.exports = db;
