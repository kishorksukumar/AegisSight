require('dotenv').config();
const { io } = require("socket.io-client");
const axios = require("axios");
const os = require("os");
const cron = require("node-cron");
const { performBackup } = require("./backup");

const AEGISSIGHT_URL = process.env.AEGISSIGHT_URL || "http://localhost:4000";
const AGENT_ID = process.env.AGENT_ID || `agent-${os.hostname()}`;

const socket = io(AEGISSIGHT_URL);

let currentJobs = [];
let cronTasks = {};
let telemetryInterval;

socket.on("connect", () => {
  console.log("Connected to AegisSight:", AEGISSIGHT_URL);
  
  socket.emit("agent:register", {
    id: AGENT_ID,
    hostname: os.hostname(),
    ip_address: Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || '127.0.0.1',
    platform: os.platform()
  });

  fetchJobs();
  
  if (telemetryInterval) clearInterval(telemetryInterval);
  telemetryInterval = setInterval(() => {
    const ramTotal = os.totalmem();
    const ramFree = os.freemem();
    const cpuLoad = os.loadavg()[0].toFixed(2);
    const ramUsage = ((ramTotal - ramFree) / ramTotal * 100).toFixed(2);
    const uptime = os.uptime();
    
    socket.emit('agent:telemetry', {
      id: AGENT_ID,
      cpu_load: cpuLoad,
      ram_usage: ramUsage,
      uptime: uptime
    });
  }, 10000);
});

socket.on("disconnect", () => {
  console.log("Disconnected from AegisSight");
  if (telemetryInterval) clearInterval(telemetryInterval);
});

async function fetchJobs() {
  try {
    const res = await axios.get(`${AEGISSIGHT_URL}/api/agents/${AGENT_ID}/jobs`);
    currentJobs = res.data;
    console.log(`Fetched ${currentJobs.length} backup jobs.`);
    scheduleJobs();
  } catch(err) {
    console.error("Failed to fetch jobs:", err.message);
  }
}

function scheduleJobs() {
  // Clear existing
  for (const taskId in cronTasks) {
    cronTasks[taskId].stop();
  }
  cronTasks = {};

  currentJobs.forEach(job => {
    if (!job.is_active) return;
    
    console.log(`Scheduling job '${job.name}' with cron: ${job.cron_schedule}`);
    const task = cron.schedule(job.cron_schedule, () => {
      console.log(`Executing Cron Job: ${job.name}`);
      executeJob(job);
    });
    
    cronTasks[job.id] = task;
  });
}

async function executeJob(job) {
  const historyId = `hist-${Date.now()}`;
  
  // Start job
  socket.emit('agent:job_status', {
    history_id: historyId,
    job_id: job.id,
    status: 'running',
    progress: 0,
    logs: 'Started backup job'
  });

  try {
    await performBackup(job, (progressEvents) => {
      socket.emit('agent:job_status', {
        history_id: historyId,
        job_id: job.id,
        status: 'running',
        progress: progressEvents.percentage || 50,
        logs: progressEvents.logs
      });
    });

    socket.emit('agent:job_status', {
      history_id: historyId,
      job_id: job.id,
      status: 'success',
      progress: 100,
      logs: 'Backup completed successfully'
    });
    console.log(`Job ${job.name} completed successfully.`);
    
  } catch (error) {
    console.error(`Job ${job.name} failed:`, error);
    socket.emit('agent:job_status', {
      history_id: historyId,
      job_id: job.id,
      status: 'failed',
      progress: 0,
      logs: `Error: ${error.message}`
    });
  }
}

// Debug manual trigger listener
socket.on("agent:trigger_job", (jobId) => {
  const job = currentJobs.find(j => j.id === jobId);
  if (job) executeJob(job);
});
