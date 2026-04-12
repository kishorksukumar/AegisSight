import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from './api';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, Server, Cpu, MemoryStick, Clock, Wifi, Activity
} from 'lucide-react';

const SOCKET_URL = "http://localhost:4000";
const API_URL = "http://localhost:4000/api";

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

  useEffect(() => {
    fetchAll();
    const socket = io(SOCKET_URL);
    socket.on('dashboard:agents_updated', fetchAgent);
    socket.on('dashboard:history_updated', fetchHistory);
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
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
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
    </div>
  );
}
