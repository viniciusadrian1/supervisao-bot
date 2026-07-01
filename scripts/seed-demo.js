// Semeia DADOS DE DEMONSTRAÇÃO no DATA_DIR para visualizar o painel cheio.
// Uso: DATA_DIR=./data-demo node scripts/seed-demo.js   (NÃO use no DATA_DIR de produção)
import { initStore, saveConversation, appendLead } from '../src/store/index.js';

await initStore();
const now = Date.now();
const min = 60_000;
const day = 86_400_000;

// [nome, step, criadoHáDias, últimaMsgHáMin, objeções]
const LEADS = [
  ['João',     'HANDOFF',            1, 3,    null],
  ['Marina',   'AWAITING_PAYMENT',   0, 2,    { preco: 1 }],
  ['Carlos',   'AWAITING_POSTVIDEO', 0, 5,    null],
  ['Ana',      'AWAITING_ADDRESS',   0, 8,    { prazo: 1 }],
  ['Pedro',    'HANDOFF',            2, 600,  null],
  ['Juliana',  'AWAITING_SITE',      1, 65,   { juros: 1 }],
  ['Rafael',   'AWAITING_UNITS',     1, 180,  null],
  ['Beatriz',  'HANDOFF',            3, 900,  null],
  ['Lucas',    'AWAITING_NAME',      0, 20,   null],
  ['Camila',   'AWAITING_PAYMENT',   0, 30,   { preco: 1, desconto: 1 }],
  ['Felipe',   'AWAITING_ADDRESS',   4, 5800, null],
  ['Mariana',  'HANDOFF',            5, 7200, null],
  ['Gustavo',  'AWAITING_POSTVIDEO', 2, 360,  { garantia: 1 }],
  ['Larissa',  'AWAITING_SITE',      0, 12,   null],
  ['Bruno',    'HANDOFF',            7, 9000, null],
];

let i = 0;
for (const [nome, step, daysAgo, minAgo, objections] of LEADS) {
  const phone = '55119' + String(90000000 + i++).padStart(8, '0');
  const createdAt = now - daysAgo * day;
  const lastUserAt = now - minAgo * min;
  const conv = {
    phone, step, data: { nome, pushName: nome },
    createdAt, updatedAt: lastUserAt, lastUserAt,
  };
  if (objections) conv.objections = objections;
  if (step === 'HANDOFF') {
    conv.qualifiedAt = lastUserAt;
    conv.data.endereco = 'Av. Exemplo, 123 — São Paulo/SP';
    conv.data.cep = '01310-100';
    conv.data.unidades = 'Uma loja';
    conv.data.pagamento = 'À vista (10% de desconto)';
  }
  await saveConversation(phone, conv);
  if (step === 'HANDOFF') {
    await appendLead({ phone, nome, qualifiedAt: new Date(lastUserAt).toISOString() });
  }
}

console.log(`✅ ${LEADS.length} leads de demonstração semeados em ${process.env.DATA_DIR || './data'}`);
