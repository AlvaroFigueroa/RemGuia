import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
  DialogTitle,
  DialogActions,
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

const isoDate = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};
const today = new Date();

const normalizeGuide = (guide, fallback = {}) => {
  const guideNumber = String(
    guide?.guideNumber ??
    guide?.guia ??
    guide?.guiaNumero ??
    guide?.numero ??
    ''
  ).trim();

  const subDestino =
    guide?.subDestination ??
    guide?.subDestino ??
    guide?.subDest ??
    guide?.subdestino ??
    guide?.SubDestino ??
    guide?.sub_destino ??
    guide?.SubDesGDSur ??
    guide?.SubDesGDNorte ??
    guide?.subD413884 ??
    guide?.subD416335 ??
    fallback.subDestino ??
    '';

  return {
    guideNumber,
    ubicacion: guide?.ubicacion ?? guide?.location ?? fallback.ubicacion ?? 'No definido',
    destino: guide?.destino ?? guide?.destination ?? fallback.destino ?? 'No definido',
    subDestino,
    date: guide?.date ?? guide?.fecha ?? guide?.createdAt ?? null,
    rawRecord: guide
  };
};

const buildGuideKey = (guide) => {
  const guideNumber = guide?.guideNumber ? String(guide.guideNumber).trim() : '';
  const subDestino = guide?.subDestino ? String(guide.subDestino).trim().toLowerCase() : '';
  return `${guideNumber}||${subDestino}`;
};

const getLocationLabel = (guide) => {
  if (!guide) return 'No registrada';
  const direct = typeof guide.ubicacion === 'string' ? guide.ubicacion.trim() : '';
  if (direct) return direct;

  const record = guide.rawRecord || guide;
  const location = record?.location;

  if (typeof location === 'string' && location.trim()) return location.trim();

  const alias = typeof location?.alias === 'string' ? location.alias.trim() : '';
  if (alias) return alias;

  const name = typeof location?.name === 'string' ? location.name.trim() : '';
  if (name) return name;

  return 'No registrada';
};

const formatDate = (value) => {
  if (!value) return 'Fecha no disponible';
  const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Fecha no disponible';
  return parsed.toLocaleString('es-CL');
};

const DashboardPage = () => {
  const { getGuideRecords, currentUser, getDestinationsCatalog, getLocationsCatalog } = useFirebase();
  const [filters, setFilters] = useState({
    startDate: isoDate(today),
    endDate: isoDate(today),
    ubicacion: 'Todos',
    destino: 'Todos',
    subDestino: 'Todos'
  });
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState('');
  const [ubicacionGuides, setUbicacionGuides] = useState([]);
  const [destinoGuides, setDestinoGuides] = useState([]);
  const [differences, setDifferences] = useState({
    missingInDestino: [],
    missingInUbicacion: [],
    matches: []
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [showDifferencesModal, setShowDifferencesModal] = useState(false);
  const [destinationsCatalog, setDestinationsCatalog] = useState([]);
  const [locationsCatalog, setLocationsCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState({ destinations: false, locations: false });
  const filtersRef = useRef(filters);

  const transporteApiBaseUrl = useMemo(() => {
    const envBase = (import.meta.env.VITE_TRANSPORTE_API || '').trim();
    const base = envBase.length > 0 ? envBase : 'https://guia.codecland.com/api';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

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
      const subDestinoMatches = range.subDestino === 'Todos'
        || guide.subDestino?.toLowerCase()?.includes(range.subDestino.toLowerCase());
      return destinoMatches && ubicacionMatches && subDestinoMatches;
    });

    return filtered;
  }, [currentUser, getGuideRecords, filterByRange]);

  const fetchUbicacionGuides = useCallback(async (range) => {
    const params = new URLSearchParams();
    if (range.startDate) params.append('startDate', range.startDate);
    if (range.endDate) params.append('endDate', range.endDate);
    if (range.ubicacion && range.ubicacion !== 'Todos') params.append('ubicacion', range.ubicacion);
    if (range.destino && range.destino !== 'Todos') params.append('destino', range.destino);
    if (range.subDestino && range.subDestino !== 'Todos') params.append('subDestino', range.subDestino);

    const response = await fetch(`${transporteApiBaseUrl}/transporte_by_date.php?${params.toString()}`);
    if (!response.ok) {
      throw new Error('No se pudieron obtener las guías de origen (SQL).');
    }

    const data = await response.json();
    if (!data?.success) {
      throw new Error(data?.message || 'Respuesta inválida desde la API SQL.');
    }

    const records = Array.isArray(data?.data) ? data.data : [];

    const normalized = records.map((record) => normalizeGuide(record));

    return normalized.filter((guide) => {
      const destinoMatches = range.destino === 'Todos'
        || guide.destino?.toLowerCase()?.includes(range.destino.toLowerCase());
      const ubicacionMatches = range.ubicacion === 'Todos'
        || guide.ubicacion?.toLowerCase()?.includes(range.ubicacion.toLowerCase());
      const subDestinoMatches = range.subDestino === 'Todos'
        || guide.subDestino?.toLowerCase()?.includes(range.subDestino.toLowerCase());
      return destinoMatches && ubicacionMatches && subDestinoMatches;
    });
  }, [transporteApiBaseUrl]);

  const compareGuides = useCallback((ubicacion, destino) => {
    const destinoKeyMap = new Map(destino.map((guide) => [buildGuideKey(guide), guide]));
    const ubicacionKeyMap = new Map(ubicacion.map((guide) => [buildGuideKey(guide), guide]));

    const missingInDestino = ubicacion.filter((guide) => !destinoKeyMap.has(buildGuideKey(guide)));
    const missingInUbicacion = destino.filter((guide) => !ubicacionKeyMap.has(buildGuideKey(guide)));
    const matches = [];

    destinoKeyMap.forEach((guide, key) => {
      if (!guide?.guideNumber) return;
      const sqlGuide = ubicacionKeyMap.get(key);
      if (sqlGuide) {
        matches.push({
          key,
          guideNumber: guide.guideNumber,
          subDestino: guide.subDestino || sqlGuide.subDestino || '',
          firestore: guide,
          sql: sqlGuide
        });
      }
    });

    return {
      missingInDestino,
      missingInUbicacion,
      matches
    };
  }, []);

  const handleCompare = useCallback(async (range) => {
    const activeFilters = range || filtersRef.current;
    setIsComparing(true);
    setError('');
    try {
      const [destinoData, ubicacionData] = await Promise.all([
        fetchDestinoGuides(activeFilters),
        fetchUbicacionGuides(activeFilters)
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
  }, [fetchDestinoGuides, fetchUbicacionGuides, compareGuides]);

  const loadDestinationsCatalog = useCallback(async () => {
    setCatalogLoading((prev) => ({ ...prev, destinations: true }));
    try {
      const data = await getDestinationsCatalog();
      setDestinationsCatalog(data);
    } catch (error) {
      console.error('Error al cargar destinos:', error);
      setCatalogError('No se pudieron cargar los destinos disponibles.');
    } finally {
      setCatalogLoading((prev) => ({ ...prev, destinations: false }));
    }
  }, [getDestinationsCatalog]);

  const loadLocationsCatalog = useCallback(async () => {
    setCatalogLoading((prev) => ({ ...prev, locations: true }));
    try {
      const data = await getLocationsCatalog();
      setLocationsCatalog(data);
    } catch (error) {
      console.error('Error al cargar orígenes:', error);
      setCatalogError('No se pudieron cargar los orígenes disponibles.');
    } finally {
      setCatalogLoading((prev) => ({ ...prev, locations: false }));
    }
  }, [getLocationsCatalog]);

  useEffect(() => {
    if (currentUser) {
      handleCompare();
      loadDestinationsCatalog();
      loadLocationsCatalog();
    }
  }, [currentUser, handleCompare, loadDestinationsCatalog, loadLocationsCatalog]);

  useEffect(() => {
    if (!currentUser) return;
    const timeout = setTimeout(() => handleCompare(filters), 200);
    return () => clearTimeout(timeout);
  }, [filters, handleCompare, currentUser]);

  const totalUbicacion = ubicacionGuides.length;
  const totalDestino = destinoGuides.length;
  const totalDiferencias = differences.missingInDestino.length + differences.missingInUbicacion.length;
  const totalCoincidencias = differences.matches.length;

  const renderGuideList = (
    items = [],
    originLabel,
    emptyLabel,
    chipColor = 'default',
    highlightColor = 'transparent'
  ) => {
    if (!items.length) {
      return (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      );
    }

    return (
      <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
        {items.map((guide, index) => (
          <ListItem
            key={`${originLabel}-${buildGuideKey(guide)}-${index}`}
            alignItems="flex-start"
            sx={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 0.5,
              backgroundColor: highlightColor,
              borderRadius: 1,
              border: '1px solid',
              borderColor: `${chipColor}.main` || 'divider',
              mb: 1
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">N° {guide.guideNumber || 'Sin número'}</Typography>
              <Chip size="small" label={originLabel} color={chipColor} variant="outlined" />
            </Box>
            <Typography variant="body2">Destino: {guide.destino || 'No definido'}</Typography>
            <Typography variant="body2">Subdestino: {guide.subDestino || 'No definido'}</Typography>
            <Typography variant="body2">Origen: {getLocationLabel(guide)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(guide.date)}
            </Typography>
          </ListItem>
        ))}
      </List>
    );
  };

  const renderMatchesList = (items = []) => {
    if (!items.length) {
      return (
        <Typography variant="body2" color="text.secondary">
          No hay coincidencias en este rango.
        </Typography>
      );
    }

    return (
      <List dense sx={{ maxHeight: 240, overflow: 'auto' }}>
        {items.map((match, index) => (
          <ListItem
            key={`match-${match.key}-${index}`}
            alignItems="flex-start"
            sx={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 0.5,
              backgroundColor: 'rgba(56, 142, 60, 0.08)',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'success.light',
              mb: 1
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">N° {match.guideNumber}</Typography>
              <Chip size="small" label="Coincidencia" color="success" variant="outlined" />
            </Box>
            <Typography variant="body2">Subdestino: {match.subDestino || 'No definido'}</Typography>
            <Typography variant="body2" fontWeight={600}>Origen</Typography>
            <Typography variant="body2">Destino: {match.sql?.destino || 'No definido'}</Typography>
            <Typography variant="body2">Origen: {getLocationLabel(match.sql)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(match.sql?.date)}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>Destino</Typography>
            <Typography variant="body2">Destino: {match.firestore?.destino || match.firestore?.destination || 'No definido'}</Typography>
            <Typography variant="body2">Origen: {getLocationLabel(match.firestore)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(match.firestore?.date)}
            </Typography>
          </ListItem>
        ))}
      </List>
    );
  };

  const ubicacionOptions = useMemo(() => {
    const names = locationsCatalog
      .map((location) => location.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    return ['Todos', ...names];
  }, [locationsCatalog]);

  const destinoOptions = useMemo(() => {
    const names = destinationsCatalog
      .map((destination) => destination.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    return ['Todos', ...names];
  }, [destinationsCatalog]);

  const selectedDestination = useMemo(
    () => destinationsCatalog.find((dest) => dest.name === filters.destino),
    [destinationsCatalog, filters.destino]
  );

  const subDestinoOptions = useMemo(() => {
    const base = ['Todos'];
    if (!selectedDestination?.subDestinations?.length) return base;
    const sorted = [...selectedDestination.subDestinations].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
    return [...base, ...sorted];
  }, [selectedDestination]);

  const hasSubDestinoFilter = subDestinoOptions.length > 1;

  useEffect(() => {
    if (!hasSubDestinoFilter && filters.subDestino !== 'Todos') {
      setFilters((prev) => ({ ...prev, subDestino: 'Todos' }));
    }
  }, [hasSubDestinoFilter, filters.subDestino]);

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
      {catalogError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setCatalogError('')}>
          {catalogError}
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
              label="Origen"
              select
              fullWidth
              value={filters.ubicacion}
              onChange={(e) => handleFilterChange('ubicacion', e.target.value)}
              SelectProps={{
                MenuProps: { disableScrollLock: true }
              }}
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
              SelectProps={{
                MenuProps: { disableScrollLock: true }
              }}
            >
              {destinoOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {hasSubDestinoFilter && (
            <Grid item xs={12} sm={6}>
              <TextField
                label="Subdestino"
                select
                fullWidth
                value={filters.subDestino}
                onChange={(e) => handleFilterChange('subDestino', e.target.value)}
                SelectProps={{
                  MenuProps: { disableScrollLock: true }
                }}
              >
                {subDestinoOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
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
            p: 2,
            flex: 1,
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Guías desde Origen
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
            p: 2,
            flex: 1,
            minHeight: 180,
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
            p: 2,
            flex: 1,
            minHeight: 180,
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
          <Button
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-start', mt: 1 }}
            onClick={() => setShowDifferencesModal(true)}
            disabled={!totalUbicacion && !totalDestino}
          >
            Ver detalle
          </Button>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            p: 2,
            flex: 1,
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Coinciden
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudDone color="success" />
            <Typography variant="h3" color="success.main">
              {totalCoincidencias}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Guías con el mismo número en ambos orígenes.
          </Typography>
        </Paper>
      </Stack>

      <Grid container spacing={3} alignItems="stretch" justifyContent="center">
        <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paper elevation={3} sx={{ p: 2, width: '100%', maxWidth: 520 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">SQL - Guías por Origen</Typography>
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
                        primaryTypographyProps={{ component: 'div' }}
                        secondaryTypographyProps={{ component: 'div' }}
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
                              Origen: {guide.ubicacion || 'No definido'}
                            </Typography>
                            <Typography component="span" variant="body2" display="block">
                              Subdestino: {guide.subDestino || 'No definido'}
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
        <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paper elevation={3} sx={{ p: 2, width: '100%', maxWidth: 520 }}>
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
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
                          primary={
                            <Box component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                              <Typography variant="subtitle1" fontWeight={600} component="span">
                                N° {guide.guideNumber || 'Sin número'}
                              </Typography>
                              <Chip
                                size="small"
                                label={record.destination || 'Sin destino'}
                                sx={{ backgroundColor: 'grey.200', color: 'text.primary' }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box component="div" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="body2" component="span"><strong>Destino:</strong> {record.destination || 'No registrado'}</Typography>
                              <Typography variant="body2" component="span"><strong>Subdestino:</strong> {record.subDestination || 'No registrado'}</Typography>
                              <Typography variant="body2" component="span"><strong>Origen:</strong> {record.location?.alias || record.location?.name || 'No registrado'}</Typography>
                              <Box component="div" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                <Typography component="span" variant="body2" color="text.secondary">
                                  {formatDate(record.date || guide.date)}
                                </Typography>
                                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
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
                            </Box>
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
        open={showDifferencesModal}
        onClose={() => setShowDifferencesModal(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Detalle de diferencias y coincidencias</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Solo en Origen
              </Typography>
              {renderGuideList(
                differences.missingInDestino,
                'Origen',
                'No hay guías exclusivas de Origen en este rango.',
                'warning',
                'rgba(255, 167, 38, 0.12)'
              )}
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Solo en Destino
              </Typography>
              {renderGuideList(
                differences.missingInUbicacion,
                'Destino',
                'No hay guías exclusivas de Destino en este rango.',
                'primary',
                'rgba(33, 150, 243, 0.12)'
              )}
            </Box>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Coincidencias en ambas tablas
              </Typography>
              {renderMatchesList(differences.matches)}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDifferencesModal(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

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
