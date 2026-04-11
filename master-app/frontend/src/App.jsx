import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Server, Settings, Activity, HardDrive } from 'lucide-react';
import Dashboard from './Dashboard';
import Agents from './Agents';
import Destinations from './Destinations';

function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <aside className="sidebar">
          <h2><Activity color="#66fcf1" /> AegisSight</h2>
          <nav>
            <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              <LayoutDashboard size={20} /> Dashboard
            </NavLink>
            <NavLink to="/agents" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              <Server size={20} /> Agents
            </NavLink>
            <NavLink to="/destinations" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              <HardDrive size={20} /> Destinations
            </NavLink>
          </nav>
        </aside>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/destinations" element={<Destinations />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
