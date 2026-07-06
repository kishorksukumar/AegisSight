import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, CircularProgress, useTheme } from '@mui/material';
import { Shield as ShieldIcon } from '@mui/icons-material';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('aegissight_loggedIn', 'true');
        onLoginSuccess();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      bgcolor: 'background.default',
      backgroundImage: theme.palette.mode === 'dark' 
        ? 'radial-gradient(circle at top right, rgba(102, 252, 241, 0.08), transparent 400px), radial-gradient(circle at bottom left, rgba(69, 162, 158, 0.08), transparent 400px)'
        : 'none'
    }}>
      <Paper 
        component="form"
        onSubmit={handleLogin}
        sx={{ 
          width: '100%',
          maxWidth: '400px', 
          p: 5, 
          borderRadius: 4,
          textAlign: 'center',
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' 
            : '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(31, 40, 51, 0.6)' : '#ffffff',
          backdropFilter: theme.palette.mode === 'dark' ? 'blur(12px)' : 'none',
          border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`
        }}
      >
        <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'rgba(102, 252, 241, 0.1)', mb: 2 }}>
          <ShieldIcon sx={{ color: 'primary.main', fontSize: 40 }} />
        </Box>
        
        <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary', mb: 1 }}>
          AegisSight
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Secure System Access
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left', borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField 
            label="Username" 
            variant="outlined" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            disabled={loading}
            autoComplete="username"
            required
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.3)' : 'rgba(0, 0, 0, 0.15)',
                },
                '&:hover fieldset': {
                  borderColor: 'primary.main',
                },
              }
            }}
          />

          <TextField 
            label="Password" 
            type="password"
            variant="outlined" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            disabled={loading}
            autoComplete="current-password"
            required
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.3)' : 'rgba(0, 0, 0, 0.15)',
                },
                '&:hover fieldset': {
                  borderColor: 'primary.main',
                },
              }
            }}
          />
          
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            size="large"
            disabled={loading}
            sx={{ 
              py: 1.5,
              fontWeight: 700,
              boxShadow: theme.palette.mode === 'dark' ? '0 4px 15px rgba(102, 252, 241, 0.2)' : 'none',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'secondary.main',
                boxShadow: theme.palette.mode === 'dark' ? '0 6px 20px rgba(102, 252, 241, 0.3)' : 'none',
              }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Secure Login'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
