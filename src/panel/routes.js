import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { panelAuth } from './auth.js';
import { getFlowMap } from './flowmap.js';
import { getStats, getLive } from './stats.js';
import { log } from '../util/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const panelRouter = express.Router();

// Tudo no /painel exige autenticação.
panelRouter.use(panelAuth);

panelRouter.get('/api/flow', (_req, res) => {
  res.json(getFlowMap());
});

panelRouter.get('/api/stats', async (_req, res) => {
  try {
    res.json(await getStats());
  } catch (e) {
    log.error('painel/stats', e.message);
    res.status(500).json({ error: 'stats_failed' });
  }
});

panelRouter.get('/api/live', async (_req, res) => {
  try {
    res.json(await getLive());
  } catch (e) {
    log.error('painel/live', e.message);
    res.status(500).json({ error: 'live_failed' });
  }
});

// UI estática (index.html, app.js, styles.css) — também protegida pelo auth acima.
panelRouter.use('/', express.static(path.join(__dirname, 'public')));
