import React, { useState, useEffect } from 'react';
import { apiFetch } from './api';
import { formatDistanceToNow } from 'date-fns';

const API_URL = '/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch(`${API_URL}/users`);
      if (res.ok) setUsers(await res.json());
    } catch(e) {}
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddForm(false);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch(e) {
      alert("Failed to add user");
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user '${username}'?`)) return;
    try {
      const res = await apiFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch(e) {
      alert('Delete request failed.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${API_URL}/users/${resetId}/reset`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword })
      });
      if (res.ok) {
        setResetId(null);
        setResetPassword('');
        alert('Password reset successful!');
      } else {
        alert('Failed to reset password.');
      }
    } catch(e) {
      alert('Request failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>User Management</h2>
        <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showAddForm && (
        <div className="glass-card" style={{ marginBottom: '20px', backgroundColor: 'rgba(102, 252, 241, 0.05)', borderColor: 'var(--accent-color)' }}>
          <h3 style={{ color: 'var(--accent-color)', marginBottom: '15px' }}>Create Administrator</h3>
          <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Username</label>
              <input required value={newUsername} onChange={e => setNewUsername(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>Initial Password</label>
              <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', height: 'fit-content' }}>Create</button>
          </form>
        </div>
      )}

      {resetId && (
        <div className="glass-card" style={{ marginBottom: '20px', borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.05)' }}>
          <h3 style={{ color: '#eab308', marginBottom: '15px' }}>Reset Password</h3>
          <form onSubmit={handleResetPassword} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px', color: 'var(--text-muted)' }}>New Password</label>
              <input required type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px' }} />
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', background: '#eab308', color: 'black' }}>Confirm Reset</button>
            <button type="button" onClick={() => setResetId(null)} className="btn-primary" style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #eab308' }}>Cancel</button>
          </form>
        </div>
      )}

      <div className="table-container glass-card">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.created_at ? formatDistanceToNow(new Date(u.created_at + 'Z'), { addSuffix: true }) : 'Unknown'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setResetId(u.id)} style={{ background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Reset Password</button>
                    <button onClick={() => handleDelete(u.id, u.username)} style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
