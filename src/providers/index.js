import { config } from '../config.js';
import { uazapi } from './uazapi.js';
import { mock } from './mock.js';

const registry = { uazapi, mock };

let instance = null;

/** Retorna o provedor configurado (singleton). */
export function getProvider() {
  if (instance) return instance;
  const p = registry[config.provider];
  if (!p) throw new Error(`Provedor desconhecido: "${config.provider}" (use uazapi ou mock)`);
  instance = p;
  return p;
}
