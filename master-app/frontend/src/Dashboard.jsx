import React, { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Button, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, CircularProgress, useTheme, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import {
  Dns as ServerIcon,
  Analytics as ActivityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AccessTime as ClockIcon,
  Autorenew as AutorenewIcon,
  Edit as EditIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const API_URL = "/api";

function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Dashboard() {
  const [agents, setAgents] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ online: 0, jobsRunning: 0, totalSuccess: 0, totalFailed: 0, downtimeCount: 0 });
  const navigate = useNavigate();
  const theme = useTheme();

  // Rename states
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState('');
  const [newName, setNewName] = useState('');

  const [downtimeEvents, setDowntimeEvents] = useState([]);

  function formatDowntimeDuration(start, end) {
    const startTime = new Date(start + 'Z');
    const endTime = end ? new Date(end + 'Z') : new Date();
    const diffMs = endTime - startTime;
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ${diffSecs % 60}s`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  }

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${API_URL}/agents/${renameTargetId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        setRenameOpen(false);
        fetchData();
      }
    } catch(err) {
      console.error(err);
    }
  };

  const renderMiniTimeline = (statusHistory, currentStatus) => {
    const totalBlocks = 24;
    const historyBlocks = statusHistory || [];
    const paddingCount = Math.max(0, totalBlocks - historyBlocks.length);
    const blocks = [];
    for (let i = 0; i < paddingCount; i++) {
      blocks.push({ status: 'unknown', hour: 'N/A' });
    }
    historyBlocks.forEach((h) => {
      let formattedHour = 'N/A';
      try {
        const dateObj = new Date(h.hour_bucket + 'Z');
        formattedHour = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
      blocks.push({ status: h.status, hour: formattedHour });
    });

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
        {blocks.map((b, idx) => {
          let color = theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1';
          if (b.status === 'online') color = '#10b981';
          if (b.status === 'offline') color = '#ef4444';
          return (
            <Tooltip key={idx} title={b.status === 'unknown' ? 'No data' : `${b.hour}: ${b.status.toUpperCase()}`} arrow>
              <Box sx={{ width: 6, height: 16, bgcolor: color, borderRadius: '1.5px' }} />
            </Tooltip>
          );
        })}
      </Box>
    );
  };

  useEffect(() => {
    fetchData();
    const socket = io({ withCredentials: true });
    
    let fetchTimeout;
    const throttledFetch = () => {
      if (fetchTimeout) return;
      fetchData();
      fetchTimeout = setTimeout(() => {
        fetchTimeout = null;
      }, 2000);
    };

    socket.on('dashboard:agents_updated', throttledFetch);
    socket.on('dashboard:history_updated', throttledFetch);
    
    socket.on('dashboard:metrics_updated', (data) => {
      setAgents(prev => prev.map(a => 
        a.id === data.id ? { 
          ...a, 
          uptime: data.uptime,
          last_seen: new Date().toISOString().replace('T', ' ').slice(0, 19) 
        } : a
      ));
    });

    return () => {
      socket.disconnect();
      if (fetchTimeout) clearTimeout(fetchTimeout);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const agentsRes = await apiFetch(`${API_URL}/agents`);
      if (!agentsRes.ok) return;
      const agentsData = await agentsRes.json();
      if (!Array.isArray(agentsData)) return;
      setAgents(agentsData);

      const histRes = await apiFetch(`${API_URL}/history`);
      if (!histRes.ok) return;
      const histData = await histRes.json();
      if (!Array.isArray(histData)) return;
      setHistory(histData);

      let downCount = 0;
      try {
        const downRes = await apiFetch(`${API_URL}/downtime`);
        if (downRes.ok) {
          const downData = await downRes.json();
          if (Array.isArray(downData)) {
            setDowntimeEvents(downData);
            downCount = downData.length;
          }
        }
      } catch (e) {}

      setStats({
        online: agentsData.filter(a => a.status === 'online').length,
        jobsRunning: histData.filter(h => h.status === 'running').length,
        totalSuccess: histData.filter(h => h.status === 'success').length,
        totalFailed: histData.filter(h => h.status === 'failed').length,
        downtimeCount: downCount
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status) => {
    let color = 'default';
    if (status === 'online' || status === 'success') color = 'success';
    if (status === 'offline' || status === 'failed') color = 'error';
    if (status === 'running') color = 'primary';
    
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

  return (
    <Box>
      {/* KPI Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
              <ServerIcon sx={{ fontSize: 36, color: 'primary.main' }} />
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Active Agents
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
                  {stats.online}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
              <ActivityIcon sx={{ fontSize: 36, color: '#eab308' }} />
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Running Jobs
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
                  {stats.jobsRunning}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
              <CheckCircleIcon sx={{ fontSize: 36, color: '#10b981' }} />
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Successful Backups
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
                  {stats.totalSuccess}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
              <CancelIcon sx={{ fontSize: 36, color: 'error.main' }} />
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Failed Backups
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
                  {stats.totalFailed}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card 
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.02)' } }}
            onClick={() => navigate('/events')}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
              <WarningIcon sx={{ fontSize: 36, color: '#ef4444' }} />
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Server Outages
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#ef4444' }}>
                  {stats.downtimeCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Servers Overview Table */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
                Server Overview
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                Click any server to view detailed metrics, CPU/RAM telemetry, and backup history.
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              onClick={fetchData} 
              startIcon={<AutorenewIcon />}
              sx={{ borderColor: 'primary.main', color: 'primary.main' }}
            >
              Refresh
            </Button>
          </Box>
          
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Hostname</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Liveness (24h)</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Uptime</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Last Backup</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Last Seen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={30} />
                      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                        Loading server agents...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {agents.map(agent => {
                      const agentHistory = history.filter(h => h.agent_hostname === agent.hostname);
                      const lastBackup = agentHistory[0];
                      return (
                        <TableRow
                          key={agent.id}
                          hover
                          onClick={() => navigate(`/agents/${agent.id}`)}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.04) !important' : 'rgba(0, 0, 0, 0.02) !important'
                            }
                          }}
                        >
                          <TableCell sx={{ py: 2 }} onClick={(e) => e.stopPropagation()}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ fontWeight: 600, color: 'primary.main', cursor: 'pointer', '&:hover': { decoration: 'underline' } }}
                                onClick={() => navigate(`/agents/${agent.id}`)}
                              >
                                {agent.name || agent.hostname || 'Enrolled Server'}
                              </Typography>
                              <IconButton 
                                size="small" 
                                onClick={() => {
                                  setRenameTargetId(agent.id);
                                  setNewName(agent.name || '');
                                  setRenameOpen(true);
                                }}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                              >
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              ({agent.id})
                            </Typography>
                          </TableCell>
                          <TableCell>{getStatusChip(agent.status)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {renderMiniTimeline(agent.status_history || [], agent.status)}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ClockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="body2">{formatUptime(agent.uptime)}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {lastBackup ? getStatusChip(lastBackup.status) : (
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>No backups yet</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {agent.last_seen ? formatDistanceToNow(new Date(agent.last_seen + 'Z'), { addSuffix: true }) : 'Never'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {agents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          No agents connected yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Recent Global Backup Activity */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", mb: 3, color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
            Recent Backup Activity
          </Typography>
          
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Job Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Agent</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Started</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={30} />
                      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                        Loading backup activity...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {history.slice(0, 10).map(item => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ py: 2, fontWeight: 600 }}>{item.job_name}</TableCell>
                        <TableCell 
                          sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 500 }}
                          onClick={() => {
                            const agent = agents.find(a => a.hostname === item.agent_hostname);
                            if (agent) navigate(`/agents/${agent.id}`);
                          }}
                        >
                          {item.agent_hostname}
                        </TableCell>
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
                          ) : item.status === 'failed' ? (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>
                          ) : (
                            <Typography variant="body2">{item.progress}%</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>
                          {formatDistanceToNow(new Date(item.start_time + 'Z'), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          No backup history yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Rename Dialog Modal */}
      <Dialog 
        open={renameOpen} 
        onClose={() => setRenameOpen(false)}
        PaperProps={{
          sx: {
            border: `1px solid ${theme => theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
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
    </Box>
  );
}
