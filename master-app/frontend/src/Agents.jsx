import React, { useState, useEffect } from 'react';

const API_URL = "http://localhost:4000/api";

export default function Agents() {
  const [showInstall, setShowInstall] = useState(false);
  const [agentId, setAgentId] = useState(`agent_${Math.floor(Math.random()*10000)}`);
  
  const [agents, setAgents] = useState([]);
  const [destinations, setDestinations] = useState([]);
  
  const [jobForm, setJobForm] = useState({
    id: `job_${Date.now()}`,
    name: 'Daily Backup',
    agent_id: '',
    destination_id: '',
    source_paths: '["/var/www/html", "/etc"]',
    backup_type: 'full',
    cron_schedule: '0 2 * * *'
  });

  const host = window.location.hostname;
  const curlCommand = `curl -sL http://${host}:4000/api/install.sh | bash -s -- ${agentId}`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [aRes, dRes] = await Promise.all([
        fetch(`${API_URL}/agents`),
        fetch(`${API_URL}/destinations`)
      ]);
      const aData = await aRes.json();
      const dData = await dRes.json();
      
      setAgents(aData);
      setDestinations(dData);
      
      if (aData.length > 0 && !jobForm.agent_id) setJobForm(f => ({...f, agent_id: aData[0].id}));
      if (dData.length > 0 && !jobForm.destination_id) setJobForm(f => ({...f, destination_id: dData[0].id}));
    } catch (e) {}
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      JSON.parse(jobForm.source_paths); // Validate JSON array
      const res = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...jobForm, source_paths: JSON.parse(jobForm.source_paths) })
      });
      if (res.ok) {
        alert("Job Scheduled successfully!");
        setJobForm({ ...jobForm, id: `job_${Date.now()}` });
      }
    } catch(err) {
      alert("Error: Source paths must be a valid JSON array like [\"/etc\", \"/var/log\"]");
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Server Agent Manager</h2>
        <button className="btn-primary" onClick={() => setShowInstall(!showInstall)}>
          {showInstall ? 'Close Installer' : '+ Add New Server'}
        </button>
      </div>

      {showInstall && (
        <div className="glass-card" style={{ marginBottom: '20px', backgroundColor: 'rgba(102, 252, 241, 0.05)', borderColor: 'var(--accent-color)' }}>
          <h3 style={{ color: 'var(--accent-color)', marginBottom: '10px' }}>Install New Agent</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Run the following command on your Linux server. This will automatically download Node.js dependencies and connect the latest AegisSight agent script to this dashboard.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <label>Agent Identifier:</label>
            <input 
              value={agentId} 
              onChange={e => setAgentId(e.target.value.replace(/\s+/g, '-'))} 
              style={{ padding: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
            />
          </div>

          <div style={{ padding: '15px', background: '#0b0c10', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
            <code style={{ color: '#2ecc71', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {curlCommand}
            </code>
            <button 
              onClick={() => navigator.clipboard.writeText(curlCommand)}
              style={{ position: 'absolute', right: '10px', top: '10px', background: 'var(--surface-color)', padding: '4px 8px', borderRadius: '4px', color: 'white', border: '1px solid var(--border-color)' }}>
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: '20px' }}>
         <h3 style={{ marginBottom: '15px' }}>Assign Backup Job to Agent</h3>
         {agents.length === 0 ? (
           <p style={{ color: 'var(--danger)' }}>No active agents available. Please install an agent first.</p>
         ) : destinations.length === 0 ? (
           <p style={{ color: 'var(--danger)' }}>No destinations available. Please configure a storage destination first.</p>
         ) : (
           <form onSubmit={handleJobSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
             
             <div>
               <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Select Agent</label>
               <select value={jobForm.agent_id} onChange={e => setJobForm({...jobForm, agent_id: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }}>
                 {agents.map(a => <option key={a.id} value={a.id} style={{color:'black'}}>{a.hostname} ({a.id})</option>)}
               </select>
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Job Name</label>
               <input value={jobForm.name} onChange={e => setJobForm({...jobForm, name: e.target.value})} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Target Destination</label>
               <select value={jobForm.destination_id} onChange={e => setJobForm({...jobForm, destination_id: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }}>
                 {destinations.map(d => <option key={d.id} value={d.id} style={{color:'black'}}>{d.name} [{d.type.toUpperCase()}]</option>)}
               </select>
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Backup Type</label>
               <select value={jobForm.backup_type} onChange={e => setJobForm({...jobForm, backup_type: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }}>
                 <option value="full" style={{color:'black'}}>Full Archive</option>
                 <option value="incremental" style={{color:'black'}}>Incremental (tar --listed-incremental)</option>
               </select>
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Source Paths (JSON Array)</label>
               <input value={jobForm.source_paths} onChange={e => setJobForm({...jobForm, source_paths: e.target.value})} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', fontFamily: 'monospace' }} />
             </div>

             <div>
               <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Cron Schedule (e.g. 0 2 * * *)</label>
               <input value={jobForm.cron_schedule} onChange={e => setJobForm({...jobForm, cron_schedule: e.target.value})} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
             </div>

             <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
               <button type="submit" className="btn-primary" style={{ width: '200px' }}>Schedule Job</button>
             </div>
           </form>
         )}
      </div>
    </div>
  );
}
