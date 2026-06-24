// Mostra o status de conexão da instância UAZAPI.
// Uso: npm run status
import { getProvider } from '../src/providers/index.js';

const provider = getProvider();

try {
  const st = await provider.getStatus();
  console.log(JSON.stringify(st, null, 2));
  const ok = st?.status?.connected && st?.status?.loggedIn;
  console.log(ok ? '\n✅ Conectado e logado' : '\n⚠️  NÃO conectado — rode: npm run connect');
} catch (e) {
  console.error('❌ Erro:', e.message, e.data || '');
  process.exit(1);
}
