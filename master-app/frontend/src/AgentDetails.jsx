import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import {
  Box, Grid, Card, CardContent, Typography, Button, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, useTheme, Tooltip, MenuItem, FormControl, InputLabel, Select, IconButton
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Dns as ServerIcon,
  DeveloperBoard as CpuIcon,
  Memory as MemoryIcon,
  AccessTime as ClockIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  SettingsBackupRestore as RestoreIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';

const API_URL = "/api";

function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
}

function MetricGauge({ label, value, unit, color = 'primary.main', icon }) {
  const pct = parseFloat(value) || 0;
  const isPercentage = unit === '%';
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 1.5 }}>
          {icon}
          <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5, color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
          {value !== null && value !== undefined ? `${value}${unit}` : 'N/A'}
        </Typography>
        {isPercentage && (
          <Box sx={{ width: '100%' }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: pct > 85 ? 'error.main' : pct > 65 ? 'warning.main' : color,
                }
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function AgentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [agent, setAgent] = useState(null);
  const [history, setHistory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState(null);
  
  // Rename states
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // Delete states
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Job creation states
  const [jobOpen, setJobOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    id: '',
    name: 'Scheduled Backup',
    destination_id: '',
    source_paths: '["/var/www/html", "/etc"]',
    exclude_paths: '["/proc", "/sys", "/dev", "/run", "/mnt", "/tmp"]',
    backup_type: 'full',
    cron_schedule: '0 2 * * *',
    schedule_type: 'daily',
    start_time: '02:00',
    weekly_day: '1',
    monthly_day: '1'
  });

  const [dbConfig, setDbConfig] = useState({
    host: 'localhost',
    port: '',
    user: 'root',
    password: '',
    database: ''
  });

  const [restoreModal, setRestoreModal] = useState(null);
  const [restoreForm, setRestoreForm] = useState({ target_paths: '', restore_dir: '' });
  const [activeRestores, setActiveRestores] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    fetchAll();
    const socket = io({ withCredentials: true });
    socketRef.current = socket;
    
    let fetchTimeout;
    const throttledFetch = (callback) => {
      if (fetchTimeout) return;
      callback();
      fetchTimeout = setTimeout(() => {
        fetchTimeout = null;
      }, 2000);
    };

    socket.on('dashboard:agents_updated', () => {
      throttledFetch(() => fetchAll(true));
    });
    socket.on('dashboard:history_updated', () => {
      throttledFetch(() => fetchAll(true));
    });
    socket.on('dashboard:restore_status', (data) => {
      setActiveRestores(prev => ({ ...prev, [data.restore_id]: data }));
    });
    
    return () => { 
      socket.disconnect(); 
      socketRef.current = null; 
      if (fetchTimeout) clearTimeout(fetchTimeout);
    };
  }, [id]);

  const fetchAll = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiFetch(`${API_URL}/agents/${id}/summary`);
      if (res.ok) {
        const data = await res.json();
        if (data.server_time) setServerTime(data.server_time);
        if (data.agent) {
          setAgent(data.agent);
          setNewName(data.agent.name || '');
          if (Array.isArray(data.agent.status_history)) {
            setStatusHistory(data.agent.status_history);
          }
        }
        if (Array.isArray(data.history)) setHistory(data.history);
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
        if (Array.isArray(data.destinations)) {
          setDestinations(data.destinations);
          if (data.destinations.length > 0) {
            setJobForm(f => ({ ...f, destination_id: data.destinations[0].id }));
          }
        }
      }
    } catch(e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAgent = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data);
        setNewName(data.name || '');
      }
    } catch (e) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setHistory(data);
      }
    } catch (e) {}
  };

  const fetchJobs = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}/jobs`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setJobs(data);
      }
    } catch (e) {}
  };

  const fetchDestinations = async () => {
    try {
      const res = await apiFetch(`${API_URL}/destinations`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDestinations(data);
          if (data.length > 0) {
            setJobForm(f => ({ ...f, destination_id: data[0].id }));
          }
        }
      }
    } catch (e) {}
  };

  const fetchStatusHistory = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}/status-history`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setStatusHistory(data);
      }
    } catch (e) {}
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        setRenameOpen(false);
        fetchAgent();
      }
    } catch (err) {
      alert('Failed to rename agent');
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDeleteOpen(false);
        navigate('/');
      } else {
        alert('Failed to delete server agent');
      }
    } catch(err) {
      alert('Delete request failed');
    }
  };

  const handleNewJobClick = () => {
    setJobForm({
      id: '',
      name: 'Scheduled Backup',
      destination_id: destinations[0]?.id || '',
      source_paths: '["/var/www/html", "/etc"]',
      exclude_paths: '["/proc", "/sys", "/dev", "/run", "/mnt", "/tmp"]',
      backup_type: 'full',
      cron_schedule: '0 2 * * *',
      schedule_type: 'daily',
      start_time: '02:00',
      weekly_day: '1',
      monthly_day: '1'
    });
    setDbConfig({
      host: 'localhost',
      port: '',
      user: 'root',
      password: '',
      database: ''
    });
    setJobOpen(true);
  };

  const handleEditJob = (job) => {
    const isDb = (job.backup_type === 'mysql' || job.backup_type === 'postgres');
    let dbConf = { host: 'localhost', port: '', user: 'root', password: '', database: '' };
    let sources = '';
    
    if (isDb) {
      try {
        dbConf = JSON.parse(job.source_paths);
      } catch(e) {}
    } else {
      sources = job.source_paths;
    }

    const cronParts = job.cron_schedule.split(' ');
    let schedType = 'custom';
    let startTime = '02:00';
    let weeklyDay = '1';
    let monthlyDay = '1';

    if (cronParts.length === 5) {
      const [min, hour, dom, mon, dow] = cronParts;
      const pad = (n) => String(n).padStart(2, '0');
      if (dom === '*' && mon === '*' && dow === '*') {
        schedType = 'daily';
        startTime = `${pad(hour)}:${pad(min)}`;
      } else if (dom === '*' && mon === '*' && dow !== '*') {
        schedType = 'weekly';
        startTime = `${pad(hour)}:${pad(min)}`;
        weeklyDay = dow;
      } else if (dom !== '*' && mon === '*' && dow === '*') {
        schedType = 'monthly';
        startTime = `${pad(hour)}:${pad(min)}`;
        monthlyDay = dom;
      }
    }

    setJobForm({
      id: job.id,
      name: job.name,
      destination_id: job.destination_id,
      source_paths: sources,
      exclude_paths: job.exclude_paths || '',
      backup_type: job.backup_type || 'full',
      cron_schedule: job.cron_schedule,
      schedule_type: schedType,
      start_time: startTime,
      weekly_day: weeklyDay,
      monthly_day: monthlyDay
    });

    if (isDb) {
      setDbConfig(dbConf);
    }
    
    setJobOpen(true);
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this backup job?")) return;
    try {
      const res = await apiFetch(`${API_URL}/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAll(true);
      } else {
        alert("Failed to delete backup job");
      }
    } catch(err) {
      alert("Error deleting job");
    }
  };

  const handleRunJob = async (jobId) => {
    try {
      const res = await apiFetch(`${API_URL}/jobs/${jobId}/run`, { method: 'POST' });
      if (res.ok) {
        alert("Backup job triggered successfully!");
        fetchAll(true);
      } else {
        alert("Failed to trigger backup job");
      }
    } catch(err) {
      alert("Error triggering job");
    }
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      const isDb = (jobForm.backup_type === 'mysql' || jobForm.backup_type === 'postgres');
      let parsedSources;
      if (isDb) {
        if (!dbConfig.database) {
          throw new Error('Database name is required for database backups');
        }
        parsedSources = dbConfig;
      } else {
        const rawValue = jobForm.source_paths.trim();
        if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
          parsedSources = JSON.parse(rawValue);
        } else {
          parsedSources = [rawValue];
        }
      }

      let parsedExcludes = [];
      if (!isDb && jobForm.exclude_paths) {
        const rawExclude = jobForm.exclude_paths.trim();
        if (rawExclude !== '') {
          if (rawExclude.startsWith('[') && rawExclude.endsWith(']')) {
            try {
              parsedExcludes = JSON.parse(rawExclude);
            } catch(err) {
              throw new Error('Exclude paths must be a valid JSON array or empty like []');
            }
          } else {
            parsedExcludes = rawExclude.split(',').map(p => p.trim()).filter(p => p.length > 0);
          }
        }
      }

      let finalCron = jobForm.cron_schedule;
      if (jobForm.schedule_type === 'daily') {
        const [hours, minutes] = jobForm.start_time.split(':');
        finalCron = `${parseInt(minutes)} ${parseInt(hours)} * * *`;
      } else if (jobForm.schedule_type === 'weekly') {
        const [hours, minutes] = jobForm.start_time.split(':');
        finalCron = `${parseInt(minutes)} ${parseInt(hours)} * * ${jobForm.weekly_day}`;
      } else if (jobForm.schedule_type === 'monthly') {
        const [hours, minutes] = jobForm.start_time.split(':');
        finalCron = `${parseInt(minutes)} ${parseInt(hours)} ${jobForm.monthly_day} * *`;
      }

      const res = await apiFetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: jobForm.id || `job_${Date.now()}`,
          agent_id: id,
          name: jobForm.name,
          source_paths: parsedSources,
          exclude_paths: parsedExcludes,
          destination_id: jobForm.destination_id,
          backup_type: jobForm.backup_type,
          cron_schedule: finalCron
        })
      });
      if (res.ok) {
        setJobOpen(false);
        setJobForm({
          id: '',
          name: 'Scheduled Backup',
          destination_id: destinations.length > 0 ? destinations[0].id : '',
          source_paths: '["/var/www/html", "/etc"]',
          exclude_paths: '["/proc", "/sys", "/dev", "/run", "/mnt", "/tmp"]',
          backup_type: 'full',
          cron_schedule: '0 2 * * *',
          schedule_type: 'daily',
          start_time: '02:00',
          weekly_day: '1',
          monthly_day: '1'
        });
        fetchJobs();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to schedule job');
      }
    } catch (err) {
      alert(err.message || "Error: Source paths must be a valid JSON array like [\"/etc\", \"/var/log\"]");
    }
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    if (!restoreModal) return;
    try {
      const paths = restoreForm.target_paths.split(',').map(p => p.trim()).filter(Boolean);
      const socketId = socketRef.current?.id;
      const res = await apiFetch(`${API_URL}/agents/${id}/restore`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(socketId ? { 'x-socket-id': socketId } : {})
        },
        body: JSON.stringify({
          history_id: restoreModal.id,
          target_paths: paths,
          restore_dir: restoreForm.restore_dir
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveRestores(prev => ({
          ...prev,
          [data.restore_id]: { status: 'starting', progress: 0, logs: 'Initializing restore...' }
        }));
        setRestoreModal(null);
        setRestoreForm({ target_paths: '', restore_dir: '' });
      } else {
        const err = await res.json();
        alert('Restore failed: ' + err.error);
      }
    } catch(err) {
      alert('Network error while triggering restore.');
    }
  };

  const getStatusChip = (status) => {
    let color = 'default';
    if (status === 'online' || status === 'success' || status === 'active' || status === 'ACTIVE') color = 'success';
    if (status === 'offline' || status === 'failed' || status === 'paused' || status === 'PAUSED') color = 'error';
    if (status === 'running' || status === 'starting') color = 'primary';
    
    return (
      <Chip 
        label={status.toUpperCase()} 
        color={color} 
        size="small" 
        variant="outlined"
        sx={{ fontWeight: 600, borderRadius: '6px' }}
      />
    );
  };

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 2 }}>
      <CircularProgress color="primary" />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading agent telemetry...</Typography>
    </Box>
  );

  if (!agent) return (
    <Box>
      <Button 
        variant="outlined" 
        onClick={() => navigate('/')} 
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Back to Dashboard
      </Button>
      <Alert severity="error">Agent details could not be found or loaded.</Alert>
    </Box>
  );

  const successCount = history.filter(h => h.status === 'success').length;
  const failedCount = history.filter(h => h.status === 'failed').length;

  const renderUptimeTimeline = () => {
    const totalBlocks = 24;
    const historyBlocks = statusHistory || [];
    const paddingCount = Math.max(0, totalBlocks - historyBlocks.length);
    
    const blocks = [];
    for (let i = 0; i < paddingCount; i++) {
      blocks.push({ hour: 'N/A', status: 'unknown' });
    }
    historyBlocks.forEach((h) => {
      let formattedHour = 'Unknown Hour';
      try {
        const dateObj = new Date(h.hour_bucket + 'Z');
        formattedHour = dateObj.toLocaleString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
      blocks.push({ hour: formattedHour, status: h.status });
    });

    return (
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Liveness Timeline (Last 24 Hours)
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: agent.status === 'online' ? 'success.main' : 'error.main' }}>
            {agent.status === 'online' ? '● ONLINE' : '● OFFLINE'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {blocks.map((b, idx) => {
            let color = theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1';
            if (b.status === 'online') color = '#10b981';
            if (b.status === 'offline') color = '#f43f5e';
            
            return (
              <Tooltip key={idx} title={b.status === 'unknown' ? 'No history recorded' : `${b.hour}: ${b.status.toUpperCase()}`} arrow>
                <Box 
                  sx={{ 
                    flex: 1, 
                    height: 24, 
                    bgcolor: color, 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'scaleY(1.2)', opacity: 0.9 }
                  }} 
                />
              </Tooltip>
            );
          })}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, color: 'text.secondary' }}>
          <Typography variant="caption">24h ago</Typography>
          <Typography variant="caption">Now</Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      {/* Back & Actions Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
            startIcon={<ArrowBackIcon />}
            sx={{ borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.3)' : 'rgba(0,0,0,0.15)', color: 'text.primary' }}
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ServerIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
              {agent.name || agent.hostname || 'Enrolled Server'}
            </Typography>
            <IconButton onClick={() => { setNewName(agent.name || ''); setRenameOpen(true); }} size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <EditIcon fontSize="small" />
            </IconButton>
            {getStatusChip(agent.status)}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
            sx={{ fontWeight: 600 }}
          >
            Delete Server
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleNewJobClick}
            sx={{ fontWeight: 600 }}
          >
            Schedule Backup Job
          </Button>
        </Box>
      </Box>

      {/* Server Metadata & Availability Timeline Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={4}>
            
            {/* Metadata column */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Server Specifications
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    AGENT IDENTIFIER (ID)
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {agent.id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    SERVER IP ADDRESS
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', fontFamily: 'monospace' }}>
                    {agent.ip_address || 'Unknown IP'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    OPERATING SYSTEM
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {agent.platform || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    LAST HEARTBEAT
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {agent.last_seen ? formatDistanceToNow(new Date(agent.last_seen + 'Z'), { addSuffix: true }) : 'Never seen'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    MASTER SERVER TIME
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main', fontFamily: 'monospace' }}>
                    {serverTime ? new Date(serverTime).toLocaleString() : 'Loading...'}
                  </Typography>
                </Grid>
              </Grid>
            </Grid>

            {/* Timeline column */}
            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {renderUptimeTimeline()}
            </Grid>

          </Grid>
        </CardContent>
      </Card>

      {/* Live Telemetry Gauges Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricGauge
            label="CPU Load (1m)"
            value={agent.cpu_load}
            unit=""
            color="warning.main"
            icon={<CpuIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricGauge
            label="RAM Usage"
            value={agent.ram_usage}
            unit="%"
            color="primary.main"
            icon={<MemoryIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <MetricGauge
            label="Server Uptime"
            value={formatUptime(agent.uptime)}
            unit=""
            color="success.main"
            icon={<ClockIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricGauge
            label="Success Jobs"
            value={successCount}
            unit=""
            color="success.main"
            icon={<CheckCircleIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <MetricGauge
            label="Failed Jobs"
            value={failedCount}
            unit=""
            color="error.main"
            icon={<CancelIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={1}>
          <MetricGauge
            label="Jobs"
            value={jobs.length}
            unit=""
            color="primary.main"
            icon={<SettingsIcon fontSize="small" />}
          />
        </Grid>
      </Grid>

      {/* Active Restores */}
      {Object.values(activeRestores).length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RestoreIcon color="primary" /> Active Restores
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Progress</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Logs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.values(activeRestores).map(restore => (
                    <TableRow key={restore.restore_id}>
                      <TableCell>{getStatusChip(restore.status)}</TableCell>
                      <TableCell sx={{ minWidth: 150 }}>
                        {restore.status === 'running' || restore.status === 'starting' ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={restore.progress} 
                              sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                            />
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                              {restore.progress}%
                            </Typography>
                          </Box>
                        ) : restore.status === 'success' ? (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>100%</Typography>
                        ) : (
                          <Typography variant="body2">—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.85rem' }}>
                        {restore.logs}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Backup History */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontFamily: "'Outfit', sans-serif" }}>
            <HistoryIcon color="primary" /> Backup History
          </Typography>
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Job Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Started</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Ended</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Log</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map(item => (
                  <TableRow key={item.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{item.job_name}</TableCell>
                    <TableCell>{getStatusChip(item.status)}</TableCell>
                    <TableCell>
                      {item.status === 'running' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 120 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={item.progress} 
                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            {item.progress}%
                          </Typography>
                        </Box>
                      ) : item.status === 'success' ? (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>100%</Typography>
                      ) : (
                        <Typography variant="body2">—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {formatDistanceToNow(new Date(item.start_time + 'Z'), { addSuffix: true })}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {item.end_time ? formatDistanceToNow(new Date(item.end_time + 'Z'), { addSuffix: true }) : '—'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.85rem' }}>
                      {item.logs}
                    </TableCell>
                    <TableCell>
                      {item.status === 'success' && (
                        <Button 
                          variant="contained" 
                          color="primary" 
                          size="small"
                          onClick={() => setRestoreModal(item)}
                          sx={{ py: 0.5 }}
                        >
                          Restore
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No backup history for this agent yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Scheduled Jobs */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontFamily: "'Outfit', sans-serif" }}>
            <SettingsIcon color="primary" /> Scheduled Jobs
          </Typography>
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Schedule</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Details / Targets</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map(job => (
                  <TableRow key={job.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{job.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={job.backup_type ? job.backup_type.toUpperCase() : 'FULL'} 
                        size="small" 
                        color={(job.backup_type === 'mysql' || job.backup_type === 'postgres') ? 'secondary' : 'default'}
                        sx={{ fontWeight: 600, borderRadius: '4px' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', color: 'primary.main' }}>{job.cron_schedule}</TableCell>
                    <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>
                      { (job.backup_type === 'mysql' || job.backup_type === 'postgres') ? (
                        (() => {
                          try {
                            const conf = JSON.parse(job.source_paths);
                            return `Database: "${conf.database}" @ ${conf.host}`;
                          } catch(e) {
                            return 'Database Config';
                          }
                        })()
                      ) : (
                        `Sources: ${job.source_paths} | Excludes: ${job.exclude_paths || '[]'}`
                      )}
                    </TableCell>
                    <TableCell>{getStatusChip(job.is_active ? 'active' : 'paused')}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Run Backup Now">
                        <IconButton size="small" sx={{ color: 'success.main', mr: 1 }} onClick={() => handleRunJob(job.id)}>
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Job">
                        <IconButton size="small" color="primary" onClick={() => handleEditJob(job)} sx={{ mr: 1 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Job">
                        <IconButton size="small" color="error" onClick={() => handleDeleteJob(job.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {jobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No jobs scheduled for this agent.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Restore Dialog Modal */}
      <Dialog 
        open={Boolean(restoreModal)} 
        onClose={() => setRestoreModal(null)}
        PaperProps={{
          sx: {
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
            bgcolor: 'background.paper',
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
          Restore Backup
        </DialogTitle>
        <DialogContent>
          {restoreModal && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Restore files from <strong>{restoreModal.job_name}</strong> created {formatDistanceToNow(new Date(restoreModal.start_time + 'Z'), { addSuffix: true })}.
            </Typography>
          )}
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Restore Directory (Optional)"
              value={restoreForm.restore_dir}
              onChange={e => setRestoreForm({...restoreForm, restore_dir: e.target.value})}
              placeholder="e.g. /opt/aegissight-restore"
              fullWidth
              helperText="Leave blank to overwrite files in their original locations."
            />
            <TextField
              label="Specific Paths to Restore (Optional)"
              value={restoreForm.target_paths}
              onChange={e => setRestoreForm({...restoreForm, target_paths: e.target.value})}
              placeholder="e.g. var/www/html/index.php, etc/nginx"
              fullWidth
              helperText="Comma separated. Note: paths in tar archives typically do not have a leading slash."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setRestoreModal(null)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleRestoreSubmit} variant="contained" color="primary">
            Trigger Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog Modal */}
      <Dialog 
        open={renameOpen} 
        onClose={() => setRenameOpen(false)}
        PaperProps={{
          sx: {
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
            bgcolor: 'background.paper',
            borderRadius: 3,
            minWidth: 320
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
          Rename Server Agent
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleRenameSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Friendly Display Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Production Database Server"
              fullWidth
              autoFocus
              required
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setRenameOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleRenameSubmit} variant="contained" color="primary">
            Save Name
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Backup Job Dialog Modal */}
      <Dialog 
        open={jobOpen} 
        onClose={() => setJobOpen(false)}
        PaperProps={{
          sx: {
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
            bgcolor: 'background.paper',
            borderRadius: 3,
            minWidth: 450
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
          Schedule Backup Job
        </DialogTitle>
        <DialogContent>
          {destinations.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              No storage destinations available. Please configure a destination in the 'Destinations' settings tab first.
            </Alert>
          ) : (
            <Box component="form" onSubmit={handleJobSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              <TextField
                label="Job Name"
                value={jobForm.name}
                onChange={e => setJobForm({ ...jobForm, name: e.target.value })}
                placeholder="e.g. Daily Backup"
                fullWidth
                required
              />

              <FormControl fullWidth>
                <InputLabel id="dest-select-label">Target Storage Destination</InputLabel>
                <Select
                  labelId="dest-select-label"
                  label="Target Storage Destination"
                  value={jobForm.destination_id}
                  onChange={e => setJobForm({ ...jobForm, destination_id: e.target.value })}
                  required
                >
                  {destinations.map(d => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name} [{d.type.toUpperCase()}]
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="type-select-label">Backup Type</InputLabel>
                <Select
                  labelId="type-select-label"
                  label="Backup Type"
                  value={jobForm.backup_type}
                  onChange={e => setJobForm({ ...jobForm, backup_type: e.target.value })}
                  required
                >
                  <MenuItem value="full">Full Archive (Files/Folders)</MenuItem>
                  <MenuItem value="incremental">Incremental (Files/Folders)</MenuItem>
                  <MenuItem value="mysql">MySQL Database Dump</MenuItem>
                  <MenuItem value="postgres">PostgreSQL Database Dump</MenuItem>
                </Select>
              </FormControl>

              { (jobForm.backup_type === 'mysql' || jobForm.backup_type === 'postgres') ? (
                <>
                  <TextField
                    label="DB Host"
                    fullWidth
                    value={dbConfig.host}
                    onChange={e => setDbConfig({...dbConfig, host: e.target.value})}
                    required
                  />
                  <TextField
                    label="DB Port"
                    placeholder={jobForm.backup_type === 'mysql' ? '3306' : '5432'}
                    fullWidth
                    value={dbConfig.port}
                    onChange={e => setDbConfig({...dbConfig, port: e.target.value})}
                  />
                  <TextField
                    label="DB Username"
                    fullWidth
                    value={dbConfig.user}
                    onChange={e => setDbConfig({...dbConfig, user: e.target.value})}
                    required
                  />
                  <TextField
                    label="DB Password"
                    type="password"
                    fullWidth
                    value={dbConfig.password}
                    onChange={e => setDbConfig({...dbConfig, password: e.target.value})}
                  />
                  <TextField
                    label="Database Name"
                    fullWidth
                    value={dbConfig.database}
                    onChange={e => setDbConfig({...dbConfig, database: e.target.value})}
                    required
                  />
                </>
              ) : (
                <>
                  <TextField 
                    label="Source Paths (JSON Array)" 
                    fullWidth
                    value={jobForm.source_paths} 
                    onChange={e => setJobForm({...jobForm, source_paths: e.target.value})} 
                    required 
                    helperText="e.g. ['/'] for full server, or ['/var/www/html']"
                    inputProps={{ style: { fontFamily: 'monospace' } }}
                  />

                  <TextField 
                    label="Exclude Paths (JSON Array)" 
                    fullWidth
                    value={jobForm.exclude_paths} 
                    onChange={e => setJobForm({...jobForm, exclude_paths: e.target.value})} 
                    helperText="e.g. ['/proc', '/sys', '/dev', '/run', '/mnt', '/tmp']"
                    inputProps={{ style: { fontFamily: 'monospace' } }}
                  />
                </>
              )}

              <FormControl fullWidth>
                <InputLabel id="freq-select-label">Schedule Frequency</InputLabel>
                <Select
                  labelId="freq-select-label"
                  label="Schedule Frequency"
                  value={jobForm.schedule_type}
                  onChange={e => setJobForm({ ...jobForm, schedule_type: e.target.value })}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="custom">Custom (Cron)</MenuItem>
                </Select>
              </FormControl>

              {jobForm.schedule_type !== 'custom' && (
                <TextField
                  label="Start Time"
                  type="time"
                  fullWidth
                  value={jobForm.start_time}
                  onChange={e => setJobForm({ ...jobForm, start_time: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                />
              )}

              {jobForm.schedule_type === 'weekly' && (
                <FormControl fullWidth>
                  <InputLabel id="weekday-select-label">Day of Week</InputLabel>
                  <Select
                    labelId="weekday-select-label"
                    label="Day of Week"
                    value={jobForm.weekly_day}
                    onChange={e => setJobForm({ ...jobForm, weekly_day: e.target.value })}
                  >
                    <MenuItem value="1">Monday</MenuItem>
                    <MenuItem value="2">Tuesday</MenuItem>
                    <MenuItem value="3">Wednesday</MenuItem>
                    <MenuItem value="4">Thursday</MenuItem>
                    <MenuItem value="5">Friday</MenuItem>
                    <MenuItem value="6">Saturday</MenuItem>
                    <MenuItem value="0">Sunday</MenuItem>
                  </Select>
                </FormControl>
              )}

              {jobForm.schedule_type === 'monthly' && (
                <FormControl fullWidth>
                  <InputLabel id="monthday-select-label">Day of Month</InputLabel>
                  <Select
                    labelId="monthday-select-label"
                    label="Day of Month"
                    value={jobForm.monthly_day}
                    onChange={e => setJobForm({ ...jobForm, monthly_day: e.target.value })}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <MenuItem key={day} value={String(day)}>{day}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {jobForm.schedule_type === 'custom' && (
                <TextField
                  label="Cron Schedule"
                  value={jobForm.cron_schedule}
                  onChange={e => setJobForm({ ...jobForm, cron_schedule: e.target.value })}
                  placeholder="e.g. 0 2 * * *"
                  helperText="Standard cron syntax: minute hour day-of-month month day-of-week"
                  fullWidth
                  required
                />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setJobOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleJobSubmit} 
            variant="contained" 
            color="primary"
            disabled={destinations.length === 0}
          >
            Schedule Job
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog Modal */}
      <Dialog 
        open={deleteOpen} 
        onClose={() => setDeleteOpen(false)}
        PaperProps={{
          sx: {
            border: `1px solid ${theme => theme.palette.mode === 'dark' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
            bgcolor: 'background.paper',
            borderRadius: 3,
            minWidth: 320
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
          Delete Server Agent
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Are you sure you want to permanently delete this server agent (<strong>{id}</strong>) and all its scheduled backup jobs, history, downtime logs, and metrics?
          </Typography>
          <Typography variant="body2" color="error.main" sx={{ mt: 2, fontWeight: 600 }}>
            This action is irreversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDeleteSubmit} variant="contained" color="error">
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
