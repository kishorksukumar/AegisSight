import React, { useState, useEffect } from 'react';
import { apiFetch } from './api';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import {
  Box, Card, CardContent, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, useTheme, Button
} from '@mui/material';
import {
  Warning as WarningIcon,
  Autorenew as AutorenewIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

const API_URL = window.location.origin + '/api';

export default function Events() {
  const [downtimeEvents, setDowntimeEvents] = useState([]);
  const theme = useTheme();

  const fetchDowntime = async () => {
    try {
      const res = await apiFetch(`${API_URL}/downtime`);
      if (res.ok) {
        setDowntimeEvents(await res.json());
      }
    } catch (err) {
      console.error('Error fetching downtime events:', err);
    }
  };

  useEffect(() => {
    fetchDowntime();
    const socket = io({ withCredentials: true });
    socket.on('dashboard:agents_updated', fetchDowntime);
    return () => socket.disconnect();
  }, []);

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

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Real-time log of agent server downtime events, recovery states, and duration metrics.
        </Typography>
        <Button 
          variant="outlined" 
          onClick={fetchDowntime} 
          startIcon={<AutorenewIcon />}
          sx={{ borderColor: 'primary.main', color: 'primary.main' }}
        >
          Refresh
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Server Agent</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Outage Triggered</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Resolved At</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Total Downtime</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Current Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {downtimeEvents.map(event => (
                  <TableRow key={event.id} hover>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {event.agent_name || event.agent_hostname || 'Enrolled Agent'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        ID: {event.agent_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(event.start_time + 'Z').toLocaleString()}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        ({formatDistanceToNow(new Date(event.start_time + 'Z'), { addSuffix: true })})
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {event.end_time ? (
                        <>
                          <Typography variant="body2">
                            {new Date(event.end_time + 'Z').toLocaleString()}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ({formatDistanceToNow(new Date(event.end_time + 'Z'), { addSuffix: true })})
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
                          Active Outage
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {formatDowntimeDuration(event.start_time, event.end_time)}
                    </TableCell>
                    <TableCell>
                      {event.end_time ? (
                        <Chip 
                          icon={<CheckCircleIcon sx={{ fontSize: '1rem !important' }} />}
                          label="RESOLVED" 
                          color="success" 
                          variant="outlined"
                          sx={{ fontWeight: 700, borderRadius: '4px' }}
                        />
                      ) : (
                        <Chip 
                          icon={<ErrorIcon sx={{ fontSize: '1rem !important' }} />}
                          label="STILL OFFLINE" 
                          color="error" 
                          variant="outlined"
                          sx={{ fontWeight: 700, borderRadius: '4px' }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {downtimeEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <WarningIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.5 }} />
                        <Typography variant="body2">No server outage events recorded yet.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
