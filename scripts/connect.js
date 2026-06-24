// Conecta o número (gera QR ou pair code) e mostra o status.
// Uso:
//   npm run connect              -> retorna QR code (escaneie no painel/imagem)
//   npm run connect 5511999999999 -> retorna PAIR CODE para esse número
import { getProvider } from '../src/providers/index.js';

const provider = getProvider();
const phone = process.argv[2];

try {
  const r = await provider.connect(phone);
  const inst = r.instance || r;
  console.log('— connect —');
  if (inst.paircode || r.paircode) console.log('PAIR CODE:', inst.paircode || r.paircode);
  if (inst.qrcode || r.qrcode) {
    console.log('QR CODE (base64) recebido — escaneie pelo painel da UAZAPI');
    console.log((inst.qrcode || r.qrcode).slice(0, 80) + '...');
  }

  const st = await provider.getStatus();
  console.log('\n— status —');
  console.log(JSON.stringify(st.status || st, null, 2));
} catch (e) {
  console.error('❌ Erro:', e.message, e.data || '');
  process.exit(1);
}
