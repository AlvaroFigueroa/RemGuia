import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { QrCodeScanner, History, Settings } from './AppIcons';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determinar la página actual basada en la ruta
  const getValueFromPath = (path) => {
    if (path.includes('/scan')) return 0;
    if (path.includes('/history')) return 1;
    if (path.includes('/config')) return 2;
    return 0;
  };
  
  const [value, setValue] = useState(getValueFromPath(location.pathname));

  const handleChange = (event, newValue) => {
    setValue(newValue);
    switch (newValue) {
      case 0:
        navigate('/scan');
        break;
      case 1:
        navigate('/history');
        break;
      case 2:
        navigate('/config');
        break;
      default:
        navigate('/scan');
    }
  };

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={handleChange}
      >
        <BottomNavigationAction label="Escanear" icon={<QrCodeScanner />} />
        <BottomNavigationAction label="Historial" icon={<History />} />
        <BottomNavigationAction label="Configuración" icon={<Settings />} />
      </BottomNavigation>
    </Paper>
  );
};

export default Navigation;
