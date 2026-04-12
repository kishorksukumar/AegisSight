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
const activeTokens = new Set();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username || 'admin');
  if (user && verifyPassword(password, user.password_hash)) {
    const token = crypto.randomBytes(32).toString('hex');
    activeTokens.add(token);
    res.json({ token, username: user.username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

function verifyToken(req, res, next) {
  const openPaths = ['/api/login', '/api/install.sh', '/api/agent-bundle.js', '/api/backup-bundle.js'];
  // Allow open dashboard access or agent API fetching bypassing token check for agents
  if (openPaths.includes(req.path) || req.path.match(/^\/api\/agents\/[^\/]+\/jobs$/)) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  if (!activeTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized Session' });
  }
  next();
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
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  setSetting('domain', domain);
  res.json({ success: true, domain });
});

app.post('/api/settings/email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
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
    // Run certbot inside the certbot container (or directly if not in Docker)
    const certbotCmd = process.env.CERTBOT_CONTAINER
      ? `docker exec ${process.env.CERTBOT_CONTAINER} certbot certonly --webroot -w /var/www/certbot -d ${domain} --email ${email} --agree-tos --non-interactive --force-renewal`
      : `certbot certonly --webroot -w /var/www/certbot -d ${domain} --email ${email} --agree-tos --non-interactive --force-renewal`;

    res.write('[AegisSight] Running Certbot...\n');
    const output = execSync(certbotCmd, { timeout: 120000 }).toString();
    res.write(output + '\n');

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

app.get('/api/agents', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents').all();
  res.json(agents);
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
  res.json(destinations.map(d => ({ ...d, config: JSON.parse(decrypt(d.config)) })));
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
AGENT_ID=$1
if [ -z "$AGENT_ID" ]; then
  echo "Error: AGENT_ID is required as the first argument."
  exit 1
fi

echo "Installing AegisSight Agent: $AGENT_ID"
mkdir -p /opt/aegissight-agent
cd /opt/aegissight-agent

echo "Setting up Node.js environment..."
npm init -y > /dev/null
npm install socket.io-client axios node-cron archiver @aws-sdk/client-s3 @aws-sdk/lib-storage basic-ftp ssh2-sftp-client dotenv > /dev/null

echo "Downloading agent scripts..."
curl -sL http://${req.headers.host}/api/agent-bundle.js -o agent.js
curl -sL http://${req.headers.host}/api/backup-bundle.js -o backup.js

echo "Creating .env..."
echo "AEGISSIGHT_URL=http://${req.headers.host}" > .env
echo "AGENT_ID=$AGENT_ID" >> .env

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
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  socket.on('agent:register', (data) => {
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
    // data: { history_id, job_id, status, progress, file_size, logs }
    const { history_id, job_id, status, progress, file_size, logs } = data;
    
    // Check if history exists
    const exists = db.prepare('SELECT id FROM backup_history WHERE id = ?').get(history_id);
    if (!exists) {
      db.prepare(`
        INSERT INTO backup_history (id, job_id, status, progress, file_size, logs)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(history_id, job_id, status, progress, file_size, logs);
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
      query += ` WHERE id = ?`;
      params.push(history_id);
      db.prepare(query).run(...params);
    }
    
    io.emit('dashboard:history_updated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`AegisSight backend running on port ${PORT}`);
});
