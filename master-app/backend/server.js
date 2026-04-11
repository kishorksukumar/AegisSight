const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

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

// REST API
app.get('/api/agents', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents').all();
  res.json(agents);
});

app.get('/api/agents/:id/jobs', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, d.type as dest_type, d.config as dest_config 
    FROM backup_jobs j 
    LEFT JOIN destinations d ON j.destination_id = d.id 
    WHERE j.agent_id = ?
  `).all(req.params.id);
  res.json(jobs);
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
  res.json(destinations.map(d => ({ ...d, config: JSON.parse(d.config) })));
});

app.post('/api/destinations', (req, res) => {
  const { id, name, type, config } = req.body;
  const stmt = db.prepare(`INSERT INTO destinations (id, name, type, config) VALUES (?, ?, ?, ?)`);
  stmt.run(id, name, type, JSON.stringify(config));
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
