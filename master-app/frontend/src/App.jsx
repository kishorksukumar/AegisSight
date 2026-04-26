import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Server, Activity, HardDrive, LogOut, Users as UsersIcon, Wrench } from 'lucide-react';
import Dashboard from './Dashboard';
import Agents from './Agents';
import Destinations from './Destinations';
import Users from './Users';
import AgentDetails from './AgentDetails';
import SettingsPage from './Settings';
import Login from './Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('aegissight_loggedIn'));

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('aegissight_loggedIn'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch(e) {}
    localStorage.removeItem('aegissight_loggedIn');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <BrowserRouter>
      <div className="layout">
        <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
          <div>
            <h2><Activity color="#66fcf1" /> AegisSight</h2>
            <nav>
              <NavLink to="/" end className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <LayoutDashboard size={20} /> Dashboard
              </NavLink>
              <NavLink to="/agents" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Server size={20} /> Agents
              </NavLink>
              <NavLink to="/destinations" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <HardDrive size={20} /> Destinations
              </NavLink>
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '12px 0' }} />
              <NavLink to="/users" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <UsersIcon size={20} /> Users
              </NavLink>
              <NavLink to="/settings" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <Wrench size={20} /> Settings
              </NavLink>
            </nav>
          </div>
          <div style={{ marginTop: 'auto', padding: '20px 0' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 16px', marginBottom: '8px' }}>AegisSight v0.5.0</div>
            <button onClick={handleLogout} className="nav-link" style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <LogOut size={20} /> Logout
            </button>
          </div>
        </aside>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:id" element={<AgentDetails />} />
            <Route path="/destinations" element={<Destinations />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
