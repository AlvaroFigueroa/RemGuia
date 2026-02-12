import { useCallback, useMemo, useState } from 'react';
import basePdfMake from 'pdfmake/build/pdfmake';
import pdfMakeFonts from 'pdfmake/build/vfs_fonts';
import {
  Container,
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Snackbar,
  Alert,
  CircularProgress,
  TablePagination
} from '@mui/material';

let cachedPdfMake = null;

const getPdfMakeInstance = async () => {
  if (cachedPdfMake) return cachedPdfMake;
  const pdfMake = basePdfMake;

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

const InformesAridosPage = () => {
  const todayIso = useMemo(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }, []);

  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [appliedRange, setAppliedRange] = useState({ from: todayIso, to: todayIso });
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: 'info', message: '' });
  const [rows, setRows] = useState([]);
  const [plantaRows, setPlantaRows] = useState([]);
  const [plantaSearch, setPlantaSearch] = useState('');
  const [plantaPage, setPlantaPage] = useState(0);
  const [plantaRowsPerPage, setPlantaRowsPerPage] = useState(10);

  const columns = useMemo(
    () => [
      { key: 'destino', label: 'Destino', align: 'left', minWidth: 220 },
      { key: 'base15', label: 'Base 1.5', align: 'center' },
      { key: 'base15Acum', label: 'Acum.', align: 'center' },
      { key: 'baseArcilla', label: 'Base Arcilla', align: 'center' },
      { key: 'baseArcillaAcum', label: 'Acum.', align: 'center' },
      { key: 'base2', label: 'Base 2', align: 'center' },
      { key: 'base2Acum', label: 'Acum.', align: 'center' },
      { key: 'grava15', label: 'Grava 1.5', align: 'center' },
      { key: 'grava15Acum', label: 'Acum.', align: 'center' },
      { key: 'grava', label: 'Grava', align: 'center' },
      { key: 'gravaAcum', label: 'Acum.', align: 'center' },
      { key: 'integral', label: 'Integral', align: 'center' },
      { key: 'integralAcum', label: 'Acum.', align: 'center' },
      { key: 'bolones', label: 'Bolones', align: 'center' },
      { key: 'bolonesAcum', label: 'Acum.', align: 'center' }
    ],
    []
  );

  const transporteApiBaseUrl = useMemo(() => {
    const envBase = (import.meta.env.VITE_TRANSPORTE_API || '').trim();
    const base = envBase.length > 0 ? envBase : 'https://guia.codecland.com/api';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const toNumber = useCallback((value) => {
    if (value == null) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const sanitized = value
      .toString()
      .trim()
      .replaceAll('.', '')
      .replaceAll(',', '.');
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const extractDestino = useCallback((record) => {
    const raw = record?.destino ?? record?.destination ?? record?.Destino ?? '';
    return typeof raw === 'string' ? raw.trim() : '';
  }, []);

  const extractFechaKey = useCallback((record) => {
    const raw = record?.fecha ?? record?.date ?? record?.Fecha;
    if (!raw) return '';
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
      if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        return `${year}-${month}-${day}`;
      }
      return trimmed;
    }
    return '';
  }, []);

  const extractIdTransporte = useCallback((record) => {
    const raw = record?.id_transporte ?? record?.idTransporte ?? record?.id ?? record?.Id;
    if (raw == null) return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    const parsed = Number(raw.toString().trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const sumMaterials = useCallback((records, destinoAllowList = null) => {
    const allow = destinoAllowList
      ? new Set(destinoAllowList.map((name) => name.toLowerCase()))
      : null;

    const aggregates = new Map();

    records.forEach((record) => {
      const destino = extractDestino(record);
      if (!destino) return;
      const key = destino.toLowerCase();
      if (allow && !allow.has(key)) return;

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          destino,
          base15: 0,
          baseArcilla: 0,
          base2: 0,
          grava15: 0,
          grava: 0,
          integral: 0,
          bolones: 0
        });
      }

      const bucket = aggregates.get(key);
      bucket.base15 += toNumber(record?.base_1_5 ?? record?.base_1_5_50 ?? record?.base_1_5Arcilla ?? record?.base_1_5_550 ?? record?.base_1_5);
      bucket.baseArcilla += toNumber(record?.base_arcilla ?? record?.Arcilla ?? record?.baseArcilla);
      bucket.base2 += toNumber(record?.base_2 ?? record?.base2);
      bucket.grava15 += toNumber(record?.grava_1_5 ?? record?.Grava_1_5 ?? record?.grava15);
      bucket.grava += toNumber(record?.grava ?? record?.Grava);
      bucket.integral += toNumber(record?.integral ?? record?.Integral);
      bucket.bolones += toNumber(record?.bolones ?? record?.Bolones);
    });

    return aggregates;
  }, [extractDestino, toNumber]);

  const pickLastDestinosByMaxId = useCallback((records, limit = 8) => {
    const destinoMeta = new Map();
    records.forEach((record) => {
      const destino = extractDestino(record);
      if (!destino) return;
      const key = destino.toLowerCase();
      const idTransporte = extractIdTransporte(record);
      const prev = destinoMeta.get(key);
      if (!prev || idTransporte > prev.maxId) {
        destinoMeta.set(key, { destino, maxId: idTransporte });
      }
    });
    return Array.from(destinoMeta.values())
      .sort((a, b) => b.maxId - a.maxId)
      .slice(0, limit)
      .map((entry) => entry.destino);
  }, [extractDestino, extractIdTransporte]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => (row.destino || '').toLowerCase().includes(needle));
  }, [rows, search]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0
  }), []);

  const decimalFormatter = useMemo(() => new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }), []);

  const formatCellValue = useCallback((value, options = {}) => {
    const { decimals = null } = options;
    if (typeof value === 'number') {
      if (decimals === 2) return decimalFormatter.format(value);
      return numberFormatter.format(value);
    }
    return value || '';
  }, [decimalFormatter, numberFormatter]);

  const plantaColumns = useMemo(
    () => [
      { key: 'planta', label: 'Planta', align: 'left', minWidth: 220 },
      { key: 'base15', label: 'Base 1.5', align: 'center' },
      { key: 'base15Acum', label: 'Acum.', align: 'center' },
      { key: 'stock', label: 'Stock', align: 'center' },
      { key: 'm3hHistorico', label: 'M3/H Historico', align: 'center' }
    ],
    []
  );

  const filteredPlantaRows = useMemo(() => {
    const needle = plantaSearch.trim().toLowerCase();
    if (!needle) return plantaRows;
    return plantaRows.filter((row) => (row.planta || '').toLowerCase().includes(needle));
  }, [plantaRows, plantaSearch]);

  const pagedPlantaRows = useMemo(() => {
    const start = plantaPage * plantaRowsPerPage;
    return filteredPlantaRows.slice(start, start + plantaRowsPerPage);
  }, [filteredPlantaRows, plantaPage, plantaRowsPerPage]);

  const plantaTotals = useMemo(() => {
    const total = { planta: 'Total', base15: 0, base15Acum: 0, stock: 0, m3hHistorico: 0 };
    filteredPlantaRows.forEach((row) => {
      total.base15 += Number(row.base15 || 0);
      total.base15Acum += Number(row.base15Acum || 0);
      total.stock += Number(row.stock || 0);
    });
    return total;
  }, [filteredPlantaRows]);

  const handlePlantaChangePage = useCallback((_event, newPage) => {
    setPlantaPage(newPage);
  }, []);

  const handlePlantaChangeRowsPerPage = useCallback((event) => {
    const next = Number(event.target.value);
    setPlantaRowsPerPage(Number.isFinite(next) ? next : 10);
    setPlantaPage(0);
  }, []);

  const handlePlantaExportExcel = useCallback(() => {
    const header = plantaColumns.map((col) => col.label);
    const line = (row) =>
      plantaColumns
        .map((col) => {
          const raw = row[col.key];
          const value = typeof raw === 'number' ? raw.toString() : (raw || '').toString();
          const escaped = value.replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(',');
    const csv = [header.map((h) => `"${h.replaceAll('"', '""')}"`).join(','), ...filteredPlantaRows.map(line), line(plantaTotals)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Planta - ${appliedRange.from} a ${appliedRange.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [appliedRange.from, appliedRange.to, filteredPlantaRows, plantaColumns, plantaTotals]);

  const handlePlantaExportPdf = useCallback(() => {
    setToast({ open: true, severity: 'info', message: 'PDF de Planta se conectará cuando definamos la consulta.' });
  }, []);

  const totals = useMemo(() => {
    const base = {
      destino: 'Total'
    };
    columns.forEach((col) => {
      if (col.key === 'destino') return;
      base[col.key] = 0;
    });
    filteredRows.forEach((row) => {
      columns.forEach((col) => {
        if (col.key === 'destino') return;
        const value = Number(row[col.key] || 0);
        base[col.key] += Number.isFinite(value) ? value : 0;
      });
    });
    return base;
  }, [columns, filteredRows]);

  const handleToastClose = useCallback((_event, reason) => {
    if (reason === 'clickaway') return;
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConsult = useCallback(() => {
    if (!fromDate || !toDate) {
      setToast({ open: true, severity: 'error', message: 'Selecciona un rango de fechas válido.' });
      return;
    }
    if (fromDate > toDate) {
      setToast({ open: true, severity: 'error', message: 'La fecha desde no puede ser mayor que la fecha hasta.' });
      return;
    }
    const run = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        const endAll = nowLocal.toISOString().slice(0, 10);
        const startAll = '2000-01-01';

        const paramsAll = new URLSearchParams();
        paramsAll.append('startDate', startAll);
        paramsAll.append('endDate', endAll);

        const responseAllPromise = fetch(`${transporteApiBaseUrl}/transporte_by_date.php?${paramsAll.toString()}`);

        const params = new URLSearchParams();
        params.append('startDate', fromDate);
        params.append('endDate', toDate);
        const responsePeriodPromise = fetch(`${transporteApiBaseUrl}/transporte_by_date.php?${params.toString()}`);

        const paramsPlanta = new URLSearchParams();
        paramsPlanta.append('startDate', fromDate);
        paramsPlanta.append('endDate', toDate);
        const responsePlantaPromise = fetch(`${transporteApiBaseUrl}/planta_by_date.php?${paramsPlanta.toString()}`);

        const [allResult, periodResult, plantaResult] = await Promise.allSettled([
          responseAllPromise,
          responsePeriodPromise,
          responsePlantaPromise
        ]);

        if (allResult.status !== 'fulfilled' || !allResult.value.ok) {
          throw new Error('No se pudo obtener la información histórica desde SQL.');
        }

        if (periodResult.status !== 'fulfilled' || !periodResult.value.ok) {
          throw new Error('No se pudo consultar la información en SQL.');
        }

        const payloadAll = await allResult.value.json();
        if (!payloadAll?.success) {
          throw new Error(payloadAll?.message || 'Respuesta inválida desde la API SQL (histórico).');
        }
        const allRecords = Array.isArray(payloadAll?.data) ? payloadAll.data : [];
        const destinos = pickLastDestinosByMaxId(allRecords, 8);
        const cumulativeAggregates = sumMaterials(allRecords, destinos);

        const payload = await periodResult.value.json();
        if (!payload?.success) {
          throw new Error(payload?.message || 'Respuesta inválida desde la API SQL.');
        }
        const periodRecords = Array.isArray(payload?.data) ? payload.data : [];
        const periodAggregates = sumMaterials(periodRecords, destinos);

        let plantaFailed = false;
        if (plantaResult.status === 'fulfilled' && plantaResult.value.ok) {
          const payloadPlanta = await plantaResult.value.json();
          if (payloadPlanta?.success) {
            const plantaData = Array.isArray(payloadPlanta?.data) ? payloadPlanta.data : [];
            const allowedPlantas = new Set(
              ['Cocharcas', 'Vista Bella', 'Movil Cocharcas', 'El Saque'].map((name) => name.toLowerCase())
            );
            const filtered = plantaData.filter((row) => allowedPlantas.has((row?.planta || '').toString().trim().toLowerCase()));
            setPlantaRows(filtered);
          } else {
            plantaFailed = true;
            setPlantaRows([]);
          }
        } else {
          plantaFailed = true;
          setPlantaRows([]);
        }

        const nextRows = destinos.map((destino) => {
          const key = destino.toLowerCase();
          const period = periodAggregates.get(key);
          const cumulative = cumulativeAggregates.get(key);

          const base15 = period?.base15 || 0;
          const baseArcilla = period?.baseArcilla || 0;
          const base2 = period?.base2 || 0;
          const grava15 = period?.grava15 || 0;
          const grava = period?.grava || 0;
          const integral = period?.integral || 0;
          const bolones = period?.bolones || 0;

          return {
            destino,
            base15,
            base15Acum: cumulative?.base15 || 0,
            baseArcilla,
            baseArcillaAcum: cumulative?.baseArcilla || 0,
            base2,
            base2Acum: cumulative?.base2 || 0,
            grava15,
            grava15Acum: cumulative?.grava15 || 0,
            grava,
            gravaAcum: cumulative?.grava || 0,
            integral,
            integralAcum: cumulative?.integral || 0,
            bolones,
            bolonesAcum: cumulative?.bolones || 0
          };
        });

        setRows(nextRows);
        setAppliedRange({ from: fromDate, to: toDate });
        setToast({
          open: true,
          severity: plantaFailed ? 'warning' : 'success',
          message: plantaFailed
            ? `Consulta lista. Destinos OK (${nextRows.length}). Planta no se pudo cargar (API/CORS).`
            : `Consulta lista. Mostrando ${nextRows.length} destinos.`
        });
      } catch (queryError) {
        console.error(queryError);
        setRows([]);
        setPlantaRows([]);
        setToast({ open: true, severity: 'error', message: queryError?.message || 'No se pudo consultar la información.' });
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [fromDate, pickLastDestinosByMaxId, sumMaterials, toDate, transporteApiBaseUrl]);

  const buildCsv = useCallback((items) => {
    const header = columns.map((col) => col.label);
    const toLine = (row) =>
      columns
        .map((col) => {
          const raw = row[col.key];
          const value = typeof raw === 'number' ? raw.toString() : (raw || '').toString();
          const escaped = value.replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(',');
    return [header.map((h) => `"${h.replaceAll('"', '""')}"`).join(','), ...items.map(toLine)].join('\n');
  }, [columns]);

  const handleExportExcel = useCallback(() => {
    const csv = buildCsv([...filteredRows, totals]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Informes Aridos - ${appliedRange.from} a ${appliedRange.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [appliedRange.from, appliedRange.to, buildCsv, filteredRows, totals]);

  const handleExportPdf = useCallback(async () => {
    try {
      if (filteredRows.length === 0) {
        setToast({ open: true, severity: 'info', message: 'No hay datos para exportar.' });
        return;
      }

      const pdfMake = await getPdfMakeInstance();

      const headerRow = columns.map((col) => ({
        text: col.label,
        bold: true,
        fillColor: '#0f1f3a',
        color: '#f8fafc',
        alignment: col.align,
        margin: [0, 6, 0, 6]
      }));

      const bodyRows = filteredRows.map((row) =>
        columns.map((col) => ({
          text: formatCellValue(row[col.key]),
          alignment: col.align,
          margin: [0, 4, 0, 4]
        }))
      );

      const totalsRow = columns.map((col) => ({
        text: formatCellValue(totals[col.key]),
        alignment: col.align,
        bold: true,
        margin: [0, 5, 0, 5]
      }));

      const widths = columns.map((col) => (col.key === 'destino' ? 160 : 55));

      const docDefinition = {
        pageOrientation: 'landscape',
        pageSize: 'LEGAL',
        pageMargins: [20, 30, 20, 30],
        content: [
          {
            text: `Informes Áridos (${appliedRange.from} a ${appliedRange.to})`,
            alignment: 'center',
            bold: true,
            fontSize: 14,
            margin: [0, 0, 0, 12]
          },
          {
            table: {
              headerRows: 1,
              widths,
              body: [headerRow, ...bodyRows, totalsRow]
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
        defaultStyle: {
          fontSize: 8,
          color: '#0f172a'
        }
      };

      const filename = `Informes Aridos - ${appliedRange.from} a ${appliedRange.to}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);
    } catch (pdfError) {
      console.error(pdfError);
      setToast({ open: true, severity: 'error', message: pdfError?.message || 'No se pudo exportar el PDF.' });
    }
  }, [appliedRange.from, appliedRange.to, columns, filteredRows, formatCellValue, totals]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ pt: 4, pb: 10 }}>
      <Stack spacing={3}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h4" component="h1" gutterBottom fontWeight={600}>
                Informes Áridos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Consulta información entre fechas y exporta resultados.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <TextField
                label="Desde"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: { xs: '100%', sm: 170 } }}
              />
              <TextField
                label="Hasta"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: { xs: '100%', sm: 170 } }}
              />
              <Button variant="contained" onClick={handleConsult} sx={{ minWidth: { xs: '100%', sm: 120 } }}>
                Consultar
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button variant="outlined" size="small" onClick={handleExportExcel}>Excel</Button>
                <Button variant="outlined" size="small" onClick={handleExportPdf}>PDF</Button>
                <Button variant="outlined" size="small" onClick={handlePrint}>Print</Button>
              </Stack>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Buscar:
                </Typography>
                <TextField
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  size="small"
                  placeholder="Destino"
                />
              </Box>
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        align={col.align}
                        sx={{ fontWeight: 700, backgroundColor: '#f8fafc', minWidth: col.minWidth }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        No hay datos para mostrar.
                      </TableCell>
                    </TableRow>
                  )}

                  {filteredRows.map((row) => (
                    <TableRow key={row.destino} hover>
                      {columns.map((col) => (
                        <TableCell key={`${row.destino}-${col.key}`} align={col.align}>
                          {formatCellValue(row[col.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!isLoading && filteredRows.length > 0 && (
                    <TableRow>
                      {columns.map((col) => (
                        <TableCell key={`total-${col.key}`} align={col.align} sx={{ fontWeight: 700 }}>
                          {formatCellValue(totals[col.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>

                <TableFooter>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell
                        key={`footer-${col.key}`}
                        align={col.align}
                        sx={{ fontWeight: 700, backgroundColor: '#f8fafc', borderTop: '1px solid rgba(224, 224, 224, 1)' }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>

            <Typography variant="caption" color="text.secondary">
              Rango aplicado: {appliedRange.from} a {appliedRange.to}
            </Typography>
          </Stack>
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button variant="outlined" size="small" onClick={handlePlantaExportExcel}>Excel</Button>
                <Button variant="outlined" size="small" onClick={handlePlantaExportPdf}>PDF</Button>
                <Button variant="outlined" size="small" onClick={handlePrint}>Print</Button>
              </Stack>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Buscar:
                </Typography>
                <TextField
                  value={plantaSearch}
                  onChange={(event) => {
                    setPlantaSearch(event.target.value);
                    setPlantaPage(0);
                  }}
                  size="small"
                  placeholder="Planta"
                />
              </Box>
            </Stack>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {plantaColumns.map((col) => (
                      <TableCell
                        key={col.key}
                        align={col.align}
                        sx={{ fontWeight: 700, backgroundColor: '#f8fafc', minWidth: col.minWidth }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {pagedPlantaRows.map((row) => (
                    <TableRow key={row.planta} hover>
                      {plantaColumns.map((col) => (
                        <TableCell key={`${row.planta}-${col.key}`} align={col.align}>
                          {col.key === 'm3hHistorico'
                            ? formatCellValue(row[col.key], { decimals: 2 })
                            : formatCellValue(row[col.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {pagedPlantaRows.length > 0 && (
                    <TableRow>
                      {plantaColumns.map((col) => (
                        <TableCell key={`planta-total-${col.key}`} align={col.align} sx={{ fontWeight: 700 }}>
                          {col.key === 'm3hHistorico'
                            ? formatCellValue(plantaTotals[col.key], { decimals: 2 })
                            : formatCellValue(plantaTotals[col.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>

                <TableFooter>
                  <TableRow>
                    {plantaColumns.map((col) => (
                      <TableCell
                        key={`planta-footer-${col.key}`}
                        align={col.align}
                        sx={{ fontWeight: 700, backgroundColor: '#f8fafc', borderTop: '1px solid rgba(224, 224, 224, 1)' }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filteredPlantaRows.length}
              page={plantaPage}
              onPageChange={handlePlantaChangePage}
              rowsPerPage={plantaRowsPerPage}
              onRowsPerPageChange={handlePlantaChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
              labelRowsPerPage="Filas"
              labelDisplayedRows={({ from, to, count }) => `Mostrando ${from} a ${to} de ${count} entradas`}
            />
          </Stack>
        </Paper>
      </Stack>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleToastClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} onClose={handleToastClose} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default InformesAridosPage;
