import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
  IconButton, Typography, AppBar, Toolbar, Menu, MenuItem, Divider, Button, useTheme
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Dns as ServerIcon,
  Storage as StorageIcon,
  People as UsersIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  SettingsBrightness as SettingsBrightnessIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

import Dashboard from './Dashboard';
import Agents from './Agents';
import Destinations from './Destinations';
import Users from './Users';
import AgentDetails from './AgentDetails';
import SettingsPage from './Settings';
import Events from './Events';
import Login from './Login';
import { ThemeContext } from './ThemeContext';

const drawerWidth = 260;

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
      <AppLayout onLogout={handleLogout} />
    </BrowserRouter>
  );
}

function AppLayout({ onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { themeMode, setThemeMode } = useContext(ThemeContext);

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleThemeMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleThemeMenuClose = (mode) => {
    if (mode) {
      setThemeMode(mode);
    }
    setAnchorEl(null);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Agents', icon: <ServerIcon />, path: '/agents' },
    { text: 'Events', icon: <WarningIcon />, path: '/events' },
    { text: 'Destinations', icon: <StorageIcon />, path: '/destinations' },
  ];

  const adminItems = [
    { text: 'Users', icon: <UsersIcon />, path: '/users' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const getThemeIcon = () => {
    if (themeMode === 'light') return <LightModeIcon />;
    if (themeMode === 'dark') return <DarkModeIcon />;
    return <SettingsBrightnessIcon />;
  };

  // Get dynamic title based on path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/agents') return 'Agents';
    if (path.startsWith('/agents/')) return 'Agent Details';
    if (path === '/events') return 'System Events';
    if (path === '/destinations') return 'Destinations';
    if (path === '/users') return 'Users Management';
    if (path === '/settings') return 'System Settings';
    return 'AegisSight';
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      {/* Sidebar Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(11, 12, 16, 0.85)' : '#ffffff',
            backdropFilter: theme.palette.mode === 'dark' ? 'blur(10px)' : 'none',
            borderRight: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`
          },
        }}
      >
        <Toolbar sx={{ px: 3, py: 2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <ShieldIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em', color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
            AegisSight
          </Typography>
        </Toolbar>
        
        <Box sx={{ overflow: 'auto', px: 2, mt: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <List>
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    selected={active}
                    sx={{
                      borderRadius: '8px',
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: active 
                        ? (theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.08)' : 'rgba(15, 118, 110, 0.08)') 
                        : 'transparent',
                      '&:hover': {
                        bgcolor: active 
                          ? (theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.12)' : 'rgba(15, 118, 110, 0.12)') 
                          : (theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.04)' : 'rgba(15, 118, 110, 0.04)'),
                        color: 'primary.main',
                        '& .MuiListItemIcon-root': { color: 'primary.main' }
                      },
                      '&.Mui-selected': {
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.08)' : 'rgba(15, 118, 110, 0.08)',
                        '&:hover': {
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.12)' : 'rgba(15, 118, 110, 0.12)'
                        }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: active ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: active ? 700 : 500 }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          
          <Divider sx={{ my: 2, borderColor: theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)' }} />
          
          <List>
            {adminItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    selected={active}
                    sx={{
                      borderRadius: '8px',
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: active 
                        ? (theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.08)' : 'rgba(15, 118, 110, 0.08)') 
                        : 'transparent',
                      '&:hover': {
                        bgcolor: active 
                          ? (theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.12)' : 'rgba(15, 118, 110, 0.12)') 
                          : (theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.04)' : 'rgba(15, 118, 110, 0.04)'),
                        color: 'primary.main',
                        '& .MuiListItemIcon-root': { color: 'primary.main' }
                      },
                      '&.Mui-selected': {
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.08)' : 'rgba(15, 118, 110, 0.08)',
                        '&:hover': {
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.12)' : 'rgba(15, 118, 110, 0.12)'
                        }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: active ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: active ? 700 : 500 }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          <Box sx={{ mt: 'auto', mb: 4, px: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, ml: 1 }}>
              AegisSight v0.6.0
            </Typography>
            <ListItemButton
              onClick={onLogout}
              sx={{
                borderRadius: '8px',
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: 'rgba(255, 75, 75, 0.08)',
                  color: 'error.main',
                  '& .MuiListItemIcon-root': { color: 'error.main' }
                }
              }}
            >
              <ListItemIcon sx={{ color: 'text.secondary', minWidth: 40 }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 500 }} />
            </ListItemButton>
          </Box>
        </Box>
      </Drawer>

      {/* Main Content Pane */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <AppBar 
          position="static" 
          elevation={0}
          sx={{ 
            bgcolor: 'transparent',
            borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
            px: 2
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: theme.palette.mode === 'dark' ? '#fff' : 'text.primary' }}>
              {getPageTitle()}
            </Typography>

            {/* Theme Swapper Toggle */}
            <Box>
              <IconButton 
                onClick={handleThemeMenuOpen} 
                sx={{ 
                  color: 'primary.main',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(102, 252, 241, 0.1)' : 'rgba(0, 0, 0, 0.08)'
                  }
                }}
              >
                {getThemeIcon()}
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={openMenu}
                onClose={() => handleThemeMenuClose(null)}
                PaperProps={{
                  sx: {
                    mt: 1,
                    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(69, 162, 158, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
                    bgcolor: 'background.paper',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                  }
                }}
              >
                <MenuItem onClick={() => handleThemeMenuClose('light')} selected={themeMode === 'light'} sx={{ gap: 1.5 }}>
                  <LightModeIcon fontSize="small" /> Light Mode
                </MenuItem>
                <MenuItem onClick={() => handleThemeMenuClose('dark')} selected={themeMode === 'dark'} sx={{ gap: 1.5 }}>
                  <DarkModeIcon fontSize="small" /> Dark Mode
                </MenuItem>
                <MenuItem onClick={() => handleThemeMenuClose('system')} selected={themeMode === 'system'} sx={{ gap: 1.5 }}>
                  <SettingsBrightnessIcon fontSize="small" /> System Theme
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Inner Page View */}
        <Box component="main" sx={{ flexGrow: 1, p: 4, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:id" element={<AgentDetails />} />
            <Route path="/events" element={<Events />} />
            <Route path="/destinations" element={<Destinations />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default App;
