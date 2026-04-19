const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { encrypt, decrypt } = require('./crypto-util');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const crypto = require('crypto');
const activeTokens = new Map();
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 600000, 64, 'sha512');
  const storedHashBuffer = Buffer.from(hash, 'hex');
  if (verifyHash.length !== storedHashBuffer.length) return false;
  return crypto.timingSafeEqual(verifyHash, storedHashBuffer);
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username || 'admin');
  if (user && verifyPassword(password, user.password_hash)) {
    const token = crypto.randomBytes(32).toString('hex');
    activeTokens.set(token, { username: user.username, expiresAt: Date.now() + SESSION_EXPIRY_MS });
    res.json({ token, username: user.username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeTokens.delete(token);
  }
  res.json({ success: true });
});

function verifyToken(req, res, next) {
  const openPaths = ['/api/login', '/api/install.sh', '/api/agent-bundle.js', '/api/backup-bundle.js'];
  if (openPaths.includes(req.path)) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  
  const session = activeTokens.get(token);
  if (session) {
    if (session.expiresAt > Date.now()) {
      return next();
    } else {
      activeTokens.delete(token);
    }
  }

  // Fallback to check if it's an agent authenticating for its own endpoint
  const agentMatch = req.path.match(/^\/api\/agents\/([^\/]+)/) || req.path.match(/^\/api\/jobs/);
  if (agentMatch) {
    let agentId = agentMatch[1];
    // For /api/jobs, the agent_id is in the body
    if (req.path.startsWith('/api/jobs') && req.body && req.body.agent_id) {
       agentId = req.body.agent_id;
    }
    
    if (agentId) {
      const agent = db.prepare('SELECT token_hash FROM agents WHERE id = ?').get(agentId);
      if (agent && agent.token_hash && verifyPassword(token, agent.token_hash)) {
        return next();
      }
    }
  }

  return res.status(401).json({ error: 'Unauthorized Session' });
}

app.use(verifyToken);

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, username, created_at FROM users').all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { username, password } = req.body;
  try {
    const stmt = db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
    stmt.run(`user_${Date.now()}`, username, hashPassword(password));
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Username taken' : err.message });
  }
});

app.put('/api/users/:id/reset', (req, res) => {
  const { newPassword } = req.body;
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.params.id);
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  // Prevent deleting the very last user
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count <= 1) return res.status(400).json({ error: 'Cannot delete the only remaining user.' });
  
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Settings APIs ─────────────────────────────────────────────────────────────
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  rows.forEach(r => result[r.key] = r.value);
  res.json(result);
});

app.post('/api/settings/domain', (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.match(/^[a-zA-Z0-9.-]+$/)) return res.status(400).json({ error: 'Valid domain is required' });
  setSetting('domain', domain);
  res.json({ success: true, domain });
});

app.post('/api/settings/email', (req, res) => {
  const { email } = req.body;
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return res.status(400).json({ error: 'Valid email is required' });
  setSetting('letsencrypt_email', email);
  res.json({ success: true });
});

app.post('/api/settings/ssl', async (req, res) => {
  const domain = getSetting('domain');
  const email  = getSetting('letsencrypt_email');

  if (!domain || domain === 'localhost') {
    return res.status(400).json({ error: 'A valid domain must be configured before enabling SSL.' });
  }
  if (!email) {
    return res.status(400).json({ error: 'A Let\'s Encrypt email is required before enabling SSL.' });
  }

  // Stream logs back to client
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.write(`[AegisSight] Starting SSL provisioning for ${domain}...\n`);

  try {
    // Run certbot inside the certbot container (or directly if not in Docker) using spawnSync
    const cmd = process.env.CERTBOT_CONTAINER ? 'docker' : 'certbot';
    const args = process.env.CERTBOT_CONTAINER 
      ? ['exec', process.env.CERTBOT_CONTAINER, 'certbot', 'certonly', '--webroot', '-w', '/var/www/certbot', '-d', domain, '--email', email, '--agree-tos', '--non-interactive', '--force-renewal']
      : ['certonly', '--webroot', '-w', '/var/www/certbot', '-d', domain, '--email', email, '--agree-tos', '--non-interactive', '--force-renewal'];

    res.write('[AegisSight] Running Certbot...\n');
    const { spawnSync } = require('child_process');
    const child = spawnSync(cmd, args, { timeout: 120000 });
    res.write(child.stdout?.toString() || '');
    if (child.stderr) res.write(child.stderr.toString());
    
    if (child.status !== 0) {
      throw new Error(`Certbot failed with status ${child.status}`);
    }

    // Swap Nginx config to SSL version
    const nginxContainer = process.env.NGINX_CONTAINER || 'aegissight-nginx';
    const nginxSslConf = path.join(__dirname, '../../nginx/nginx.conf');
    
    try {
      // Generate nginx.conf with domain substituted
      const template = fs.readFileSync(nginxSslConf, 'utf8');
      const rendered = template.replace(/\$\{DOMAIN\}/g, domain);
      fs.writeFileSync('/tmp/aegis-nginx-ssl.conf', rendered);
      
      execSync(`docker cp /tmp/aegis-nginx-ssl.conf ${nginxContainer}:/etc/nginx/conf.d/default.conf`);
      execSync(`docker exec ${nginxContainer} nginx -s reload`);
      res.write('[AegisSight] Nginx reloaded with SSL configuration.\n');
    } catch (nginxErr) {
      res.write(`[AegisSight] Warning: Could not reload Nginx automatically: ${nginxErr.message}\n`);
      res.write('[AegisSight] Please run: docker exec aegissight-nginx nginx -s reload\n');
    }

    setSetting('ssl_enabled', 'true');
    res.write('[AegisSight] ✓ SSL enabled successfully!\n');
    res.end();
  } catch (err) {
    res.write(`[AegisSight] ✗ SSL provisioning failed: ${err.message}\n`);
    res.end();
  }
});

// ── Update & Rollback APIs ────────────────────────────────────────────────────
const https = require('https');

const REPO_OWNER = 'kishorksukumar';
const REPO_NAME  = 'AegisSight';
const BACKUPS_DIR = path.join(__dirname, '../..', 'aegissight-backups');
const DB_PATH = path.join(__dirname, 'aegissight.sqlite');

// Ensure backups dir exists
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

function getGitHubRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      headers: { 'User-Agent': 'AegisSight-Self-Hosted' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getCurrentGitCommit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '../..') }).toString().trim(); }
  catch(e) { return 'unknown'; }
}

function createSnapshot(label) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const commit    = getCurrentGitCommit();
  const snapName  = `${timestamp}__${label}__${commit}.sqlite`;
  const snapPath  = path.join(BACKUPS_DIR, snapName);
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, snapPath);
  }
  return { snapName, snapPath, timestamp, commit };
}

app.get('/api/update/status', async (req, res) => {
  try {
    const currentVersion = getSetting('app_version') || '0.2.0';
    const currentCommit  = getCurrentGitCommit();
    let latestRelease    = null;
    let updateAvailable  = false;

    try {
      const release = await getGitHubRelease();
      if (release && release.tag_name) {
        latestRelease   = { version: release.tag_name.replace(/^v/, ''), tag: release.tag_name, url: release.html_url, body: release.body };
        updateAvailable = latestRelease.version !== currentVersion;
      }
    } catch(e) {
      // GitHub unreachable — still return current info
    }

    res.json({ currentVersion, currentCommit, latestRelease, updateAvailable });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update/apply', (req, res) => {
  const repoRoot = path.join(__dirname, '../..');

  // Streaming response
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  const log = (msg) => res.write(msg + '\n');

  try {
    log('[AegisSight] ─── Starting Update Process ───────────────────');

    // 1. Snapshot DB before anything
    log('[AegisSight] Step 1/4: Creating database snapshot...');
    const { snapName } = createSnapshot('pre-update');
    log(`[AegisSight] ✓ Snapshot saved: ${snapName}`);

    // 2. Store current commit for potential rollback ref
    const prevCommit = getCurrentGitCommit();
    log(`[AegisSight] Current commit: ${prevCommit}`);

    // 3. Pull latest code
    log('[AegisSight] Step 2/4: Pulling latest code from GitHub...');
    const pullOutput = execSync('git pull origin main', { cwd: repoRoot, timeout: 60000 }).toString();
    log(pullOutput);

    const newCommit = getCurrentGitCommit();
    log(`[AegisSight] ✓ Updated to commit: ${newCommit}`);

    // 4. Rebuild & restart containers
    log('[AegisSight] Step 3/4: Rebuilding containers (this may take a minute)...');
    const composeOutput = execSync('docker compose up -d --build', { cwd: repoRoot, timeout: 300000 }).toString();
    log(composeOutput || '[AegisSight] Containers rebuilt and restarted.');

    // 5. Update version in settings
    const newVersion = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(repoRoot, 'master-app/backend/package.json'), 'utf8')).version; }
      catch(e) { return getSetting('app_version'); }
    })();
    setSetting('app_version', newVersion);

    log('[AegisSight] Step 4/4: Finalizing...');
    log(`[AegisSight] ✓ AegisSight updated to v${newVersion} successfully!`);
    log('[AegisSight] ─────────────────────────────────────────────────');
    res.end();
  } catch(err) {
    log(`[AegisSight] ✗ Update failed: ${err.message}`);
    log('[AegisSight] Your previous version is still running. Use Rollback to restore the DB if needed.');
    res.end();
  }
});

app.get('/api/update/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.sqlite'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, f));
        // Parse: TIMESTAMP__LABEL__COMMIT.sqlite
        const parts = f.replace('.sqlite', '').split('__');
        return {
          filename: f,
          label: parts[1] || 'manual',
          commit: parts[2] || 'unknown',
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(files);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update/snapshot', (req, res) => {
  try {
    const { snapName, timestamp, commit } = createSnapshot('manual');
    res.json({ success: true, filename: snapName, timestamp, commit });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/update/rollback', (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename is required' });

  const filePath = path.join(BACKUPS_DIR, path.basename(filename)); // basename prevents path traversal
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Snapshot not found' });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  const log = (msg) => res.write(msg + '\n');

  try {
    log('[AegisSight] ─── Starting Rollback ─────────────────────────');

    // Safety snapshot of current DB
    log('[AegisSight] Creating safety snapshot of current state...');
    const { snapName } = createSnapshot('pre-rollback');
    log(`[AegisSight] ✓ Safety snapshot: ${snapName}`);

    // Restore chosen snapshot
    log(`[AegisSight] Restoring: ${filename}...`);
    fs.copyFileSync(filePath, DB_PATH);
    log('[AegisSight] ✓ Database restored.');

    // Restart backend container so the restored DB is loaded fresh
    try {
      const backendContainer = process.env.BACKEND_CONTAINER || 'aegissight-backend';
      execSync(`docker restart ${backendContainer}`, { timeout: 30000 });
      log('[AegisSight] ✓ Backend container restarted with restored database.');
    } catch(e) {
      log('[AegisSight] ⚠ Could not auto-restart container. Run: docker restart aegissight-backend');
    }

    log('[AegisSight] ✓ Rollback complete.');
    log('[AegisSight] ─────────────────────────────────────────────────');
    res.end();
  } catch(err) {
    log(`[AegisSight] ✗ Rollback failed: ${err.message}`);
    res.end();
  }
});

app.get('/api/agents', (req, res) => {
  const agents = db.prepare('SELECT id, hostname, ip_address, platform, status, last_seen FROM agents').all();
  res.json(agents);
});

app.post('/api/agents', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Agent ID is required' });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashPassword(rawToken);
  try {
    db.prepare(`
      INSERT INTO agents (id, status, token_hash) 
      VALUES (?, 'offline', ?)
    `).run(id, tokenHash);
    res.status(201).json({ success: true, id, token: rawToken });
  } catch (err) {
    res.status(400).json({ error: 'Agent ID may already exist or another error occurred' });
  }
});

app.get('/api/agents/:id', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

app.get('/api/agents/:id/history', (req, res) => {
  const history = db.prepare(`
    SELECT h.*, j.name as job_name
    FROM backup_history h
    JOIN backup_jobs j ON h.job_id = j.id
    WHERE j.agent_id = ?
    ORDER BY h.start_time DESC LIMIT 50
  `).all(req.params.id);
  res.json(history);
});

app.get('/api/agents/:id/jobs', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, d.type as dest_type, d.config as dest_config 
    FROM backup_jobs j 
    LEFT JOIN destinations d ON j.destination_id = d.id 
    WHERE j.agent_id = ?
  `).all(req.params.id);
  res.json(jobs.map(j => ({ ...j, dest_config: j.dest_config ? decrypt(j.dest_config) : null })));
});

app.put('/api/agents/:id/restore', (req, res) => {
  const { history_id, target_paths, restore_dir } = req.body;
  
  if (!history_id) return res.status(400).json({ error: 'history_id is required' });

  const history = db.prepare('SELECT job_id, archive_name FROM backup_history WHERE id = ?').get(history_id);
  if (!history || !history.archive_name) {
    return res.status(400).json({ error: 'Backup history record not found or has no archive name.' });
  }

  const job = db.prepare('SELECT agent_id, destination_id FROM backup_jobs WHERE id = ?').get(history.job_id);
  if (!job || job.agent_id !== req.params.id) {
    return res.status(400).json({ error: 'Job does not belong to this agent.' });
  }

  const destination = db.prepare('SELECT type, config FROM destinations WHERE id = ?').get(job.destination_id);
  if (!destination) {
    return res.status(400).json({ error: 'Destination not found.' });
  }

  const restore_id = `rest-${Date.now()}`;
  
  io.to(`agent_${req.params.id}`).emit('agent:trigger_restore', {
    restore_id,
    history_id,
    archive_name: history.archive_name,
    dest_type: destination.type,
    dest_config: decrypt(destination.config),
    target_paths: target_paths || [],
    restore_dir: restore_dir || '/'
  });

  res.json({ success: true, restore_id });
});

app.post('/api/jobs', (req, res) => {
  const { id, agent_id, name, source_paths, destination_id, backup_type, cron_schedule } = req.body;
  const stmt = db.prepare(`
    INSERT INTO backup_jobs (id, agent_id, name, source_paths, destination_id, backup_type, cron_schedule)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, agent_id, name, JSON.stringify(source_paths), destination_id, backup_type || 'full', cron_schedule);
  res.status(201).json({ success: true });
});

app.get('/api/history', (req, res) => {
  const history = db.prepare(`
    SELECT h.*, j.name as job_name, a.hostname as agent_hostname 
    FROM backup_history h
    JOIN backup_jobs j ON h.job_id = j.id
    JOIN agents a ON j.agent_id = a.id
    ORDER BY h.start_time DESC LIMIT 50
  `).all();
  res.json(history);
});

// Destinations API
app.get('/api/destinations', (req, res) => {
  const destinations = db.prepare('SELECT * FROM destinations').all();
  res.json(destinations.map(d => {
    const rawConfig = decrypt(d.config);
    let parsedConfig = {};
    if (rawConfig) {
      try {
        parsedConfig = JSON.parse(rawConfig);
      } catch (err) {
        console.error(`Failed to parse config for destination ${d.id}`);
      }
    } else {
      console.error(`Decryption failed or returned null for destination ${d.id}`);
    }
    return { ...d, config: parsedConfig };
  }));
});

app.post('/api/destinations', (req, res) => {
  const { id, name, type, config } = req.body;
  const stmt = db.prepare(`INSERT INTO destinations (id, name, type, config) VALUES (?, ?, ?, ?)`);
  stmt.run(id, name, type, encrypt(JSON.stringify(config)));
  res.status(201).json({ success: true });
});

app.post('/api/destinations/verify', async (req, res) => {
  const { type, config } = req.body;
  if (type === 's3') {
    try {
      const client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      });
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  } else {
    // Mock success for other types
    res.json({ success: true });
  }
});

// Dynamic Install Script
app.get('/api/install.sh', (req, res) => {
  const installScript = `#!/bin/bash
# AegisSight Agent Install Script
if [ -z "$AGENT_ID" ] || [ -z "$AGENT_TOKEN" ]; then
  echo "Error: AGENT_ID and AGENT_TOKEN must be set as environment variables."
  exit 1
fi

echo "Installing AegisSight Agent: $AGENT_ID"
mkdir -p /opt/aegissight-agent
cd /opt/aegissight-agent

echo "Setting up Node.js environment..."
npm init -y > /dev/null
npm install socket.io-client axios node-cron archiver @aws-sdk/client-s3 @aws-sdk/lib-storage basic-ftp ssh2-sftp-client dotenv > /dev/null

echo "Downloading agent scripts..."
curl -sL \${AEGISSIGHT_URL:-http://${req.headers.host}}/api/agent-bundle.js -o agent.js
curl -sL \${AEGISSIGHT_URL:-http://${req.headers.host}}/api/backup-bundle.js -o backup.js

echo "Creating .env..."
echo "AEGISSIGHT_URL=\${AEGISSIGHT_URL:-http://${req.headers.host}}" > .env
echo "AGENT_ID=$AGENT_ID" >> .env
echo "AGENT_TOKEN=$AGENT_TOKEN" >> .env

echo "Install complete! Run locally with: node /opt/aegissight-agent/agent.js"
`;
  res.setHeader('Content-Type', 'text/x-shellscript');
  res.send(installScript);
});

app.get('/api/agent-bundle.js', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const agentPath = path.join(__dirname, '../../agent-app/agent.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.send(fs.readFileSync(agentPath, 'utf8'));
});

app.get('/api/backup-bundle.js', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const backupPath = path.join(__dirname, '../../agent-app/backup.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.send(fs.readFileSync(backupPath, 'utf8'));
});

// WebSocket for Agent Communications
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  const session = activeTokens.get(token);
  if (session && session.expiresAt > Date.now()) {
    socket.isDashboard = true;
    return next();
  }

  const agentId = socket.handshake.auth.agent_id;
  if (agentId) {
    const agent = db.prepare('SELECT token_hash FROM agents WHERE id = ?').get(agentId);
    if (agent && agent.token_hash && verifyPassword(token, agent.token_hash)) {
      socket.isAgent = true;
      socket.agentId = agentId;
      return next();
    }
  }

  return next(new Error('Authentication error'));
});

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id, socket.isDashboard ? '[Dashboard]' : '[Agent]', socket.agentId || '');

  if (socket.isAgent && socket.agentId) {
    socket.join(`agent_${socket.agentId}`);
  }

  socket.on('agent:register', (data) => {
    if (!socket.isAgent || socket.agentId !== data.id) return;
    
    // data: { id, hostname, ip_address, platform }
    const stmt = db.prepare(`
      INSERT INTO agents (id, hostname, ip_address, platform, status, last_seen)
      VALUES (@id, @hostname, @ip_address, @platform, 'online', CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET 
        status = 'online',
        ip_address = @ip_address,
        last_seen = CURRENT_TIMESTAMP
    `);
    
    try {
      stmt.run(data);
      console.log(`Agent ${data.hostname} (${data.id}) registered/heartbeat.`);
      // Emit update to dashboard
      io.emit('dashboard:agents_updated');
    } catch(err) {
      console.error('Error registering agent:', err);
    }
  });

  socket.on('agent:telemetry', (data) => {
    if (!socket.isAgent || socket.agentId !== data.id) return;
    
    // data: { id, cpu_load, ram_usage, uptime }
    const stmt = db.prepare(`
      UPDATE agents SET 
        cpu_load = @cpu_load, 
        ram_usage = @ram_usage, 
        uptime = @uptime,
        last_seen = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    try {
      stmt.run(data);
      io.emit('dashboard:agents_updated');
    } catch(err) {
      console.error('Error updating agent telemetry:', err);
    }
  });

  socket.on('agent:job_status', (data) => {
    // data: { history_id, job_id, status, progress, file_size, logs, archive_name }
    const { history_id, job_id, status, progress, file_size, logs, archive_name } = data;
    
    // Verify job belongs to this agent
    if (socket.isAgent) {
       const job = db.prepare('SELECT agent_id FROM backup_jobs WHERE id = ?').get(job_id);
       if (!job || job.agent_id !== socket.agentId) return;
    }
    
    // Check if history exists
    const exists = db.prepare('SELECT id FROM backup_history WHERE id = ?').get(history_id);
    if (!exists) {
      db.prepare(`
        INSERT INTO backup_history (id, job_id, status, progress, file_size, logs, archive_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(history_id, job_id, status, progress, file_size, logs, archive_name || null);
    } else {
      let query = `UPDATE backup_history SET status = ?, progress = ?, logs = ?`;
      const params = [status, progress, logs];
      if (status === 'success' || status === 'failed') {
        query += `, end_time = CURRENT_TIMESTAMP`;
      }
      if (file_size) {
        query += `, file_size = ?`;
        params.push(file_size);
      }
      if (archive_name) {
        query += `, archive_name = ?`;
        params.push(archive_name);
      }
      query += ` WHERE id = ?`;
      params.push(history_id);
      db.prepare(query).run(...params);
    }
    
    io.emit('dashboard:history_updated', data);
  });

  socket.on('agent:restore_status', (data) => {
    // Expected to broadcast restore status to dashboard UI
    io.emit('dashboard:restore_status', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`AegisSight backend running on port ${PORT}`);
});
