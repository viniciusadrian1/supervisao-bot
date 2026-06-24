// Registra a URL do webhook na instância UAZAPI.
// Uso: npm run setup:webhook   (precisa de PUBLIC_URL e UAZAPI_TOKEN no .env)
import { config } from '../src/config.js';
import { getProvider } from '../src/providers/index.js';

const provider = getProvider();

if (!config.publicUrl) {
  console.error('❌ Defina PUBLIC_URL no .env (ex.: https://supervisao-bot.onrender.com)');
  process.exit(1);
}
if (!config.uazapi.token) {
  console.error('❌ Defina UAZAPI_TOKEN no .env');
  process.exit(1);
}

const url = config.publicUrl + (config.webhookSecret ? `/webhook/${config.webhookSecret}` : '/webhook');

try {
  const r = await provider.setWebhook(url, ['messages', 'connection']);
  console.log('✅ Webhook registrado em:', url);
  console.log(JSON.stringify(r, null, 2));
} catch (e) {
  console.error('❌ Erro ao registrar webhook:', e.message, e.data || '');
  process.exit(1);
}
