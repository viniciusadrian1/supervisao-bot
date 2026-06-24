import { config } from '../config.js';

/** Tempo de "digitando..." proporcional ao tamanho da mensagem (+ jitter). */
export function typingDelay(text) {
  const { minMs, maxMs, perChar } = config.typing;
  const base = Math.min(maxMs, Math.max(minMs, (text?.length || 0) * perChar));
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(maxMs, base + jitter);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const onlyDigits = (s) => (s || '').toString().replace(/\D/g, '');
