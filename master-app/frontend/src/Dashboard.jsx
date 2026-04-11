import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { Server, Activity, DatabaseBackup, HardDrive } from 'lucide-react';

const SOCKET_URL = "http://localhost:4000";
const API_URL = "http://localhost:4000/api";

export default function Dashboard() {
  const [agents, setAgents] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ online: 0, jobsRunning: 0 });

  useEffect(() => {
    fetchData();
    
    const socket = io(SOCKET_URL);
    socket.on('dashboard:agents_updated', () => {
      fetchData();
    });
    
    socket.on('dashboard:history_updated', (data) => {
      fetchData();
    });

    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    try {
      const agentsRes = await fetch(`${API_URL}/agents`);
      const agentsData = await agentsRes.json();
      setAgents(agentsData);
      
      const histRes = await fetch(`${API_URL}/history`);
      const histData = await histRes.json();
      setHistory(histData);

      setStats({
        online: agentsData.filter(a => a.status === 'online').length,
        jobsRunning: histData.filter(h => h.status === 'running').length
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="dashboard-grid">
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
            <Activity size={32} color="var(--accent-color)" />
            <div>
              <h3>Running Jobs</h3>
              <div className="value">{stats.jobsRunning}</div>
            </div>
          </div>
        </div>
        <div className="glass-card metric-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <DatabaseBackup size={32} color="var(--accent-color)" />
            <div>
              <h3>Total Backups</h3>
              <div className="value">{history.filter(h => h.status === 'success').length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Connected Agents</h2>
          <button className="btn-primary" onClick={fetchData}>Refresh</button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hostname</th>
                <th>IP Address</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id}>
                  <td><strong>{agent.hostname}</strong></td>
                  <td>{agent.ip_address}</td>
                  <td>{agent.platform}</td>
                  <td>
                    <span className={`status-badge status-${agent.status}`}>
                      {agent.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{agent.last_seen ? formatDistanceToNow(new Date(agent.last_seen + 'Z'), { addSuffix: true }) : 'Never'}</td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No agents connected yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card">
        <h2>Recent Backup Activity</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Job Name</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Start Time</th>
                <th>Last Log</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.job_name}</strong></td>
                  <td>{item.agent_hostname}</td>
                  <td>
                    <span className={`status-badge status-${item.status}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {item.status === 'running' ? (
                      <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '8px', marginTop: '6px' }}>
                        <div style={{ width: `${item.progress}%`, background: 'var(--accent-color)', height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                      </div>
                    ) : item.status === 'success' ? '100%' : 'Failed'}
                  </td>
                  <td>{formatDistanceToNow(new Date(item.start_time + 'Z'), { addSuffix: true })}</td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.logs}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No backup history.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
