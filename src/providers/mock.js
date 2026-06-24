// Provedor de TESTE: não chama a internet, só imprime o que enviaria.
// Use PROVIDER=mock para rodar o fluxo localmente (npm run simulate).
// O parseIncoming reusa o normalizador real da UAZAPI, para que o teste do
// webhook por HTTP exercite o mesmo parsing de produção.
import { uazapi } from './uazapi.js';

export const mock = {
  name: 'mock',
  sent: [],

  async sendText(number, text) {
    this.sent.push({ kind: 'text', number, text });
    console.log(`\n📤 texto -> ${number}\n${text}`);
  },

  async sendVideo(number, file, caption = '') {
    this.sent.push({ kind: 'video', number, file, caption });
    console.log(`\n🎬 vídeo -> ${number}\n  file: ${file}\n  legenda: ${caption}`);
  },

  async sendTyping() {},
  async markRead() {},
  async getStatus() {
    return { status: { connected: true, loggedIn: true } };
  },
  async connect() {
    return { ok: true };
  },
  async setWebhook() {
    return { ok: true };
  },

  parseIncoming(body) {
    return uazapi.parseIncoming(body);
  },
};
