import { config } from '../config.js';
import { interpretOpenAI } from './openai.js';
import { log } from '../util/logger.js';

export function nluEnabled() {
  return config.openai.enabled;
}

/**
 * Interpreta a mensagem do lead (objeção / nome / pagamento).
 * Retorna { objection, name, payment } ou null se a IA estiver desligada ou
 * falhar (nesse caso o fluxo cai nas regras determinísticas).
 */
export async function interpret(step, text) {
  if (!config.openai.enabled || !text) return null;
  try {
    return await interpretOpenAI(step, text);
  } catch (e) {
    log.warn('NLU (OpenAI) falhou — usando regras:', e.message);
    return null;
  }
}
