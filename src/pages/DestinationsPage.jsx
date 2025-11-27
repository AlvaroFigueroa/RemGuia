import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  Box,
  Chip,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Add, Delete } from '../components/AppIcons';
import { useFirebase } from '../context/FirebaseContext';

const DestinationsPage = () => {
  const {
    getDestinationsCatalog,
    createDestinationCatalog,
    updateDestinationCatalog,
    deleteDestinationCatalog,
    getLocationsCatalog,
    createLocationCatalog,
    deleteLocationCatalog
  } = useFirebase();

  const [destinations, setDestinations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [newDestination, setNewDestination] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [subInputs, setSubInputs] = useState({});
  const [feedback, setFeedback] = useState({ type: null, message: '' });

  const loadDestinations = useCallback(async () => {
    setLoadingDestinations(true);
    try {
      const data = await getDestinationsCatalog();
      setDestinations(data);
    } catch (error) {
      console.error('Error al cargar destinos:', error);
      setFeedback({ type: 'error', message: 'No se pudieron cargar los destinos.' });
    } finally {
      setLoadingDestinations(false);
    }
  }, [getDestinationsCatalog]);

  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    try {
      const data = await getLocationsCatalog();
      setLocations(data);
    } catch (error) {
      console.error('Error al cargar ubicaciones:', error);
      setFeedback({ type: 'error', message: 'No se pudieron cargar las ubicaciones.' });
    } finally {
      setLoadingLocations(false);
    }
  }, [getLocationsCatalog]);

  useEffect(() => {
    loadDestinations();
    loadLocations();
  }, [loadDestinations, loadLocations]);

  const handleCreateDestination = async (event) => {
    event.preventDefault();
    if (!newDestination.trim()) return;
    try {
      await createDestinationCatalog({ name: newDestination });
      setNewDestination('');
      setFeedback({ type: 'success', message: 'Destino creado correctamente.' });
      loadDestinations();
    } catch (error) {
      console.error('Error al crear destino:', error);
      setFeedback({ type: 'error', message: error.message || 'No se pudo crear el destino.' });
    }
  };

  const handleDeleteDestination = async (id) => {
    if (!window.confirm('¿Eliminar este destino?')) return;
    try {
      await deleteDestinationCatalog(id);
      setFeedback({ type: 'success', message: 'Destino eliminado.' });
      loadDestinations();
    } catch (error) {
      console.error('Error al eliminar destino:', error);
      setFeedback({ type: 'error', message: error.message || 'No se pudo eliminar el destino.' });
    }
  };

  const handleAddSubDestination = async (id) => {
    const value = subInputs[id]?.trim();
    if (!value) return;
    const destination = destinations.find((dest) => dest.id === id);
    if (!destination) return;
    try {
      await updateDestinationCatalog(id, {
        subDestinations: [...destination.subDestinations, value]
      });
      setSubInputs((prev) => ({ ...prev, [id]: '' }));
      setFeedback({ type: 'success', message: 'Subdestino agregado.' });
      loadDestinations();
    } catch (error) {
      console.error('Error al agregar subdestino:', error);
      setFeedback({ type: 'error', message: error.message || 'No se pudo agregar el subdestino.' });
    }
  };

  const handleRemoveSubDestination = async (id, subName) => {
    const destination = destinations.find((dest) => dest.id === id);
    if (!destination) return;
    try {
      await updateDestinationCatalog(id, {
        subDestinations: destination.subDestinations.filter((sub) => sub !== subName)
      });
      setFeedback({ type: 'success', message: 'Subdestino eliminado.' });
      loadDestinations();
    } catch (error) {
      console.error('Error al eliminar subdestino:', error);
      setFeedback({ type: 'error', message: error.message || 'No se pudo eliminar el subdestino.' });
    }
  };

  const handleCreateLocation = async (event) => {
    event.preventDefault();
    if (!newLocation.trim()) return;
    try {
      await createLocationCatalog({ name: newLocation });
      setNewLocation('');
      setFeedback({ type: 'success', message: 'Ubicación creada correctamente.' });
      loadLocations();
    } catch (error) {
      console.error('Error al crear ubicación:', error);
      setFeedback({ type: 'error', message: error.message || 'No se pudo crear la ubicación.' });
    }
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('¿Eliminar esta ubicación?')) return;
    try {
      await deleteLocationCatalog(id);
      setFeedback({ type: 'success', message: 'Ubicación eliminada.' });
      loadLocations();
    } catch (error) {
      console.error('Error al eliminar ubicación:', error);
      setFeedback({ type: 'error', message: error.message || 'No se pudo eliminar la ubicación.' });
    }
  };

  return (
    <Container maxWidth="md" sx={{ pt: 3, pb: 10 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Gestión de Destinos
      </Typography>

      {feedback.message && (
        <Alert
          severity={feedback.type === 'error' ? 'error' : 'success'}
          sx={{ mb: 3 }}
          onClose={() => setFeedback({ type: null, message: '' })}
        >
          {feedback.message}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} component="form" onSubmit={handleCreateDestination}>
          <TextField
            label="Nuevo destino"
            value={newDestination}
            onChange={(e) => setNewDestination(e.target.value)}
            fullWidth
          />
          <Button type="submit" variant="contained" startIcon={<Add />}>
            Agregar destino
          </Button>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {loadingDestinations ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : destinations.length === 0 ? (
          <Typography color="text.secondary">Aún no hay destinos registrados.</Typography>
        ) : (
          <Stack spacing={2}>
            {destinations.map((destination) => (
              <Paper key={destination.id} variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">{destination.name}</Typography>
                  <IconButton color="error" size="small" onClick={() => handleDeleteDestination(destination.id)}>
                    <Delete />
                  </IconButton>
                </Box>

                <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                  {destination.subDestinations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No hay subdestinos todavía.
                    </Typography>
                  ) : (
                    destination.subDestinations.map((sub) => (
                      <Chip key={sub} label={sub} onDelete={() => handleRemoveSubDestination(destination.id, sub)} />
                    ))
                  )}
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="Nuevo subdestino"
                    value={subInputs[destination.id] || ''}
                    onChange={(e) =>
                      setSubInputs((prev) => ({
                        ...prev,
                        [destination.id]: e.target.value
                      }))
                    }
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={() => handleAddSubDestination(destination.id)}
                  >
                    Agregar subdestino
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Ubicaciones
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} component="form" onSubmit={handleCreateLocation}>
          <TextField
            label="Nueva ubicación"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            fullWidth
          />
          <Button type="submit" variant="contained" color="secondary" startIcon={<Add />}>
            Agregar ubicación
          </Button>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {loadingLocations ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : locations.length === 0 ? (
          <Typography color="text.secondary">Aún no hay ubicaciones registradas.</Typography>
        ) : (
          <List>
            {locations.map((location) => (
              <ListItem
                key={location.id}
                secondaryAction={
                  <IconButton edge="end" color="error" onClick={() => handleDeleteLocation(location.id)}>
                    <Delete />
                  </IconButton>
                }
              >
                <ListItemText primary={location.name} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default DestinationsPage;
