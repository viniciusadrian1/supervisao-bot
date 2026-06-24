import { config } from '../config.js';
import { log } from '../util/logger.js';
import { onlyDigits, sleep } from '../util/humanize.js';

// Adapter da UAZAPI (uazapiGO / v2).
// Base: https://{subdominio}.uazapi.com — auth por header "token" (instância).
// Docs: /send/text, /send/media (type:"video", file, text=legenda),
// /message/presence, /message/markread, /webhook, /instance/status|connect.

const TIMEOUT_MS = 15000;
const RETRIES = 2;

async function call(pathname, body, { admin = false, method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  headers[admin ? 'admintoken' : 'token'] = admin ? config.uazapi.adminToken : config.uazapi.token;
  const url = config.uazapi.baseUrl + pathname;
  const payload = body ? JSON.stringify(body) : undefined;

  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, headers, body: payload, signal: ctrl.signal });
      const raw = await res.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }

      if (!res.ok) {
        // 5xx/429 são transitórios -> tenta de novo; 4xx é definitivo
        if ((res.status >= 500 || res.status === 429) && attempt < RETRIES) {
          log.warn('uazapi', method, pathname, res.status, '(retry)');
          await sleep(400 * (attempt + 1));
          continue;
        }
        log.error('uazapi', method, pathname, res.status, raw.slice(0, 300));
        const err = new Error(`uazapi ${pathname} -> ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (e.status) throw e; // erro HTTP já tratado acima = definitivo
      // rede/timeout (AbortError, ECONNRESET, etc.) -> tenta de novo
      if (attempt < RETRIES) {
        log.warn('uazapi', method, pathname, 'erro de rede:', e.message, '(retry)');
        await sleep(400 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export const uazapi = {
  name: 'uazapi',

  /** Envia texto. `delay` (ms) mostra "digitando..." antes de entregar. */
  sendText(number, text, { delay = 0 } = {}) {
    return call('/send/text', { number: onlyDigits(number), text, delay, linkPreview: false });
  },

  /** Envia vídeo (file = URL pública .mp4 ou base64). `caption` é o texto/legenda. */
  sendVideo(number, file, caption = '', { delay = 0 } = {}) {
    return call('/send/media', {
      number: onlyDigits(number),
      type: 'video',
      file,
      text: caption, // na UAZAPI a legenda de mídia é o campo "text"
      delay,
    });
  },

  /** Mostra "digitando..." (composing) por `ms` (máx 5 min). */
  sendTyping(number, ms = 2000) {
    return call('/message/presence', {
      number: onlyDigits(number),
      presence: 'composing',
      delay: Math.min(ms, 300000),
    });
  },

  /** Marca mensagens como lidas (recebe array de messageid). */
  markRead(messageIds = []) {
    if (!messageIds.length) return Promise.resolve();
    return call('/message/markread', { id: messageIds });
  },

  getStatus() {
    return call('/instance/status', null, { method: 'GET' });
  },

  /** Gera QR / pair code para conectar o número. Com phone => pair code. */
  connect(phone) {
    return call('/instance/connect', phone ? { phone: onlyDigits(phone) } : {});
  },

  /** Registra a URL do webhook nesta instância. */
  setWebhook(url, events = ['messages', 'connection']) {
    return call('/webhook', {
      enabled: true,
      url,
      events,
      excludeMessages: ['fromMeYes', 'isGroupYes'], // não recebe as nossas nem de grupo
      action: 'add',
    });
  },

  /**
   * Normaliza o payload do webhook -> objeto padrão do bot, ou null se não for
   * uma mensagem de TEXTO recebida de um lead (1:1).
   */
  parseIncoming(body) {
    if (!body || typeof body !== 'object') return null;

    const ev = (body.event || body.EventType || '').toString();
    // aceita "messages" (plural, config) e "message" (singular, schema)
    if (ev && !/^messages?$/i.test(ev)) return null;

    const d = body.data || body.message || body;
    if (!d || typeof d !== 'object') return null;

    if (d.fromMe === true || d.wasSentByApi === true) return null; // anti-loop
    if (d.isGroup === true) return null;

    // chatid/sender vêm como JID completo (5511...@s.whatsapp.net).
    const jid = (d.chatid || d.sender || d.chatId || d.from || '').toString();
    let from;
    if (jid.includes('@')) {
      const [num, suffix] = jid.split('@');
      from = onlyDigits(num);
      if (suffix !== 's.whatsapp.net' && suffix !== 'c.us') {
        // @lid, @g.us, @newsletter... — formato não-padrão de número 1:1
        if (suffix === 'g.us' || suffix === 'newsletter') return null;
        log.warn('JID não-padrão recebido (', suffix, ') — processando com cautela:', jid);
      }
    } else {
      from = onlyDigits(jid);
    }
    if (!from) return null;

    // messageType da UAZAPI segue a convenção Baileys: "conversation",
    // "extendedTextMessage", "imageMessage"... NUNCA "text". Então derivamos
    // isText do conteúdo textual + ausência de mídia, robusto às duas convenções.
    const type = (d.messageType || d.type || '').toString();
    const tl = type.toLowerCase();
    const isMedia = /(image|video|audio|sticker|document|location|contact|ptt|ptv|poll)/.test(tl);
    const text = (
      d.text ??
      d.content?.conversation ??
      d.content?.extendedTextMessage?.text ??
      d.body ??
      ''
    )
      .toString()
      .trim();

    return {
      from,
      name: (d.senderName || d.pushName || '').toString().trim(),
      text,
      type,
      messageId: d.messageid || d.id || '',
      isText: !!text && !isMedia,
    };
  },
};
