import React, { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('aegissight_token', data.token);
        onLoginSuccess();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0c10' }}>
      <div className="glass-card" style={{ width: '400px', padding: '40px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '10px', color: 'var(--accent-color)' }}>AegisSight</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Secure System Access</p>
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              disabled={loading}
              autoComplete="username"
              required
              style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
            />
          </div>

          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              disabled={loading}
              autoComplete="current-password"
              required
              style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }} 
            />
          </div>
          
          {error && <div style={{ color: 'var(--danger)', marginBottom: '20px', fontSize: '0.9rem' }}>{error}</div>}
          
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
