import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Dashboard, QrCodeScanner, History, Settings, Users, LocationOn } from './AppIcons';
import { useFirebase } from '../context/FirebaseContext';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useFirebase();

  const tabs = useMemo(() => {
    if (isAdmin) {
      return [
        { label: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
        { label: 'Usuarios', icon: <Users />, path: '/users' },
        { label: 'Destinos', icon: <LocationOn />, path: '/destinations' },
        { label: 'Configuración', icon: <Settings />, path: '/config' }
      ];
    }
    return [
      { label: 'Escanear', icon: <QrCodeScanner />, path: '/scan' },
      { label: 'Registros', icon: <History />, path: '/history' },
      { label: 'Configuración', icon: <Settings />, path: '/config' }
    ];
  }, [isAdmin]);

  const [value, setValue] = useState(() => {
    const index = tabs.findIndex((tab) => location.pathname.startsWith(tab.path));
    return index >= 0 ? index : 0;
  });

  const handleChange = (event, newValue) => {
    setValue(newValue);
    const tab = tabs[newValue];
    if (tab) {
      navigate(tab.path);
    }
  };

  return (
    <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
      <BottomNavigation
        showLabels
        value={value}
        onChange={handleChange}
      >
        {tabs.map((tab) => (
          <BottomNavigationAction key={tab.path} label={tab.label} icon={tab.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default Navigation;
