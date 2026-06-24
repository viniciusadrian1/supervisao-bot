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

  uazapi: {
    baseUrl: stripSlash(process.env.UAZAPI_BASE_URL || 'https://free.uazapi.com'),
    token: process.env.UAZAPI_TOKEN || '',
    adminToken: process.env.UAZAPI_ADMIN_TOKEN || '',
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
};

/** URL pública do vídeo demo (override por VIDEO_URL, ou servido pelo próprio bot). */
export function videoUrl() {
  if (config.video.url) return config.video.url;
  if (config.publicUrl) return `${config.publicUrl}/media/${config.video.file}`;
  return '';
}
