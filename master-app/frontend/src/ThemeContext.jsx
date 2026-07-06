import React, { createContext, useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export const ThemeContext = createContext({
  themeMode: 'system',
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export function ThemeContextProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(() => {
    return localStorage.getItem('theme_mode') || 'system';
  });

  const setThemeMode = (mode) => {
    localStorage.setItem('theme_mode', mode);
    setThemeModeState(mode);
  };

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const activeMode = useMemo(() => {
    if (themeMode === 'system') {
      return prefersDarkMode ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, prefersDarkMode]);

  const theme = useMemo(() => {
    const isDark = activeMode === 'dark';
    
    return createTheme({
      palette: {
        mode: activeMode,
        primary: {
          main: isDark ? '#66fcf1' : '#0f766e', // Cyan for dark, Teal for light (highly readable)
          contrastText: isDark ? '#0b0c10' : '#ffffff',
        },
        secondary: {
          main: isDark ? '#45a29e' : '#0d9488',
        },
        background: {
          default: isDark ? '#0b0c10' : '#f8fafc', // Dark background vs modern Slate-50 background
          paper: isDark ? '#1f2833' : '#ffffff',
        },
        text: {
          primary: isDark ? '#c5c6c7' : '#0f172a', // High contrast text
          secondary: isDark ? '#8892b0' : '#475569',
        },
        divider: isDark ? 'rgba(69, 162, 158, 0.2)' : '#e2e8f0',
      },
      typography: {
        fontFamily: "'Inter', sans-serif",
        h1: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
        h2: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
        h3: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
        h4: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
        h5: { fontFamily: "'Outfit', sans-serif", fontWeight: 700 },
        h6: { fontFamily: "'Outfit', sans-serif", fontWeight: 600 },
        body1: { fontSize: '0.95rem' },
        body2: { fontSize: '0.875rem' },
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              borderRadius: '16px',
              border: isDark ? '1px solid rgba(69, 162, 158, 0.15)' : '1px solid #e2e8f0',
              boxShadow: isDark 
                ? '0 10px 30px -10px rgba(0,0,0,0.5)' 
                : '0 4px 20px -2px rgba(0,0,0,0.05)',
              backgroundColor: isDark ? 'rgba(31, 40, 51, 0.6)' : '#ffffff',
              backdropFilter: isDark ? 'blur(12px)' : 'none',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: isDark ? 'rgba(102, 252, 241, 0.4)' : '#0f766e',
                boxShadow: isDark 
                  ? '0 12px 40px -10px rgba(102, 252, 241, 0.15)' 
                  : '0 8px 30px -4px rgba(15, 118, 110, 0.1)',
              }
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              padding: '8px 16px',
            },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#f1f5f9',
              '& .MuiTableCell-root': {
                fontWeight: 600,
                color: isDark ? '#8892b0' : '#475569',
              }
            }
          }
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              padding: '16px',
              borderBottom: isDark ? '1px solid rgba(69, 162, 158, 0.15)' : '1px solid #f1f5f9',
            }
          }
        }
      },
    });
  }, [activeMode]);

  const toggleTheme = () => {
    if (themeMode === 'light') {
      setThemeMode('dark');
    } else if (themeMode === 'dark') {
      setThemeMode('system');
    } else {
      setThemeMode('light');
    }
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
