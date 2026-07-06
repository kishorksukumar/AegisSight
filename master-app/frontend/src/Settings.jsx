import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api';
import {
  Box, Card, CardContent, Typography, Button, TextField, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Grid, Alert, CircularProgress, Divider, Chip, useTheme,
  Switch, FormControlLabel, FormGroup
} from '@mui/material';
import {
  Language as GlobeIcon,
  Shield as ShieldIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Terminal as TerminalIcon,
  Refresh as RefreshIcon,
  Backup as BackupIcon,
  SystemUpdate as UpdateIcon,
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Telegram as TelegramIcon
} from '@mui/icons-material';

const API_URL = '/api';

function SettingSection({ icon, title, children }) {
  const theme = useTheme();
  return (
    <Card sx={{ mb: 4 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, pb: 2, borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.15)' : 'rgba(0, 0, 0, 0.08)'}` }}>
          {icon}
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
            {title}
          </Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ ok, label }) {
  return (
    <Chip
      icon={ok ? <CheckCircleIcon sx={{ fontSize: '16px !important' }} /> : <WarningIcon sx={{ fontSize: '16px !important' }} />}
      label={label}
      color={ok ? 'success' : 'warning'}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 600, borderRadius: '6px' }}
    />
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainMsg, setDomainMsg] = useState(null);

  // Notification states
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpEnabled, setSmtpEnabled] = useState(false);

  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);

  const [cpuThreshold, setCpuThreshold] = useState('2.0');
  const [ramThreshold, setRamThreshold] = useState('80');

  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState(null);

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  const [sslLoading, setSslLoading] = useState(false);
  const [sslLogs, setSslLogs] = useState('');
  const logsRef = useRef(null);

  // Update & Recovery state
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateLogs, setUpdateLogs] = useState('');
  const [updateLogsVisible, setUpdateLogsVisible] = useState(false);
  const updateLogsRef = useRef(null);

  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState(null);

  const [rollbackTarget, setRollbackTarget] = useState(null);
  const [rollbackLogs, setRollbackLogs] = useState('');
  const rollbackLogsRef = useRef(null);

  useEffect(() => { 
    fetchSettings(); 
    fetchUpdateStatus(); 
    fetchBackups(); 
  }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [sslLogs]);

  useEffect(() => {
    if (updateLogsRef.current) updateLogsRef.current.scrollTop = updateLogsRef.current.scrollHeight;
  }, [updateLogs]);

  useEffect(() => {
    if (rollbackLogsRef.current) rollbackLogsRef.current.scrollTop = rollbackLogsRef.current.scrollHeight;
  }, [rollbackLogs]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setDomain(data.domain || '');
        setEmail(data.letsencrypt_email || '');

        setSmtpHost(data.notification_smtp_host || '');
        setSmtpPort(data.notification_smtp_port || '587');
        setSmtpUser(data.notification_smtp_user || '');
        setSmtpPass(data.notification_smtp_pass || '');
        setSmtpFrom(data.notification_smtp_from || '');
        setSmtpTo(data.notification_smtp_to || '');
        setSmtpEnabled(data.notification_enabled_smtp === 'true');

        setTelegramToken(data.notification_telegram_bot_token || '');
        setTelegramChatId(data.notification_telegram_chat_id || '');
        setTelegramEnabled(data.notification_enabled_telegram === 'true');

        setCpuThreshold(data.notification_cpu_threshold || '2.0');
        setRamThreshold(data.notification_ram_threshold || '80');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const saveNotifications = async (e) => {
    if (e) e.preventDefault();
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const res = await apiFetch(`${API_URL}/settings/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_smtp_host: smtpHost,
          notification_smtp_port: smtpPort,
          notification_smtp_user: smtpUser,
          notification_smtp_pass: smtpPass,
          notification_smtp_from: smtpFrom,
          notification_smtp_to: smtpTo,
          notification_enabled_smtp: String(smtpEnabled),
          notification_telegram_bot_token: telegramToken,
          notification_telegram_chat_id: telegramChatId,
          notification_enabled_telegram: String(telegramEnabled),
          notification_cpu_threshold: cpuThreshold,
          notification_ram_threshold: ramThreshold
        })
      });
      if (res.ok) {
        setNotifMsg({ ok: true, text: 'Notification settings saved successfully.' });
        fetchSettings();
      } else {
        const d = await res.json();
        setNotifMsg({ ok: false, text: d.error || 'Failed to save settings.' });
      }
    } catch (e) {
      setNotifMsg({ ok: false, text: 'Request failed.' });
    }
    setNotifSaving(false);
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    setNotifMsg(null);
    try {
      const res = await apiFetch(`${API_URL}/settings/notifications/test-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
          to: smtpTo
        })
      });
      if (res.ok) {
        setNotifMsg({ ok: true, text: 'Test SMTP email sent successfully! Please check your inbox.' });
      } else {
        const d = await res.json();
        setNotifMsg({ ok: false, text: `SMTP Test failed: ${d.error}` });
      }
    } catch (e) {
      setNotifMsg({ ok: false, text: 'SMTP Test request failed.' });
    }
    setTestingSmtp(false);
  };

  const testTelegram = async () => {
    setTestingTelegram(true);
    setNotifMsg(null);
    try {
      const res = await apiFetch(`${API_URL}/settings/notifications/test-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: telegramToken,
          chatId: telegramChatId
        })
      });
      if (res.ok) {
        setNotifMsg({ ok: true, text: 'Test Telegram message sent successfully! Please check your Telegram chat.' });
      } else {
        const d = await res.json();
        setNotifMsg({ ok: false, text: `Telegram Test failed: ${d.error}` });
      }
    } catch (e) {
      setNotifMsg({ ok: false, text: 'Telegram Test request failed.' });
    }
    setTestingTelegram(false);
  };


  const fetchUpdateStatus = async () => {
    try {
      const res = await apiFetch(`${API_URL}/update/status`);
      if (res.ok) setUpdateStatus(await res.json());
    } catch (e) {}
  };

  const fetchBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/update/backups`);
      if (res.ok) setBackups(await res.json());
    } catch (e) {}
    setBackupsLoading(false);
  };

  const saveDomain = async (e) => {
    e.preventDefault();
    setDomainSaving(true);
    setDomainMsg(null);
    try {
      const res = await apiFetch(`${API_URL}/settings/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      if (res.ok) {
        await apiFetch(`${API_URL}/settings/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        setDomainMsg({ ok: true, text: 'Domain & email saved successfully.' });
        fetchSettings();
      } else {
        const d = await res.json();
        setDomainMsg({ ok: false, text: d.error });
      }
    } catch (e) {
      setDomainMsg({ ok: false, text: 'Request failed.' });
    }
    setDomainSaving(false);
  };

  const enableSSL = async () => {
    if (!window.confirm(`This will run Let's Encrypt Certbot for domain: ${settings.domain}.\n\nMake sure your domain's DNS is pointing to this server.\n\nContinue?`)) return;
    setSslLoading(true);
    setSslLogs('');

    try {
      const response = await fetch(`${API_URL}/settings/ssl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setSslLogs(prev => prev + decoder.decode(value));
      }
      fetchSettings();
    } catch (e) {
      setSslLogs(prev => prev + `\nError: ${e.message}`);
    }
    setSslLoading(false);
  };

  const applyUpdate = async () => {
    if (!window.confirm('This will pull the latest code from GitHub and rebuild the Docker containers.\n\nA database snapshot will be created automatically before updating.\n\nContinue?')) return;
    setUpdateLoading(true);
    setUpdateLogs('');
    setUpdateLogsVisible(true);

    try {
      const response = await fetch(`${API_URL}/update/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setUpdateLogs(prev => prev + decoder.decode(value));
      }
      fetchUpdateStatus();
      fetchBackups();
      fetchSettings();
    } catch (e) {
      setUpdateLogs(prev => prev + `\nError: ${e.message}`);
    }
    setUpdateLoading(false);
  };

  const takeSnapshot = async () => {
    setSnapshotting(true);
    setSnapshotMsg(null);
    try {
      const res = await apiFetch(`${API_URL}/update/snapshot`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        setSnapshotMsg({ ok: true, text: `Snapshot created: ${d.filename}` });
        fetchBackups();
      } else {
        const d = await res.json();
        setSnapshotMsg({ ok: false, text: d.error });
      }
    } catch (e) {
      setSnapshotMsg({ ok: false, text: 'Snapshot failed.' });
    }
    setSnapshotting(false);
  };

  const rollback = async (filename) => {
    if (!window.confirm(`Roll back database to snapshot:\n${filename}\n\nYour current database will be saved as a safety snapshot first.\n\nContinue?`)) return;
    setRollbackTarget(filename);
    setRollbackLogs('');

    try {
      const response = await fetch(`${API_URL}/update/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setRollbackLogs(prev => prev + decoder.decode(value));
      }
      fetchBackups();
    } catch (e) {
      setRollbackLogs(prev => prev + `\nError: ${e.message}`);
    }
    setRollbackTarget(null);
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (iso) => new Date(iso).toLocaleString();

  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 2 }}>
      <CircularProgress color="primary" />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading settings...</Typography>
    </Box>
  );

  const sslEnabled = settings.ssl_enabled === 'true';
  const hasValidDomain = settings.domain && settings.domain !== 'localhost';

  return (
    <Box sx={{ maxWidth: '1000px' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
          Settings
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          Manage your AegisSight deployment configuration, domain certificates, and system upgrades.
        </Typography>
      </Box>

      {/* General Information Card */}
      <SettingSection icon={<InfoIcon color="primary" />} title="General Information">
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
              App Version
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
              v{settings.app_version || '0.6.0'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
              Active Domain
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 0.5 }}>
              {settings.domain || 'Not configured'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', mb: 1 }}>
              SSL Status
            </Typography>
            <StatusBadge ok={sslEnabled} label={sslEnabled ? 'HTTPS Enabled' : 'HTTP Only'} />
          </Grid>
        </Grid>
      </SettingSection>

      {/* Domain Configuration */}
      <SettingSection icon={<GlobeIcon color="primary" />} title="Domain Configuration">
        <Box component="form" onSubmit={saveDomain}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Public Domain"
                fullWidth
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. aegis.yourcompany.com"
                helperText="DNS A-record must point to this server's IP before provisioning SSL."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Let's Encrypt Email"
                type="email"
                fullWidth
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                helperText="Used for automated SSL certificate expiry warnings."
              />
            </Grid>
          </Grid>

          {domainMsg && (
            <Alert severity={domainMsg.ok ? 'success' : 'error'} sx={{ mb: 3, borderRadius: '8px' }}>
              {domainMsg.text}
            </Alert>
          )}

          <Button type="submit" variant="contained" color="primary" disabled={domainSaving} sx={{ fontWeight: 700 }}>
            {domainSaving ? 'Saving...' : 'Save Domain Settings'}
          </Button>
        </Box>
      </SettingSection>

      {/* SSL Provisioning Card */}
      <SettingSection icon={<ShieldIcon color={sslEnabled ? 'success' : 'warning'} />} title="SSL / HTTPS Security">
        {sslEnabled ? (
          <Alert severity="success" sx={{ borderRadius: '8px' }}>
            HTTPS encryption is active for <strong>{settings.domain}</strong>. Certbot automatically schedules renewals.
          </Alert>
        ) : (
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.6 }}>
              Enable free, automated HTTPS certificate management via <strong>Let's Encrypt</strong>.
              This processes SSL credentials on-demand and swaps your Nginx configurations.
            </Typography>

            {!hasValidDomain && (
              <Alert severity="warning" sx={{ mb: 3, borderRadius: '8px' }}>
                Please set and save a valid public domain name above before attempting to provision a certificate.
              </Alert>
            )}

            <Button
              variant="contained"
              onClick={enableSSL}
              disabled={sslLoading || !hasValidDomain}
              sx={{
                fontWeight: 700,
                bgcolor: hasValidDomain ? 'success.main' : 'action.disabledBackground',
                color: hasValidDomain ? '#000' : 'text.disabled',
                '&:hover': {
                  bgcolor: 'success.dark',
                }
              }}
            >
              {sslLoading ? 'Provisioning SSL...' : 'Enable SSL (Let\'s Encrypt)'}
            </Button>
          </Box>
        )}

        {sslLogs && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
              <TerminalIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                Certbot Stream Terminal
              </Typography>
            </Box>
            <Paper
              ref={logsRef}
              elevation={0}
              sx={{
                bgcolor: '#080a0d',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                p: 2.5,
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              <Typography 
                component="pre" 
                sx={{ 
                  color: '#2ecc71', 
                  fontFamily: 'monospace', 
                  fontSize: '0.85rem', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  m: 0
                }}
              >
                {sslLogs}
              </Typography>
            </Paper>
          </Box>
        )}
      </SettingSection>

      {/* Notification System Settings */}
      <SettingSection icon={<NotificationsIcon color="primary" />} title="Notification System">
        <Box component="form" onSubmit={saveNotifications}>
          <Grid container spacing={4}>
            
            {/* SMTP Settings Column */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon fontSize="small" color="primary" /> SMTP Email Alerts
              </Typography>
              <FormGroup sx={{ mb: 2 }}>
                <FormControlLabel
                  control={<Switch checked={smtpEnabled} onChange={e => setSmtpEnabled(e.target.checked)} color="primary" />}
                  label="Enable Email Notifications"
                />
              </FormGroup>
              <Grid container spacing={2}>
                <Grid item xs={8}>
                  <TextField
                    label="SMTP Host"
                    fullWidth
                    size="small"
                    value={smtpHost}
                    onChange={e => setSmtpHost(e.target.value)}
                    placeholder="smtp.mailgun.org"
                    disabled={!smtpEnabled}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Port"
                    fullWidth
                    size="small"
                    value={smtpPort}
                    onChange={e => setSmtpPort(e.target.value)}
                    placeholder="587"
                    disabled={!smtpEnabled}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="SMTP Username"
                    fullWidth
                    size="small"
                    value={smtpUser}
                    onChange={e => setSmtpUser(e.target.value)}
                    placeholder="postmaster@yourdomain.com"
                    disabled={!smtpEnabled}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="SMTP Password"
                    type="password"
                    fullWidth
                    size="small"
                    value={smtpPass}
                    onChange={e => setSmtpPass(e.target.value)}
                    placeholder="••••••••••••••••"
                    disabled={!smtpEnabled}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="From Email Address"
                    fullWidth
                    size="small"
                    value={smtpFrom}
                    onChange={e => setSmtpFrom(e.target.value)}
                    placeholder="alerts@aegissight.internal"
                    disabled={!smtpEnabled}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Recipient Email Address"
                    fullWidth
                    size="small"
                    value={smtpTo}
                    onChange={e => setSmtpTo(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    disabled={!smtpEnabled}
                  />
                </Grid>
              </Grid>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={testSmtp}
                disabled={!smtpEnabled || testingSmtp}
                sx={{ mt: 2, fontWeight: 600 }}
              >
                {testingSmtp ? 'Sending Test...' : 'Test SMTP Connection'}
              </Button>
            </Grid>

            {/* Telegram Settings Column */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TelegramIcon fontSize="small" color="primary" /> Telegram Channel Alerts
              </Typography>
              <FormGroup sx={{ mb: 2 }}>
                <FormControlLabel
                  control={<Switch checked={telegramEnabled} onChange={e => setTelegramEnabled(e.target.checked)} color="primary" />}
                  label="Enable Telegram Notifications"
                />
              </FormGroup>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Telegram Bot Token"
                    fullWidth
                    size="small"
                    value={telegramToken}
                    onChange={e => setTelegramToken(e.target.value)}
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    disabled={!telegramEnabled}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Telegram Chat ID"
                    fullWidth
                    size="small"
                    value={telegramChatId}
                    onChange={e => setTelegramChatId(e.target.value)}
                    placeholder="-100123456789"
                    disabled={!telegramEnabled}
                    helperText="Can be a group chat ID or personal chat ID."
                  />
                </Grid>
              </Grid>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={testTelegram}
                disabled={!telegramEnabled || testingTelegram}
                sx={{ mt: 2, fontWeight: 600 }}
              >
                {testingTelegram ? 'Sending Test...' : 'Test Telegram Bot'}
              </Button>
            </Grid>

            {/* Metric Alert Thresholds Row */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1, borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.15)' : 'rgba(0, 0, 0, 0.08)' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, mt: 1 }}>
                Alert Thresholds (Resource Overload Notifications)
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="CPU Load Average Threshold (1-min)"
                    type="number"
                    inputProps={{ step: 0.1, min: 0.1 }}
                    fullWidth
                    size="small"
                    value={cpuThreshold}
                    onChange={e => setCpuThreshold(e.target.value)}
                    helperText="Alerts when load average goes beyond this level."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Memory (RAM) Usage Threshold (%)"
                    type="number"
                    inputProps={{ min: 10, max: 100 }}
                    fullWidth
                    size="small"
                    value={ramThreshold}
                    onChange={e => setRamThreshold(e.target.value)}
                    helperText="Alerts when memory utilization goes beyond this percentage."
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          {notifMsg && (
            <Alert severity={notifMsg.ok ? 'success' : 'error'} sx={{ mt: 3, borderRadius: '8px' }}>
              {notifMsg.text}
            </Alert>
          )}

          <Box sx={{ mt: 4 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={notifSaving}
              sx={{ fontWeight: 700 }}
            >
              {notifSaving ? 'Saving...' : 'Save Notification Settings'}
            </Button>
          </Box>
        </Box>
      </SettingSection>

      {/* Updates & Recovery Card */}
      <SettingSection icon={<UpdateIcon color="primary" />} title="System Updates & Recovery">
        
        {/* Version Banner Grid */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', height: '100%', bgcolor: 'background.default' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Current Local Version
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                v{updateStatus?.currentVersion || settings.app_version || '0.6.0'}
              </Typography>
              {updateStatus?.currentCommit && (
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  hash: {updateStatus.currentCommit.slice(0, 7)}
                </Typography>
              )}
            </Paper>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Paper sx={{ 
              p: 2, 
              border: `1px solid ${updateStatus?.updateAvailable ? 'rgba(102,252,241,0.2)' : 'rgba(16,185,129,0.2)'}`, 
              textAlign: 'center', 
              height: '100%', 
              bgcolor: updateStatus?.updateAvailable ? 'rgba(102,252,241,0.02)' : 'rgba(16,185,129,0.02)'
            }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Latest GitHub Release
              </Typography>
              {updateStatus?.latestRelease ? (
                <>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: updateStatus.updateAvailable ? 'primary.main' : 'success.main' }}>
                    v{updateStatus.latestRelease.version}
                  </Typography>
                  <Typography variant="caption" sx={{ color: updateStatus.updateAvailable ? 'primary.main' : 'success.main', fontWeight: 600, display: 'block', mt: 0.5 }}>
                    {updateStatus.updateAvailable ? 'Update Available' : 'System Up to Date'}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>GitHub Registry offline</Typography>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Paper sx={{ p: 2, border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', height: '100%', bgcolor: 'background.default' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
                Database Snapshots
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {backups.length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                Total snapshots stored
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Release Notes Preview */}
        {updateStatus?.latestRelease?.body && (
          <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: '1px solid rgba(102,252,241,0.15)', bgcolor: 'rgba(102,252,241,0.03)' }}>
            <Typography variant="caption" display="block" sx={{ color: 'primary.main', fontWeight: 600, mb: 1, textTransform: 'uppercase' }}>
              Release Notes (v{updateStatus.latestRelease.version})
            </Typography>
            <Typography 
              component="pre" 
              sx={{ 
                m: 0, 
                fontSize: '0.85rem', 
                color: 'text.secondary', 
                whiteSpace: 'pre-wrap', 
                fontFamily: 'inherit',
                lineHeight: 1.5
              }}
            >
              {updateStatus.latestRelease.body.slice(0, 600)}{updateStatus.latestRelease.body.length > 600 ? '…' : ''}
            </Typography>
          </Box>
        )}

        {/* Action Buttons Row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={applyUpdate}
            disabled={updateLoading}
            sx={{ fontWeight: 700 }}
          >
            {updateLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} color="inherit" /> Applying...
              </Box>
            ) : (
              updateStatus?.updateAvailable ? 'Apply System Update' : 'Rebuild Container Images'
            )}
          </Button>

          <Button
            variant="outlined"
            onClick={fetchUpdateStatus}
            startIcon={<RefreshIcon />}
            sx={{ borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.3)' : 'rgba(0,0,0,0.15)', color: 'text.primary' }}
          >
            Refresh Status
          </Button>

          <Button
            variant="contained"
            onClick={takeSnapshot}
            disabled={snapshotting}
            startIcon={<BackupIcon />}
            sx={{
              fontWeight: 700,
              bgcolor: 'rgba(16, 185, 129, 0.15)',
              color: 'success.main',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              '&:hover': {
                bgcolor: 'rgba(16, 185, 129, 0.25)',
              }
            }}
          >
            {snapshotting ? 'Saving Snapshot...' : 'Take Snapshot'}
          </Button>
        </Box>

        {snapshotMsg && (
          <Alert severity={snapshotMsg.ok ? 'success' : 'error'} sx={{ mb: 3, borderRadius: '8px' }}>
            {snapshotMsg.text}
          </Alert>
        )}

        {/* Update Logs Stream Terminal */}
        {updateLogsVisible && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
              <TerminalIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                System Upgrade Stream Terminal
              </Typography>
            </Box>
            <Paper
              ref={updateLogsRef}
              elevation={0}
              sx={{
                bgcolor: '#080a0d',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                p: 2.5,
                maxHeight: '280px',
                overflowY: 'auto',
              }}
            >
              <Typography 
                component="pre" 
                sx={{ 
                  color: '#2ecc71', 
                  fontFamily: 'monospace', 
                  fontSize: '0.85rem', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  m: 0
                }}
              >
                {updateLogs || 'Waiting for stream response output...'}
              </Typography>
            </Paper>
          </Box>
        )}

        <Divider sx={{ my: 3, borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.15)' : 'rgba(0, 0, 0, 0.08)' }} />

        {/* Database Snapshots Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Restore Database Snapshot
          </Typography>
          <Button 
            onClick={fetchBackups} 
            size="small" 
            startIcon={<RefreshIcon />}
            sx={{ color: 'text.secondary' }}
          >
            Refresh
          </Button>
        </Box>

        {backupsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : backups.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No snapshots saved. Click "Take Snapshot" or run an update.
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent', mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Label</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Commit Commit</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Created</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((b) => (
                  <TableRow key={b.filename} hover>
                    <TableCell>
                      <Chip
                        label={b.label}
                        color={b.label === 'pre-update' ? 'primary' : b.label === 'pre-rollback' ? 'warning' : 'success'}
                        size="small"
                        sx={{ fontWeight: 600, borderRadius: '4px' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{b.commit.slice(0, 7)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(b.createdAt)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatBytes(b.sizeBytes)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        onClick={() => rollback(b.filename)}
                        disabled={rollbackTarget === b.filename}
                        sx={{ fontWeight: 600 }}
                      >
                        {rollbackTarget === b.filename ? 'Rolling back...' : '↩ Restore'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Rollback Logs Stream Terminal */}
        {rollbackLogs && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: 'text.secondary' }}>
              <TerminalIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                Rollback Stream Terminal
              </Typography>
            </Box>
            <Paper
              ref={rollbackLogsRef}
              elevation={0}
              sx={{
                bgcolor: '#080a0d',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                p: 2.5,
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              <Typography 
                component="pre" 
                sx={{ 
                  color: 'warning.main', 
                  fontFamily: 'monospace', 
                  fontSize: '0.85rem', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  m: 0
                }}
              >
                {rollbackLogs}
              </Typography>
            </Paper>
          </Box>
        )}
      </SettingSection>
    </Box>
  );
}
