import { listConversations, listLeads } from '../store/index.js';

// Ordem das etapas (índice = profundidade no fluxo).
const STEP_ORDER = [
  'NEW', 'AWAITING_NAME', 'AWAITING_ADDRESS', 'AWAITING_POSTVIDEO',
  'AWAITING_SITE', 'AWAITING_UNITS', 'AWAITING_PAYMENT', 'HANDOFF',
];
const STEP_LABEL = {
  NEW: 'Início', AWAITING_NAME: 'Nome', AWAITING_ADDRESS: 'Endereço',
  AWAITING_POSTVIDEO: 'Vídeo', AWAITING_SITE: 'Site', AWAITING_UNITS: 'Unidades',
  AWAITING_PAYMENT: 'Pagamento', HANDOFF: 'Handoff',
};
const idx = (s) => {
  const i = STEP_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
};
const isQualified = (c) => c.step === 'HANDOFF' || !!c.qualifiedAt;

let cache = null;
let cacheAt = 0;
const TTL_MS = 2500; // evita reler o disco a cada poll

export async function getStats() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;

  const convs = await listConversations();
  const now = Date.now();
  const total = convs.length;
  const qualified = convs.filter(isQualified).length;

  // Funil: quantos ALCANÇARAM cada etapa. Qualificados contam como tendo chegado ao
  // HANDOFF mesmo que um #bot os tenha retomado (senão a barra cairia abaixo da conversão).
  const reached = (c) => (c.qualifiedAt ? idx('HANDOFF') : idx(c.step));
  const funnelSteps = STEP_ORDER.slice(1); // sem NEW
  const funnel = [{ key: 'inicio', label: 'Iniciaram', count: total }];
  for (const s of funnelSteps) {
    funnel.push({ key: s, label: STEP_LABEL[s], count: convs.filter((c) => reached(c) >= idx(s)).length });
  }

  // Onde os leads estão AGORA (para os selos "X aqui" no fluxo).
  const currentByStep = {};
  for (const c of convs) {
    if (c.step === 'HANDOFF') continue;
    currentByStep[c.step] = (currentByStep[c.step] || 0) + 1;
  }

  // Objeções somadas por tipo.
  const objTotals = {};
  for (const c of convs) {
    if (c.objections) {
      for (const [k, v] of Object.entries(c.objections)) objTotals[k] = (objTotals[k] || 0) + v;
    }
  }
  const objections = Object.entries(objTotals)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  // Ativos agora: em andamento (não NEW/HANDOFF) com atividade na última hora.
  const activeNow = convs.filter(
    (c) => c.step !== 'HANDOFF' && c.step !== 'NEW' && now - (c.lastUserAt || 0) < 3600_000
  ).length;

  // Leads por dia (últimos 14 dias) a partir do createdAt das conversas.
  const perDay = lastNDays(14);
  for (const c of convs) {
    const day = dayKey(c.createdAt);
    if (day && day in perDay) perDay[day] += 1;
  }

  cache = {
    kpis: {
      total,
      qualified,
      conversion: total ? +((100 * qualified) / total).toFixed(1) : 0,
      activeNow,
    },
    funnel,
    currentByStep,
    objections,
    perDay: Object.entries(perDay).map(([day, count]) => ({ day, count })),
    updatedAt: now,
  };
  cacheAt = now;
  return cache;
}

export async function getLive(limit = 14) {
  const convs = await listConversations();
  const now = Date.now();
  const rows = convs
    .filter((c) => c.step !== 'NEW')
    .sort((a, b) => (b.lastUserAt || 0) - (a.lastUserAt || 0))
    .slice(0, limit)
    .map((c) => ({
      name: c.data?.nome || c.data?.pushName || ('+' + (c.phone || '')),
      phone: maskPhone(c.phone),
      step: c.step,
      stepLabel: STEP_LABEL[c.step] || c.step,
      qualified: isQualified(c),
      agoMs: now - (c.lastUserAt || c.updatedAt || now),
    }));
  return { rows, updatedAt: now };
}

function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 6) return s;
  return s.slice(0, 4) + '•••' + s.slice(-2);
}

// Bucketiza por dia no fuso do negócio (Brasil), não em UTC (o Render roda em UTC).
const BR_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD

function dayKey(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return BR_DAY.format(d);
}

function lastNDays(n) {
  const out = {};
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out[BR_DAY.format(new Date(now - i * 86400_000))] = 0;
  }
  return out;
}
