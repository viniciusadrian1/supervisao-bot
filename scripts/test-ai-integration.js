// Testa o caminho COM IA usando um stub local da OpenAI (sem chave/rede real).
// Prova que: o request sai no formato certo, a resposta é parseada, e o FLUXO
// usa a classificação da IA (nome/objeção/pagamento). Uso: npm run test:ai
import http from 'node:http';

const PORT = 3399;
let lastBody = null;

// --- stub do endpoint /v1/chat/completions ---
const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    lastBody = JSON.parse(raw);
    const userMsg = lastBody.messages.find((m) => m.role === 'user')?.content || '';
    const step = (userMsg.match(/Etapa atual: (\w+)/) || [])[1];
    const text = (userMsg.match(/Mensagem do lead: """([\s\S]*)"""/) || [])[1] || '';
    const t = text.toLowerCase();

    const cls = { objection: null, name: null, payment: null };
    if (/juros/.test(t)) cls.objection = 'juros';
    else if (/caro|quanto custa|preç/.test(t)) cls.objection = 'preco';

    if (step === 'AWAITING_NAME' && !cls.objection) {
      const words = text.match(/[A-Za-zÀ-ÿ]{2,}/g);
      cls.name = words ? words[words.length - 1] : null; // "chamar de João" -> João
    }
    if (step === 'AWAITING_PAYMENT' && !cls.objection) {
      if (/vista|pix/.test(t)) cls.payment = 'vista';
      else if (/parcel|cart|6x|vezes/.test(t)) cls.payment = 'parcelado';
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(cls) } }] }));
  });
});
await new Promise((r) => server.listen(PORT, r));

process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENAI_BASE_URL = `http://localhost:${PORT}/v1`;
process.env.OPENAI_MODEL = 'gpt-4o-mini';
process.env.PROVIDER = 'mock';
process.env.IDLE_ENABLED = 'false';
process.env.DATA_DIR = './data-test-ai';
process.env.PUBLIC_URL = 'https://exemplo.com';

const { handleIncoming } = await import('../src/engine/flow.js');
const { getProvider } = await import('../src/providers/index.js');
const { initStore } = await import('../src/store/index.js');

const provider = getProvider();
await initStore();
const phone = '5511933334444';
let n = 0;
async function user(text) {
  const msg = provider.parseIncoming({
    event: 'messages',
    data: { chatid: `${phone}@s.whatsapp.net`, fromMe: false, messageType: 'conversation', text, messageid: 'a' + ++n },
  });
  await handleIncoming(msg);
}

await user('Olá! Vim pelo site e quero meu Tour Virtual 360º no Google Maps 🚀'); // GATILHO -> saudação
await user('Aqui quem fala é o Joaquim'); // IA extrai nome (última palavra) -> Joaquim
await user('Rua das Flores, 123 - 01310-100, São Paulo'); // endereço (determinístico) + vídeo
await user('vamos sim'); // pós-vídeo -> site
await user('@minhaempresa'); // site -> unidades
await user('uma loja'); // unidades -> pagamento
await user('isso tem juros?'); // IA -> objeção juros (não fecha)
await user('prefiro à vista'); // IA -> pagamento vista -> resumo

const sent = provider.sent.map((s) => s.text || '').join('\n');
let pass = 0, fail = 0;
const must = (name, cond) => {
  console.log(cond ? `✅ ${name}` : `❌ ${name}`);
  cond ? pass++ : fail++;
};

must('IA extraiu o nome (Joaquim) e o roteiro usou', sent.includes('Ótimo, Joaquim!'));
must('IA detectou objeção de juros (resposta do roteiro)', sent.includes('Não tem juros!'));
must('objeção NÃO fechou o lead com lixo (re-perguntou pagamento)', sent.includes('você prefere'));
must('IA classificou pagamento à vista no resumo', sent.includes('À vista (10% de desconto)'));
must('request usou response_format json_schema', lastBody?.response_format?.type === 'json_schema');
must('request gpt-4o-mini usou temperature/max_tokens', lastBody?.temperature === 0 && lastBody?.max_tokens === 200);

server.close();
console.log(`\n${pass} passaram, ${fail} falharam`);
if (fail) process.exit(1);
