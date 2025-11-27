import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Dashboard, QrCodeScanner, History, Settings, Users } from './AppIcons';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determinar la página actual basada en la ruta
  const getValueFromPath = (path) => {
    if (path.includes('/dashboard')) return 0;
    if (path.includes('/scan')) return 1;
    if (path.includes('/history')) return 2;
    if (path.includes('/users')) return 3;
    if (path.includes('/config')) return 4;
    return 0;
  };
  
  const [value, setValue] = useState(getValueFromPath(location.pathname));

  const handleChange = (event, newValue) => {
    setValue(newValue);
    switch (newValue) {
      case 0:
        navigate('/dashboard');
        break;
      case 1:
        navigate('/scan');
        break;
      case 2:
        navigate('/history');
        break;
      case 3:
        navigate('/users');
        break;
      case 4:
        navigate('/config');
        break;
      default:
        navigate('/dashboard');
    }
  };

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={handleChange}
      >
        <BottomNavigationAction label="Dashboard" icon={<Dashboard />} />
        <BottomNavigationAction label="Escanear" icon={<QrCodeScanner />} />
        <BottomNavigationAction label="Registros" icon={<History />} />
        <BottomNavigationAction label="Usuarios" icon={<Users />} />
        <BottomNavigationAction label="Configuración" icon={<Settings />} />
      </BottomNavigation>
    </Paper>
  );
};

export default Navigation;
