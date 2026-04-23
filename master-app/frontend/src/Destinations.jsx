import React, { useEffect, useState } from 'react';
import { apiFetch } from './api';

const API_URL = '/api';

export default function Destinations() {
  const [destinations, setDestinations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  
  const defaultS3 = { bucket: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '' };
  const defaultFtp = { host: '', user: '', password: '' };
  const defaultSftp = { host: '', port: '22', user: '', password: '' };
  
  const [formData, setFormData] = useState({ id: `dest_${Date.now()}`, name: '', type: 's3' });
  const [fields, setFields] = useState(defaultS3);
  
  const [verifyStatus, setVerifyStatus] = useState('idle'); // idle, verifying, success, error
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      const res = await apiFetch(`${API_URL}/destinations`);
      setDestinations(await res.json());
    } catch(e) {}
  };

  const handleVerify = async () => {
    setVerifyStatus('verifying');
    setVerifyError('');
    try {
      const res = await apiFetch(`${API_URL}/destinations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: formData.type, config: fields })
      });
      const data = await res.json();
      if (data.success) {
        setVerifyStatus('success');
      } else {
        setVerifyStatus('error');
        setVerifyError(data.error || 'Verification failed');
      }
    } catch (err) {
      setVerifyStatus('error');
      setVerifyError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (verifyStatus !== 'success') {
      alert("Please successfully verify the connection before saving.");
      return;
    }
    try {
      await apiFetch(`${API_URL}/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, config: fields })
      });
      setShowForm(false);
      resetForm();
      fetchDestinations();
    } catch(err) {
      alert("Failed to save destination!");
    }
  };

  const resetForm = () => {
    setFormData({ id: `dest_${Date.now()}`, name: '', type: 's3' });
    setFields(defaultS3);
    setVerifyStatus('idle');
  }

  const handleTypeChange = (e) => {
    const type = e.target.value;
    setFormData({...formData, type});
    setVerifyStatus('idle');
    if (type === 's3') setFields(defaultS3);
    if (type === 'ftp') setFields(defaultFtp);
    if (type === 'sftp') setFields(defaultSftp);
    if (type === 'scp') setFields(defaultSftp);
  };

  const handleFieldChange = (key, value) => {
    setFields({...fields, [key]: value});
    setVerifyStatus('idle'); // any change resets verify status
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Storage Destinations</h2>
        <button className="btn-primary" onClick={() => { setShowForm(true); resetForm(); }}>Add Destination</button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ marginBottom: '20px' }}>
          <h3>New Destination</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
            <div style={{display: 'flex', gap: '10px', flexDirection: 'column'}}>
              <input placeholder="Name (e.g. Primary S3)" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
              <select value={formData.type} onChange={handleTypeChange} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }}>
                <option value="s3" style={{color:'black'}}>S3 / MinIO</option>
                <option value="ftp" style={{color:'black'}}>FTP</option>
                <option value="sftp" style={{color:'black'}}>SFTP</option>
                <option value="scp" style={{color:'black'}}>SCP</option>
              </select>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4>Configuration</h4>
              {formData.type === 's3' && (
                <>
                  <input placeholder="Bucket Name" required value={fields.bucket || ''} onChange={e => handleFieldChange('bucket', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
                  <input placeholder="Region (e.g. us-east-1)" required value={fields.region || ''} onChange={e => handleFieldChange('region', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
                  <input placeholder="Access Key ID" required value={fields.accessKeyId || ''} onChange={e => handleFieldChange('accessKeyId', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
                  <input type="password" placeholder="Secret Access Key" required value={fields.secretAccessKey || ''} onChange={e => handleFieldChange('secretAccessKey', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
                </>
              )}
              {['ftp', 'sftp', 'scp'].includes(formData.type) && (
                <>
                  <input placeholder="Host (e.g. ftp.example.com)" required value={fields.host || ''} onChange={e => handleFieldChange('host', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
                  {(formData.type === 'sftp' || formData.type === 'scp') && <input placeholder="Port (e.g. 22)" required value={fields.port || ''} onChange={e => handleFieldChange('port', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />}
                  <input placeholder="Username" required value={fields.user || ''} onChange={e => handleFieldChange('user', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
                  <input type="password" placeholder="Password / Private Key" required value={fields.password || ''} onChange={e => handleFieldChange('password', e.target.value)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button type="button" onClick={handleVerify} className="btn-primary" disabled={verifyStatus === 'verifying'} style={{ width: '150px', background: '#3b82f6' }}>
                {verifyStatus === 'verifying' ? 'Verifying...' : 'Verify'}
              </button>
              {verifyStatus === 'success' && <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Connection Verified</span>}
              {verifyStatus === 'error' && <span style={{ color: '#ef4444', fontSize: '0.9em' }}>Error: {verifyError}</span>}
            </div>

            <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

            <div style={{display:'flex', gap:'10px'}}>
              <button type="submit" className="btn-primary" disabled={verifyStatus !== 'success'} style={{ width: '150px', opacity: verifyStatus !== 'success' ? 0.5 : 1, cursor: verifyStatus !== 'success' ? 'not-allowed' : 'pointer' }}>Save</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-primary" style={{ width: '150px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'white' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container glass-card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map(d => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td><strong>{d.name}</strong></td>
                <td><span className={`status-badge status-online`}>{d.type.toUpperCase()}</span></td>
              </tr>
            ))}
            {destinations.length === 0 && <tr><td colSpan="3" style={{padding:'20px', textAlign:'center'}}>No destinations configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
