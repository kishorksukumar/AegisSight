import React, { useState, useEffect } from 'react';
import { apiFetch } from './api';
import { formatDistanceToNow } from 'date-fns';
import {
  Box, Card, CardContent, Typography, Button, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Snackbar, useTheme
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';

const API_URL = '/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const theme = useTheme();
  
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch(`${API_URL}/users`);
      if (res.ok) setUsers(await res.json());
    } catch(e) {
      console.error(e);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddForm(false);
        setNewUsername('');
        setNewPassword('');
        showToast('Administrator created successfully!');
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to create user', 'error');
      }
    } catch(e) {
      showToast("Failed to add user", 'error');
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user '${username}'?`)) return;
    try {
      const res = await apiFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('User deleted successfully.');
        fetchUsers();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete user', 'error');
      }
    } catch(e) {
      showToast('Delete request failed.', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${API_URL}/users/${resetId}/reset`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword })
      });
      if (res.ok) {
        setResetId(null);
        setResetPassword('');
        showToast('Password reset successful!');
      } else {
        showToast('Failed to reset password.', 'error');
      }
    } catch(e) {
      showToast('Request failed', 'error');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
          User Management
        </Typography>
        <Button
          variant="contained"
          color={showAddForm ? "secondary" : "primary"}
          startIcon={showAddForm ? <CloseIcon /> : <AddIcon />}
          onClick={() => setShowAddForm(!showAddForm)}
          sx={{ fontWeight: 600 }}
        >
          {showAddForm ? 'Cancel' : 'Add User'}
        </Button>
      </Box>

      {/* Create User Form Card */}
      {showAddForm && (
        <Card sx={{ mb: 4, borderColor: 'primary.main', borderStyle: 'solid', borderWidth: 1 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AdminIcon /> Create Administrator Account
            </Typography>
            
            <Box component="form" onSubmit={handleAddUser}>
              <Grid container spacing={3} alignItems="flex-end">
                <Grid item xs={12} sm={5}>
                  <TextField 
                    label="Username" 
                    fullWidth 
                    required 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)} 
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField 
                    label="Initial Password" 
                    type="password"
                    fullWidth 
                    required 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button type="submit" variant="contained" color="primary" fullWidth size="large" sx={{ py: 1.7, fontWeight: 700 }}>
                    Create
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Username</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell sx={{ py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AdminIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.username}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {u.created_at ? formatDistanceToNow(new Date(u.created_at + 'Z'), { addSuffix: true }) : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button 
                          variant="outlined" 
                          color="warning" 
                          size="small"
                          startIcon={<KeyIcon />}
                          onClick={() => setResetId(u.id)}
                          sx={{ py: 0.5 }}
                        >
                          Reset Password
                        </Button>
                        <Button 
                          variant="outlined" 
                          color="error" 
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDelete(u.id, u.username)}
                          sx={{ py: 0.5 }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog 
        open={Boolean(resetId)} 
        onClose={() => setResetId(null)}
        PaperProps={{
          sx: {
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
            bgcolor: 'background.paper',
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon /> Reset User Password
        </DialogTitle>
        <DialogContent sx={{ minWidth: 350 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Please input a strong new password for this user. This will terminate all of their active login sessions.
          </Typography>
          <Box component="form" onSubmit={handleResetPassword} sx={{ pt: 1 }}>
            <TextField
              label="New Password"
              type="password"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              fullWidth
              required
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setResetId(null)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleResetPassword} variant="contained" color="warning" sx={{ fontWeight: 700, color: '#000' }}>
            Confirm Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast Messages */}
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
    </Box>
  );
}
