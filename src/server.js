import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, videoUrl } from './config.js';
import { log } from './util/logger.js';
import { initStore } from './store/index.js';
import { getProvider } from './providers/index.js';
import { handleIncoming } from './engine/flow.js';
import { startIdleWatcher } from './engine/idle.js';
import { withLock } from './util/lock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const provider = getProvider();

const app = express();
app.use(express.json({ limit: '2mb' }));

// Vídeo demo servido pelo próprio bot -> URL .mp4 direta (entrega nativa no WhatsApp).
app.use(
  '/media',
  express.static(path.join(__dirname, '..', 'media'), {
    maxAge: '7d',
    fallthrough: false,
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, provider: provider.name, video: videoUrl() || null });
});

// Caminho do webhook (com segredo no path para dificultar chamadas indevidas).
const webhookPath = config.webhookSecret ? `/webhook/${config.webhookSecret}` : '/webhook';
const webhookLogPath = config.webhookSecret ? '/webhook/***' : '/webhook';

// Sem segredo o endpoint fica PÚBLICO (qualquer um injeta mensagens). Em
// produção isso é inaceitável -> aborta; fora de produção, avisa alto.
if (!config.webhookSecret) {
  const aviso =
    'WEBHOOK_SECRET vazio: /webhook fica PÚBLICO (qualquer um pode injetar mensagens e disparar envios). Defina WEBHOOK_SECRET.';
  if (process.env.NODE_ENV === 'production') {
    log.error(aviso, 'Abortando.');
    process.exit(1);
  }
  log.warn(aviso);
}

app.post(webhookPath, (req, res) => {
  res.sendStatus(200); // responde rápido — a UAZAPI exige webhook ágil
  let msg;
  try {
    msg = provider.parseIncoming(req.body);
  } catch (e) {
    log.error('parseIncoming:', e.message);
    return;
  }
  if (!msg) return; // não é mensagem de texto de lead
  withLock(msg.from, () => handleIncoming(msg)).catch((e) =>
    log.error('handleIncoming:', e?.stack || e?.message || e)
  );
});

initStore()
  .then(() => {
    app.listen(config.port, () => {
      log.info(`Bot no ar na porta ${config.port} | provider=${provider.name}`);
      log.info(`Webhook: POST ${config.publicUrl || '(defina PUBLIC_URL)'}${webhookLogPath}`);
      log.info(`Vídeo:   ${videoUrl() || '(defina PUBLIC_URL ou VIDEO_URL)'}`);
      startIdleWatcher();
    });
  })
  .catch((e) => {
    log.error('Falha ao iniciar:', e);
    process.exit(1);
  });
