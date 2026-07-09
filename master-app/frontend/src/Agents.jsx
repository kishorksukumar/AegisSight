import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem,
  Select, InputLabel, FormControl, Grid, Paper, IconButton, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Schedule as ScheduleIcon,
  Dns as ServerIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const API_URL = "/api";

export default function Agents() {
  const navigate = useNavigate();
  const [showInstall, setShowInstall] = useState(false);
  const [agentId, setAgentId] = useState(`agent_${Math.floor(Math.random()*10000)}`);
  const [agentToken, setAgentToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const [agents, setAgents] = useState([]);
  const [destinations, setDestinations] = useState([]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState('');
  const [newName, setNewName] = useState('');

  // Delete states
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  
  const [jobForm, setJobForm] = useState({
    id: `job_${Date.now()}`,
    name: 'Daily Backup',
    agent_id: '',
    destination_id: '',
    source_paths: '["/var/www/html", "/etc"]',
    backup_type: 'full',
    cron_schedule: '0 2 * * *'
  });

  const curlCommand = agentToken ? `export AGENT_ID=${agentId}\nexport AGENT_TOKEN=${agentToken}\ncurl -fsSL ${window.location.protocol}//${window.location.host}/api/install.sh | bash` : '';

  useEffect(() => {
    fetchData();
  }, []);

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
        showToast('Server renamed successfully');
        fetchData();
      } else {
        showToast('Failed to rename server', 'error');
      }
    } catch(err) {
      showToast('Rename request failed', 'error');
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${deleteTargetId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDeleteOpen(false);
        showToast('Server deleted successfully');
        fetchData();
      } else {
        showToast('Failed to delete server', 'error');
      }
    } catch(err) {
      showToast('Delete request failed', 'error');
    }
  };

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const getStatusChip = (status) => {
    let color = 'default';
    if (status === 'online' || status === 'success' || status === 'active') color = 'success';
    if (status === 'offline' || status === 'failed' || status === 'paused') color = 'error';
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

  const fetchData = async () => {
    try {
      const [aRes, dRes] = await Promise.all([
        apiFetch(`${API_URL}/agents`),
        apiFetch(`${API_URL}/destinations`)
      ]);
      const aData = await aRes.json();
      const dData = await dRes.json();
      
      setAgents(aData);
      setDestinations(dData);
      
      if (aData.length > 0 && !jobForm.agent_id) setJobForm(f => ({...f, agent_id: aData[0].id}));
      if (dData.length > 0 && !jobForm.destination_id) setJobForm(f => ({...f, destination_id: dData[0].id}));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEnrollment = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId })
      });
      const data = await res.json();
      if (res.ok) {
        setAgentToken(data.token);
        showToast('Agent enrolled. Please install using the command below.');
        fetchData();
      } else {
        showToast(data.error || 'Enrollment failed', 'error');
      }
    } catch(err) {
      showToast("Failed to enroll agent.", "error");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    showToast('Installation command copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      JSON.parse(jobForm.source_paths); // Validate JSON array
      const res = await apiFetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...jobForm, source_paths: JSON.parse(jobForm.source_paths) })
      });
      if (res.ok) {
        showToast("Job Scheduled successfully!");
        setJobForm({ ...jobForm, id: `job_${Date.now()}` });
      } else {
        const errData = await res.json();
        showToast(errData.error || "Failed to schedule job.", "error");
      }
    } catch(err) {
      showToast("Error: Source paths must be a valid JSON array like [\"/etc\", \"/var/log\"]", "error");
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
          Server Agent Manager
        </Typography>
        <Button
          variant="contained"
          color={showInstall ? "secondary" : "primary"}
          startIcon={showInstall ? <CloseIcon /> : <AddIcon />}
          onClick={() => { setShowInstall(!showInstall); setAgentToken(''); }}
          sx={{ fontWeight: 600 }}
        >
          {showInstall ? 'Close Installer' : 'Add New Server'}
        </Button>
      </Box>

      {/* Enroll/Install Section */}
      {showInstall && (
        <Card sx={{ mb: 4, borderColor: 'primary.main', borderStyle: 'solid', borderWidth: 1 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700, mb: 1 }}>
              Install New Agent
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              To securely connect a server, generate a unique enrollment token. This token is required to authenticate the new agent.
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField 
                label="Agent Identifier" 
                variant="outlined" 
                size="small"
                value={agentId} 
                onChange={e => setAgentId(e.target.value.replace(/\s+/g, '-'))} 
                disabled={!!agentToken}
                sx={{ minWidth: 250 }}
              />
              {!agentToken && (
                <Button variant="contained" color="primary" onClick={handleEnrollment}>
                  Generate Token
                </Button>
              )}
            </Box>

            {agentToken && (
              <Paper sx={{ p: 2.5, bgcolor: 'background.default', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mb: 1, fontWeight: 600 }}>
                  Run this command on your destination server (requires sudo/root):
                </Typography>
                <Box 
                  component="code" 
                  sx={{ 
                    display: 'block', 
                    color: 'success.main', 
                    fontFamily: 'monospace', 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-all', 
                    pr: 5,
                    fontSize: '0.9rem'
                  }}
                >
                  {curlCommand}
                </Box>
                <IconButton 
                  onClick={handleCopy} 
                  sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                >
                  {copied ? <CheckIcon color="success" /> : <CopyIcon fontSize="small" />}
                </IconButton>
              </Paper>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enrolled Server Agents List */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontFamily: "'Outfit', sans-serif" }}>
            <ServerIcon color="primary" /> Enrolled Server Agents
          </Typography>
          {agents.length === 0 ? (
            <Alert severity="info">
              No servers enrolled yet. Click 'Add New Server' above to generate an installation command.
            </Alert>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Display Name / ID</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Hostname</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>IP Address</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Platform</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agents.map(a => (
                    <TableRow key={a.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {a.name || 'Set Friendly Name'}
                          </Typography>
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setRenameTargetId(a.id);
                              setNewName(a.name || '');
                              setRenameOpen(true);
                            }}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                          >
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          ID: {a.id}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{a.hostname || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{a.ip_address || '—'}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>{a.platform || '—'}</TableCell>
                      <TableCell>{getStatusChip(a.status)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            variant="outlined" 
                            size="small" 
                            startIcon={<ViewIcon />} 
                            onClick={() => navigate(`/agents/${a.id}`)}
                            sx={{ fontWeight: 600 }}
                          >
                            Details
                          </Button>
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => {
                              setDeleteTargetId(a.id);
                              setDeleteOpen(true);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Backup Scheduling Form */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon color="primary" /> Schedule Backup Job
          </Typography>
          
          {agents.length === 0 ? (
            <Alert severity="warning">No active agents available. Please enroll and install an agent first.</Alert>
          ) : destinations.length === 0 ? (
            <Alert severity="warning">No destinations available. Please configure a storage destination first.</Alert>
          ) : (
            <Box component="form" onSubmit={handleJobSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="agent-select-label">Select Agent</InputLabel>
                    <Select
                      labelId="agent-select-label"
                      label="Select Agent"
                      value={jobForm.agent_id}
                      onChange={e => setJobForm({...jobForm, agent_id: e.target.value})}
                    >
                      {agents.map(a => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.hostname || a.id} ({a.id})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Job Name" 
                    fullWidth
                    value={jobForm.name} 
                    onChange={e => setJobForm({...jobForm, name: e.target.value})} 
                    required 
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="dest-select-label">Target Destination</InputLabel>
                    <Select
                      labelId="dest-select-label"
                      label="Target Destination"
                      value={jobForm.destination_id}
                      onChange={e => setJobForm({...jobForm, destination_id: e.target.value})}
                    >
                      {destinations.map(d => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name} [{d.type.toUpperCase()}]
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="type-select-label">Backup Type</InputLabel>
                    <Select
                      labelId="type-select-label"
                      label="Backup Type"
                      value={jobForm.backup_type}
                      onChange={e => setJobForm({...jobForm, backup_type: e.target.value})}
                    >
                      <MenuItem value="full">Full Archive</MenuItem>
                      <MenuItem value="incremental">Incremental (tar --listed-incremental)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Source Paths (JSON Array)" 
                    fullWidth
                    value={jobForm.source_paths} 
                    onChange={e => setJobForm({...jobForm, source_paths: e.target.value})} 
                    required 
                    inputProps={{ style: { fontFamily: 'monospace' } }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Cron Schedule (e.g. 0 2 * * *)" 
                    fullWidth
                    value={jobForm.cron_schedule} 
                    onChange={e => setJobForm({...jobForm, cron_schedule: e.target.value})} 
                    required 
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button type="submit" variant="contained" color="primary" size="large" sx={{ fontWeight: 700 }}>
                    Schedule Job
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Toast Notifications */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert 
          onClose={() => setToast({ ...toast, open: false })} 
          severity={toast.severity} 
          sx={{ width: '100%', borderRadius: '8px' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

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
              placeholder="e.g. Database Server"
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
            Are you sure you want to permanently delete this server agent (<strong>{deleteTargetId}</strong>) and all its scheduled backup jobs, history, downtime logs, and metrics?
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
