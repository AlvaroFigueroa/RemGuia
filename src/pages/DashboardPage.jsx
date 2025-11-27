import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Tooltip
} from '@mui/material';
import { useFirebase } from '../context/FirebaseContext';
import {
  LocationOn,
  CloudSync,
  CloudOff,
  CloudDone,
  Image
} from '../components/AppIcons';

const isoDate = (date) => date.toISOString().split('T')[0];
const today = new Date();
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(today.getDate() - 7);

const normalizeGuide = (guide, fallback = {}) => {
  const guideNumber = String(
    guide?.guideNumber ??
    guide?.guia ??
    guide?.guiaNumero ??
    guide?.numero ??
    ''
  ).trim();

  return {
    guideNumber,
    ubicacion: guide?.ubicacion ?? guide?.location ?? fallback.ubicacion ?? 'No definida',
    destino: guide?.destino ?? guide?.destination ?? fallback.destino ?? 'No definido',
    date: guide?.date ?? guide?.fecha ?? guide?.createdAt ?? null,
    rawRecord: guide
  };
};

const formatDate = (value) => {
  if (!value) return 'Fecha no disponible';
  const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Fecha no disponible';
  return parsed.toLocaleString('es-CL');
};

const DashboardPage = () => {
  const { getGuideRecords, currentUser } = useFirebase();
  const [filters, setFilters] = useState({
    startDate: isoDate(sevenDaysAgo),
    endDate: isoDate(today),
    ubicacion: 'Todos',
    destino: 'Todos'
  });
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState('');
  const [ubicacionGuides, setUbicacionGuides] = useState([]);
  const [destinoGuides, setDestinoGuides] = useState([]);
  const [differences, setDifferences] = useState({
    missingInDestino: [],
    missingInUbicacion: []
  });
  const [selectedImage, setSelectedImage] = useState(null);

  const transporteApiBaseUrl = useMemo(() => {
    const base = import.meta.env.VITE_TRANSPORTE_API || '';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const parseDateValue = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const filterByRange = useCallback((guides, range) => {
    return guides.filter((guide) => {
      if (!guide.guideNumber) return false;
      const guideDate = parseDateValue(guide.date);
      if (!guideDate) return true;
      const start = range.startDate ? new Date(range.startDate) : null;
      const end = range.endDate ? new Date(range.endDate) : null;
      if (start && guideDate < new Date(`${range.startDate}T00:00:00`)) return false;
      if (end && guideDate > new Date(`${range.endDate}T23:59:59`)) return false;
      return true;
    });
  }, []);

  const fetchDestinoGuides = useCallback(async (range) => {
    if (!currentUser) {
      throw new Error('Debes iniciar sesión para ver el panel.');
    }
    const records = await getGuideRecords();
    const normalized = records.map((record) => normalizeGuide(record, {
      ubicacion: record?.location?.alias || record?.location?.name,
      destino: record?.destination || record?.destino
    }));

    const filtered = filterByRange(normalized, range).filter((guide) => {
      const destinoMatches = range.destino === 'Todos'
        || guide.destino?.toLowerCase()?.includes(range.destino.toLowerCase());
      const ubicacionMatches = range.ubicacion === 'Todos'
        || guide.ubicacion?.toLowerCase()?.includes(range.ubicacion.toLowerCase());
      return destinoMatches && ubicacionMatches;
    });

    return filtered;
  }, [currentUser, getGuideRecords, filterByRange]);

  const fetchUbicacionGuides = useCallback(async (range) => {
    if (!transporteApiBaseUrl) {
      console.warn('VITE_TRANSPORTE_API no está configurado.');
      return [];
    }

    const params = new URLSearchParams();
    if (range.startDate) params.append('startDate', range.startDate);
    if (range.endDate) params.append('endDate', range.endDate);
    if (range.ubicacion && range.ubicacion !== 'Todos') params.append('ubicacion', range.ubicacion);
    if (range.destino && range.destino !== 'Todos') params.append('destino', range.destino);

    const response = await fetch(`${transporteApiBaseUrl}/transporte?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudieron obtener las guías de ubicación (SQL).');
    }

    const data = await response.json();
    const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [];

    return records.map((record) => normalizeGuide(record));
  }, [transporteApiBaseUrl]);

  const compareGuides = useCallback((ubicacion, destino) => {
    const destinoSet = new Set(destino.map((guide) => guide.guideNumber));
    const ubicacionSet = new Set(ubicacion.map((guide) => guide.guideNumber));

    const missingInDestino = ubicacion.filter((guide) => !destinoSet.has(guide.guideNumber));
    const missingInUbicacion = destino.filter((guide) => !ubicacionSet.has(guide.guideNumber));

    return {
      missingInDestino,
      missingInUbicacion
    };
  }, []);

  const handleCompare = useCallback(async () => {
    setIsComparing(true);
    setError('');
    try {
      const [destinoData, ubicacionData] = await Promise.all([
        fetchDestinoGuides(filters),
        fetchUbicacionGuides(filters)
      ]);

      setDestinoGuides(destinoData);
      setUbicacionGuides(ubicacionData);
      setDifferences(compareGuides(ubicacionData, destinoData));
    } catch (err) {
      console.error('Error al comparar guías:', err);
      setError(err.message || 'No se pudo comparar la información.');
    } finally {
      setIsComparing(false);
    }
  }, [fetchDestinoGuides, fetchUbicacionGuides, compareGuides, filters]);

  useEffect(() => {
    if (currentUser) {
      handleCompare();
    }
  }, [currentUser, handleCompare]);

  const totalUbicacion = ubicacionGuides.length;
  const totalDestino = destinoGuides.length;
  const totalDiferencias = differences.missingInDestino.length + differences.missingInUbicacion.length;

  const ubicacionOptions = useMemo(() => {
    const set = new Set(['Todos']);
    ubicacionGuides.forEach((guide) => {
      if (guide.ubicacion) set.add(guide.ubicacion);
    });
    return Array.from(set);
  }, [ubicacionGuides]);

  const destinoOptions = useMemo(() => {
    const set = new Set(['Todos']);
    destinoGuides.forEach((guide) => {
      if (guide.destino) set.add(guide.destino);
    });
    return Array.from(set);
  }, [destinoGuides]);

  return (
    <Container maxWidth="md" sx={{ pt: 3, pb: 10 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center">
        Panel de Control
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filtros
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Desde"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Hasta"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Ubicación"
              select
              fullWidth
              value={filters.ubicacion}
              onChange={(e) => handleFilterChange('ubicacion', e.target.value)}
            >
              {ubicacionOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Destino"
              select
              fullWidth
              value={filters.destino}
              onChange={(e) => handleFilterChange('destino', e.target.value)}
            >
              {destinoOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: 'stretch' }}
      >
        <Paper
          elevation={2}
          sx={{
            p: 3,
            flex: 1,
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Guías desde Ubicación
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn />
            <Typography variant="h3">{totalUbicacion}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Registros provenientes del sistema de transporte (SQL).
          </Typography>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            p: 3,
            flex: 1,
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Guías en Destino
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudSync />
            <Typography variant="h3">{totalDestino}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Datos recibidos desde la app en terreno (Firestore).
          </Typography>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            p: 3,
            flex: 1,
            minHeight: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Diferencia
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {totalDiferencias > 0 ? <CloudOff /> : <CloudSync />}
            <Typography variant="h3" color={totalDiferencias ? 'error.main' : 'success.main'}>
              {totalDiferencias}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {totalDiferencias > 0
              ? 'Revisa las listas para conocer los detalles.'
              : 'Sin diferencias detectadas en este rango.'}
          </Typography>
        </Paper>
      </Stack>

      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">SQL - Guías por Ubicación</Typography>
              <Chip label={`${ubicacionGuides.length} guías`} color="default" />
            </Box>
            {ubicacionGuides.length === 0 ? (
              <Alert severity="info">
                Aún no hay guías desde la base SQL para este filtro.
              </Alert>
            ) : (
              <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                {ubicacionGuides.map((guide, index) => (
                  <Box key={`sql-${guide.guideNumber}-${index}`}>
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                        borderRadius: 1,
                        px: 2
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              N° {guide.guideNumber || 'Sin número'}
                            </Typography>
                            <Chip size="small" label={guide.destino || 'Sin destino'} />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.secondary">
                              {formatDate(guide.date)}
                            </Typography>
                            <Typography component="span" variant="body2" display="block">
                              Ubicación: {guide.ubicacion || 'No definida'}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    {index < ubicacionGuides.length - 1 && <Divider component="li" />}
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Paper elevation={3} sx={{ p: 2, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Firestore - Guías en destino</Typography>
              <Chip label={`${destinoGuides.length} guías`} color="primary" icon={<CloudDone />} />
            </Box>
            {destinoGuides.length === 0 ? (
              <Alert severity="info">
                Aún no hay registros en este rango de fechas.
              </Alert>
            ) : (
              <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                {destinoGuides.map((guide, index) => {
                  const record = guide.rawRecord || {};
                  return (
                    <Box key={`fs-${guide.guideNumber}-${index}`}>
                      <ListItem
                        alignItems="flex-start"
                        sx={{
                          backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                          borderRadius: 1,
                          px: 2
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                N° {guide.guideNumber || 'Sin número'}
                              </Typography>
                              <Chip
                                size="small"
                                icon={record.synced ? <CloudDone /> : <CloudOff />}
                                label={record.synced ? 'Sincronizado' : 'Pendiente'}
                                color={record.synced ? 'success' : 'warning'}
                              />
                            </Box>
                          }
                          secondary={
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                                <Typography component="span" variant="body2" color="text.secondary">
                                  {formatDate(record.date || guide.date)}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {(record.location?.latitude && record.location.latitude !== 'No disponible') && (
                                    <Tooltip title="Abrir en Google Maps">
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
                                  {record.imageData && (
                                    <Tooltip title="Ver imagen">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => setSelectedImage({
                                          src: record.imageData,
                                          guideNumber: guide.guideNumber
                                        })}
                                      >
                                        <Image />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </Box>
                            </>
                          }
                        />
                      </ListItem>
                      {index < destinoGuides.length - 1 && <Divider component="li" />}
                    </Box>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={Boolean(selectedImage)}
        onClose={() => setSelectedImage(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {selectedImage && (
            <Box sx={{ position: 'relative' }}>
              <IconButton
                aria-label="Cerrar"
                onClick={() => setSelectedImage(null)}
                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
              >
                ✕
              </IconButton>
              <Box
                component="img"
                src={selectedImage.src}
                alt={`Imagen guía ${selectedImage.guideNumber}`}
                sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default DashboardPage;
