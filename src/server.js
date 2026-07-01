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
import { panelRouter } from './panel/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const provider = getProvider();

const app = express();
app.set('trust proxy', 1); // Render fica atrás de proxy — necessário p/ req.ip real (rate limit do painel)
app.use(express.json({ limit: '2mb' }));

// DEBUG (temporário): registra qualquer POST que bata em /webhook (mascara o segredo).
// Se aparecer "POST em /webhook/***" mas NÃO aparecer "webhook <- payload", o segredo
// registrado na UAZAPI está diferente do WEBHOOK_SECRET do Render (404). Remover depois.
app.use((req, _res, next) => {
  if (req.method === 'POST' && req.path.startsWith('/webhook')) {
    log.info('POST em', req.path.replace(/(\/webhook\/).+/, '$1***'));
  }
  next();
});

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

// Painel de visualização (read-only), protegido por senha — em /painel.
app.use('/painel', panelRouter);

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

// Painel exposto com senha fraca é risco (mostra dados de leads). Avisa alto — mas
// NÃO derruba o bot (o painel é secundário; o core não pode cair por causa dele).
if (config.panel.enabled) {
  const w = config.panel.password;
  const fraca = w.length < 12 || ['painel123', 'admin', 'senha', 'password', '123456'].includes(w.toLowerCase());
  if (fraca) log.warn('PANEL_PASSWORD fraca: use 12+ caracteres — o painel expõe dados de leads.');
}

app.post(webhookPath, (req, res) => {
  res.sendStatus(200); // responde rápido — a UAZAPI exige webhook ágil
  log.info('webhook <- payload:', JSON.stringify(req.body).slice(0, 1200)); // DEBUG (remover depois)
  let msg;
  try {
    msg = provider.parseIncoming(req.body);
  } catch (e) {
    log.error('parseIncoming:', e.message);
    return;
  }
  if (!msg) {
    log.info('webhook: IGNORADO (parseIncoming=null — não reconheceu como msg de texto de lead)');
    return;
  }
  log.info('webhook: msg de', msg.from, '| isText=', msg.isText, '| texto=', JSON.stringify((msg.text || '').slice(0, 120)));
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
      log.info(
        `Painel:  ${config.panel.enabled ? `${config.publicUrl || ''}/painel (login: ${config.panel.user})` : 'DESLIGADO (defina PANEL_PASSWORD)'}`
      );
      startIdleWatcher();
    });
  })
  .catch((e) => {
    log.error('Falha ao iniciar:', e);
    process.exit(1);
  });
