import React, { useEffect, useState } from 'react';
import { apiFetch } from './api';
import {
  Box, Card, CardContent, Typography, Button, TextField, MenuItem,
  Select, InputLabel, FormControl, Grid, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Alert, CircularProgress, useTheme,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
  Power as PowerIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

const API_URL = '/api';

export default function Destinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const theme = useTheme();
  
  const defaultS3 = { bucket: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' };
  const defaultFtp = { host: '', user: '', password: '' };
  const defaultSftp = { host: '', port: '22', user: '', password: '' };
  
  const [formData, setFormData] = useState({ id: `dest_${Date.now()}`, name: '', type: 's3' });
  const [fields, setFields] = useState(defaultS3);
  
  const [verifyStatus, setVerifyStatus] = useState('idle'); // idle, verifying, success, error
  const [verifyError, setVerifyError] = useState('');

  // Delete states
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_URL}/destinations`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDestinations(data);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setDeleteError('');
    try {
      const res = await apiFetch(`${API_URL}/destinations/${deleteTargetId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDeleteOpen(false);
        fetchDestinations();
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete storage destination.');
      }
    } catch(err) {
      setDeleteError('Network error while deleting destination.');
    }
  };

  const handleVerify = async () => {
    setVerifyStatus('verifying');
    setVerifyError('');
    try {
      const res = await apiFetch(`${API_URL}/destinations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: formData.type, config: fields })
      });
      const data = await res.json();
      if (data.success) {
        setVerifyStatus('success');
      } else {
        setVerifyStatus('error');
        setVerifyError(data.error || 'Verification failed');
      }
    } catch (err) {
      setVerifyStatus('error');
      setVerifyError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (verifyStatus !== 'success') {
      alert("Please successfully verify the connection before saving.");
      return;
    }
    try {
      await apiFetch(`${API_URL}/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, config: fields })
      });
      setShowForm(false);
      resetForm();
      fetchDestinations();
    } catch(err) {
      alert("Failed to save destination!");
    }
  };

  const resetForm = () => {
    setFormData({ id: `dest_${Date.now()}`, name: '', type: 's3' });
    setFields(defaultS3);
    setVerifyStatus('idle');
  }

  const handleTypeChange = (e) => {
    const type = e.target.value;
    setFormData({...formData, type});
    setVerifyStatus('idle');
    if (type === 's3') setFields(defaultS3);
    if (type === 'ftp') setFields(defaultFtp);
    if (type === 'sftp') setFields(defaultSftp);
    if (type === 'scp') setFields(defaultSftp);
  };

  const handleFieldChange = (key, value) => {
    setFields({...fields, [key]: value});
    setVerifyStatus('idle'); // any change resets verify status
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
          Storage Destinations
        </Typography>
        <Button
          variant="contained"
          color={showForm ? "secondary" : "primary"}
          startIcon={showForm ? <CloseIcon /> : <AddIcon />}
          onClick={() => { setShowForm(!showForm); resetForm(); }}
          sx={{ fontWeight: 600 }}
        >
          {showForm ? 'Close Form' : 'Add Destination'}
        </Button>
      </Box>

      {/* New Destination Form Card */}
      {showForm && (
        <Card sx={{ mb: 4, borderColor: 'primary.main', borderStyle: 'solid', borderWidth: 1 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700, mb: 3 }}>
              Create Storage Destination
            </Typography>
            
            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Destination Name" 
                    fullWidth 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="e.g. Offsite Backups"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel id="type-label">Storage Type</InputLabel>
                    <Select
                      labelId="type-label"
                      label="Storage Type"
                      value={formData.type}
                      onChange={handleTypeChange}
                    >
                      <MenuItem value="s3">S3 / MinIO Bucket</MenuItem>
                      <MenuItem value="ftp">FTP</MenuItem>
                      <MenuItem value="sftp">SFTP</MenuItem>
                      <MenuItem value="scp">SCP</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Paper sx={{ p: 3, bgcolor: 'background.default', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StorageIcon fontSize="small" color="primary" /> Connection Configuration
                    </Typography>
                    
                    <Grid container spacing={3}>
                      {formData.type === 's3' && (
                        <>
                          <Grid item xs={12}>
                            <TextField 
                              label="Endpoint URL (Optional)" 
                              fullWidth 
                              value={fields.endpoint || ''} 
                              onChange={e => handleFieldChange('endpoint', e.target.value)} 
                              placeholder="e.g. hel1.your-objectstorage.com (for Hetzner, MinIO, etc.)"
                              helperText="Leave empty for standard AWS S3. For other providers, enter the endpoint host."
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField 
                              label="Bucket Name" 
                              fullWidth 
                              required 
                              value={fields.bucket || ''} 
                              onChange={e => handleFieldChange('bucket', e.target.value)} 
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField 
                              label="Region" 
                              fullWidth 
                              required 
                              value={fields.region || ''} 
                              onChange={e => handleFieldChange('region', e.target.value)} 
                              placeholder="e.g. us-east-1"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField 
                              label="Access Key ID" 
                              fullWidth 
                              required 
                              value={fields.accessKeyId || ''} 
                              onChange={e => handleFieldChange('accessKeyId', e.target.value)} 
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField 
                              label="Secret Access Key" 
                              type="password"
                              fullWidth 
                              required 
                              value={fields.secretAccessKey || ''} 
                              onChange={e => handleFieldChange('secretAccessKey', e.target.value)} 
                            />
                          </Grid>
                        </>
                      )}

                      {['ftp', 'sftp', 'scp'].includes(formData.type) && (
                        <>
                          <Grid item xs={12} sm={8}>
                            <TextField 
                              label="Host URL / IP" 
                              fullWidth 
                              required 
                              value={fields.host || ''} 
                              onChange={e => handleFieldChange('host', e.target.value)} 
                              placeholder="e.g. ftp.yourserver.com"
                            />
                          </Grid>
                          {(formData.type === 'sftp' || formData.type === 'scp') && (
                            <Grid item xs={12} sm={4}>
                              <TextField 
                                label="Port" 
                                fullWidth 
                                required 
                                value={fields.port || ''} 
                                onChange={e => handleFieldChange('port', e.target.value)} 
                              />
                            </Grid>
                          )}
                          <Grid item xs={12} sm={6}>
                            <TextField 
                              label="Username" 
                              fullWidth 
                              required 
                              value={fields.user || ''} 
                              onChange={e => handleFieldChange('user', e.target.value)} 
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField 
                              label="Password / Private Key" 
                              type="password"
                              fullWidth 
                              required 
                              value={fields.password || ''} 
                              onChange={e => handleFieldChange('password', e.target.value)} 
                            />
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                {/* Connection Verification */}
                <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Button 
                    variant="contained" 
                    color="secondary"
                    onClick={handleVerify} 
                    disabled={verifyStatus === 'verifying'}
                  >
                    {verifyStatus === 'verifying' ? <CircularProgress size={24} color="inherit" /> : 'Verify Connection'}
                  </Button>
                  
                  {verifyStatus === 'success' && (
                    <Alert severity="success" icon={<CheckIcon fontSize="inherit" />} sx={{ py: 0, borderRadius: '8px' }}>
                      Connection verified successfully!
                    </Alert>
                  )}
                  {verifyStatus === 'error' && (
                    <Alert severity="error" sx={{ py: 0, borderRadius: '8px' }}>
                      Connection failed: {verifyError}
                    </Alert>
                  )}
                </Grid>

                <Grid item xs={12} sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    color="primary"
                    disabled={verifyStatus !== 'success'}
                    sx={{ fontWeight: 700 }}
                  >
                    Save Destination
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={() => setShowForm(false)}
                    sx={{ borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.3)' : 'rgba(0,0,0,0.15)', color: 'text.primary' }}
                  >
                    Cancel
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Destinations List Card */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={30} />
                      <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                        Loading storage destinations...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {destinations.map(d => (
                      <TableRow key={d.id}>
                        <TableCell sx={{ color: 'text.secondary' }}>{d.id}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                        <TableCell>
                          <Chip 
                            icon={d.type === 's3' ? <CloudIcon /> : <PowerIcon />}
                            label={d.type.toUpperCase()} 
                            color="primary"
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 600, borderRadius: '6px' }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton 
                            color="error" 
                            size="small" 
                            onClick={() => {
                              setDeleteTargetId(d.id);
                              setDeleteError('');
                              setDeleteOpen(true);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {destinations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          No destinations configured.
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
          Delete Storage Destination
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Are you sure you want to permanently delete this storage destination (<strong>{deleteTargetId}</strong>)?
          </Typography>
          
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: '8px' }}>
              {deleteError}
            </Alert>
          )}
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
