import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, Server, Cpu, MemoryStick, Clock, Wifi, Activity
} from 'lucide-react';

const API_URL = "/api";

function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
}

function MetricGauge({ label, value, unit, color = 'var(--accent-color)', icon }) {
  const pct = parseFloat(value) || 0;
  const isPercentage = unit === '%';
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
        {icon}
        <span style={{ fontSize: '0.85rem' }}>{label}</span>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: '700', color }}>
        {value !== null && value !== undefined ? `${value}${unit}` : 'N/A'}
      </div>
      {isPercentage && (
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
          <div style={{
            width: `${Math.min(pct, 100)}%`,
            height: '100%',
            borderRadius: '4px',
            background: pct > 85 ? '#ef4444' : pct > 65 ? '#eab308' : color,
            transition: 'width 0.5s ease'
          }} />
        </div>
      )}
    </div>
  );
}

export default function AgentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [history, setHistory] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [restoreModal, setRestoreModal] = useState(null);
  const [restoreForm, setRestoreForm] = useState({ target_paths: '', restore_dir: '' });
  const [activeRestores, setActiveRestores] = useState({});

  useEffect(() => {
    fetchAll();
    const token = localStorage.getItem('aegissight_token');
    const socket = io({ auth: { token } });
    socket.on('dashboard:agents_updated', fetchAgent);
    socket.on('dashboard:history_updated', fetchHistory);
    socket.on('dashboard:restore_status', (data) => {
      setActiveRestores(prev => ({ ...prev, [data.restore_id]: data }));
    });
    return () => socket.disconnect();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchAgent(), fetchHistory(), fetchJobs()]);
    setLoading(false);
  };

  const fetchAgent = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}`);
      if (res.ok) setAgent(await res.json());
    } catch (e) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}/history`);
      if (res.ok) setHistory(await res.json());
    } catch (e) {}
  };

  const fetchJobs = async () => {
    try {
      const res = await apiFetch(`${API_URL}/agents/${id}/jobs`);
      if (res.ok) setJobs(await res.json());
    } catch (e) {}
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    if (!restoreModal) return;
    try {
      const paths = restoreForm.target_paths.split(',').map(p => p.trim()).filter(Boolean);
      const res = await apiFetch(`${API_URL}/agents/${id}/restore`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
      Loading agent data...
    </div>
  );

  if (!agent) return (
    <div>
      <button onClick={() => navigate('/')} className="btn-primary" style={{ marginBottom: '20px' }}>
        ← Back to Dashboard
      </button>
      <div className="glass-card" style={{ textAlign: 'center', color: 'var(--danger)' }}>Agent not found.</div>
    </div>
  );

  const successCount = history.filter(h => h.status === 'success').length;
  const failedCount = history.filter(h => h.status === 'failed').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={24} color="var(--accent-color)" />
            <h2 style={{ margin: 0 }}>{agent.hostname}</h2>
            <span className={`status-badge status-${agent.status}`}>{agent.status.toUpperCase()}</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            {agent.ip_address} &bull; {agent.platform} &bull; Last seen {agent.last_seen ? formatDistanceToNow(new Date(agent.last_seen + 'Z'), { addSuffix: true }) : 'never'}
          </div>
        </div>
      </div>

      {/* Live Telemetry Gauges */}
      <h3 style={{ marginBottom: '14px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Live Telemetry</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        <MetricGauge
          label="CPU Load (1m avg)"
          value={agent.cpu_load}
          unit=""
          color="#eab308"
          icon={<Cpu size={16} />}
        />
        <MetricGauge
          label="RAM Usage"
          value={agent.ram_usage}
          unit="%"
          color="var(--accent-color)"
          icon={<MemoryStick size={16} />}
        />
        <MetricGauge
          label="Server Uptime"
          value={formatUptime(agent.uptime)}
          unit=""
          color="#10b981"
          icon={<Clock size={16} />}
        />
        <MetricGauge
          label="Successful Backups"
          value={successCount}
          unit=""
          color="#10b981"
          icon={<Activity size={16} />}
        />
        <MetricGauge
          label="Failed Backups"
          value={failedCount}
          unit=""
          color={failedCount > 0 ? 'var(--danger)' : '#10b981'}
          icon={<Activity size={16} />}
        />
        <MetricGauge
          label="Scheduled Jobs"
          value={jobs.length}
          unit=""
          color="var(--accent-color)"
          icon={<Wifi size={16} />}
        />
      </div>

      {/* Active Restores */}
      {Object.values(activeRestores).length > 0 && (
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h2 style={{ marginBottom: '16px' }}>Active Restores</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Logs</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(activeRestores).map(restore => (
                  <tr key={restore.restore_id}>
                    <td>
                      <span className={`status-badge status-${restore.status}`}>
                        {restore.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {restore.status === 'running' || restore.status === 'starting' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '6px' }}>
                            <div style={{ width: `${restore.progress}%`, background: 'var(--accent-color)', height: '100%', borderRadius: '4px' }} />
                          </div>
                          <span style={{ fontSize: '0.8rem' }}>{restore.progress}%</span>
                        </div>
                      ) : restore.status === 'success' ? '100%' : '—'}
                    </td>
                    <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {restore.logs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backup History */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Backup History</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Started</th>
                <th>Ended</th>
                <th>Log</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.job_name}</strong></td>
                  <td>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {item.status === 'running' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '6px' }}>
                          <div style={{ width: `${item.progress}%`, background: 'var(--accent-color)', height: '100%', borderRadius: '4px' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem' }}>{item.progress}%</span>
                      </div>
                    ) : item.status === 'success' ? '100%' : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {formatDistanceToNow(new Date(item.start_time + 'Z'), { addSuffix: true })}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {item.end_time ? formatDistanceToNow(new Date(item.end_time + 'Z'), { addSuffix: true }) : '—'}
                  </td>
                  <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {item.logs}
                  </td>
                  <td>
                    {item.status === 'success' && (
                      <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setRestoreModal(item)}>Restore</button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No backup history for this agent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scheduled Jobs */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '16px' }}>Scheduled Jobs</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td><strong>{job.name}</strong></td>
                  <td>{job.backup_type || 'full'}</td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--accent-color)' }}>{job.cron_schedule}</td>
                  <td>
                    <span className={`status-badge status-${job.is_active ? 'online' : 'offline'}`}>
                      {job.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No jobs scheduled for this agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Modal */}
      {restoreModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--accent-color)' }}>Restore Backup</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              Restore from <strong>{restoreModal.job_name}</strong> ({formatDistanceToNow(new Date(restoreModal.start_time + 'Z'), { addSuffix: true })})
            </p>
            <form onSubmit={handleRestoreSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Restore Directory (Optional)</label>
                <input 
                  type="text" 
                  value={restoreForm.restore_dir} 
                  onChange={e => setRestoreForm({...restoreForm, restore_dir: e.target.value})} 
                  placeholder="e.g. /opt/aegissight-restore"
                  style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
                />
                <small style={{ color: 'var(--text-muted)' }}>Leave blank to overwrite files in their original absolute paths.</small>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Specific Paths to Restore (Optional)</label>
                <input 
                  type="text" 
                  value={restoreForm.target_paths} 
                  onChange={e => setRestoreForm({...restoreForm, target_paths: e.target.value})} 
                  placeholder="e.g. var/www/html/index.php, etc/nginx"
                  style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
                />
                <small style={{ color: 'var(--text-muted)' }}>Comma separated. Note: paths in tar archives typically do not have a leading slash.</small>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setRestoreModal(null)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'white', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>Trigger Restore</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
