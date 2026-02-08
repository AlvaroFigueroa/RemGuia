const numberFormatter = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const longDateFormatter = new Intl.DateTimeFormat('es-CL', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const timeFormatter = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit'
});

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter.format(value);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return longDateFormatter.format(date);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
};

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return timeFormatter.format(date);
};

const formatIntervalMinutes = (minutes) => {
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds} s`;
  }
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

const renderIntervalCell = (interval) => {
  if (!interval) {
    return '<div class="interval-cell interval-cell--empty">—</div>';
  }

  if (interval.closing) {
    return `
      <div class="interval-cell interval-cell--closing">
        <div class="interval-title">Cierre del día</div>
        <div class="interval-meta">Guía ${escapeHtml(interval.guide || 'Sin número')}</div>
        <div class="interval-meta">${formatDateTime(interval.time || interval.date)}</div>
      </div>
    `;
  }

  return `
    <div class="interval-cell">
      <div class="interval-title">${formatIntervalMinutes(interval.minutes)}</div>
      <div class="interval-meta">${escapeHtml(interval.fromGuide || '—')} → ${escapeHtml(interval.toGuide || '—')}</div>
      <div class="interval-meta">${formatTime(interval.fromDate)}</div>
      <div class="interval-meta">${formatTime(interval.toDate)}</div>
    </div>
  `;
};

const renderTotalsByType = (totals = []) => {
  if (!Array.isArray(totals) || !totals.length) {
    return '—';
  }
  return totals
    .map((entry) => `${escapeHtml(entry.type || 'Sin tipo')}: ${formatNumber(entry.total)} m³`)
    .join(' · ');
};

export const createIntervalReportHtml = (data = {}) => {
  const filters = data.filters || {};
  const summary = data.summary || {};
  const intervals = Array.isArray(data.intervals) ? data.intervals : [];
  const highlight = summary.highlight || {};
  const columns = (summary.columns && summary.columns.length
    ? summary.columns
    : Array.from({ length: summary.maxIntervalColumns || 0 }, (_, idx) => `Intervalo ${idx + 1}`)) || [];
  const columnCount = columns.length;
  const generatedAt = summary.generatedAt || new Date().toISOString();

  const highlightBlock = highlight.hasData
    ? `
      <section class="highlight">
        <div>
          <div class="label">Ruta</div>
          <div class="value">${escapeHtml(highlight.label || 'Origen/Destino no definido')}</div>
        </div>
        <div>
          <div class="label">Distancia media</div>
          <div class="value">${highlight.averageDistance ? `${escapeHtml(highlight.averageDistance)} km` : '—'}</div>
        </div>
        <div>
          <div class="label">Condiciones</div>
          <div class="value">${escapeHtml(highlight.routeConditions || 'Sin comentarios')}</div>
        </div>
      </section>
    `
    : '';

  const intervalRows = intervals
    .map((entry) => {
      const cells = Array.from({ length: columnCount }, (_, idx) => `<td>${renderIntervalCell(entry.intervals?.[idx])}</td>`).join('');
      return `
        <tr>
          <td>
            <div class="conductor-card">
              <div class="conductor-name">${escapeHtml(entry.conductor || 'Sin conductor')}</div>
              <div class="conductor-meta">${entry.receptions || 0} recepción(es)</div>
              ${entry.capacityLabel ? `<div class="conductor-meta">Capacidad: ${escapeHtml(entry.capacityLabel)}</div>` : ''}
              <div class="conductor-meta">Total transportado: ${formatNumber(entry.totalTransported)} m³</div>
              <div class="conductor-meta">${renderTotalsByType(entry.totalsByType)}</div>
            </div>
          </td>
          ${cells}
        </tr>
      `;
    })
    .join('');

  const totalsRow = Array.isArray(summary.intervalColumnTotals) && summary.intervalColumnTotals.length
    ? `
      <tr class="totals-row">
        <td>
          <div class="conductor-card">
            <div class="conductor-name">Total transportado en el día</div>
            <div class="conductor-meta">${formatNumber(summary.totalTransportedDay)} m³</div>
          </div>
        </td>
        ${summary.intervalColumnTotals
          .map((value) => `<td><div class="interval-cell interval-cell--total">${value > 0 ? `${formatNumber(value)} m³` : '—'}</div></td>`)
          .join('')}
      </tr>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Intervalos por conductor</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 24px 32px 48px;
            color: #1f2933;
            background-color: #ffffff;
            line-height: 1.4;
          }
          h1 {
            margin: 0 0 4px;
            font-size: 22px;
            font-weight: 700;
            color: #111827;
          }
          p { margin: 0; }
          .report-header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-top: 12px;
          }
          .label {
            font-size: 11px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #6b7280;
          }
          .value {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
          }
          .card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
            background: linear-gradient(180deg, #fdfdfd 0%, #f5f7fb 100%);
          }
          .card-value { font-size: 20px; font-weight: 700; color: #111827; }
          .highlight {
            border: 1px solid #dbeafe;
            border-radius: 16px;
            padding: 16px;
            background: #eff6ff;
            margin-bottom: 18px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
          }
          thead {
            background: #f3f4f6;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 10px;
            vertical-align: top;
          }
          th {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            text-align: left;
          }
          .conductor-card { font-size: 12px; }
          .conductor-name { font-weight: 700; font-size: 14px; color: #111827; }
          .conductor-meta { color: #4b5563; font-size: 11px; margin-top: 2px; }
          .interval-cell {
            font-size: 11px;
            color: #111827;
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-height: 68px;
          }
          .interval-title { font-weight: 700; font-size: 12px; }
          .interval-meta { color: #4b5563; font-size: 10px; }
          .interval-cell--closing { background: #fef3c7; border-radius: 6px; padding: 6px; }
          .interval-cell--total { font-weight: 700; text-align: center; }
          .interval-cell--empty { color: #c4c4c4; text-align: center; }
          .totals-row td { background: #f9fafb; }
        </style>
      </head>
      <body>
        <section class="report-header">
          <h1>Intervalos por conductor</h1>
          <p>Reporte generado el ${formatDate(generatedAt)}</p>
          <div class="meta-grid">
            <div>
              <div class="label">Rango analizado</div>
              <div class="value">${escapeHtml(filters.startDate || '—')} al ${escapeHtml(filters.endDate || '—')}</div>
            </div>
            <div>
              <div class="label">Origen seleccionado</div>
              <div class="value">${escapeHtml(filters.ubicacion || 'Todos')}</div>
            </div>
            <div>
              <div class="label">Destino</div>
              <div class="value">${escapeHtml(filters.destino || 'Todos')}</div>
            </div>
            <div>
              <div class="label">Subdestino</div>
              <div class="value">${escapeHtml(filters.subDestino || 'Todos')}</div>
            </div>
          </div>
        </section>

        <section class="summary-grid">
          <div class="card">
            <div class="label">Conductores analizados</div>
            <div class="card-value">${summary.totalConductors || 0}</div>
          </div>
          <div class="card">
            <div class="label">Volumen total (m³)</div>
            <div class="card-value">${formatNumber(summary.totalTransportedDay)}</div>
          </div>
          <div class="card">
            <div class="label">Columnas de intervalos</div>
            <div class="card-value">${columnCount}</div>
          </div>
        </section>

        ${highlightBlock}

        <table>
          <thead>
            <tr>
              <th style="width: 180px">Conductor</th>
              ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${intervalRows || '<tr><td colspan="100%" style="text-align:center; padding:24px;">No hay datos para mostrar.</td></tr>'}
            ${totalsRow}
          </tbody>
        </table>
      </body>
    </html>
  `;
};
