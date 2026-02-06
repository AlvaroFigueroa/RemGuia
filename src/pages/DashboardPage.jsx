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
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

const getConductorName = (guide) => {
  const record = guide?.rawRecord || guide;
  const candidate =
    record?.conductor ??
    record?.Conductor ??
    record?.chofer ??
    record?.Chofer ??
    record?.driver ??
    record?.Driver ??
    record?.nombreConductor ??
    record?.NombreConductor ??
    record?.operador ??
    record?.Operador ??
    '';
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : 'No registrado';
};

const escapeHtml = (value) => {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

const normalizeGuideNumberKey = (value) => {
  if (!value) return '';
  const base = String(value).trim().toLowerCase();
  if (!base) return '';
  const numeric = base.replace(/[^0-9]/g, '');
  if (numeric) {
    const trimmed = numeric.replace(/^0+/, '');
    return trimmed || numeric;
  }
  // remove spaces and separators, drop leading zeros for consistent match
  return base.replace(/[^0-9a-z]/g, '').replace(/^0+/, '') || base.replace(/\s+/g, '');
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

  const tryParseLocalDateString = (raw) => {
    if (typeof raw !== 'string') return null;
    // Evita tratar cadenas ISO con zona horaria explícita
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) return null;

    const normalized = raw.trim().replace('T', ' ');
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return null;

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    const localDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  };

  const candidate = typeof value?.toDate === 'function'
    ? value.toDate()
    : tryParseLocalDateString(value) || new Date(value);

  if (Number.isNaN(candidate?.getTime?.())) return 'Fecha no disponible';
  return candidate.toLocaleString('es-CL');
};

const formatReportDate = (value, { dateOnly = false } = {}) => {
  const formatted = formatDate(value);
  if (!dateOnly) return formatted;
  const [datePart] = formatted.split(',');
  return (datePart || formatted).trim();
};

const formatIntervalValue = (minutes) => {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds} s`;
  }
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = Math.round(minutes % 60);
  if (restMinutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${restMinutes} min`;
};

const inferUnitFromKey = (key = '') => {
  const normalized = key.toLowerCase();
  if (normalized.includes('ton') || normalized.includes('tn')) return 'ton';
  if (normalized.includes('kg')) return 'kg';
  if (normalized.includes('m3') || normalized.includes('m^3')) return 'm³';
  if (normalized.includes('litro') || normalized.includes('lts')) return 'L';
  if (normalized.includes('unidad')) return 'unid.';
  return '';
};

const toNumericValue = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[\s]/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const findFieldByKeywords = (source, keywords = [], { numericOnly = false } = {}) => {
  if (!source || typeof source !== 'object') return null;
  for (const [key, value] of Object.entries(source)) {
    if (value == null || value === '') continue;
    const normalizedKey = key.toLowerCase();
    if (!keywords.some((kw) => normalizedKey.includes(kw))) continue;
    if (numericOnly) {
      const numericValue = toNumericValue(value);
      if (numericValue == null) continue;
      return { key, value: numericValue, rawValue: value };
    }
    return { key, value, rawValue: value };
  }
  return null;
};

const formatCapacityField = (field) => {
  if (!field) return '';
  const numericValue = toNumericValue(field.value);
  if (numericValue != null) {
    const unit = inferUnitFromKey(field.key) || 'ton';
    return `${numericValue} ${unit}`.trim();
  }
  return String(field.value);
};

const formatQuantityValue = (value) => {
  if (!Number.isFinite(value)) return '';
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
};

const summarizeTotalsByType = (totals = []) => {
  if (!Array.isArray(totals) || !totals.length) return '';
  return totals
    .map(({ type, total }) => {
      if (!Number.isFinite(total)) return '';
      const formatted = formatQuantityValue(total);
      const typeLabel = type && type !== 'Sin tipo' ? ` (${type})` : '';
      return `${formatted} m³${typeLabel}`.trim();
    })
    .filter(Boolean)
    .join(' · ');
};

const INTERVAL_HIGHLIGHT_STORAGE_KEY = 'interval-highlight-presets';
const intervalHighlightDefault = { averageDistance: '', routeConditions: '' };
const buildHighlightRouteKey = (destino = 'Todos', subDestino = 'Todos', origen = 'Todos') => {
  const safeDestino = destino || 'Todos';
  const safeSub = subDestino || 'Todos';
  const safeOrigin = origen || 'Todos';
  return `${safeDestino}__${safeSub}__${safeOrigin}`;
};
const buildLegacyHighlightRouteKey = (destino = 'Todos', subDestino = 'Todos') => `${destino || 'Todos'}__${subDestino || 'Todos'}`;
const normalizeHighlightPreset = (entry = {}) => ({
  destino: entry.destino || 'Todos',
  subDestino: entry.subDestino || 'Todos',
  origen: entry.origen || 'Todos',
  averageDistance: entry.averageDistance || '',
  routeConditions: entry.routeConditions || ''
});

const getGuideCapacityDetails = (guide) => {
  const record = guide?.rawRecord || guide;
  if (!record || typeof record !== 'object') {
    return {};
  }

  const capacityField = findFieldByKeywords(record, ['capacidad', 'cap_camion', 'capcamion', 'cap_ton', 'm3_camion', 'volumen_camion']);
  const typeField = findFieldByKeywords(record, ['tipo', 'producto', 'material', 'carga', 'categoria', 'mercaderia', 'especie', 'item']);

  const capacityValue = toNumericValue(capacityField?.value);
  const capacityLabel = capacityValue != null ? `${capacityValue} m³` : formatCapacityField(capacityField);
  const typeLabel = typeField?.value ? String(typeField.value).trim() : 'Sin tipo';

  if (capacityValue == null && !capacityLabel && (!typeLabel || typeLabel === 'Sin tipo')) {
    return null;
  }

  return {
    capacityLabel,
    capacityValue,
    typeLabel
  };
};

const DashboardPage = () => {
  const {
    getGuideRecords,
    currentUser,
    currentUserProfile,
    getDestinationsCatalog,
    getLocationsCatalog,
    updateGuideRecord,
    getRouteHighlight,
    saveRouteHighlight,
    deleteRouteHighlight,
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
  const intervalDefaultRange = useMemo(() => ({
    startDate: isoDate(today),
    endDate: isoDate(today),
    ubicacion: 'Todos',
    destino: 'Todos',
    subDestino: 'Todos'
  }), []);
  const [intervalFilters, setIntervalFilters] = useState(() => ({ ...intervalDefaultRange }));
  const [intervalFiltersDraft, setIntervalFiltersDraft] = useState(() => ({ ...intervalDefaultRange }));
  const [intervalPdfStatus, setIntervalPdfStatus] = useState({ state: 'idle', message: '' });
  const [quickGuides, setQuickGuides] = useState([]);
  const [quickStatus, setQuickStatus] = useState({ state: 'idle', message: '' });
  const [reportStatus, setReportStatus] = useState({ state: 'idle', message: '' });
  const [intervalDestinoData, setIntervalDestinoData] = useState([]);
  const [intervalUbicacionData, setIntervalUbicacionData] = useState([]);
  const [intervalStatus, setIntervalStatus] = useState({ state: 'idle', message: '' });
  const intervalDataInitializedRef = useRef(false);
  const intervalReportRef = useRef(null);
  const [intervalHighlights, setIntervalHighlights] = useState({ ...intervalHighlightDefault });
  const [intervalHighlightPresets, setIntervalHighlightPresets] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = window.localStorage.getItem(INTERVAL_HIGHLIGHT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('No se pudieron leer las notas de ruta guardadas:', error);
      return {};
    }
  });
  const [activeHighlightRouteKey, setActiveHighlightRouteKey] = useState(() =>
    buildHighlightRouteKey(
      intervalDefaultRange.destino,
      intervalDefaultRange.subDestino,
      intervalDefaultRange.ubicacion
    )
  );
  const [highlightSyncStatus, setHighlightSyncStatus] = useState({ state: 'idle', message: '' });
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [highlightSaving, setHighlightSaving] = useState(false);
  const [highlightDeleting, setHighlightDeleting] = useState(false);
  const intervalHighlightPresetsRef = useRef(intervalHighlightPresets);

  useEffect(() => {
    intervalHighlightPresetsRef.current = intervalHighlightPresets;
  }, [intervalHighlightPresets]);

  const transporteApiBaseUrl = useMemo(() => {
    const envBase = (import.meta.env.VITE_TRANSPORTE_API || '').trim();
    const base = envBase.length > 0 ? envBase : 'https://guia.codecland.com/api';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const [notesDestination, setNotesDestination] = useState('Todos');
  const [notesSubDestination, setNotesSubDestination] = useState('Todos');
  const [notesOrigin, setNotesOrigin] = useState('Todos');

  const intervalFiltersChanged = useMemo(
    () => ['startDate', 'endDate', 'ubicacion', 'destino', 'subDestino'].some(
      (key) => intervalFiltersDraft[key] !== intervalFilters[key]
    ),
    [intervalFiltersDraft, intervalFilters]
  );

  const canAssociateHighlight = useMemo(
    () => Boolean(notesDestination && notesDestination !== 'Todos' && notesOrigin && notesOrigin !== 'Todos'),
    [notesDestination, notesOrigin]
  );

  const currentHighlightRouteLabel = useMemo(() => {
    if (!notesDestination || notesDestination === 'Todos' || !notesOrigin || notesOrigin === 'Todos') {
      return 'Selecciona un origen y destino específicos';
    }
    const destinationLabel = notesSubDestination && notesSubDestination !== 'Todos'
      ? `${notesDestination} · ${notesSubDestination}`
      : notesDestination;
    return `${notesOrigin} → ${destinationLabel}`;
  }, [notesDestination, notesOrigin, notesSubDestination]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuickFilterChange = (field, value) => {
    setQuickFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleIntervalFilterChange = (field, value) => {
    setIntervalFiltersDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'destino') {
        next.subDestino = 'Todos';
      }
      return next;
    });
  };

  const handleIntervalHighlightChange = (field, value) => {
    setIntervalHighlights((prev) => ({ ...prev, [field]: value }));
    if (canAssociateHighlight) {
      setHighlightSyncStatus((prev) =>
        prev.state === 'loading'
          ? prev
          : { state: 'warning', message: 'Hay cambios sin guardar para esta ruta.' }
      );
    }
  };

  useEffect(() => {
    setNotesDestination(intervalFilters.destino || 'Todos');
    setNotesSubDestination(intervalFilters.subDestino || 'Todos');
    setNotesOrigin(intervalFilters.ubicacion || 'Todos');
  }, [intervalFilters.destino, intervalFilters.subDestino, intervalFilters.ubicacion]);

  const notesSubDestinoOptions = useMemo(() => {
    if (!notesDestination || notesDestination === 'Todos') return ['Todos'];
    const entry = destinationsCatalog.find((dest) => dest.name === notesDestination);
    if (!entry) return ['Todos'];
    const subs = Array.isArray(entry.subDestinations) && entry.subDestinations.length > 0
      ? entry.subDestinations
      : ['NO'];
    const unique = Array.from(new Set(subs.map((sub) => (sub && sub.trim()) || 'NO'))).filter(Boolean);
    return ['Todos', ...unique];
  }, [destinationsCatalog, notesDestination]);

  const ubicacionOptions = useMemo(() => {
    const names = locationsCatalog
      .map((location) => location.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    return ['Todos', ...names];
  }, [locationsCatalog]);

  const notesOriginOptions = useMemo(() => ubicacionOptions.filter((option) => option && option !== 'Todos'), [ubicacionOptions]);

  useEffect(() => {
    setNotesSubDestination((prev) => (notesSubDestinoOptions.includes(prev) ? prev : 'Todos'));
  }, [notesSubDestinoOptions]);

  useEffect(() => {
    if (!notesOriginOptions.length) return;
    setNotesOrigin((prev) => (prev && notesOriginOptions.includes(prev) ? prev : 'Todos'));
  }, [notesOriginOptions]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    setIntervalFiltersDraft(intervalFilters);
  }, [intervalFilters]);

  useEffect(() => {
    if (!destinoGuides.length && !ubicacionGuides.length) return;
    if (intervalDataInitializedRef.current) return;
    setIntervalDestinoData(destinoGuides);
    setIntervalUbicacionData(ubicacionGuides);
  }, [destinoGuides, ubicacionGuides]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(INTERVAL_HIGHLIGHT_STORAGE_KEY, JSON.stringify(intervalHighlightPresets));
    } catch (error) {
      console.warn('No se pudieron guardar las notas de ruta:', error);
    }
  }, [intervalHighlightPresets]);

  const deriveHighlightKey = useCallback(
    (destino, subDestino, origen) => buildHighlightRouteKey(destino, subDestino, origen),
    []
  );

  const intervalFiltersHighlightKey = useMemo(
    () => deriveHighlightKey(intervalFilters.destino, intervalFilters.subDestino, intervalFilters.ubicacion),
    [intervalFilters.destino, intervalFilters.subDestino, intervalFilters.ubicacion, deriveHighlightKey]
  );

  const intervalFiltersHighlight = intervalHighlightPresets[intervalFiltersHighlightKey];

  const notesSelectionMatchesFilters =
    notesDestination === intervalFilters.destino &&
    notesSubDestination === intervalFilters.subDestino &&
    notesOrigin === intervalFilters.ubicacion;

  const intervalSectionHighlight = notesSelectionMatchesFilters ? intervalHighlights : intervalFiltersHighlight;

  const canDisplayIntervalHighlight = useMemo(
    () => Boolean(
      intervalFilters.ubicacion &&
      intervalFilters.ubicacion !== 'Todos' &&
      intervalFilters.destino &&
      intervalFilters.destino !== 'Todos'
    ),
    [intervalFilters.destino, intervalFilters.ubicacion]
  );

  const intervalHighlightRouteLabel = useMemo(() => {
    if (!canDisplayIntervalHighlight) return 'Selecciona origen y destino para ver notas.';
    const subLabel = intervalFilters.subDestino && intervalFilters.subDestino !== 'Todos'
      ? ` · ${intervalFilters.subDestino}`
      : '';
    return `${intervalFilters.ubicacion} → ${intervalFilters.destino}${subLabel}`;
  }, [canDisplayIntervalHighlight, intervalFilters.destino, intervalFilters.subDestino, intervalFilters.ubicacion]);

  const intervalDisplayHighlight = useMemo(() => ({
    averageDistance: intervalSectionHighlight?.averageDistance?.toString().trim() || '',
    routeConditions: intervalSectionHighlight?.routeConditions?.toString().trim() || ''
  }), [intervalSectionHighlight]);

  const hasIntervalHighlightData = Boolean(
    intervalDisplayHighlight.averageDistance || intervalDisplayHighlight.routeConditions
  );

  useEffect(() => {
    setActiveHighlightRouteKey(deriveHighlightKey(notesDestination, notesSubDestination, notesOrigin));
  }, [deriveHighlightKey, notesDestination, notesSubDestination, notesOrigin]);

  useEffect(() => {
    let isCancelled = false;

    if (!canAssociateHighlight) {
      setHighlightLoading(false);
      setIntervalHighlights({ ...intervalHighlightDefault });
      setHighlightSyncStatus({ state: 'idle', message: 'Selecciona un destino específico para asociar notas.' });
      return () => {
        isCancelled = true;
      };
    }

    const routeParams = {
      destino: notesDestination,
      subDestino: notesSubDestination,
      origen: notesOrigin
    };
    const cacheKey = deriveHighlightKey(routeParams.destino, routeParams.subDestino, routeParams.origen);

    const fetchHighlight = async () => {
      setHighlightLoading(true);
      setHighlightSyncStatus({ state: 'loading', message: 'Buscando notas guardadas…' });
      try {
        const remote = await getRouteHighlight(routeParams);
        if (isCancelled) return;
        if (remote) {
          const payload = {
            averageDistance: remote.averageDistance || '',
            routeConditions: remote.routeConditions || ''
          };
          setIntervalHighlights({ ...intervalHighlightDefault, ...payload });
          setIntervalHighlightPresets((prev) => ({ ...prev, [cacheKey]: payload }));
          setHighlightSyncStatus({ state: 'success', message: 'Notas recuperadas desde Firebase.' });
        } else {
          const cached = intervalHighlightPresetsRef.current[cacheKey];
          if (cached) {
            setIntervalHighlights({ ...intervalHighlightDefault, ...cached });
            setHighlightSyncStatus({ state: 'warning', message: 'No hay notas en Firebase, mostrando datos locales.' });
          } else {
            const legacyKey = buildLegacyHighlightRouteKey(routeParams.destino, routeParams.subDestino);
            const legacyCached = intervalHighlightPresetsRef.current[legacyKey];
            if (legacyCached) {
              setIntervalHighlights({ ...intervalHighlightDefault, ...legacyCached });
              setIntervalHighlightPresets((prev) => {
                if (prev[cacheKey]) return prev;
                return { ...prev, [cacheKey]: legacyCached };
              });
              setHighlightSyncStatus({ state: 'warning', message: 'Convertimos notas guardadas sin origen. Revisa y vuelve a guardar para esta ruta.' });
            } else {
              setIntervalHighlights({ ...intervalHighlightDefault });
              setHighlightSyncStatus({ state: 'idle', message: 'No hay notas guardadas para esta ruta.' });
            }
          }
        }
      } catch (error) {
        console.error('Error al cargar notas de ruta:', error);
        if (isCancelled) return;
        const cached = intervalHighlightPresetsRef.current[cacheKey] || intervalHighlightPresetsRef.current[buildLegacyHighlightRouteKey(routeParams.destino, routeParams.subDestino)];
        setIntervalHighlights({ ...intervalHighlightDefault, ...(cached || {}) });
        setHighlightSyncStatus({
          state: 'error',
          message: error.message || 'No se pudieron cargar las notas desde Firebase. Mostrando datos locales.'
        });
      } finally {
        if (!isCancelled) {
          setHighlightLoading(false);
        }
      }
    };

    fetchHighlight();

    return () => {
      isCancelled = true;
    };
  }, [canAssociateHighlight, deriveHighlightKey, getRouteHighlight, notesDestination, notesSubDestination, notesOrigin]);

  useEffect(() => {
    if (!canDisplayIntervalHighlight) return;
    if (notesSelectionMatchesFilters) return;
    const key = intervalFiltersHighlightKey;
    if (intervalHighlightPresetsRef.current[key]) return;

    let isCancelled = false;
    const fetchPresetForFilters = async () => {
      try {
        const remote = await getRouteHighlight({
          destino: intervalFilters.destino,
          subDestino: intervalFilters.subDestino,
          origen: intervalFilters.ubicacion
        });
        if (isCancelled || !remote) return;
        const payload = {
          averageDistance: remote.averageDistance || '',
          routeConditions: remote.routeConditions || ''
        };
        setIntervalHighlightPresets((prev) => ({ ...prev, [key]: payload }));
      } catch (error) {
        console.error('Error al precargar notas para los filtros de intervalos:', error);
      }
    };

    fetchPresetForFilters();

    return () => {
      isCancelled = true;
    };
  }, [canDisplayIntervalHighlight, getRouteHighlight, intervalFilters.destino, intervalFilters.subDestino, intervalFilters.ubicacion, intervalFiltersHighlightKey, notesSelectionMatchesFilters]);

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

  const intervalDestinoGuides = useMemo(
    () => filterByRange(intervalDestinoData, intervalFilters),
    [intervalDestinoData, intervalFilters, filterByRange]
  );
  const intervalUbicacionGuides = useMemo(
    () => filterByRange(intervalUbicacionData, intervalFilters),
    [intervalUbicacionData, intervalFilters, filterByRange]
  );

  const conductorCatalog = useMemo(() => {
    const catalog = new Map();
    const registerGuide = (guide) => {
      if (!guide) return;
      const key = normalizeGuideNumberKey(guide.guideNumber);
      if (!key) return;
      const conductorName = getConductorName(guide);
      if (!conductorName || conductorName === 'No registrado') {
        if (!catalog.has(key)) {
          catalog.set(key, 'No registrado');
        }
        return;
      }
      catalog.set(key, conductorName);
    };

    [...intervalUbicacionData, ...ubicacionGuides].forEach(registerGuide);
    return catalog;
  }, [intervalUbicacionData, ubicacionGuides]);

  const guideDetailCatalog = useMemo(() => {
    const catalog = new Map();
    const registerGuide = (guide) => {
      if (!guide) return;
      const key = normalizeGuideNumberKey(guide.guideNumber);
      if (!key) return;
      const details = getGuideCapacityDetails(guide);
      if (!details) return;
      const hasUsefulInfo =
        Boolean(details.capacityLabel) ||
        Number.isFinite(details.quantityValue) ||
        (details.typeLabel && details.typeLabel !== 'Sin tipo');
      if (!hasUsefulInfo) return;
      catalog.set(key, details);
    };

    [...intervalUbicacionData, ...ubicacionGuides].forEach(registerGuide);
    return catalog;
  }, [intervalUbicacionData, ubicacionGuides]);

  const conductorIntervals = useMemo(() => {
    if (!intervalDestinoGuides.length) return [];

    const byConductor = new Map();

    intervalDestinoGuides.forEach((guide) => {
      const key = normalizeGuideNumberKey(guide.guideNumber);
      const conductor = key ? conductorCatalog.get(key) || 'No registrado' : 'No registrado';
      if (!byConductor.has(conductor)) {
        byConductor.set(conductor, []);
      }
      byConductor.get(conductor).push(guide);
    });

    const toDateValue = (guide) => parseDateValue(guide?.date) || new Date(0);

    return Array.from(byConductor.entries())
      .map(([conductor, guides]) => {
        const sortedGuides = guides
          .map((guide) => ({
            ...guide,
            parsedDate: toDateValue(guide)
          }))
          .filter((guide) => guide.parsedDate instanceof Date && !Number.isNaN(guide.parsedDate.getTime()))
          .sort((a, b) => a.parsedDate - b.parsedDate);

        const guideDetails = sortedGuides.map((guide) => guideDetailCatalog.get(normalizeGuideNumberKey(guide.guideNumber)) || null);
        const intervals = [];
        let capacityLabel = '';
        let capacityValueNumeric = null;
        const totalsByTypeMap = new Map();

        const resolveIntervalLoad = (detail) => {
          if (Number.isFinite(detail?.capacityValue)) return detail.capacityValue;
          if (Number.isFinite(capacityValueNumeric)) return capacityValueNumeric;
          return 0;
        };

        sortedGuides.forEach((guide, index) => {
          const detail = guideDetails[index];
          if (detail) {
            if (!capacityLabel && detail.capacityLabel) {
              capacityLabel = detail.capacityLabel;
            }
            if (capacityValueNumeric == null && Number.isFinite(detail.capacityValue)) {
              capacityValueNumeric = detail.capacityValue;
            }
            if (Number.isFinite(detail.capacityValue)) {
              const typeKey = detail.typeLabel || 'Sin tipo';
              if (!totalsByTypeMap.has(typeKey)) {
                totalsByTypeMap.set(typeKey, {
                  type: detail.typeLabel || 'Sin tipo',
                  total: 0
                });
              }
              const aggregate = totalsByTypeMap.get(typeKey);
              aggregate.total += detail.capacityValue;
            }
          }

          if (index === 0) {
            return;
          }

          const previous = sortedGuides[index - 1];
          const diffMs = guide.parsedDate - previous.parsedDate;
          const diffMinutes = diffMs / 60000;
          if (Number.isFinite(diffMinutes) && diffMinutes >= 0) {
            intervals.push({
              minutes: diffMinutes,
              fromGuide: previous.guideNumber || 'Sin número',
              toGuide: guide.guideNumber || 'Sin número',
              fromDate: previous.parsedDate,
              toDate: guide.parsedDate,
              loadValue: resolveIntervalLoad(detail)
            });
          }
        });

        if (sortedGuides.length) {
          const lastGuide = sortedGuides[sortedGuides.length - 1];
          const lastDetail = guideDetails[guideDetails.length - 1];
          intervals.push({
            closing: true,
            guide: lastGuide.guideNumber || 'Sin número',
            time: lastGuide.parsedDate,
            date: lastGuide.parsedDate,
            loadValue: resolveIntervalLoad(lastDetail)
          });
        }

        const totalsByType = Array.from(totalsByTypeMap.values()).filter((entry) => Number.isFinite(entry.total) && entry.total > 0);
        const totalTransported = totalsByType.reduce((sum, entry) => sum + entry.total, 0);

        return {
          conductor,
          receptions: sortedGuides.length,
          intervals,
          capacityLabel,
          totalsByType,
          capacityValue: capacityValueNumeric,
          totalTransported
        };
      })
      .filter((entry) => entry.receptions > 0)
      .sort((a, b) => b.receptions - a.receptions || a.conductor.localeCompare(b.conductor, 'es'));
  }, [conductorCatalog, intervalDestinoGuides, guideDetailCatalog]);

  const maxIntervalColumns = useMemo(() => {
    return conductorIntervals.reduce((max, entry) => Math.max(max, entry.intervals.length), 0);
  }, [conductorIntervals]);

  const totalTransportedDay = useMemo(() => {
    return conductorIntervals.reduce((sum, entry) => sum + (entry.totalTransported || 0), 0);
  }, [conductorIntervals]);

  const intervalColumnTotals = useMemo(() => {
    if (!maxIntervalColumns) return [];
    const totals = Array.from({ length: maxIntervalColumns }, () => 0);
    conductorIntervals.forEach((entry) => {
      for (let idx = 0; idx < maxIntervalColumns; idx += 1) {
        const interval = entry.intervals[idx];
        if (!interval) continue;
        const load = Number.isFinite(interval.loadValue)
          ? interval.loadValue
          : entry.capacityValue || 0;
        if (!Number.isFinite(load) || load <= 0) continue;
        totals[idx] += load;
      }
    });
    return totals;
  }, [conductorIntervals, maxIntervalColumns]);

  const handleExportIntervalPdf = useCallback(async () => {
    if (!intervalReportRef.current) {
      setIntervalPdfStatus({ state: 'error', message: 'No hay contenido para exportar.' });
      return;
    }
    if (!conductorIntervals.length) {
      setIntervalPdfStatus({ state: 'error', message: 'No existen intervalos en este rango.' });
      return;
    }

    setIntervalPdfStatus({ state: 'loading', message: 'Generando PDF…' });

    try {
      const canvas = await html2canvas(intervalReportRef.current, {
        scale: 1.3,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const margin = 24;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const printableWidth = pageWidth - margin * 2;
      const pageContentHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * printableWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
      heightLeft -= pageContentHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - (imgHeight - heightLeft);
        pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
        heightLeft -= pageContentHeight;
      }

      const fileName = `intervalos-conductores-${intervalFilters.startDate || 'inicio'}-${intervalFilters.endDate || 'fin'}.pdf`;
      pdf.save(fileName);
      setIntervalPdfStatus({ state: 'success', message: 'PDF descargado correctamente.' });
    } catch (error) {
      console.error('Error al generar PDF de intervalos:', error);
      setIntervalPdfStatus({ state: 'error', message: error.message || 'No se pudo generar el PDF.' });
    }
  }, [conductorIntervals.length, intervalFilters]);

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

  const handleApplyIntervalFilters = useCallback(async () => {
    setIntervalStatus({ state: 'loading', message: 'Actualizando intervalos…' });
    try {
      const [destinoData, ubicacionData] = await Promise.all([
        fetchDestinoGuides(intervalFiltersDraft),
        fetchUbicacionGuides(intervalFiltersDraft)
      ]);
      setIntervalDestinoData(destinoData);
      setIntervalUbicacionData(ubicacionData);
      setIntervalFilters(intervalFiltersDraft);
      setIntervalStatus({ state: 'success', message: 'Intervalos actualizados correctamente.' });
      intervalDataInitializedRef.current = true;
    } catch (error) {
      console.error('No se pudieron actualizar los intervalos:', error);
      setIntervalStatus({ state: 'error', message: error.message || 'No se pudo obtener la información.' });
    }
  }, [intervalFiltersDraft, fetchDestinoGuides, fetchUbicacionGuides]);

  const compareGuides = useCallback((ubicacion = [], destino = []) => {
    const destinoKeyMap = new Map(destino.map((guide) => [buildGuideKey(guide), guide]));
    const ubicacionKeyMap = new Map(ubicacion.map((guide) => [buildGuideKey(guide), guide]));

    const missingInDestino = ubicacion.filter((guide) => !destinoKeyMap.has(buildGuideKey(guide)));
    const missingInUbicacion = destino.filter((guide) => !ubicacionKeyMap.has(buildGuideKey(guide)));
    const matches = [];

    destinoKeyMap.forEach((destinoGuide, key) => {
      const ubicacionGuide = ubicacionKeyMap.get(key);
      if (!ubicacionGuide) return;
      matches.push({
        key,
        guideNumber: destinoGuide.guideNumber || ubicacionGuide.guideNumber || 'Sin número',
        firestore: destinoGuide,
        sql: ubicacionGuide,
        destino: destinoGuide.destino || destinoGuide.destination || ubicacionGuide.destino || 'No definido',
        subDestino: destinoGuide.subDestino || ubicacionGuide.subDestino || 'No definido'
      });
    });

    return { missingInDestino, missingInUbicacion, matches };
  }, []);

  const handleCompare = useCallback(
    async (overrideFilters) => {
      const activeFilters = overrideFilters || filtersRef.current;
      setIsComparing(true);
      setError('');
      try {
        const [ubicacionData, destinoData] = await Promise.all([
          fetchUbicacionGuides(activeFilters),
          fetchDestinoGuides(activeFilters)
        ]);
        setUbicacionGuides(ubicacionData);
        setDestinoGuides(destinoData);
        setDifferences(compareGuides(ubicacionData, destinoData));
        return true;
      } catch (error) {
        console.error('No se pudo obtener la información principal:', error);
        setError(error.message || 'No se pudo obtener la información.');
        return false;
      } finally {
        setIsComparing(false);
      }
    },
    [compareGuides, fetchDestinoGuides, fetchUbicacionGuides, filtersRef]
  );

  const handleManualRefresh = useCallback(async () => {
    setRefreshStatus({ status: 'loading', message: 'Actualizando datos…' });
    const success = await handleCompare(filtersRef.current);
    setRefreshStatus({
      status: success ? 'success' : 'error',
      message: success ? 'Datos sincronizados correctamente.' : 'No se pudieron actualizar los datos.'
    });
    if (success) {
      setTimeout(() => setRefreshStatus({ status: 'idle', message: '' }), 2500);
    }
  }, [handleCompare]);

  const handleQuickFetch = useCallback(async () => {
    setQuickStatus({ state: 'loading', message: '' });
    try {
      const range = {
        startDate: quickFilters.startDate,
        endDate: quickFilters.endDate,
        ubicacion: 'Todos',
        destino: 'Todos',
        subDestino: 'Todos'
      };

      const data = await fetchDestinoGuides(range);
      const trimmed = quickFilters.guideNumber.trim().toLowerCase();
      const filtered = trimmed
        ? data.filter((guide) => guide.guideNumber?.toLowerCase().includes(trimmed))
        : data;

      setQuickGuides(filtered);
      setQuickStatus({
        state: 'success',
        message: filtered.length ? `${filtered.length} guía(s) encontradas.` : 'No se encontraron guías con esos filtros.'
      });
    } catch (error) {
      console.error('No se pudieron obtener las guías rápidas:', error);
      setQuickStatus({ state: 'error', message: error.message || 'No se pudieron obtener las guías solicitadas.' });
    }
  }, [fetchDestinoGuides, quickFilters]);

  const handleGeneratePdfReport = useCallback(async () => {
    if (!destinoGuides.length && !ubicacionGuides.length) {
      setReportStatus({ state: 'error', message: 'No hay datos para generar el informe.' });
      return;
    }

    setReportStatus({ state: 'loading', message: 'Generando PDF…' });

    let tempContainer;
    try {
      const timestamp = new Date().toLocaleString('es-CL', {
        dateStyle: 'full',
        timeStyle: 'short'
      });
      const filterEntries = [
        { label: 'Desde', value: filters.startDate || '—' },
        { label: 'Hasta', value: filters.endDate || '—' },
        { label: 'Origen', value: filters.ubicacion || 'Todos' },
        { label: 'Destino', value: filters.destino || 'Todos' },
        { label: 'Subdestino', value: filters.subDestino || 'Todos' }
      ];
      const statsData = [
        { label: 'Guías desde origen', value: ubicacionGuides.length },
        { label: 'Guías en destino', value: destinoGuides.length },
        { label: 'Coincidencias', value: differences.matches.length },
        {
          label: 'Sólo en origen',
          value: differences.missingInDestino.length
        },
        {
          label: 'Sólo en destino',
          value: differences.missingInUbicacion.length
        }
      ];

      const buildRows = (items, { includeOrigin = true, includeConductor = false, dateOnly = false } = {}) => {
        if (!items.length) {
          const span = includeOrigin ? 6 : 5;
          return `<tr><td colspan="${span}" class="empty">Sin registros</td></tr>`;
        }
        return items
          .map((guide) => `
            <tr>
              <td>${escapeHtml(guide.guideNumber || 'Sin número')}</td>
              <td>${escapeHtml(formatReportDate(guide.date, { dateOnly }))}</td>
              <td>${escapeHtml(guide.destino || 'No definido')}</td>
              <td>${escapeHtml(guide.subDestino || 'No definido')}</td>
              ${includeConductor ? `<td>${escapeHtml(getConductorName(guide))}</td>` : ''}
              ${includeOrigin ? `<td>${escapeHtml(getLocationLabel(guide))}</td>` : ''}
            </tr>
          `)
          .join('');
      };

      const buildSection = (title, items, config = {}) => {
        const {
          includeOrigin = true,
          includeConductor = false,
          note = '',
          dateOnly = false
        } = config;
        return `
          <section class="data-section">
            <h3>${title}</h3>
            ${note ? `<p class="section-note">${note}</p>` : ''}
            <table>
              <thead>
                <tr>
                  <th>N° Guía</th>
                  <th>Fecha</th>
                  <th>Destino</th>
                  <th>Subdestino</th>
                  ${includeConductor ? '<th>Conductor</th>' : ''}
                  ${includeOrigin ? '<th>Origen</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${buildRows(items, { includeOrigin, includeConductor, dateOnly })}
              </tbody>
            </table>
          </section>
        `;
      };

      const discrepancyCards = `
        <section class="discrepancy-section">
          <h2>Alertas de discrepancia</h2>
          <div class="discrepancy-grid">
            <article class="discrepancy-card warning">
              <div class="badge">Origen</div>
              <strong>${escapeHtml(differences.missingInDestino.length)}</strong>
              <p>Guías presentes sólo en origen</p>
            </article>
            <article class="discrepancy-card danger">
              <div class="badge">Destino</div>
              <strong>${escapeHtml(differences.missingInUbicacion.length)}</strong>
              <p>Guías presentes sólo en destino</p>
            </article>
          </div>
        </section>
      `;

      const filterSummary = `
        <section class="summary-block">
          <div class="filters-grid">
            ${filterEntries
              .map(
                ({ label, value }) => `
                  <div class="filter-card">
                    <span class="filter-label">${label}</span>
                    <span class="filter-value">${escapeHtml(value)}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        </section>
      `;

      const statsGrid = statsData
        .map(
          (item) => `
            <div class="stat-card">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
            </div>
          `
        )
        .join('');

      const html = `
        <style>
          .report-root { font-family: 'Segoe UI', 'Rubik', sans-serif; margin: 24px; color: #1f2933; background: #faf7f2; }
          .report-root .report-top { display: flex; flex-direction: column; gap: 20px; }
          .report-root .report-hero { background: #ffffff; border-radius: 24px; padding: 28px 32px; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12); border: 1px solid #ede9e0; }
          .report-root .hero-badge { display: inline-flex; padding: 4px 12px; border-radius: 999px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; background: #f5efe6; color: #9c6b1c; margin-bottom: 12px; }
          .report-root .report-hero h1 { margin: 0; font-size: 31px; color: #1f1305; }
          .report-root .hero-subtitle { margin: 6px 0 18px; font-size: 15px; color: #5c5043; }
          .report-root .timestamp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: #f5efe6; font-size: 13px; color: #7c4a0b; border: 1px solid #eadfcd; }
          .report-root .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
          .report-root .filter-card { background: #ffffff; border-radius: 14px; padding: 12px 16px; border: 1px solid #e2e8f0; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
          .report-root .filter-label { display: block; font-size: 11px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; }
          .report-root .filter-value { display: block; margin-top: 4px; font-size: 15px; font-weight: 600; color: #0f172a; }
          .report-root .discrepancy-section { margin-bottom: 12px; }
          .report-root .discrepancy-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
          .report-root .discrepancy-card { border-radius: 14px; padding: 16px; border: 1px solid #f5d0a4; background: #fff7ed; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08); }
          .report-root .discrepancy-card.danger { border-color: #fecaca; background: #fff5f5; }
          .report-root .discrepancy-card strong { font-size: 32px; display: block; color: #b45309; }
          .report-root .discrepancy-card.danger strong { color: #b91c1c; }
          .report-root .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
          .report-root .stat-card { background: #ffffff; border-radius: 12px; padding: 14px 16px; border: 1px solid #dbe2ec; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
          .report-root .stat-card span { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #7b8794; }
          .report-root .stat-card strong { font-size: 26px; color: #0f172a; }
          .report-root .data-section { margin-bottom: 28px; background: #fff; border-radius: 16px; padding: 18px 20px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e0e7ff; }
          .report-root .data-section h3 { margin-bottom: 10px; color: #0f172a; border-left: 4px solid #3a7bd5; padding-left: 8px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
          .report-root table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; border-radius: 12px; border: 1px solid #dbe2ec; overflow: hidden; }
          .report-root th, .report-root td { padding: 11px 12px; text-align: left; font-size: 13px; }
          .report-root thead { background: #eff5ff; color: #102a43; }
          .report-root tbody tr:nth-child(even) { background: #f8fbff; }
          .report-root .empty { text-align: center; font-style: italic; color: #94a3b8; }
          .report-root footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; }
        </style>
        <div class="report-root">
          <section class="report-top">
            <div class="report-hero">
              <p class="hero-badge">Resumen operativo</p>
              <h1>Informe de guías despachadas y recepcionadas</h1>
              <p class="hero-subtitle">Monitoreo de discrepancias entre el transporte despachado y las recepciones en destino.</p>
              <div class="timestamp-chip">Generado el ${escapeHtml(timestamp)}</div>
            </div>
            ${filterSummary}
            ${discrepancyCards}
            <section>
              <div class="stats-grid">${statsGrid}</div>
            </section>
          </section>
          ${buildSection('Solo en origen (no están en destino)', differences.missingInDestino, {
            includeOrigin: true,
            includeConductor: true,
            dateOnly: true,
            note: 'Guías que el sistema de transporte reporta como despachadas, pero que aún no han sido recepcionadas en destino.'
          })}
          ${buildSection('Solo en destino (no están en origen)', differences.missingInUbicacion, {
            includeOrigin: true,
            note: 'Guías recibidas en terreno que todavía no tienen coincidencia con un transporte despachado.'
          })}
          <footer>Informe automático generado desde el panel de control.</footer>
        </div>
      `;

      tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.top = '0';
      tempContainer.style.left = '-200vw';
      tempContainer.style.width = '210mm';
      tempContainer.style.pointerEvents = 'none';
      tempContainer.style.zIndex = '-1';
      tempContainer.style.background = '#fff';
      tempContainer.innerHTML = html;
      document.body.appendChild(tempContainer);

      const chunkNodes = [
        tempContainer.querySelector('.report-top'),
        ...tempContainer.querySelectorAll('.data-section')
      ].filter(Boolean);

      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const printableWidth = pageWidth - margin * 2;
      const pageContentHeight = pageHeight - margin * 2;
      const chunkSpacing = 12;

      let currentY = margin;
      let isFirstChunk = true;

      for (const chunk of chunkNodes) {
        const canvas = await html2canvas(chunk, {
          scale: 1.2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        const imgHeight = (canvas.height * printableWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');
        const remainingSpace = pageHeight - margin - currentY;

        if (imgHeight <= pageContentHeight) {
          if (!isFirstChunk && imgHeight > remainingSpace) {
            pdf.addPage();
            currentY = margin;
          }
          pdf.addImage(imgData, 'PNG', margin, currentY, printableWidth, imgHeight);
          currentY += imgHeight + chunkSpacing;
          if (currentY > pageHeight - margin - 20) {
            pdf.addPage();
            currentY = margin;
          }
        } else {
          if (!isFirstChunk) {
            pdf.addPage();
          }
          let heightLeft = imgHeight;
          let firstSlice = true;
          while (heightLeft > 0) {
            if (!firstSlice) {
              pdf.addPage();
            }
            firstSlice = false;
            const position = firstSlice ? margin : margin - (imgHeight - heightLeft);
            pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
            heightLeft -= pageContentHeight;
          }
          currentY = margin;
        }

        isFirstChunk = false;
      }

      const fileName = `informe-guias-${filters.startDate || 'inicio'}-${filters.endDate || 'fin'}.pdf`;
      pdf.save(fileName);
      setReportStatus({ state: 'success', message: 'Informe descargado en PDF.' });
    } catch (error) {
      console.error('Error al generar informe PDF:', error);
      setReportStatus({ state: 'error', message: error.message || 'No se pudo generar el informe.' });
    } finally {
      if (tempContainer?.parentNode) {
        tempContainer.parentNode.removeChild(tempContainer);
      }
    }
  }, [destinoGuides.length, differences, filters, ubicacionGuides.length]);

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
    if (!currentUser) return;
    const timeout = setTimeout(() => {
      handleCompare(filters);
    }, 250);
    return () => clearTimeout(timeout);
  }, [filters, handleCompare, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    loadDestinationsCatalog();
    loadLocationsCatalog();
  }, [currentUser, loadDestinationsCatalog, loadLocationsCatalog]);

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

  const renderGuideList = (
    items = [],
    title = 'Registros',
    emptyMessage = 'Sin registros en este rango.',
    alertSeverity = 'info',
    backgroundColor = 'rgba(33, 150, 243, 0.08)'
  ) => {
    if (!items.length) {
      return <Alert severity={alertSeverity}>{emptyMessage}</Alert>;
    }

    return (
      <List dense sx={{ maxHeight: 280, overflow: 'auto' }}>
        {items.map((guide, index) => (
          <Box key={`${title}-${guide?.guideNumber || index}`}>
            <ListItem
              alignItems="flex-start"
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.5,
                backgroundColor,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                mb: 1
              }}
            >
              <Typography variant="subtitle2" fontWeight={600}>
                N° {guide?.guideNumber || 'Sin número'}
              </Typography>
              <Typography variant="body2">Destino: {guide?.destino || 'No definido'}</Typography>
              <Typography variant="body2">Subdestino: {guide?.subDestino || 'No definido'}</Typography>
              <Typography variant="body2">Conductor: {getConductorName(guide)}</Typography>
              <Typography variant="body2">Origen: {getLocationLabel(guide)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDate(guide?.date)}
              </Typography>
            </ListItem>
            {index < items.length - 1 && <Divider component="li" />}
          </Box>
        ))}
      </List>
    );
  };

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

  const totalUbicacion = ubicacionGuides.length;
  const totalDestino = destinoGuides.length;
  const totalDiferencias = differences.missingInDestino.length + differences.missingInUbicacion.length;
  const totalCoincidencias = differences.matches.length;
  const intervalSelectedDestination = useMemo(
    () => destinationsCatalog.find((dest) => dest.name === intervalFiltersDraft.destino),
    [destinationsCatalog, intervalFiltersDraft.destino]
  );

  const intervalSubDestinoOptions = useMemo(() => {
    const base = ['Todos'];
    if (!intervalSelectedDestination?.subDestinations?.length) return base;
    const sorted = [...intervalSelectedDestination.subDestinations].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
    return [...base, ...sorted];
  }, [intervalSelectedDestination]);

  const hasIntervalSubDestinoFilter = intervalSubDestinoOptions.length > 1;

  useEffect(() => {
    if (!hasIntervalSubDestinoFilter && intervalFiltersDraft.subDestino !== 'Todos') {
      setIntervalFiltersDraft((prev) => ({ ...prev, subDestino: 'Todos' }));
    }
  }, [hasIntervalSubDestinoFilter, intervalFiltersDraft.subDestino]);

  const handleSaveHighlightPreset = useCallback(async () => {
    if (!canAssociateHighlight) {
      setHighlightSyncStatus({ state: 'error', message: 'Selecciona un destino específico para guardar estas notas.' });
      return;
    }
    const key = deriveHighlightKey(notesDestination, notesSubDestination, notesOrigin);
    const sanitized = {
      averageDistance: intervalHighlights.averageDistance?.toString().trim() || '',
      routeConditions: intervalHighlights.routeConditions?.trim() || ''
    };
    setHighlightSaving(true);
    setHighlightSyncStatus({ state: 'loading', message: 'Guardando notas en Firebase…' });
    try {
      await saveRouteHighlight({
        destino: notesDestination,
        subDestino: notesSubDestination,
        origen: notesOrigin,
        ...sanitized
      });
      setIntervalHighlightPresets((prev) => ({ ...prev, [key]: sanitized }));
      setHighlightSyncStatus({ state: 'success', message: 'Notas guardadas correctamente en Firebase.' });
    } catch (error) {
      console.error('Error al guardar notas de ruta:', error);
      setHighlightSyncStatus({ state: 'error', message: error.message || 'No se pudieron guardar las notas en Firebase.' });
    } finally {
      setHighlightSaving(false);
    }
  }, [canAssociateHighlight, deriveHighlightKey, notesDestination, notesSubDestination, notesOrigin, intervalHighlights.averageDistance, intervalHighlights.routeConditions, saveRouteHighlight]);

  const handleClearHighlightPreset = useCallback(async () => {
    if (!canAssociateHighlight) {
      setHighlightSyncStatus({ state: 'error', message: 'Selecciona un destino específico para limpiar sus notas.' });
      return;
    }
    const key = deriveHighlightKey(notesDestination, notesSubDestination, notesOrigin);
    setHighlightDeleting(true);
    setHighlightSyncStatus({ state: 'loading', message: 'Eliminando notas en Firebase…' });
    try {
      await deleteRouteHighlight({ destino: notesDestination, subDestino: notesSubDestination, origen: notesOrigin });
      setIntervalHighlightPresets((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setIntervalHighlights({ ...intervalHighlightDefault });
      setHighlightSyncStatus({ state: 'success', message: 'Notas eliminadas correctamente.' });
    } catch (error) {
      console.error('Error al eliminar notas de ruta:', error);
      setHighlightSyncStatus({ state: 'error', message: error.message || 'No se pudieron eliminar las notas en Firebase.' });
    } finally {
      setHighlightDeleting(false);
    }
  }, [canAssociateHighlight, deleteRouteHighlight, deriveHighlightKey, notesDestination, notesSubDestination, notesOrigin]);

  return (
    <Container maxWidth="lg" sx={{ pt: 3, pb: 10 }}>
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

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: { xs: '100%', sm: 320 }, gap: 0.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%' }}>
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
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={handleGeneratePdfReport}
                disabled={reportStatus.state === 'loading'}
                fullWidth
              >
                {reportStatus.state === 'loading' ? 'Generando PDF…' : 'Informe PDF'}
              </Button>
            </Stack>
            {refreshStatus.status !== 'idle' && (
              <Typography
                variant="caption"
                color={
                  refreshStatus.status === 'success'
                    ? 'success.main'
                    : refreshStatus.status === 'error'
                      ? 'error.main'
                      : 'text.secondary'
                }
              >
                {refreshStatus.message}
              </Typography>
            )}
            {reportStatus.state !== 'idle' && (
              <Typography
                variant="caption"
                color={
                  reportStatus.state === 'success'
                    ? 'success.main'
                    : reportStatus.state === 'error'
                      ? 'error.main'
                      : 'text.secondary'
                }
              >
                {reportStatus.message}
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
            Guías desde origen
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
            Guías en destino
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

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3} alignItems="stretch" justifyContent="center">
          <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'center' }}>
            <Paper elevation={3} sx={{ p: 2, width: '100%', maxWidth: 520 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Guías por origen</Typography>
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
                              {formatDate(guide.date).split(' ')[0]}
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
      </Paper>

      {isAdmin && (
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
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
        </Paper>
      )}

      <Paper elevation={3} sx={{ p: 3, mt: 4 }} ref={intervalReportRef}>
        <Typography variant="h5" gutterBottom>
          Intervalos entre recepciones por conductor
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Este análisis usa sólo las guías que ya fueron registradas en destino con horario confiable.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Desde (intervalos)"
              type="date"
              value={intervalFiltersDraft.startDate}
              onChange={(e) => handleIntervalFilterChange('startDate', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Hasta (intervalos)"
              type="date"
              value={intervalFiltersDraft.endDate}
              onChange={(e) => handleIntervalFilterChange('endDate', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Ubicación"
              select
              fullWidth
              value={intervalFiltersDraft.ubicacion}
              onChange={(e) => handleIntervalFilterChange('ubicacion', e.target.value)}
              SelectProps={{ MenuProps: { disableScrollLock: true } }}
            >
              {ubicacionOptions.map((option) => (
                <MenuItem key={`interval-ubicacion-${option}`} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Destino"
              select
              fullWidth
              value={intervalFiltersDraft.destino}
              onChange={(e) => handleIntervalFilterChange('destino', e.target.value)}
              SelectProps={{ MenuProps: { disableScrollLock: true } }}
            >
              {destinoOptions.map((option) => (
                <MenuItem key={`interval-destino-${option}`} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {hasIntervalSubDestinoFilter && (
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Subdestino"
                select
                fullWidth
                value={intervalFiltersDraft.subDestino}
                onChange={(e) => handleIntervalFilterChange('subDestino', e.target.value)}
                SelectProps={{ MenuProps: { disableScrollLock: true } }}
              >
                {intervalSubDestinoOptions.map((option) => (
                  <MenuItem key={`interval-subdestino-${option}`} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleApplyIntervalFilters}
              disabled={!intervalFiltersChanged || intervalStatus.state === 'loading'}
            >
              Actualizar intervalos
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {intervalFiltersChanged
                ? 'Hay cambios pendientes. Presiona actualizar para aplicarlos.'
                : intervalStatus.state === 'loading'
                  ? 'Actualizando…'
                  : intervalStatus.message || 'Filtros aplicados.'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleExportIntervalPdf}
              disabled={intervalPdfStatus.state === 'loading'}
              startIcon={<PictureAsPdfIcon />}
            >
              Exportar PDF
            </Button>
            <Typography
              variant="caption"
              color={
                intervalPdfStatus.state === 'success'
                  ? 'success.main'
                  : intervalPdfStatus.state === 'error'
                    ? 'error.main'
                    : 'text.secondary'
              }
              sx={{ display: 'block', mt: 0.5 }}
            >
              {intervalPdfStatus.state === 'idle'
                ? 'Descarga la tabla actual.'
                : intervalPdfStatus.message}
            </Typography>
          </Grid>

        </Grid>

        {intervalStatus.state === 'loading' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Procesando intervalos…</Typography>
          </Box>
        ) : conductorIntervals.length === 0 ? (
          <Alert severity="info">No hay intervalos en el rango seleccionado.</Alert>
        ) : (
          <Paper elevation={3} sx={{ p: 3 }}>
            <Box
              sx={{
                backgroundColor: 'grey.50',
                border: '1px dashed',
                borderColor: hasIntervalHighlightData ? 'primary.light' : 'grey.300',
                p: 2,
                mb: 3,
                borderRadius: 2
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Notas destacadas para {intervalHighlightRouteLabel}
                </Typography>
                {!canDisplayIntervalHighlight && (
                  <Chip label="Selecciona origen y destino específicos" color="warning" variant="outlined" />
                )}
                {canDisplayIntervalHighlight && notesSelectionMatchesFilters && (
                  <Chip label="Editando esta ruta" color="primary" variant="outlined" />
                )}
              </Stack>
              {canDisplayIntervalHighlight ? (
                hasIntervalHighlightData ? (
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="overline" color="text.secondary">
                        Distancia media estimada
                      </Typography>
                      <Typography variant="h6">
                        {intervalDisplayHighlight.averageDistance
                          ? `${intervalDisplayHighlight.averageDistance} km`
                          : '—'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <Typography variant="overline" color="text.secondary">
                        Condiciones de ruta
                      </Typography>
                      <Typography variant="body1">
                        {intervalDisplayHighlight.routeConditions || 'Sin comentarios registrados.'}
                      </Typography>
                    </Grid>
                  </Grid>
                ) : (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No hay notas guardadas para esta combinación. Usa el panel "Notas destacadas por camino" para agregar una descripción que también aparecerá en el PDF.
                  </Alert>
                )
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Define origen y destino para ver las notas asociadas al intervalo.
                </Alert>
              )}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip label={`${conductorIntervals.length} conductor(es)`} color="primary" />
              <Typography variant="body2" color="text.secondary">
                Intervalos calculados entre recepciones consecutivas por conductor.
              </Typography>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 160, px: 1.5 }}>Conductor</TableCell>
                    {Array.from({ length: maxIntervalColumns }).map((_, idx) => (
                      <TableCell key={`interval-header-bottom-${idx}`} sx={{ minWidth: 120, px: 1 }}>
                        Intervalo {idx + 1}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conductorIntervals.map((entry) => (
                    <TableRow key={`interval-bottom-${entry.conductor}`} hover>
                      <TableCell sx={{ px: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '0.95rem' }}>{entry.conductor}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                          {entry.intervals.length} intervalo(s) · {entry.receptions} recepción(es)
                        </Typography>
                        {entry.capacityLabel && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                            Capacidad: {entry.capacityLabel}
                          </Typography>
                        )}
                        {entry.totalsByType?.length > 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                            Total transportado: {summarizeTotalsByType(entry.totalsByType)}
                          </Typography>
                        )}
                      </TableCell>
                      {Array.from({ length: maxIntervalColumns }).map((_, idx) => {
                        const interval = entry.intervals[idx];
                        return (
                          <TableCell key={`interval-bottom-cell-${entry.conductor}-${idx}`} sx={{ px: 1 }}>
                            {interval ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {interval.closing ? (
                                  <>
                                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.9rem' }}>
                                      Cierre del día
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      Guía {interval.guide}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                      {new Date(interval.time).toLocaleTimeString('es-CL')}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                      {formatReportDate(interval.date, { dateOnly: true })}
                                    </Typography>
                                  </>
                                ) : (
                                  <>
                                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.9rem' }}>
                                      {formatIntervalValue(interval.minutes)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      {interval.fromGuide} → {interval.toGuide}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                      {new Date(interval.fromDate).toLocaleTimeString('es-CL')}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                      {new Date(interval.toDate).toLocaleTimeString('es-CL')}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                                      {formatReportDate(interval.toDate, { dateOnly: true })}
                                    </Typography>
                                  </>
                                )}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>—</Typography>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {conductorIntervals.length > 0 && (
                    <TableRow sx={{ backgroundColor: 'grey.100' }}>
                      <TableCell sx={{ px: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Total transportado en el día
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatQuantityValue(totalTransportedDay)} m³
                        </Typography>
                      </TableCell>
                      {Array.from({ length: maxIntervalColumns }).map((_, idx) => (
                        <TableCell key={`interval-total-${idx}`} sx={{ px: 1 }}>
                          {intervalColumnTotals[idx] > 0 ? (
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                              {formatQuantityValue(intervalColumnTotals[idx])} m³
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                              —
                            </Typography>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Los intervalos se calculan con la fecha y hora de recepción en destino, emparejando cada número de guía con su conductor registrado en el origen.
            </Typography>
          </Paper>
        )}
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Notas destacadas por camino
        </Typography>
        <Paper variant="outlined" sx={{ p: 3, borderStyle: 'dashed' }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Origen (notas)"
                select
                fullWidth
                value={notesOrigin}
                onChange={(e) => {
                  const value = e.target.value;
                  setNotesOrigin(value);
                  setIntervalFiltersDraft((prev) => ({ ...prev, ubicacion: value }));
                }}
                SelectProps={{ MenuProps: { disableScrollLock: true } }}
              >
                <MenuItem value="Todos">Selecciona origen</MenuItem>
                {notesOriginOptions.map((option) => (
                  <MenuItem key={`notes-origen-${option}`} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Destino (notas)"
                select
                fullWidth
                value={notesDestination}
                onChange={(e) => {
                  const value = e.target.value;
                  setNotesDestination(value);
                  setNotesSubDestination('Todos');
                  setIntervalFiltersDraft((prev) => ({ ...prev, destino: value, subDestino: 'Todos' }));
                }}
                SelectProps={{ MenuProps: { disableScrollLock: true } }}
              >
                <MenuItem value="Todos">Selecciona destino</MenuItem>
                {destinoOptions
                  .filter((option) => option !== 'Todos')
                  .map((option) => (
                    <MenuItem key={`notes-destino-${option}`} value={option}>
                      {option}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Subdestino (notas)"
                select
                fullWidth
                value={notesSubDestination}
                onChange={(e) => {
                  const value = e.target.value;
                  setNotesSubDestination(value);
                  setIntervalFiltersDraft((prev) => ({ ...prev, subDestino: value }));
                }}
                disabled={!notesDestination || notesDestination === 'Todos' || notesSubDestinoOptions.length <= 1}
                SelectProps={{ MenuProps: { disableScrollLock: true } }}
              >
                {notesSubDestinoOptions.map((option) => (
                  <MenuItem key={`notes-subdestino-${option}`} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="contained"
                  onClick={handleSaveHighlightPreset}
                  disabled={!canAssociateHighlight || highlightSaving || highlightLoading}
                >
                  {highlightSaving ? 'Guardando…' : 'Guardar detalle para esta ruta'}
                </Button>
                <Button
                  variant="text"
                  color="error"
                  onClick={handleClearHighlightPreset}
                  disabled={!canAssociateHighlight || highlightDeleting || highlightLoading}
                >
                  {highlightDeleting ? 'Eliminando…' : 'Limpiar notas asociadas'}
                </Button>
              </Stack>
            </Grid>
          </Grid>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2 }}>
            <Chip
              color={canAssociateHighlight ? 'primary' : 'default'}
              variant={highlightLoading ? 'outlined' : 'filled'}
              label={highlightLoading ? 'Cargando notas…' : `Ruta activa: ${currentHighlightRouteLabel}`}
              sx={{ fontWeight: 600 }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ingresa la distancia media y las condiciones de ruta; al seleccionar un destino y subdestino estas notas se guardan en Firebase y se cargan automáticamente para que también aparezcan en el PDF.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Distancia media (km)"
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={intervalHighlights.averageDistance}
                onChange={(e) => handleIntervalHighlightChange('averageDistance', e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Condiciones de ruta"
                multiline
                minRows={3}
                value={intervalHighlights.routeConditions}
                onChange={(e) => handleIntervalHighlightChange('routeConditions', e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
          <Box
            sx={{
              mt: 3,
              p: 2.5,
              borderRadius: 2,
              bgcolor: intervalHighlights.routeConditions || intervalHighlights.averageDistance ? 'primary.light' : 'grey.100',
              color: intervalHighlights.routeConditions || intervalHighlights.averageDistance ? 'primary.contrastText' : 'text.secondary'
            }}
          >
            <Typography variant="subtitle2">Vista previa</Typography>
            <Typography variant="body2">
              Distancia media: {intervalHighlights.averageDistance ? `${intervalHighlights.averageDistance} km` : '—'}
            </Typography>
            <Typography variant="body2">
              Condiciones de ruta: {intervalHighlights.routeConditions || '—'}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 1.5 }}
            color={
              highlightSyncStatus.state === 'error'
                ? 'error.main'
                : highlightSyncStatus.state === 'warning'
                  ? 'warning.main'
                  : highlightSyncStatus.state === 'success'
                    ? 'success.main'
                    : highlightSyncStatus.state === 'loading'
                      ? 'text.secondary'
                      : 'text.secondary'
            }
          >
            {highlightSyncStatus.message || (canAssociateHighlight
              ? 'Los datos se guardan y sincronizan por destino/subdestino.'
              : 'Selecciona un destino específico para asociar notas.')}
          </Typography>
        </Paper>
      </Box>

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
