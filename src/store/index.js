import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { log } from '../util/logger.js';

// Persistência simples em arquivos JSON (1 por conversa) + um JSONL de leads.
// Sem dependências nativas; no Render aponte DATA_DIR para o disco persistente.
const convDir = path.join(config.dataDir, 'conversations');
const leadsFile = path.join(config.dataDir, 'leads.jsonl');
const cache = new Map();
const MAX_CACHE = 5000; // teto do cache em memória (disco continua sendo a fonte da verdade)

function cacheSet(phone, obj) {
  cache.set(phone, obj);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value; // evicção FIFO simples
    if (oldest !== phone) cache.delete(oldest);
  }
}

export async function initStore() {
  await fs.mkdir(convDir, { recursive: true });
}

const fileFor = (phone) => path.join(convDir, `${phone}.json`);

export async function getConversation(phone) {
  if (cache.has(phone)) return cache.get(phone);
  try {
    const obj = JSON.parse(await fs.readFile(fileFor(phone), 'utf8'));
    cacheSet(phone, obj);
    return obj;
  } catch (e) {
    if (e.code !== 'ENOENT') log.error('getConversation', phone, e.message);
    return null;
  }
}

export async function saveConversation(phone, obj) {
  cacheSet(phone, obj);
  const target = fileFor(phone);
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
  await fs.rename(tmp, target); // escrita atômica
}

export async function deleteConversation(phone) {
  cache.delete(phone);
  try {
    await fs.unlink(fileFor(phone));
  } catch {
    /* já não existe */
  }
}

/** Todas as conversas (para o varredor de inatividade). */
export async function listConversations() {
  const files = await fs.readdir(convDir).catch(() => []);
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const c = await getConversation(f.slice(0, -5));
    if (c) out.push(c);
  }
  return out;
}

/** Registra o lead qualificado (append-only). */
export async function appendLead(summary) {
  await fs.appendFile(leadsFile, JSON.stringify(summary) + '\n');
}
