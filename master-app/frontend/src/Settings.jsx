import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api';
import { Globe, Shield, Info, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';

const API_URL = '/api';

function SettingSection({ icon, title, children }) {
  return (
    <div className="glass-card" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
        {icon}
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ ok, label }) {
  return (
    <span className={`status-badge status-${ok ? 'online' : 'offline'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      {ok ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
      {label}
    </span>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainMsg, setDomainMsg] = useState(null);

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

  useEffect(() => { fetchSettings(); fetchUpdateStatus(); fetchBackups(); }, []);

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
      }
    } catch (e) {}
    setLoading(false);
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
      const token = localStorage.getItem('aegissight_token');
      const response = await fetch(`${API_URL}/settings/ssl`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
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
      const token = localStorage.getItem('aegissight_token');
      const response = await fetch(`${API_URL}/update/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
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
      const token = localStorage.getItem('aegissight_token');
      const response = await fetch(`${API_URL}/update/rollback`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
      Loading settings...
    </div>
  );

  const sslEnabled = settings.ssl_enabled === 'true';
  const hasValidDomain = settings.domain && settings.domain !== 'localhost';

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2>Settings</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '6px' }}>Manage your AegisSight deployment configuration.</p>
      </div>

      {/* General Info */}
      <SettingSection icon={<Info size={20} color="var(--accent-color)" />} title="General">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>App Version</div>
            <div style={{ fontWeight: '700', color: 'var(--accent-color)' }}>v{settings.app_version || '0.2.0'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Domain</div>
            <div style={{ fontWeight: '600' }}>{settings.domain || 'Not configured'}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SSL Status</div>
            <StatusBadge ok={sslEnabled} label={sslEnabled ? 'HTTPS Enabled' : 'HTTP Only'} />
          </div>
        </div>
      </SettingSection>

      {/* Domain Configuration */}
      <SettingSection icon={<Globe size={20} color="var(--accent-color)" />} title="Domain Configuration">
        <form onSubmit={saveDomain}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Public Domain
              </label>
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. aegis.yourcompany.com"
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none' }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '5px' }}>
                DNS must point to this server's IP before enabling SSL.
              </p>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Let's Encrypt Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none' }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '5px' }}>
                Used for certificate expiry notices.
              </p>
            </div>
          </div>

          {domainMsg && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: domainMsg.ok ? 'rgba(46,204,113,0.1)' : 'rgba(255,75,75,0.1)', border: `1px solid ${domainMsg.ok ? 'var(--success)' : 'var(--danger)'}`, borderRadius: '8px', color: domainMsg.ok ? 'var(--success)' : 'var(--danger)', fontSize: '0.875rem' }}>
              {domainMsg.text}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={domainSaving}>
            {domainSaving ? 'Saving...' : 'Save Domain Settings'}
          </button>
        </form>
      </SettingSection>

      {/* SSL */}
      <SettingSection icon={<Shield size={20} color={sslEnabled ? '#10b981' : '#eab308'} />} title="SSL / HTTPS">
        {sslEnabled ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981' }}>
            <CheckCircle size={20} />
            <span>HTTPS is active for <strong>{settings.domain}</strong>. Certbot handles automatic renewals every 12h.</span>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
              Enable free HTTPS using <strong style={{ color: 'white' }}>Let's Encrypt</strong>. 
              This will run Certbot inside Docker and automatically configure Nginx to serve your site over HTTPS.
            </p>

            {!hasValidDomain && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(234,179,8,0.1)', border: '1px solid #eab308', borderRadius: '8px', color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                Configure a valid domain above before enabling SSL.
              </div>
            )}

            <button
              className="btn-primary"
              onClick={enableSSL}
              disabled={sslLoading || !hasValidDomain}
              style={{ background: hasValidDomain ? 'linear-gradient(135deg, #10b981, #059669)' : undefined, opacity: !hasValidDomain ? 0.5 : 1, cursor: !hasValidDomain ? 'not-allowed' : 'pointer' }}
            >
              {sslLoading ? 'Provisioning SSL...' : '🔒 Enable SSL (Let\'s Encrypt)'}
            </button>
          </>
        )}

        {sslLogs && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <Terminal size={14} />
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Certbot Output</span>
            </div>
            <pre
              ref={logsRef}
              style={{ background: '#080a0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', color: '#2ecc71', fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '300px', overflowY: 'auto', lineHeight: '1.5' }}
            >
              {sslLogs}
            </pre>
          </div>
        )}
      </SettingSection>

      {/* ── Updates & Recovery ──────────────────────────────────────── */}
      <SettingSection
        icon={<span style={{ fontSize: '20px' }}>🚀</span>}
        title="Updates & Recovery"
      >
        {/* Version status banner */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Current Version</div>
            <div style={{ fontWeight: '700', color: 'var(--accent-color)', fontSize: '1.05rem' }}>
              v{updateStatus?.currentVersion || settings.app_version || '0.2.0'}
            </div>
            {updateStatus?.currentCommit && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', fontFamily: 'monospace' }}>
                @ {updateStatus.currentCommit}
              </div>
            )}
          </div>

          {updateStatus?.latestRelease ? (
            <div style={{ padding: '14px 16px', background: updateStatus.updateAvailable ? 'rgba(102,252,241,0.06)' : 'rgba(16,185,129,0.06)', borderRadius: '10px', border: `1px solid ${updateStatus.updateAvailable ? 'rgba(102,252,241,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Latest Release</div>
              <div style={{ fontWeight: '700', fontSize: '1.05rem', color: updateStatus.updateAvailable ? 'var(--accent-color)' : '#10b981' }}>
                v{updateStatus.latestRelease.version}
              </div>
              {updateStatus.updateAvailable ? (
                <div style={{ color: 'var(--accent-color)', fontSize: '0.75rem', marginTop: '4px' }}>⬆ Update available</div>
              ) : (
                <div style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '4px' }}>✓ Up to date</div>
              )}
            </div>
          ) : (
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Latest Release</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>GitHub unreachable</div>
            </div>
          )}

          <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>DB Snapshots</div>
            <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{backups.length}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>total backups stored</div>
          </div>
        </div>

        {/* Release notes */}
        {updateStatus?.latestRelease?.body && (
          <div style={{ marginBottom: '20px', padding: '14px 16px', background: 'rgba(102,252,241,0.05)', border: '1px solid rgba(102,252,241,0.15)', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', marginBottom: '8px' }}>
              Release Notes — v{updateStatus.latestRelease.version}
            </div>
            <pre style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontFamily: 'inherit' }}>
              {updateStatus.latestRelease.body.slice(0, 600)}{updateStatus.latestRelease.body.length > 600 ? '…' : ''}
            </pre>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button
            className="btn-primary"
            onClick={applyUpdate}
            disabled={updateLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {updateLoading ? (
              <><span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Updating...</>
            ) : (
              <><span>⬆</span> {updateStatus?.updateAvailable ? 'Apply Update' : 'Re-pull & Rebuild'}</>
            )}
          </button>

          <button
            onClick={fetchUpdateStatus}
            className="btn-primary"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          >
            🔄 Refresh Status
          </button>

          <button
            onClick={takeSnapshot}
            disabled={snapshotting}
            className="btn-primary"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981' }}
          >
            {snapshotting ? 'Saving...' : '💾 Take Snapshot'}
          </button>
        </div>

        {snapshotMsg && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', background: snapshotMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,75,75,0.1)', border: `1px solid ${snapshotMsg.ok ? '#10b981' : 'var(--danger)'}`, borderRadius: '8px', color: snapshotMsg.ok ? '#10b981' : 'var(--danger)', fontSize: '0.875rem' }}>
            {snapshotMsg.text}
          </div>
        )}

        {/* Update live logs */}
        {updateLogsVisible && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <Terminal size={14} />
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Update Output</span>
              {updateLoading && <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid rgba(102,252,241,0.3)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginLeft: '4px' }} />}
            </div>
            <pre
              ref={updateLogsRef}
              style={{ background: '#080a0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', color: '#2ecc71', fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '280px', overflowY: 'auto', lineHeight: '1.5' }}
            >
              {updateLogs || 'Waiting for output...'}
            </pre>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0 20px' }} />

        {/* DB Snapshots table */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Database Snapshots</div>
          <button onClick={fetchBackups} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🔄 Refresh
          </button>
        </div>

        {backupsLoading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading snapshots…</div>
        ) : backups.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed var(--border-color)' }}>
            No snapshots yet. Click "Take Snapshot" or apply an update to auto-create one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Label', 'Commit', 'Created', 'Size', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', background: b.label === 'pre-update' ? 'rgba(102,252,241,0.1)' : b.label === 'pre-rollback' ? 'rgba(234,179,8,0.1)' : 'rgba(16,185,129,0.1)', color: b.label === 'pre-update' ? 'var(--accent-color)' : b.label === 'pre-rollback' ? '#eab308' : '#10b981' }}>
                        {b.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{b.commit}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{formatDate(b.createdAt)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{formatBytes(b.sizeBytes)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => rollback(b.filename)}
                        disabled={rollbackTarget === b.filename}
                        style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(234,179,8,0.4)', background: 'rgba(234,179,8,0.1)', color: '#eab308', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}
                      >
                        {rollbackTarget === b.filename ? 'Rolling back…' : '↩ Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rollback logs */}
        {rollbackLogs && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)' }}>
              <Terminal size={14} />
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rollback Output</span>
            </div>
            <pre
              ref={rollbackLogsRef}
              style={{ background: '#080a0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', color: '#eab308', fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '220px', overflowY: 'auto', lineHeight: '1.5' }}
            >
              {rollbackLogs}
            </pre>
          </div>
        )}
      </SettingSection>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
