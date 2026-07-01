import crypto from 'node:crypto';
import { config } from '../config.js';

function safeEqual(a, b) {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Rate limit simples em memória contra brute-force (por IP).
const MAX_FAILS = 20;
const WINDOW_MS = 5 * 60_000;
const fails = new Map(); // ip -> { count, resetAt }

function bucket(ip) {
  const now = Date.now();
  let b = fails.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    if (fails.size > 5000) fails.clear(); // guarda de memória
    fails.set(ip, b);
  }
  return b;
}

/** Basic Auth + rate limit para o painel. Sem PANEL_PASSWORD, o painel fica desativado. */
export function panelAuth(req, res, next) {
  if (!config.panel.password) {
    return res.status(503).send('Painel desativado: defina PANEL_PASSWORD no ambiente.');
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const b = bucket(ip);
  if (b.count >= MAX_FAILS) {
    res.set('Retry-After', '300');
    return res.status(429).send('Muitas tentativas. Tente novamente em alguns minutos.');
  }

  const m = (req.headers.authorization || '').match(/^Basic\s+(.+)$/i);
  if (m) {
    const [user, pass] = Buffer.from(m[1], 'base64').toString().split(':');
    if (safeEqual(user, config.panel.user) && safeEqual(pass, config.panel.password)) {
      b.count = 0; // sucesso zera o contador
      return next();
    }
  }

  b.count += 1;
  res.set('WWW-Authenticate', 'Basic realm="Painel Supervisao 360", charset="UTF-8"');
  return res.status(401).send('Autenticação necessária.');
}
