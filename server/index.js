import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

import { createIntervalReportHtml } from './templates/intervalReportTemplate.js';

const PORT = Number(process.env.REPORTS_SERVER_PORT || 4000);
const HOST = process.env.REPORTS_SERVER_HOST || '0.0.0.0';

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));

let browserInstance;

const getBrowser = async () => {
  if (browserInstance) {
    try {
      const browserProcess = browserInstance.process();
      if (!browserProcess || browserProcess.exitCode == null) {
        return browserInstance;
      }
    } catch (error) {
      console.warn('Reiniciando instancia de Puppeteer:', error);
    }
  }

  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
  });
  return browserInstance;
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/reports/intervals/pdf', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!Array.isArray(payload.intervals)) {
      return res.status(400).json({ message: 'El cuerpo debe incluir la lista de intervalos.' });
    }

    const html = createIntervalReportHtml(payload);
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '16mm', left: '12mm', right: '12mm' }
    });

    await page.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="intervalos-por-conductor.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF de intervalos:', error);
    res.status(500).json({ message: 'No se pudo generar el PDF', detail: error?.message });
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Reports server listening on http://${HOST}:${PORT}`);
});

const gracefulShutdown = async () => {
  console.log('Cerrando servidor de reportes…');
  server.close();
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (error) {
      console.warn('Error al cerrar Puppeteer:', error);
    }
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
