import { useState, useEffect, useCallback } from 'react';
import { 
  Container, Typography, Box, Paper, List, ListItem, 
  ListItemText, ListItemIcon, Switch, Button, Divider, Dialog,
  DialogActions, DialogContent, DialogContentText,
  DialogTitle, CircularProgress, Alert, Snackbar
} from '@mui/material';
import { 
  LocationOn, Storage, Sync, DeleteForever, 
  Logout, CloudSync, CloudOff 
} from '../components/AppIcons';
import { useFirebase } from '../context/FirebaseContext';

const ConfigPage = () => {
  const { logout, syncLocalRecords, currentUser } = useFirebase();
  const [useGPS, setUseGPS] = useState(true);
  const [useLocalStorage, setUseLocalStorage] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('');
  const [syncStatus, setSyncStatus] = useState({
    lastSync: localStorage.getItem('lastSync') || null,
    pendingRecords: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const updatePendingRecords = useCallback(() => {
    const records = JSON.parse(localStorage.getItem('guideRecords') || '[]');
    const pending = records.filter(record => !record.synced).length;
    setSyncStatus(prev => ({ ...prev, pendingRecords: pending }));
  }, []);

  useEffect(() => {
    updatePendingRecords();
  }, [updatePendingRecords]);

  useEffect(() => {
    window.addEventListener('guideRecordsUpdated', updatePendingRecords);
    return () => window.removeEventListener('guideRecordsUpdated', updatePendingRecords);
  }, [updatePendingRecords]);

  // Guardar preferencias en localStorage
  useEffect(() => {
    localStorage.setItem('useGPS', JSON.stringify(useGPS));
    localStorage.setItem('useLocalStorage', JSON.stringify(useLocalStorage));
    localStorage.setItem('autoSync', JSON.stringify(autoSync));
  }, [useGPS, useLocalStorage, autoSync]);

  // Cargar preferencias desde localStorage
  useEffect(() => {
    const savedUseGPS = localStorage.getItem('useGPS');
    const savedUseLocalStorage = localStorage.getItem('useLocalStorage');
    const savedAutoSync = localStorage.getItem('autoSync');
    
    if (savedUseGPS !== null) setUseGPS(JSON.parse(savedUseGPS));
    if (savedUseLocalStorage !== null) setUseLocalStorage(JSON.parse(savedUseLocalStorage));
    if (savedAutoSync !== null) setAutoSync(JSON.parse(savedAutoSync));
  }, []);

  // Información del usuario
  const userEmail = currentUser?.email || localStorage.getItem('userEmail') || 'usuario@ejemplo.com';

  const handleOpenDialog = (type) => {
    setDialogType(type);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleLogout = async () => {
    setIsLoading(true);
    
    try {
      // Cerrar sesión en Firebase
      await logout();
      
      // Eliminar datos de sesión local
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userEmail');
      
      // La redirección se maneja automáticamente en el componente AppRoutes
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setSnackbarMessage('Error al cerrar sesión');
      setSnackbarOpen(true);
      setIsLoading(false);
    }
  };

  const syncPendingRecords = useCallback(async ({ silent = false } = {}) => {
    if (isSyncing) return;

    const notify = (message) => {
      if (!silent) {
        setSnackbarMessage(message);
        setSnackbarOpen(true);
      }
    };

    if (!navigator.onLine) {
      notify('Sin conexión a internet. Inténtalo nuevamente cuando tengas señal.');
      return;
    }

    if (!currentUser) {
      notify('Debes iniciar sesión para sincronizar tus registros.');
      return;
    }

    const records = JSON.parse(localStorage.getItem('guideRecords') || '[]');
    const pendingRecords = records.filter(record => !record.synced);

    if (pendingRecords.length === 0) {
      notify('No hay registros pendientes para sincronizar');
      return;
    }

    setIsSyncing(true);

    try {
      const result = await syncLocalRecords(pendingRecords);

      if (result.success) {
        const syncedRecords = result.records || [];
        const syncedIds = new Set(syncedRecords.map(record => record.localId));
        const updatedRecords = records.map(record =>
          syncedIds.has(record.localId) ? { ...record, synced: true } : record
        );

        localStorage.setItem('guideRecords', JSON.stringify(updatedRecords));
        const nowISO = new Date().toISOString();
        localStorage.setItem('lastSync', nowISO);

        const remainingPending = updatedRecords.filter(record => !record.synced).length;
        setSyncStatus({
          lastSync: nowISO,
          pendingRecords: remainingPending
        });

        window.dispatchEvent(new CustomEvent('guideRecordsUpdated'));

        notify(result.message || 'Registros sincronizados correctamente');
      } else {
        notify(result.message || 'Error al sincronizar. Intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error al sincronizar datos:', error);
      notify('Error al sincronizar datos: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, isSyncing, syncLocalRecords]);

  const handleConfirmDialog = () => {
    switch (dialogType) {
      case 'logout':
        handleLogout();
        break;
      case 'clearData':
        // Limpiar datos locales
        localStorage.removeItem('guideRecords');
        setSyncStatus(prev => ({ ...prev, pendingRecords: 0 }));
        break;
      case 'sync':
        syncPendingRecords();
        break;
      default:
        break;
    }
    setOpenDialog(false);
  };

  useEffect(() => {
    if (!autoSync) return;

    const handleOnline = () => {
      syncPendingRecords({ silent: true });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autoSync, syncPendingRecords]);

  // Formatear fecha de última sincronización
  const formatLastSync = () => {
    if (!syncStatus.lastSync) return 'Nunca';
    
    try {
      const date = new Date(syncStatus.lastSync);
      return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Configuración
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <List>
          <ListItem>
            <ListItemIcon>
              <LocationOn />
            </ListItemIcon>
            <ListItemText 
              primary="Usar GPS" 
              secondary="Registrar ubicación al escanear guías"
            />
            <Switch
              edge="end"
              checked={useGPS}
              onChange={(e) => setUseGPS(e.target.checked)}
            />
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <Storage />
            </ListItemIcon>
            <ListItemText 
              primary="Almacenamiento local" 
              secondary="Guardar registros en el dispositivo"
            />
            <Switch
              edge="end"
              checked={useLocalStorage}
              onChange={(e) => setUseLocalStorage(e.target.checked)}
            />
          </ListItem>
          
          <Divider variant="inset" component="li" />
          
          <ListItem>
            <ListItemIcon>
              <Sync />
            </ListItemIcon>
            <ListItemText 
              primary="Sincronización automática" 
              secondary="Sincronizar al detectar conexión"
            />
            <Switch
              edge="end"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
            />
          </ListItem>
        </List>
      </Paper>
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Estado de sincronización
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {syncStatus.pendingRecords > 0 ? (
            <CloudOff color="warning" sx={{ mr: 1 }} />
          ) : (
            <CloudSync color="success" sx={{ mr: 1 }} />
          )}
          <Typography>
            {syncStatus.pendingRecords} registro(s) pendiente(s) de sincronizar
          </Typography>
        </Box>
        <Button 
          variant="outlined" 
          color="error"
          startIcon={<DeleteForever />}
          fullWidth
          sx={{ mb: 2 }}
          onClick={() => handleOpenDialog('clearData')}
        >
          Borrar datos locales
        </Button>
        
        <Button 
          variant="contained" 
          color="primary"
          startIcon={<Logout />}
          fullWidth
          onClick={() => handleOpenDialog('logout')}
        >
          Cerrar sesión
        </Button>
      </Paper>
      
      {/* Diálogos de confirmación */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
      >
        <DialogTitle>
          {dialogType === 'logout' && "Cerrar sesión"}
          {dialogType === 'clearData' && "Borrar datos locales"}
          {dialogType === 'sync' && "Sincronizar datos"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {dialogType === 'logout' && "¿Estás seguro de que deseas cerrar sesión?"}
            {dialogType === 'clearData' && "¿Estás seguro de que deseas borrar todos los datos guardados localmente? Esta acción no se puede deshacer."}
            {dialogType === 'sync' && `¿Deseas sincronizar ${syncStatus.pendingRecords} registro(s) pendiente(s)?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleConfirmDialog} autoFocus color={dialogType === 'clearData' ? 'error' : 'primary'}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ConfigPage;
