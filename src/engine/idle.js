import { listConversations, getConversation, saveConversation } from '../store/index.js';
import { getProvider } from '../providers/index.js';
import { M } from '../messages/catalog.js';
import { typingDelay } from '../util/humanize.js';
import { config } from '../config.js';
import { log } from '../util/logger.js';
import { STEP, currentQuestion } from './flow.js';
import { withLock } from '../util/lock.js';

const provider = getProvider();
let scanning = false; // evita ciclos sobrepostos do setInterval

/** Liga o varredor que reengaja leads parados há mais de IDLE_MINUTES. */
export function startIdleWatcher() {
  if (!config.idle.enabled) {
    log.info('Reengajamento por inatividade: DESLIGADO');
    return;
  }
  const timer = setInterval(scan, config.idle.checkEveryMs);
  timer.unref?.();
  log.info(`Reengajamento por inatividade: ${config.idle.minutes} min`);
}

async function scan() {
  if (scanning) return;
  scanning = true;
  try {
    const all = await listConversations();
    const limitMs = config.idle.minutes * 60 * 1000;

    for (const snap of all) {
      if (!snap || snap.step === STEP.HANDOFF || snap.step === STEP.NEW) continue;
      if (snap.followUpSent) continue;
      if (Date.now() - (snap.lastUserAt || snap.updatedAt || 0) < limitMs) continue;

      // serializa contra o webhook do MESMO contato e revalida com dado fresco
      await withLock(snap.phone, async () => {
        const c = await getConversation(snap.phone);
        if (!c || c.step === STEP.HANDOFF || c.step === STEP.NEW || c.followUpSent) return;
        if (Date.now() - (c.lastUserAt || c.updatedAt || 0) < limitMs) return;

        // reserva ANTES de enviar (fecha o TOCTOU: scan/webhook já veem followUpSent=true)
        c.followUpSent = true;
        c.updatedAt = Date.now();
        await saveConversation(c.phone, c);

        const text = M.idle(c.data?.nome, currentQuestion(c.step));
        try {
          await provider.sendText(c.phone, text, { delay: typingDelay(text) });
          log.info('Follow-up de inatividade enviado para', c.phone);
        } catch (e) {
          // falhou: libera para o próximo ciclo tentar de novo
          c.followUpSent = false;
          await saveConversation(c.phone, c);
          log.warn('Falha no follow-up para', c.phone, '-', e.message);
        }
      }).catch((e) => log.error('idle lock:', e.message));
    }
  } catch (e) {
    log.error('idle scan:', e.message);
  } finally {
    scanning = false;
  }
}
