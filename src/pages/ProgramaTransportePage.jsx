import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  CircularProgress,
  Grid,
  Alert,
  MenuItem,
  Snackbar,
  Autocomplete
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useFirebase } from '../context/FirebaseContext';
import basePdfMake from 'pdfmake/build/pdfmake';
import pdfMakeFonts from 'pdfmake/build/vfs_fonts';

const createId = (prefix = 'id') => {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
};

const isoDate = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const TODAY_ISO = isoDate(new Date());

const getDefaultDestinationColumns = () => ([
  { id: createId('dest'), label: 'Planta Colcura' },
  { id: createId('dest'), label: 'Planta 5 Etapas' },
  { id: createId('dest'), label: 'Global Depósito' },
  { id: createId('dest'), label: 'Puente Biobío' }
]);

const seededProgramRows = [
  {
    equipmentType: 'C.Tolva',
    plate: 'DKDG-59',
    capacity: '14',
    equipmentStatus: 'Operativo',
    driver: 'Aedo Cristian',
    driverStatus: 'Trabajando',
    loadSite: 'Vista Bella'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'CGZL-37',
    capacity: '15',
    equipmentStatus: 'Operativo',
    driver: 'Bustos Roberto',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'Camabaja',
    plate: 'CTYY-48',
    capacity: '20',
    equipmentStatus: 'Operativo',
    driver: 'Carrasco Carlos',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'Aljibe',
    plate: 'SRYR-96',
    capacity: '—',
    equipmentStatus: 'Operativo',
    driver: 'Carvajal Rodrigo',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'FJGY-97',
    capacity: '24',
    equipmentStatus: 'Operativo',
    driver: 'Flores Roberto',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'PRTZ-21',
    capacity: '20',
    equipmentStatus: 'Panne',
    driver: 'Fonseca Antonio',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'FHVS-78',
    capacity: '14',
    equipmentStatus: 'Operativo',
    driver: 'Gajardo Diego',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'HWGS-63',
    capacity: '15',
    equipmentStatus: 'Operativo',
    driver: 'Godoy Oscar',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'KKPX-57',
    capacity: '15',
    equipmentStatus: 'Operativo',
    driver: 'Guajardo Wenceslao',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'DXCG-25',
    capacity: '15',
    equipmentStatus: 'Operativo',
    driver: 'Jeldres Juan',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'Camabaja',
    plate: 'VDLP-96',
    capacity: '—',
    equipmentStatus: 'Operativo',
    driver: 'Luengo Jaime',
    driverStatus: 'Vacaciones',
    loadSite: 'No aplica'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'HWGS-26',
    capacity: '15',
    equipmentStatus: 'Operativo',
    driver: 'Montanares Jaime',
    driverStatus: 'Trabajando',
    loadSite: 'El Saque'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'PRTZ-24',
    capacity: '20',
    equipmentStatus: 'Operativo',
    driver: 'Ocares Luis',
    driverStatus: 'Trabajando',
    loadSite: 'Vista Bella'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'TSJH-71',
    capacity: '22',
    equipmentStatus: 'Operativo',
    driver: 'Retamal Jorge',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'Camabaja',
    plate: 'DFGS-92',
    capacity: '20',
    equipmentStatus: 'Operativo',
    driver: 'San Martín Yegosin',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'CGZL-38',
    capacity: '15',
    equipmentStatus: 'Operativo',
    driver: 'Zapata Ariel',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'TSJH-72',
    capacity: '22',
    equipmentStatus: 'Operativo',
    driver: 'Zurita Cristian',
    driverStatus: 'Trabajando',
    loadSite: 'Cocharcas'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'GDFS-82',
    capacity: '15',
    equipmentStatus: 'Panne',
    driver: 'ZZ SCH',
    driverStatus: 'No Aplica',
    loadSite: 'No aplica'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'CGZL-40',
    capacity: '15',
    equipmentStatus: 'Panne',
    driver: 'ZZ SCH',
    driverStatus: 'No Aplica',
    loadSite: 'No aplica'
  },
  {
    equipmentType: 'Tracto c/camabaja',
    plate: 'BHZJ-74',
    capacity: '20',
    equipmentStatus: 'Operativo',
    driver: 'ZZ SCH',
    driverStatus: 'No Aplica',
    loadSite: 'No aplica'
  },
  {
    equipmentType: 'C.Tolva',
    plate: 'DXCG-26',
    capacity: '15',
    equipmentStatus: 'Operativo',
    driver: 'ZZ SCH',
    driverStatus: 'No Aplica',
    loadSite: 'No aplica'
  }
];

const defaultProgramTemplate = () => ({
  title: 'Distribución equipos de transporte',
  date: TODAY_ISO,
  destinationColumns: getDefaultDestinationColumns(),
  observationLabel: 'Observaciones',
  pdfPageSize: 'legal',
  equipmentStatusOptions: ['Operativo', 'Stand by', 'En ruta', 'Panne', 'Revisión técnica', 'Fuera de servicio'],
  driverStatusOptions: ['Trabajando', 'Vacaciones', 'Licencia', 'Permiso'],
  rows: seededProgramRows.map((row, index) => ({
    id: createId(`row-${index + 1}`),
    equipmentType: row.equipmentType,
    plate: row.plate,
    capacity: row.capacity,
    equipmentStatus: row.equipmentStatus,
    driver: row.driver,
    driverStatus: row.driverStatus,
    loadSite: row.loadSite,
    assignments: {},
    observation: row.observation || ''
  })),
  updatedAt: null
});

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeColumns = (columns) => {
  const normalized = ensureArray(columns).map((col, index) => ({
    id: col?.id || col?.key || createId(`col-${index}`),
    label: col?.label || col?.name || `Columna ${index + 1}`
  }));
  return normalized.length ? normalized : getDefaultDestinationColumns();
};

const normalizeAssignments = (assignments = {}, columns = []) => {
  const next = {};
  columns.forEach((column) => {
    next[column.id] = assignments[column.id] ?? '';
  });
  return next;
};

const normalizeRows = (rows, columns) => {
  return ensureArray(rows).map((row, index) => ({
    id: row?.id || createId(`row-${index}`),
    equipmentType: row?.equipmentType || '',
    plate: row?.plate || '',
    capacity: row?.capacity || '',
    equipmentStatus: row?.equipmentStatus || 'Operativo',
    driver: row?.driver || '',
    driverStatus: row?.driverStatus || 'Trabajando',
    loadSite: row?.loadSite || '',
    assignments: normalizeAssignments(row?.assignments, columns),
    observation: row?.observation || ''
  }));
};

const normalizeProgram = (raw) => {
  const template = defaultProgramTemplate();
  if (!raw) {
    return template;
  }

  const destinationColumns = normalizeColumns(raw.destinationColumns);
  return {
    ...template,
    ...raw,
    title: raw.title || template.title,
    date: raw.date || template.date,
    observationLabel: raw.observationLabel || template.observationLabel,
    equipmentStatusOptions: ensureArray(raw.equipmentStatusOptions).length
      ? ensureArray(raw.equipmentStatusOptions)
      : template.equipmentStatusOptions,
    driverStatusOptions: ensureArray(raw.driverStatusOptions).length
      ? ensureArray(raw.driverStatusOptions)
      : template.driverStatusOptions,
    destinationColumns,
    rows: normalizeRows(raw.rows, destinationColumns),
    pdfPageSize: raw.pdfPageSize || template.pdfPageSize
  };
};

const syncRowsWithColumns = (rows, columns) => rows.map((row) => ({
  ...row,
  assignments: normalizeAssignments(row.assignments, columns)
}));

let cachedPdfMake = null;
const getPdfMakeInstance = async () => {
  if (cachedPdfMake) return cachedPdfMake;
  const pdfMake = basePdfMake?.default || basePdfMake;
  if (!pdfMake) {
    throw new Error('No se pudo cargar pdfMake.');
  }

  let vfs =
    pdfMakeFonts?.pdfMake?.vfs ||
    pdfMakeFonts?.default?.pdfMake?.vfs ||
    pdfMakeFonts?.default?.vfs ||
    pdfMakeFonts?.vfs;

  if (!vfs && pdfMakeFonts && typeof pdfMakeFonts === 'object') {
    const candidateKeys = Object.keys(pdfMakeFonts);
    if (candidateKeys.length && /^Roboto/.test(candidateKeys[0])) {
      vfs = pdfMakeFonts;
    }
  }

  if (!vfs) {
    throw new Error('No se pudo cargar las fuentes de pdfMake.');
  }

  pdfMake.vfs = vfs;
  cachedPdfMake = pdfMake;
  return cachedPdfMake;
};

const statusPalette = {
  Operativo: 'success',
  'En ruta': 'info',
  'Stand by': 'warning',
  'Revisión técnica': 'secondary',
  Panne: 'error',
  'Fuera de servicio': 'default'
};

const statusColorTokens = {
  Operativo: { bg: '#dcfce7', fg: '#166534' },
  'En ruta': { bg: '#dbeafe', fg: '#1e40af' },
  'Stand by': { bg: '#fef9c3', fg: '#854d0e' },
  'Revisión técnica': { bg: '#ede9fe', fg: '#5b21b6' },
  Panne: { bg: '#fee2e2', fg: '#991b1b' },
  'Fuera de servicio': { bg: '#e2e8f0', fg: '#334155' }
};

const driverStatusColorTokens = {
  Trabajando: { bg: '#dcfce7', fg: '#166534' },
  Vacaciones: { bg: '#e0f2fe', fg: '#075985' },
  Licencia: { bg: '#fef9c3', fg: '#854d0e' },
  Permiso: { bg: '#ede9fe', fg: '#5b21b6' }
};

const getStatusColors = (status = '') => statusColorTokens[status] || { bg: '#f1f5f9', fg: '#0f172a' };

const getDriverStatusColors = (status = '') => driverStatusColorTokens[status] || { bg: '#f1f5f9', fg: '#0f172a' };

const buildPdfStatusCell = (statusText) => {
  const colors = getStatusColors(statusText);
  return {
    text: statusText || '—',
    style: 'tableCell',
    bold: true,
    alignment: 'center',
    fillColor: colors.bg,
    color: colors.fg
  };
};

const buildPdfDriverStatusCell = (statusText) => {
  const colors = getDriverStatusColors(statusText);
  return {
    text: statusText || '—',
    style: 'tableCell',
    bold: true,
    alignment: 'center',
    fillColor: colors.bg,
    color: colors.fg
  };
};

const programaTableTheme = {
  headerBg: '#0f1f3a',
  headerText: '#f8fafc',
  headerBorder: '#0a1730',
  stripeLight: '#f6f8fc',
  stripeDark: '#ffffff',
  border: '#e2e8f0',
  subtleText: '#64748b'
};

const tableHeaderCellSx = {
  backgroundColor: programaTableTheme.headerBg,
  color: programaTableTheme.headerText,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  fontSize: 12,
  borderColor: programaTableTheme.headerBorder,
  borderBottomWidth: 2,
  textAlign: 'center',
  verticalAlign: 'middle',
  py: 1.25,
  lineHeight: 1.15,
  whiteSpace: 'normal',
  wordBreak: 'normal',
  overflowWrap: 'normal',
  height: 72,
  px: 1
};

const tableBodyCellSx = {
  borderColor: programaTableTheme.border,
  backgroundColor: 'transparent'
};

const tableInputSx = {
  '& .MuiInputBase-root': {
    fontSize: 13,
    color: '#0f172a'
  },
  '& .MuiInputBase-input': {
    py: 0.75
  },
  '& .MuiInput-underline:before': {
    borderColor: programaTableTheme.border
  },
  '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
    borderColor: '#3b82f6'
  },
  '& .MuiInput-underline:after': {
    borderColor: '#1d4ed8'
  }
};

const plateComboInputSx = {
  '& .MuiInputBase-root': {
    backgroundColor: '#f1f5f9',
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a'
  },
  '& .MuiInputBase-input': {
    py: 0.75
  },
  '& .MuiInput-underline:before': {
    borderBottom: 'none'
  },
  '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
    borderBottom: 'none'
  },
  '& .MuiInput-underline:after': {
    borderBottom: 'none'
  },
  '& .MuiAutocomplete-endAdornment .MuiSvgIcon-root': {
    color: '#334155'
  }
};

const buildPdfColumnWidths = (destinationCount, pageSize = 'legal') => {
  const fixedColumns = [50, 55, 30, 65, 85, 85, 85];
  const observationWidth = 170;
  const usableWidth = pageSize?.toLowerCase?.() === 'letter' ? 820 : 920;
  const fixedWidthSum = fixedColumns.reduce((sum, width) => sum + width, 0) + observationWidth;
  const remaining = Math.max(usableWidth - fixedWidthSum, 60);
  const destinationWidth = destinationCount > 0
    ? Math.max(34, Math.floor(remaining / destinationCount))
    : 0;
  return [...fixedColumns, ...Array(destinationCount).fill(destinationWidth || 50), observationWidth];
};

const formatPdfHeaderLabel = (label = '') => {
  const trimmed = label.toString().trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'SITUACIÓN EQUIPO') return 'SITUACIÓN\nEQUIPO';
  if (upper === 'SITUACIÓN CONDUCTOR') return 'SITUACIÓN\nCONDUCTOR';
  if (upper === 'LUGAR DE CARGA') return 'LUGAR DE\nCARGA';
  if (upper === 'TIPO EQUIPO') return 'TIPO\nEQUIPO';
  return upper;
};

const ProgramaTransportePage = () => {
  const { getTransportProgram, saveTransportProgram } = useFirebase();

  const [programData, setProgramData] = useState(() => defaultProgramTemplate());
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStatus, setSavingStatus] = useState({ state: 'idle', message: '' });
  const [pdfStatus, setPdfStatus] = useState({ state: 'idle', message: '' });
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  const [plateErrors, setPlateErrors] = useState({});
  const [focusedRowId, setFocusedRowId] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchProgram = async () => {
      try {
        setLoading(true);
        const snapshot = await getTransportProgram();
        if (!isMounted) return;
        if (snapshot) {
          const normalized = normalizeProgram({
            ...snapshot,
            updatedAt: snapshot.updatedAt?.toDate ? snapshot.updatedAt.toDate() : snapshot.updatedAt || null
          });
          setProgramData(normalized);
        } else {
          setProgramData(defaultProgramTemplate());
        }
        setError('');
      } catch (fetchError) {
        console.error(fetchError);
        if (isMounted) {
          setError(fetchError?.message || 'No se pudo cargar el programa.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setUnsavedChanges(false);
        }
      }
    };

    fetchProgram();
    return () => {
      isMounted = false;
    };
  }, [getTransportProgram]);

  const handleProgramChange = useCallback((field, value) => {
    setProgramData((prev) => ({
      ...prev,
      [field]: value
    }));
    setUnsavedChanges(true);
  }, []);

  const handleColumnLabelChange = useCallback((columnId, value) => {
    setProgramData((prev) => {
      const nextColumns = prev.destinationColumns.map((column) =>
        column.id === columnId ? { ...column, label: value } : column
      );
      const nextRows = syncRowsWithColumns(prev.rows, nextColumns);
      return {
        ...prev,
        destinationColumns: nextColumns,
        rows: nextRows
      };
    });
    setUnsavedChanges(true);
  }, []);

  const handleAddColumn = useCallback(() => {
    setProgramData((prev) => {
      const nextColumns = [...prev.destinationColumns, { id: createId('dest'), label: `Destino ${prev.destinationColumns.length + 1}` }];
      const nextRows = syncRowsWithColumns(prev.rows, nextColumns);
      return {
        ...prev,
        destinationColumns: nextColumns,
        rows: nextRows
      };
    });
    setUnsavedChanges(true);
  }, []);

  const handleRemoveColumn = useCallback((columnId) => {
    setProgramData((prev) => {
      if (prev.destinationColumns.length === 1) {
        return prev;
      }
      const nextColumns = prev.destinationColumns.filter((column) => column.id !== columnId);
      const nextRows = syncRowsWithColumns(prev.rows, nextColumns).map((row) => {
        const { [columnId]: _removed, ...restAssignments } = row.assignments;
        return { ...row, assignments: restAssignments };
      });
      return {
        ...prev,
        destinationColumns: nextColumns,
        rows: nextRows
      };
    });
    setUnsavedChanges(true);
  }, []);

  const handleStatusOptionsChange = useCallback((field, value) => {
    setProgramData((prev) => ({
      ...prev,
      [field]: value.split(',').map((entry) => entry.trim()).filter(Boolean)
    }));
    setUnsavedChanges(true);
  }, []);

  const createBlankRow = useCallback((columns) => ({
    id: createId('row'),
    equipmentType: '',
    plate: '',
    capacity: '',
    equipmentStatus: programData.equipmentStatusOptions[0] || 'Operativo',
    driver: '',
    driverStatus: programData.driverStatusOptions[0] || 'Trabajando',
    loadSite: '',
    assignments: normalizeAssignments({}, columns),
    observation: ''
  }), [programData.driverStatusOptions, programData.equipmentStatusOptions]);

  const handleAddRow = useCallback(() => {
    setProgramData((prev) => ({
      ...prev,
      rows: [...prev.rows, createBlankRow(prev.destinationColumns)]
    }));
    setUnsavedChanges(true);
  }, [createBlankRow]);

  const updateRow = useCallback((rowId, updater) => {
    setProgramData((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === rowId ? { ...row, ...updater(row) } : row))
    }));
    setUnsavedChanges(true);
  }, []);

  const handleRowFieldChange = useCallback((rowId, field, value) => {
    setProgramData((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    }));
    setUnsavedChanges(true);
  }, []);

  const normalizePlate = useCallback((plate) => (typeof plate === 'string' ? plate.trim().toUpperCase() : ''), []);

  const plateOptions = useMemo(() => {
    const normalized = programData.rows
      .map((row) => normalizePlate(row.plate))
      .filter(Boolean);
    return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b, 'es'));
  }, [normalizePlate, programData.rows]);

  const driverRowOptions = useMemo(() => {
    const options = programData.rows
      .map((row) => {
        const driverLabel = (row.driver || '').trim();
        if (!driverLabel) return null;
        const plateLabel = normalizePlate(row.plate);
        const label = plateLabel ? `${driverLabel} (${plateLabel})` : driverLabel;
        return { id: row.id, driver: driverLabel, plate: plateLabel, label };
      })
      .filter(Boolean);

    const deduped = new Map();
    options.forEach((opt) => {
      const key = `${opt.driver}__${opt.plate || opt.id}`;
      if (!deduped.has(key)) deduped.set(key, opt);
    });
    return Array.from(deduped.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [normalizePlate, programData.rows]);

  const focusedRow = useMemo(() => {
    if (!focusedRowId) return null;
    return programData.rows.find((row) => row.id === focusedRowId) || null;
  }, [focusedRowId, programData.rows]);

  const handlePlateChange = useCallback((rowId, nextPlateRaw) => {
    const nextPlate = normalizePlate(nextPlateRaw);
    if (!nextPlate) {
      setPlateErrors((prev) => {
        const clone = { ...prev };
        delete clone[rowId];
        return clone;
      });
      handleRowFieldChange(rowId, 'plate', '');
      return;
    }

    const conflict = programData.rows.find((row) => row.id !== rowId && normalizePlate(row.plate) === nextPlate);
    if (conflict) {
      const conflictDriver = (conflict.driver || '').trim();
      setPlateErrors((prev) => ({ ...prev, [rowId]: `Asignada a ${conflictDriver || 'otro conductor'}` }));
      setToast({
        open: true,
        severity: 'error',
        message: `La patente ${nextPlate} ya está asignada a ${conflictDriver || 'otro conductor'}.`
      });
      return;
    }

    setPlateErrors((prev) => {
      const clone = { ...prev };
      delete clone[rowId];
      return clone;
    });
    handleRowFieldChange(rowId, 'plate', nextPlate);
  }, [handleRowFieldChange, normalizePlate, programData.rows]);

  const handleAssignmentChange = useCallback((rowId, columnId, value) => {
    setProgramData((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id === rowId
          ? { ...row, assignments: { ...row.assignments, [columnId]: value } }
          : row
      )
    }));
    setUnsavedChanges(true);
  }, []);

  const handleDeleteRow = useCallback((rowId) => {
    setProgramData((prev) => ({
      ...prev,
      rows: prev.rows.filter((row) => row.id !== rowId)
    }));
    setUnsavedChanges(true);
  }, []);

  const handleDuplicateRow = useCallback((rowId) => {
    setProgramData((prev) => {
      const row = prev.rows.find((item) => item.id === rowId);
      if (!row) return prev;
      const clone = {
        ...row,
        id: createId('row'),
        assignments: { ...row.assignments }
      };
      const index = prev.rows.findIndex((item) => item.id === rowId);
      const nextRows = [...prev.rows];
      nextRows.splice(index + 1, 0, clone);
      return {
        ...prev,
        rows: nextRows
      };
    });
    setUnsavedChanges(true);
  }, []);

  const handleResetProgram = useCallback(() => {
    setProgramData(defaultProgramTemplate());
    setUnsavedChanges(true);
  }, []);

  const handleSaveProgram = useCallback(async () => {
    try {
      setSavingStatus({ state: 'loading', message: 'Guardando programa…' });
      const payload = {
        ...programData,
        rows: programData.rows,
        destinationColumns: programData.destinationColumns,
        updatedAt: new Date()
      };
      await saveTransportProgram(payload);
      setSavingStatus({ state: 'success', message: 'Programa guardado correctamente.' });
      setUnsavedChanges(false);
      setToast({ open: true, severity: 'success', message: 'Programa guardado con éxito.' });
    } catch (saveError) {
      console.error(saveError);
      setSavingStatus({ state: 'error', message: saveError?.message || 'No se pudo guardar el programa.' });
      setToast({ open: true, severity: 'error', message: saveError?.message || 'No se pudo guardar el programa.' });
    }
  }, [programData, saveTransportProgram]);

  const handleExportPdf = useCallback(async () => {
    try {
      setPdfStatus({ state: 'loading', message: 'Generando PDF…' });
      const pdfMake = await getPdfMakeInstance();
      const headerRow = [
        'Tipo equipo',
        'Patente',
        'Cap.',
        'Situación equipo',
        'Conductor',
        'Situación conductor',
        'Lugar de carga',
        ...programData.destinationColumns.map((column) => column.label),
        programData.observationLabel
      ];

      const pdfHeaderRow = headerRow.map((label) => ({
        text: formatPdfHeaderLabel(label),
        style: 'tableHeader'
      }));

      const bodyRows = programData.rows.map((row) => {
        const destinationValues = programData.destinationColumns.map((column) => row.assignments[column.id] || '');
        const baseCells = [
          { text: row.equipmentType || '—', style: 'tableCell' },
          { text: row.plate || '—', style: 'tableCell' },
          { text: row.capacity || '—', style: 'tableCell' },
          buildPdfStatusCell(row.equipmentStatus),
          { text: row.driver || '—', style: 'tableCell' },
          buildPdfDriverStatusCell(row.driverStatus),
          { text: row.loadSite || '—', style: 'tableCell' },
          ...destinationValues.map((value) => ({ text: value, style: 'tableCell' })),
          { text: row.observation || '', style: 'tableCell' }
        ];
        return baseCells;
      });

      const widths = buildPdfColumnWidths(programData.destinationColumns.length, programData.pdfPageSize);

      const docDefinition = {
        pageOrientation: 'landscape',
        pageSize: programData.pdfPageSize?.toUpperCase?.() === 'LETTER' ? 'LETTER' : 'LEGAL',
        pageMargins: [20, 30, 20, 30],
        content: [
          {
            text: `${programData.title?.toUpperCase?.() || programData.title} ${new Date(programData.date).toLocaleDateString('es-CL')}`,
            style: 'title'
          },
          {
            table: {
              headerRows: 1,
              widths,
              body: [pdfHeaderRow, ...bodyRows]
            },
            layout: {
              fillColor: (rowIndex) => {
                if (rowIndex === 0) return '#0f1f3a';
                return rowIndex % 2 === 0 ? '#ffffff' : '#f6f8fc';
              },
              paddingTop: (rowIndex) => (rowIndex === 0 ? 7 : 4),
              paddingBottom: (rowIndex) => (rowIndex === 0 ? 7 : 4),
              paddingLeft: () => 4,
              paddingRight: () => 4,
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6,
              hLineColor: () => '#cbd5f5',
              vLineColor: () => '#cbd5f5'
            }
          }
        ],
        styles: {
          title: {
            fontSize: 16,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 10]
          },
          tableHeader: {
            bold: true,
            color: '#f8fafc',
            fontSize: 9,
            alignment: 'center',
            lineHeight: 1.1,
            margin: [0, 0, 0, 0]
          },
          tableCell: {
            fontSize: 8,
            color: '#0f172a',
            margin: [0, 3, 0, 3]
          }
        },
        defaultStyle: {
          fontSize: 8,
          color: '#0f172a'
        }
      };

      pdfMake.createPdf(docDefinition).open();
      setPdfStatus({ state: 'success', message: 'PDF generado en una nueva pestaña.' });
    } catch (pdfError) {
      console.error(pdfError);
      setPdfStatus({ state: 'error', message: pdfError?.message || 'No se pudo generar el PDF.' });
    }
  }, [programData.destinationColumns, programData.observationLabel, programData.rows, programData.title, programData.date]);

  const lastUpdatedLabel = useMemo(() => {
    if (!programData.updatedAt) return 'Aún no guardado';
    const date = programData.updatedAt instanceof Date
      ? programData.updatedAt
      : (programData.updatedAt?.seconds ? new Date(programData.updatedAt.seconds * 1000) : null);
    if (!date) return 'Aún no guardado';
    return `Última actualización: ${date.toLocaleString('es-CL')}`;
  }, [programData.updatedAt]);

  const handleToastClose = useCallback((event, reason) => {
    if (reason === 'clickaway') return;
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ pt: 4, pb: 10 }}>
      <Stack spacing={3}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" component="h1" gutterBottom>
                Programa de transporte
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Diseña el programa diario de camiones, reasigna conductores y exporta el detalle en PDF profesional.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {lastUpdatedLabel}
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveProgram}
                disabled={savingStatus.state === 'loading' || !unsavedChanges}
              >
                Guardar programa
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<PictureAsPdfIcon />}
                onClick={handleExportPdf}
                disabled={programData.rows.length === 0 || pdfStatus.state === 'loading'}
              >
                Exportar PDF
              </Button>
              <Button
                variant="text"
                color="inherit"
                startIcon={<RestartAltIcon />}
                onClick={handleResetProgram}
              >
                Reiniciar
              </Button>
            </Stack>
          </Stack>
          {(savingStatus.state !== 'idle' || pdfStatus.state !== 'idle') && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
              {savingStatus.state !== 'idle' && (
                <Chip
                  label={savingStatus.message}
                  color={savingStatus.state === 'success' ? 'success' : savingStatus.state === 'error' ? 'error' : 'default'}
                  variant={savingStatus.state === 'loading' ? 'outlined' : 'filled'}
                />
              )}
              {pdfStatus.state !== 'idle' && (
                <Chip
                  label={pdfStatus.message}
                  color={pdfStatus.state === 'success' ? 'success' : pdfStatus.state === 'error' ? 'error' : 'default'}
                  variant={pdfStatus.state === 'loading' ? 'outlined' : 'filled'}
                />
              )}
            </Stack>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Datos generales
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Título"
                value={programData.title}
                onChange={(event) => handleProgramChange('title', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Fecha"
                type="date"
                value={programData.date}
                onChange={(event) => handleProgramChange('date', event.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Nombre columna observaciones"
                value={programData.observationLabel}
                onChange={(event) => handleProgramChange('observationLabel', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Tamaño PDF"
                value={programData.pdfPageSize}
                onChange={(event) => handleProgramChange('pdfPageSize', event.target.value)}
                helperText="Carta o Legal (oficio)"
                fullWidth
              >
                <MenuItem value="letter">Carta (Letter)</MenuItem>
                <MenuItem value="legal">Oficio / Legal</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Estados equipo (separar por coma)"
                value={programData.equipmentStatusOptions.join(', ')}
                onChange={(event) => handleStatusOptionsChange('equipmentStatusOptions', event.target.value)}
                helperText="Ej: Operativo, En ruta, Panne"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Estados conductor (separar por coma)"
                value={programData.driverStatusOptions.join(', ')}
                onChange={(event) => handleStatusOptionsChange('driverStatusOptions', event.target.value)}
                helperText="Ej: Trabajando, Reemplazo, Licencia"
                fullWidth
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">Destinos configurables</Typography>
              <Typography variant="body2" color="text.secondary">
                Cambia los encabezados para reflejar plantas o turnos. Puedes sumar o eliminar columnas cuando se necesite.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddColumn}>
                Agregar columna
              </Button>
            </Stack>
          </Stack>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {programData.destinationColumns.map((column) => (
              <Grid item xs={12} md={6} lg={3} key={column.id}>
                <TextField
                  label="Nombre de columna"
                  value={column.label}
                  onChange={(event) => handleColumnLabelChange(column.id, event.target.value)}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <Tooltip title="Eliminar columna">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveColumn(column.id)}
                            disabled={programData.destinationColumns.length === 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Edición rápida por conductor</Typography>
              <Typography variant="body2" color="text.secondary">
                Selecciona un conductor para editar únicamente su fila. Los cambios se aplican automáticamente a la tabla general.
              </Typography>
            </Box>
            <Autocomplete
              options={driverRowOptions}
              value={driverRowOptions.find((opt) => opt.id === focusedRowId) || null}
              onChange={(_event, newValue) => setFocusedRowId(newValue?.id || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Conductor"
                  placeholder="Selecciona un conductor"
                  fullWidth
                />
              )}
            />

            {!focusedRow && (
              <Alert severity="info">
                Selecciona un conductor para ver su fila y editarla.
              </Alert>
            )}

            {focusedRow && (
              <Box sx={{ border: '1px solid', borderColor: programaTableTheme.border, borderRadius: 2, p: 2, backgroundColor: '#ffffff' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      label="Tipo equipo"
                      value={focusedRow.equipmentType}
                      onChange={(event) => handleRowFieldChange(focusedRow.id, 'equipmentType', event.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Autocomplete
                      freeSolo
                      options={plateOptions}
                      value={normalizePlate(focusedRow.plate) || ''}
                      onChange={(_event, newValue) => handlePlateChange(focusedRow.id, newValue)}
                      onInputChange={(_event, newInputValue) => {
                        if (typeof newInputValue === 'string') {
                          handlePlateChange(focusedRow.id, newInputValue);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Patente"
                          error={Boolean(plateErrors[focusedRow.id])}
                          helperText={plateErrors[focusedRow.id] || ' '}
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <TextField
                      label="Capacidad"
                      value={focusedRow.capacity}
                      onChange={(event) => handleRowFieldChange(focusedRow.id, 'capacity', event.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      select
                      label="Situación equipo"
                      value={focusedRow.equipmentStatus}
                      onChange={(event) => handleRowFieldChange(focusedRow.id, 'equipmentStatus', event.target.value)}
                      fullWidth
                      InputProps={{ disableUnderline: true }}
                      sx={{
                        '& .MuiInputBase-root': {
                          backgroundColor: getStatusColors(focusedRow.equipmentStatus).bg,
                          borderRadius: 1.5,
                          px: 1,
                          py: 0.25,
                          minHeight: 40,
                          color: getStatusColors(focusedRow.equipmentStatus).fg,
                          fontWeight: 700
                        },
                        '& .MuiSelect-icon': {
                          color: getStatusColors(focusedRow.equipmentStatus).fg
                        }
                      }}
                    >
                      {programData.equipmentStatusOptions.map((statusOption) => (
                        <MenuItem key={statusOption} value={statusOption}>
                          {statusOption}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Conductor"
                      value={focusedRow.driver}
                      onChange={(event) => handleRowFieldChange(focusedRow.id, 'driver', event.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      select
                      label="Situación conductor"
                      value={focusedRow.driverStatus}
                      onChange={(event) => handleRowFieldChange(focusedRow.id, 'driverStatus', event.target.value)}
                      fullWidth
                      InputProps={{ disableUnderline: true }}
                      sx={{
                        '& .MuiInputBase-root': {
                          backgroundColor: getDriverStatusColors(focusedRow.driverStatus).bg,
                          borderRadius: 1.5,
                          px: 1,
                          py: 0.25,
                          minHeight: 40,
                          color: getDriverStatusColors(focusedRow.driverStatus).fg,
                          fontWeight: 700
                        },
                        '& .MuiSelect-icon': {
                          color: getDriverStatusColors(focusedRow.driverStatus).fg
                        }
                      }}
                    >
                      {!programData.driverStatusOptions.includes(focusedRow.driverStatus) && focusedRow.driverStatus && (
                        <MenuItem value={focusedRow.driverStatus}>{focusedRow.driverStatus}</MenuItem>
                      )}
                      {programData.driverStatusOptions.map((statusOption) => (
                        <MenuItem key={statusOption} value={statusOption}>
                          {statusOption}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      label="Lugar de carga"
                      value={focusedRow.loadSite}
                      onChange={(event) => handleRowFieldChange(focusedRow.id, 'loadSite', event.target.value)}
                      fullWidth
                    />
                  </Grid>

                  {programData.destinationColumns.map((column) => (
                    <Grid item xs={12} sm={6} md={3} key={`${focusedRow.id}-focused-${column.id}`}>
                      <TextField
                        label={column.label}
                        value={focusedRow.assignments?.[column.id] || ''}
                        onChange={(event) => handleAssignmentChange(focusedRow.id, column.id, event.target.value)}
                        fullWidth
                      />
                    </Grid>
                  ))}

                  <Grid item xs={12}>
                    <TextField
                      label={programData.observationLabel}
                      value={focusedRow.observation}
                      onChange={(event) => handleRowFieldChange(focusedRow.id, 'observation', event.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Stack>
        </Paper>

        <Paper
          elevation={4}
          sx={{
            p: 0,
            overflow: 'hidden',
            borderRadius: 3,
            border: '1px solid',
            borderColor: programaTableTheme.border,
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
          }}
        >
          <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">Programa</Typography>
                <Typography variant="body2" color="text.secondary">
                  Agrega filas por camión. Puedes duplicar para ahorrar tiempo, mover conductores entre vehículos y registrar observaciones.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveProgram}
                  disabled={savingStatus.state === 'loading' || !unsavedChanges}
                >
                  Guardar
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<PictureAsPdfIcon />}
                  onClick={handleExportPdf}
                  disabled={programData.rows.length === 0 || pdfStatus.state === 'loading'}
                >
                  PDF
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRow}>
                  Nueva fila
                </Button>
              </Stack>
            </Stack>
          </Box>
          <TableContainer
            sx={{
              maxHeight: { xs: 'unset', md: '65vh' },
              borderTop: '1px solid',
              borderColor: programaTableTheme.border
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 110 }}>Tipo equipo</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 105 }}>Patente</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 60 }}>Cap.</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 130 }}>Situación equipo</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 140 }}>Conductor</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 140 }}>Situación conductor</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 140 }}>Lugar de carga</TableCell>
                  {programData.destinationColumns.map((column) => (
                    <TableCell key={column.id} align="center" sx={{ ...tableHeaderCellSx, minWidth: 120 }}>
                      {column.label}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 220 }}>{programData.observationLabel}</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 80 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {programData.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8 + programData.destinationColumns.length}>
                      <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                        <Typography variant="body2">Aún no hay filas en el programa. Comienza agregando un camión.</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {programData.rows.map((row, rowIndex) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{
                      backgroundColor: rowIndex % 2 === 0 ? programaTableTheme.stripeDark : programaTableTheme.stripeLight,
                      '&:last-of-type td': { borderBottomWidth: 0 }
                    }}
                  >
                    <TableCell sx={tableBodyCellSx}>
                      <TextField
                        value={row.equipmentType}
                        onChange={(event) => handleRowFieldChange(row.id, 'equipmentType', event.target.value)}
                        variant="standard"
                        placeholder="C.Tolva, camabaja…"
                        fullWidth
                        sx={tableInputSx}
                      />
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <Autocomplete
                        freeSolo
                        options={plateOptions}
                        value={normalizePlate(row.plate) || ''}
                        onChange={(_event, newValue) => handlePlateChange(row.id, newValue)}
                        onInputChange={(_event, newInputValue) => {
                          if (typeof newInputValue === 'string') {
                            handlePlateChange(row.id, newInputValue);
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="standard"
                            placeholder="DKXC-59"
                            fullWidth
                            error={Boolean(plateErrors[row.id])}
                            helperText={plateErrors[row.id] || ' '}
                            InputProps={{
                              ...params.InputProps,
                              disableUnderline: true
                            }}
                            sx={{
                              ...plateComboInputSx,
                              '& .MuiFormHelperText-root': {
                                mt: 0.5,
                                color: plateErrors[row.id] ? '#b91c1c' : programaTableTheme.subtleText
                              }
                            }}
                          />
                        )}
                      />
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <TextField
                        value={row.capacity}
                        onChange={(event) => handleRowFieldChange(row.id, 'capacity', event.target.value)}
                        variant="standard"
                        placeholder="15"
                        fullWidth
                        sx={tableInputSx}
                      />
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <TextField
                        select
                        value={row.equipmentStatus}
                        onChange={(event) => handleRowFieldChange(row.id, 'equipmentStatus', event.target.value)}
                        variant="standard"
                        fullWidth
                        InputProps={{
                          disableUnderline: true
                        }}
                        sx={{
                          ...tableInputSx,
                          '& .MuiInputBase-root': {
                            ...tableInputSx['& .MuiInputBase-root'],
                            backgroundColor: getStatusColors(row.equipmentStatus).bg,
                            borderRadius: 1.5,
                            px: 1,
                            py: 0.25,
                            minHeight: 36,
                            color: getStatusColors(row.equipmentStatus).fg,
                            fontWeight: 700
                          },
                          '& .MuiSelect-icon': {
                            color: getStatusColors(row.equipmentStatus).fg
                          }
                        }}
                      >
                        {programData.equipmentStatusOptions.map((statusOption) => (
                          <MenuItem key={statusOption} value={statusOption}>
                            {statusOption}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <TextField
                        value={row.driver}
                        onChange={(event) => handleRowFieldChange(row.id, 'driver', event.target.value)}
                        variant="standard"
                        placeholder="Nombre conductor"
                        fullWidth
                        sx={tableInputSx}
                      />
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <TextField
                        select
                        value={row.driverStatus}
                        onChange={(event) => handleRowFieldChange(row.id, 'driverStatus', event.target.value)}
                        variant="standard"
                        fullWidth
                        InputProps={{
                          disableUnderline: true
                        }}
                        sx={{
                          ...tableInputSx,
                          '& .MuiInputBase-root': {
                            ...tableInputSx['& .MuiInputBase-root'],
                            backgroundColor: getDriverStatusColors(row.driverStatus).bg,
                            borderRadius: 1.5,
                            px: 1,
                            py: 0.25,
                            minHeight: 36,
                            color: getDriverStatusColors(row.driverStatus).fg,
                            fontWeight: 700
                          },
                          '& .MuiSelect-icon': {
                            color: getDriverStatusColors(row.driverStatus).fg
                          }
                        }}
                      >
                        {!programData.driverStatusOptions.includes(row.driverStatus) && row.driverStatus && (
                          <MenuItem value={row.driverStatus}>{row.driverStatus}</MenuItem>
                        )}
                        {programData.driverStatusOptions.map((statusOption) => (
                          <MenuItem key={statusOption} value={statusOption}>
                            {statusOption}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell sx={tableBodyCellSx}>
                      <TextField
                        value={row.loadSite}
                        onChange={(event) => handleRowFieldChange(row.id, 'loadSite', event.target.value)}
                        variant="standard"
                        placeholder="Cochacaras"
                        fullWidth
                        sx={tableInputSx}
                      />
                    </TableCell>
                    {programData.destinationColumns.map((column) => (
                      <TableCell key={`${row.id}-${column.id}`} sx={tableBodyCellSx}>
                        <TextField
                          value={row.assignments[column.id] || ''}
                          onChange={(event) => handleAssignmentChange(row.id, column.id, event.target.value)}
                          variant="standard"
                          placeholder="Ej: 14"
                          fullWidth
                          sx={tableInputSx}
                        />
                      </TableCell>
                    ))}
                    <TableCell sx={tableBodyCellSx}>
                      <TextField
                        value={row.observation}
                        onChange={(event) => handleRowFieldChange(row.id, 'observation', event.target.value)}
                        variant="standard"
                        placeholder="Traslado de base"
                        fullWidth
                        multiline
                        minRows={1}
                        sx={tableInputSx}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ ...tableBodyCellSx, minWidth: 96 }}>
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="Duplicar fila">
                          <IconButton size="small" onClick={() => handleDuplicateRow(row.id)}>
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar fila">
                          <IconButton size="small" color="error" onClick={() => handleDeleteRow(row.id)}>
                            <DeleteIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleToastClose} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ProgramaTransportePage;
