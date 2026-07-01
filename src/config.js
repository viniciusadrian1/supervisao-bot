import 'dotenv/config';

const stripSlash = (s) => (s || '').replace(/\/+$/, '');
const int = (v, d) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : d;
};

export const config = {
  port: int(process.env.PORT, 3000),
  publicUrl: stripSlash(process.env.PUBLIC_URL),
  provider: process.env.PROVIDER || 'uazapi',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  dataDir: process.env.DATA_DIR || './data',
  siteUrl: process.env.SITE_URL || 'supervisao.com.br',
  ownerNumber: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  resumeKeyword: (process.env.RESUME_KEYWORD || '#bot').toLowerCase().trim(),

  // Mensagem-gatilho: o bot SÓ inicia o fluxo quando a 1ª mensagem CONTÉM este texto
  // (a mensagem pré-preenchida pelos botões da LP). Fora dele, o bot fica em silêncio
  // para não atrapalhar o atendimento humano. A mensagem da LP deve conter este trecho.
  triggerText: process.env.TRIGGER_TEXT || 'Vim pelo site e quero meu Tour Virtual 360',

  uazapi: {
    baseUrl: stripSlash(process.env.UAZAPI_BASE_URL || 'https://free.uazapi.com'),
    token: process.env.UAZAPI_TOKEN || '',
    adminToken: process.env.UAZAPI_ADMIN_TOKEN || '',
  },

  // Camada de IA (OpenAI) — SÓ pra ENTENDER (classificar objeção / extrair dado).
  // As respostas continuam saindo do roteiro fixo. Opcional: sem chave, cai nas regras.
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    enabled: !!(process.env.OPENAI_API_KEY || ''),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: stripSlash(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
    reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'low', // só p/ modelos GPT-5.x/o*
    timeoutMs: int(process.env.OPENAI_TIMEOUT_MS, 8000),
  },

  video: {
    url: process.env.VIDEO_URL || '',
    file: process.env.VIDEO_FILE || 'demo.mp4',
  },

  typing: {
    minMs: int(process.env.TYPING_MIN_MS, 900),
    maxMs: int(process.env.TYPING_MAX_MS, 3500),
    perChar: int(process.env.TYPING_PER_CHAR_MS, 35),
  },

  idle: {
    enabled: (process.env.IDLE_ENABLED || 'true') === 'true',
    minutes: int(process.env.IDLE_MINUTES, 30),
    checkEveryMs: int(process.env.IDLE_CHECK_MS, 60000),
  },

  // Painel de visualização (read-only) em /painel. Protegido por senha (Basic Auth).
  // Sem PANEL_PASSWORD o painel fica desativado.
  panel: {
    user: process.env.PANEL_USER || 'admin',
    password: process.env.PANEL_PASSWORD || '',
    enabled: !!(process.env.PANEL_PASSWORD || ''),
  },
};

/** URL pública do vídeo demo (override por VIDEO_URL, ou servido pelo próprio bot). */
export function videoUrl() {
  if (config.video.url) return config.video.url;
  if (config.publicUrl) return `${config.publicUrl}/media/${config.video.file}`;
  return '';
}
