import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import './App.css'

// Importamos las páginas
import ScanPage from './pages/ScanPage'
import HistoryPage from './pages/HistoryPage'
import ConfigPage from './pages/ConfigPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

// Importamos los componentes
import Navigation from './components/Navigation'

// Importamos el contexto de Firebase
import { FirebaseProvider, useFirebase } from './context/FirebaseContext'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
})

// Componente de enrutamiento protegido con Firebase
const AppRoutes = () => {
  const { currentUser, loading } = useFirebase();
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Verificar si hay una sesión guardada en localStorage
    const checkLocalSession = async () => {
      const savedSession = localStorage.getItem('isLoggedIn');
      if (savedSession === 'true' && !currentUser) {
        // Esperar a que Firebase termine de cargar
        if (!loading) {
          setIsReady(true);
        }
      } else {
        setIsReady(true);
      }
    };
    
    checkLocalSession();
  }, [currentUser, loading]);
  
  if (loading || !isReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Router>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="sticky" color="primary" elevation={1}>
          <Toolbar sx={{ justifyContent: 'center' }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', letterSpacing: 0.5 }}>
              Lector de Guías
            </Typography>
          </Toolbar>
        </AppBar>
        {/* Separador para evitar que el contenido quede oculto bajo el AppBar */}
        <Toolbar sx={{ display: { xs: 'block', sm: 'none' } }} />
        <Routes>
          <Route path="/login" element={!currentUser ? <LoginPage /> : <Navigate to="/scan" />} />
          <Route path="/scan" element={currentUser ? <ScanPage /> : <Navigate to="/login" />} />
          <Route path="/history" element={currentUser ? <HistoryPage /> : <Navigate to="/login" />} />
          <Route path="/config" element={currentUser ? <ConfigPage /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to={currentUser ? "/scan" : "/login"} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {currentUser && <Navigation />}
      </Box>
    </Router>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FirebaseProvider>
        <AppRoutes />
      </FirebaseProvider>
    </ThemeProvider>
  )
}

export default App
