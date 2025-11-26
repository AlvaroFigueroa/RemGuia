import { useState, useEffect } from 'react';
import { 
  Container, Typography, Box, Paper, List, ListItem, 
  ListItemText, Divider, TextField, InputAdornment,
  IconButton, Chip, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Alert, Button, Tooltip
} from '@mui/material';
import { Search, CloudDone, CloudOff, Refresh, LocationOn } from '../components/AppIcons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFirebase } from '../context/FirebaseContext';

const HistoryPage = () => {
  const { getGuideRecords, currentUser } = useFirebase();
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar registros
  useEffect(() => {
    if (!currentUser) {
      setRecords([]);
      setFilteredRecords([]);
      setError('Debes iniciar sesión para ver tus registros.');
      return;
    }

    loadRecords();
  }, [currentUser]);
  
  // Función para cargar registros desde la fuente seleccionada
  const loadRecords = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const firebaseRecords = await getGuideRecords();
      setRecords(firebaseRecords);
      setFilteredRecords(firebaseRecords);
    } catch (error) {
      console.error('Error al cargar registros:', error);
      setError('Error al cargar registros: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar registros cuando cambia el término de búsqueda o el filtro de fecha
  useEffect(() => {
    let filtered = [...records];
    
    // Filtrar por número de guía
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.guideNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtrar por fecha
    if (dateFilter !== 'all') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(record => 
            record.date.split('T')[0] === todayStr
          );
          break;
        case 'week':
          const weekAgo = new Date();
          weekAgo.setDate(today.getDate() - 7);
          filtered = filtered.filter(record => 
            new Date(record.date) >= weekAgo
          );
          break;
        case 'month':
          const monthAgo = new Date();
          monthAgo.setMonth(today.getMonth() - 1);
          filtered = filtered.filter(record => 
            new Date(record.date) >= monthAgo
          );
          break;
        default:
          break;
      }
    }
    
    // Ordenar por fecha (más reciente primero)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setFilteredRecords(filtered);
  }, [records, searchTerm, dateFilter]);

  // Formatear fecha para mostrar
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
    } catch (error) {
      return "Fecha inválida";
    }
  };

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Registros
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            label="Buscar por número de guía"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton>
                    <Search />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth variant="outlined">
            <InputLabel>Filtrar por fecha</InputLabel>
            <Select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              label="Filtrar por fecha"
            >
              <MenuItem value="all">Todas las fechas</MenuItem>
              <MenuItem value="today">Hoy</MenuItem>
              <MenuItem value="week">Última semana</MenuItem>
              <MenuItem value="month">Último mes</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start', gap: 1, alignItems: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadRecords}
            size="small"
            disabled={!currentUser}
          >
            Actualizar
          </Button>
        </Box>
        
        <Typography variant="subtitle1" gutterBottom>
          {filteredRecords.length} registro(s) encontrado(s) en Firestore
        </Typography>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            {filteredRecords.length > 0 ? (
            filteredRecords.map((record, index) => (
              <Box key={index}>
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" component="span">
                          {record.guideNumber}
                        </Typography>
                        <Chip
                          icon={record.synced ? <CloudDone /> : <CloudOff />}
                          label={record.synced ? "Sincronizado" : "Pendiente"}
                          color={record.synced ? "success" : "warning"}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {formatDate(record.date)}
                        </Typography>
                        {record.location && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography component="p" variant="body2" sx={{ flex: 1 }}>
                              {record.location.latitude !== 'No disponible' 
                                ? `Ubicación registrada`
                                : 'Ubicación no disponible'
                              }
                            </Typography>
                            {record.location.latitude !== 'No disponible' && (
                              <Tooltip title="Ver en Google Maps">
                                <IconButton 
                                  size="small" 
                                  color="primary" 
                                  onClick={() => {
                                    const url = `https://www.google.com/maps?q=${record.location.latitude},${record.location.longitude}`;
                                    window.open(url, '_blank');
                                  }}
                                >
                                  <LocationOn />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        )}
                        {record.fileName && (
                          <Typography component="p" variant="body2">
                            Archivo: {record.fileName}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
                {index < filteredRecords.length - 1 && <Divider component="li" />}
              </Box>
            ))
          ) : (
            <ListItem>
              <ListItemText 
                primary="No hay registros" 
                secondary="No se encontraron registros en Firestore"
              />
            </ListItem>
          )}
        </List>
        )}
      </Paper>
    </Container>
  );
};

export default HistoryPage;
