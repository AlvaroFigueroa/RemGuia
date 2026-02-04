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
  Tooltip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  InputAdornment
} from '@mui/material';
import { useFirebase } from '../context/FirebaseContext';
import {
  LocationOn,
  CloudSync,
  CloudOff,
  CloudDone,
  Image
} from '../components/AppIcons';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';

const isoDate = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};
const today = new Date();

const toComparableText = (value) => {
  if (typeof value === 'string') return value.toLowerCase();
  if (value == null) return '';
  try {
    return String(value).toLowerCase();
  } catch (error) {
    console.warn('No se pudo normalizar el valor para comparación:', error, value);
    return '';
  }
};

const matchesFilter = (value, filterValue) => {
  if (!filterValue || filterValue === 'Todos') return true;
  return toComparableText(value).includes(toComparableText(filterValue));
};

const extractTextValue = (source) => {
  if (!source) return '';
  if (typeof source === 'string') return source.trim();
  if (typeof source?.alias === 'string' && source.alias.trim()) return source.alias.trim();
  if (typeof source?.name === 'string' && source.name.trim()) return source.name.trim();
  return '';
};

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
    guide?.subD417998 ??
    fallback.subDestino ??
    '';

  const derivedUbicacion =
    extractTextValue(guide?.ubicacion) ||
    extractTextValue(guide?.location) ||
    extractTextValue(fallback.ubicacion);

  const derivedDestino =
    extractTextValue(guide?.destino) ||
    extractTextValue(guide?.destination) ||
    extractTextValue(fallback.destino);

  return {
    guideNumber,
    ubicacion: derivedUbicacion || 'No definido',
    destino: derivedDestino || 'No definido',
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

const parseDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  if (!value) return 'Fecha no disponible';
  const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Fecha no disponible';
  return parsed.toLocaleString('es-CL');
};

const DashboardPage = () => {
  const {
    getGuideRecords,
    currentUser,
    currentUserProfile,
    getDestinationsCatalog,
    getLocationsCatalog,
    updateGuideRecord,
    isAdmin
  } = useFirebase();
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
  const [refreshStatus, setRefreshStatus] = useState({ status: 'idle', message: '' });
  const [editBuffer, setEditBuffer] = useState({});
  const [guideUpdateState, setGuideUpdateState] = useState({});
  const [quickFilters, setQuickFilters] = useState({
    startDate: isoDate(today),
    endDate: isoDate(today),
    guideNumber: ''
  });
  const [quickGuides, setQuickGuides] = useState([]);
  const [quickStatus, setQuickStatus] = useState({ state: 'idle', message: '' });

  const transporteApiBaseUrl = useMemo(() => {
    const envBase = (import.meta.env.VITE_TRANSPORTE_API || '').trim();
    const base = envBase.length > 0 ? envBase : 'https://guia.codecland.com/api';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuickFilterChange = (field, value) => {
    setQuickFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const toDateTimeLocalValue = useCallback((value) => {
    const date = parseDateValue(value);
    if (!date) return '';
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  const destinationChoices = useMemo(() => (
    destinationsCatalog
      .map((destination) => destination.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  ), [destinationsCatalog]);

  const getSubDestinoOptions = useCallback((destName) => {
    if (!destName) return [];
    const entry = destinationsCatalog.find((dest) => dest.name === destName);
    return Array.isArray(entry?.subDestinations) ? entry.subDestinations : [];
  }, [destinationsCatalog]);

  const getGuideId = (guide) => guide?.rawRecord?.id || guide?.id || null;

  const getEditValue = (guide, field) => {
    const id = getGuideId(guide);
    const buffer = id ? editBuffer[id] : null;
    if (buffer && Object.prototype.hasOwnProperty.call(buffer, field)) {
      return buffer[field];
    }
    if (field === 'date') {
      return toDateTimeLocalValue(guide.date);
    }
    if (field === 'destino') {
      return guide.destino || '';
    }
    if (field === 'subDestino') {
      return guide.subDestino || '';
    }
    return '';
  };

  const handleEditFieldChange = (guide, field, value) => {
    const id = getGuideId(guide);
    if (!id) return;
    setEditBuffer((prev) => {
      const nextEntry = { ...(prev[id] || {}), [field]: value };
      if (field === 'destino') {
        nextEntry.subDestino = '';
      }
      nextEntry.dirty = true;
      return { ...prev, [id]: nextEntry };
    });
  };

  const guideHasChanges = (guide) => {
    const id = getGuideId(guide);
    if (!id) return false;
    const buffer = editBuffer[id];
    if (!buffer?.dirty) return false;
    const baseDate = toDateTimeLocalValue(guide.date);
    const dateChanged = typeof buffer.date !== 'undefined' && buffer.date !== baseDate;
    const destinoChanged = typeof buffer.destino !== 'undefined' && buffer.destino !== (guide.destino || '');
    const subChanged = typeof buffer.subDestino !== 'undefined' && buffer.subDestino !== (guide.subDestino || '');
    return dateChanged || destinoChanged || subChanged;
  };

  const handleSaveGuide = async (guide) => {
    const id = getGuideId(guide);
    if (!id) return;
    const buffer = editBuffer[id] || {};
    const baseDate = toDateTimeLocalValue(guide.date);
    const payload = {};

    if (typeof buffer.date !== 'undefined' && buffer.date !== baseDate) {
      const parsed = new Date(buffer.date);
      if (!Number.isNaN(parsed.getTime())) {
        payload.date = parsed.toISOString();
      }
    }
    if (typeof buffer.destino !== 'undefined' && buffer.destino !== (guide.destino || '')) {
      payload.destination = buffer.destino || '';
    }
    if (typeof buffer.subDestino !== 'undefined' && buffer.subDestino !== (guide.subDestino || '')) {
      payload.subDestination = buffer.subDestino || '';
    }

    if (Object.keys(payload).length === 0) {
      setGuideUpdateState((prev) => ({
        ...prev,
        [id]: { status: 'idle', message: 'Sin cambios' }
      }));
      return;
    }

    setGuideUpdateState((prev) => ({
      ...prev,
      [id]: { status: 'loading', message: '' }
    }));

    try {
      await updateGuideRecord(id, payload);
      await handleCompare(filtersRef.current);
      setGuideUpdateState((prev) => ({
        ...prev,
        [id]: { status: 'success', message: 'Actualizado' }
      }));
      setEditBuffer((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), dirty: false }
      }));
      setTimeout(() => {
        setGuideUpdateState((prev) => {
          const clone = { ...prev };
          if (clone[id]?.status === 'success') {
            clone[id] = { status: 'idle', message: '' };
          }
          return clone;
        });
      }, 2000);
    } catch (error) {
      console.error('No se pudo actualizar la guía:', error);
      setGuideUpdateState((prev) => ({
        ...prev,
        [id]: { status: 'error', message: error.message || 'Error al actualizar' }
      }));
    }
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
      const destinoMatches = matchesFilter(guide.destino, range.destino);
      const ubicacionMatches = matchesFilter(guide.ubicacion, range.ubicacion);
      const subDestinoMatches = matchesFilter(guide.subDestino, range.subDestino);
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
      const destinoMatches = matchesFilter(guide.destino, range.destino);
      const ubicacionMatches = matchesFilter(guide.ubicacion, range.ubicacion);
      const subDestinoMatches = matchesFilter(guide.subDestino, range.subDestino);
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

  const handleManualRefresh = useCallback(async () => {
    setRefreshStatus({ status: 'loading', message: 'Actualizando filtros...' });
    try {
      await handleCompare(filters);
      setRefreshStatus({ status: 'success', message: 'Actualizado correctamente' });
      setTimeout(() => {
        setRefreshStatus((prev) => (prev.status === 'success' ? { status: 'idle', message: '' } : prev));
      }, 2500);
    } catch (err) {
      setRefreshStatus({ status: 'error', message: err.message || 'No se pudo actualizar.' });
    }
  }, [handleCompare, filters]);

  const handleQuickFetch = useCallback(async () => {
    setQuickStatus({ state: 'loading', message: 'Buscando guías…' });
    try {
      const records = await getGuideRecords();
      const normalized = records.map((record) => normalizeGuide(record, {
        ubicacion: record?.location?.alias || record?.location?.name,
        destino: record?.destination || record?.destino
      }));

      const { startDate, endDate, guideNumber } = quickFilters;
      const trimmedGuide = guideNumber.trim().toLowerCase();
      const startBoundary = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const endBoundary = endDate ? new Date(`${endDate}T23:59:59`) : null;

      const filtered = normalized.filter((guide) => {
        const guideValue = (guide.guideNumber || '').toLowerCase();
        if (trimmedGuide && !guideValue.includes(trimmedGuide)) {
          return false;
        }

        const guideDate = parseDateValue(guide.date);
        if (startBoundary && (!guideDate || guideDate < startBoundary)) {
          return false;
        }
        if (endBoundary && (!guideDate || guideDate > endBoundary)) {
          return false;
        }
        return true;
      });

      const sorted = filtered.sort((a, b) => {
        const aDate = parseDateValue(a.date)?.getTime() || 0;
        const bDate = parseDateValue(b.date)?.getTime() || 0;
        return bDate - aDate;
      });

      setQuickGuides(sorted);

      setQuickStatus({
        state: 'success',
        message: sorted.length
          ? `${sorted.length} guía(s) encontradas.`
          : 'No se encontraron guías con esos filtros.'
      });
    } catch (error) {
      console.error('Error al cargar guías rápidas:', error);
      setQuickStatus({ state: 'error', message: error.message || 'No se pudo obtener la información.' });
    }
  }, [getGuideRecords, quickFilters]);

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
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 1,
            justifyContent: 'space-between',
            mb: 2
          }}
        >
          <Typography variant="h6">Filtros</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', sm: 'flex-end' }, width: '100%', maxWidth: { xs: '100%', sm: 220 } }}>
            <Button
              variant="contained"
              color={refreshStatus.status === 'error' ? 'error' : 'primary'}
              startIcon={
                refreshStatus.status === 'loading' ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RefreshIcon />
                )
              }
              onClick={handleManualRefresh}
              disabled={refreshStatus.status === 'loading' || isComparing}
              fullWidth
            >
              {refreshStatus.status === 'loading' ? 'Actualizando…' : 'Actualizar'}
            </Button>
            {refreshStatus.status !== 'idle' && (
              <Typography
                variant="caption"
                sx={{ mt: 0.5 }}
                color=
                  {refreshStatus.status === 'success'
                    ? 'success.main'
                    : refreshStatus.status === 'error'
                      ? 'error.main'
                      : 'text.secondary'}
              >
                {refreshStatus.message}
              </Typography>
            )}
          </Box>
        </Box>
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
            Guías desde transporte
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn />
            <Typography variant="h3">{totalUbicacion}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Registros provenientes del sistema de transporte.
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
            Guías registradas
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudSync />
            <Typography variant="h3">{totalDestino}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Datos recibidos desde la app en terreno.
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
                Aún no hay guías del sistema de transporte para este filtro.
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
              <Typography variant="h6">Registros cargados</Typography>
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

      {isAdmin && (
        <Box sx={{ mt: 5 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              Edición rápida de guías
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Usa estos filtros independientes para ajustar manualmente las guías capturadas desde la app.
            </Typography>
          </Box>
          <Grid container spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Desde"
                type="date"
                fullWidth
                value={quickFilters.startDate}
                onChange={(e) => handleQuickFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Hasta"
                type="date"
                fullWidth
                value={quickFilters.endDate}
                onChange={(e) => handleQuickFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Número de guía (opcional)"
                fullWidth
                value={quickFilters.guideNumber}
                onChange={(e) => handleQuickFilterChange('guideNumber', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                placeholder="Ej: 12345"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleQuickFetch}
                disabled={quickStatus.state === 'loading'}
              >
                {quickStatus.state === 'loading' ? 'Buscando…' : 'Buscar guías'}
              </Button>
              <Typography
                variant="caption"
                color={quickStatus.state === 'error' ? 'error.main' : quickStatus.state === 'success' ? 'success.main' : 'text.secondary'}
                sx={{ display: 'block', mt: 0.5 }}
              >
                {quickStatus.state === 'idle'
                  ? 'Los datos se mostrarán después de presionar "Buscar".'
                  : quickStatus.message}
              </Typography>
            </Grid>
          </Grid>
          <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>N° Guía</TableCell>
                  <TableCell>Fecha captura</TableCell>
                  <TableCell>Destino</TableCell>
                  <TableCell>Subdestino</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quickGuides.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {quickStatus.state === 'idle'
                        ? 'Usa los filtros y presiona "Buscar guías".'
                        : quickStatus.message || 'No se encontraron guías con esos filtros.'}
                    </TableCell>
                  </TableRow>
                )}
                {quickGuides.map((guide) => {
                  const guideId = getGuideId(guide);
                  const currentDateValue = getEditValue(guide, 'date');
                  const currentDestinoValue = getEditValue(guide, 'destino');
                  const currentSubDestinoValue = getEditValue(guide, 'subDestino');
                  const subOptions = getSubDestinoOptions(currentDestinoValue);
                  const status = guideUpdateState[guideId]?.status || 'idle';
                  const helperMessage = guideUpdateState[guideId]?.message || '';
                  const hasChanges = guideHasChanges(guide);
                  return (
                    <TableRow key={`${guideId}-${guide.guideNumber}`} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="subtitle2">N° {guide.guideNumber}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Origen: {guide.ubicacion || 'No definido'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="datetime-local"
                          size="small"
                          fullWidth
                          value={currentDateValue}
                          onChange={(e) => handleEditFieldChange(guide, 'date', e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={currentDestinoValue}
                          onChange={(e) => handleEditFieldChange(guide, 'destino', e.target.value)}
                        >
                          <MenuItem value="">
                            Sin destino
                          </MenuItem>
                          {destinationChoices.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        {subOptions.length > 0 ? (
                          <TextField
                            select
                            size="small"
                            fullWidth
                            value={currentSubDestinoValue}
                            onChange={(e) => handleEditFieldChange(guide, 'subDestino', e.target.value)}
                          >
                            <MenuItem value="">Sin subdestino</MenuItem>
                            {subOptions.map((sub) => (
                              <MenuItem key={sub} value={sub}>
                                {sub}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="Subdestino"
                            value={currentSubDestinoValue}
                            onChange={(e) => handleEditFieldChange(guide, 'subDestino', e.target.value)}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 140 }}>
                        <Stack spacing={0.5} alignItems="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleSaveGuide(guide)}
                            disabled={!hasChanges || status === 'loading'}
                          >
                            {status === 'loading' ? 'Guardando…' : 'Guardar'}
                          </Button>
                          {helperMessage && (
                            <Typography
                              variant="caption"
                              color={status === 'error' ? 'error.main' : status === 'success' ? 'success.main' : 'text.secondary'}
                            >
                              {helperMessage}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

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
