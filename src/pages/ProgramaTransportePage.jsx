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
  Snackbar
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
  driverStatusOptions: ['Trabajando', 'Disponible', 'Descanso', 'Licencia', 'Traslado', 'Reemplazo'],
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
  py: 1.5
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

const buildPdfColumnWidths = (destinationCount) => {
  const fixedColumns = [55, 62, 34, 70, 95, 78, 78];
  const observationWidth = 150;
  const usableWidth = 800;
  const fixedWidthSum = fixedColumns.reduce((sum, width) => sum + width, 0) + observationWidth;
  const remaining = Math.max(usableWidth - fixedWidthSum, 60);
  const destinationWidth = destinationCount > 0
    ? Math.max(34, Math.floor(remaining / destinationCount))
    : 0;
  return [...fixedColumns, ...Array(destinationCount).fill(destinationWidth || 50), observationWidth];
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
        text: label.toUpperCase(),
        style: 'tableHeader'
      }));

      const bodyRows = programData.rows.map((row) => {
        const values = [
          row.equipmentType || '—',
          row.plate || '—',
          row.capacity || '—',
          row.equipmentStatus || '—',
          row.driver || '—',
          row.driverStatus || '—',
          row.loadSite || '—',
          ...programData.destinationColumns.map((column) => row.assignments[column.id] || ''),
          row.observation || ''
        ];
        return values.map((value) => ({ text: value, style: 'tableCell' }));
      });

      const widths = buildPdfColumnWidths(programData.destinationColumns.length);

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
            margin: [0, 4, 0, 4]
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
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRow}>
                Nueva fila
              </Button>
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
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 140 }}>Tipo equipo</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 120 }}>Patente</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 80 }}>Cap.</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 150 }}>Situación equipo</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 150 }}>Conductor</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 160 }}>Situación conductor</TableCell>
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 150 }}>Lugar de carga</TableCell>
                  {programData.destinationColumns.map((column) => (
                    <TableCell key={column.id} align="center" sx={{ ...tableHeaderCellSx, minWidth: 130 }}>
                      {column.label}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ ...tableHeaderCellSx, minWidth: 200 }}>{programData.observationLabel}</TableCell>
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
                      <TextField
                        value={row.plate}
                        onChange={(event) => handleRowFieldChange(row.id, 'plate', event.target.value)}
                        variant="standard"
                        placeholder="DKXC-59"
                        fullWidth
                        sx={tableInputSx}
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
                        value={row.equipmentStatus}
                        onChange={(event) => handleRowFieldChange(row.id, 'equipmentStatus', event.target.value)}
                        variant="standard"
                        placeholder="Operativo"
                        fullWidth
                        sx={tableInputSx}
                      />
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          label={row.equipmentStatus || 'Sin estado'}
                          color={statusPalette[row.equipmentStatus] || 'default'}
                          size="small"
                        />
                      </Box>
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
                        value={row.driverStatus}
                        onChange={(event) => handleRowFieldChange(row.id, 'driverStatus', event.target.value)}
                        variant="standard"
                        placeholder="Trabajando"
                        fullWidth
                        sx={tableInputSx}
                      />
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
