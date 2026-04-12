import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from './api';
import { Globe, Shield, Info, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';

const API_URL = 'http://localhost:4000/api';

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

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [sslLogs]);

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
        // Save email too
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
    </div>
  );
}
