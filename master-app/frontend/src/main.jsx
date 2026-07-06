import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeContextProvider } from './ThemeContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeContextProvider>
      <CssBaseline />
      <App />
    </ThemeContextProvider>
  </StrictMode>,
)

