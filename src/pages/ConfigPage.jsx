import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Box, Paper, List, ListItem, 
  ListItemText, Switch, Button, Divider, Dialog,
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

  // Verificar registros pendientes de sincronización
  useEffect(() => {
    const records = JSON.parse(localStorage.getItem('guideRecords') || '[]');
    const pending = records.filter(record => !record.synced).length;
    setSyncStatus(prev => ({ ...prev, pendingRecords: pending }));
  }, []);

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

  const handleSyncData = async () => {
    setIsSyncing(true);
    
    try {
      // Recuperar registros pendientes de sincronizar
      const records = JSON.parse(localStorage.getItem('guideRecords') || '[]');
      const pendingRecords = records.filter(record => !record.synced);
      
      if (pendingRecords.length === 0) {
        setSnackbarMessage('No hay registros pendientes para sincronizar');
        setSnackbarOpen(true);
        setIsSyncing(false);
        return;
      }
      
      // Sincronizar con Firebase
      const result = await syncLocalRecords(pendingRecords);
      
      if (result.success) {
        // Marcar como sincronizados en localStorage
        const updatedRecords = records.map(record => ({ ...record, synced: true }));
        localStorage.setItem('guideRecords', JSON.stringify(updatedRecords));
        
        // Actualizar estadísticas
        setSyncStatus({
          lastSync: new Date().toISOString(),
          pendingRecords: 0
        });
        localStorage.setItem('lastSync', new Date().toISOString());
        
        // Mostrar mensaje de éxito
        setSnackbarMessage(result.message);
      } else {
        // Mostrar mensaje de error
        setSnackbarMessage('Error al sincronizar: ' + (result.message || 'Intente nuevamente'));
      }
      
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error al sincronizar datos:', error);
      setSnackbarMessage('Error al sincronizar datos: ' + error.message);
      setSnackbarOpen(true);
    } finally {
      setIsSyncing(false);
    }
  };

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
        handleSyncData();
        break;
      default:
        break;
    }
    setOpenDialog(false);
  };

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
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Última sincronización: {formatLastSync()}
        </Typography>
        
        <Button 
          variant="outlined" 
          startIcon={<Sync />}
          fullWidth
          sx={{ mt: 1 }}
          onClick={() => handleOpenDialog('sync')}
          disabled={syncStatus.pendingRecords === 0}
        >
          Sincronizar ahora
        </Button>
      </Paper>
      
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Cuenta y datos
        </Typography>
        
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
