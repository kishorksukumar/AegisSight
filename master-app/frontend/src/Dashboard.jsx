import React, { useEffect, useState } from 'react';
import { apiFetch } from './api';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { Server, Activity, DatabaseBackup, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SOCKET_URL = "http://localhost:4000";
const API_URL = "http://localhost:4000/api";

function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
}

export default function Dashboard() {
  const [agents, setAgents] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ online: 0, jobsRunning: 0, totalSuccess: 0, totalFailed: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    const socket = io(SOCKET_URL);
    socket.on('dashboard:agents_updated', fetchData);
    socket.on('dashboard:history_updated', fetchData);
    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const agentsRes = await apiFetch(`${API_URL}/agents`);
      const agentsData = await agentsRes.json();
      setAgents(agentsData);

      const histRes = await apiFetch(`${API_URL}/history`);
      const histData = await histRes.json();
      setHistory(histData);

      setStats({
        online: agentsData.filter(a => a.status === 'online').length,
        jobsRunning: histData.filter(h => h.status === 'running').length,
        totalSuccess: histData.filter(h => h.status === 'success').length,
        totalFailed: histData.filter(h => h.status === 'failed').length,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {/* KPI Row */}
      <div className="dashboard-grid" style={{ marginBottom: '30px' }}>
        <div className="glass-card metric-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Server size={32} color="var(--accent-color)" />
            <div>
              <h3>Active Agents</h3>
              <div className="value">{stats.online}</div>
            </div>
          </div>
        </div>
        <div className="glass-card metric-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={32} color="#eab308" />
            <div>
              <h3>Running Jobs</h3>
              <div className="value">{stats.jobsRunning}</div>
            </div>
          </div>
        </div>
        <div className="glass-card metric-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={32} color="#10b981" />
            <div>
              <h3>Successful Backups</h3>
              <div className="value">{stats.totalSuccess}</div>
            </div>
          </div>
        </div>
        <div className="glass-card metric-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <XCircle size={32} color="var(--danger)" />
            <div>
              <h3>Failed Backups</h3>
              <div className="value">{stats.totalFailed}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Agents Overview */}
      <div className="glass-card" style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Server Overview</h2>
          <button className="btn-primary" onClick={fetchData}>Refresh</button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          Click any server to view detailed metrics, CPU/RAM telemetry and backup history.
        </p>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hostname</th>
                <th>Status</th>
                <th>Uptime</th>
                <th>Last Backup</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => {
                const agentHistory = history.filter(h => h.agent_hostname === agent.hostname);
                const lastBackup = agentHistory[0];
                return (
                  <tr
                    key={agent.id}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(102,252,241,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td>
                      <strong style={{ color: 'var(--accent-color)' }}>{agent.hostname}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '8px' }}>({agent.id})</span>
                    </td>
                    <td>
                      <span className={`status-badge status-${agent.status}`}>
                        {agent.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} color="var(--text-muted)" />
                        {formatUptime(agent.uptime)}
                      </span>
                    </td>
                    <td>
                      {lastBackup ? (
                        <span className={`status-badge status-${lastBackup.status}`}>
                          {lastBackup.status.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No backups yet</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {agent.last_seen ? formatDistanceToNow(new Date(agent.last_seen + 'Z'), { addSuffix: true }) : 'Never'}
                    </td>
                  </tr>
                );
              })}
              {agents.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No agents connected yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Global Backup Activity */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '16px' }}>Recent Backup Activity</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map(item => (
                <tr key={item.id}>
                  <td><strong>{item.job_name}</strong></td>
                  <td
                    style={{ color: 'var(--accent-color)', cursor: 'pointer' }}
                    onClick={() => {
                      const agent = agents.find(a => a.hostname === item.agent_hostname);
                      if (agent) navigate(`/agents/${agent.id}`);
                    }}
                  >
                    {item.agent_hostname}
                  </td>
                  <td>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {item.status === 'running' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '6px' }}>
                          <div style={{ width: `${item.progress}%`, background: 'var(--accent-color)', height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.progress}%</span>
                      </div>
                    ) : item.status === 'success' ? '100%' : item.status === 'failed' ? '—' : `${item.progress}%`}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {formatDistanceToNow(new Date(item.start_time + 'Z'), { addSuffix: true })}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No backup history yet.
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
