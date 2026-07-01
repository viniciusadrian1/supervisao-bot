// Testa a agregação do painel (funil, objeções, ao vivo) com dados semeados.
// Uso: npm run test:panel
process.env.PROVIDER = 'mock';
process.env.DATA_DIR = './data-test-panel';
process.env.PANEL_PASSWORD = 'test';

import { promises as fs } from 'node:fs';
await fs.rm('./data-test-panel', { recursive: true, force: true });

const { initStore, saveConversation, appendLead } = await import('../src/store/index.js');
const { getStats, getLive } = await import('../src/panel/stats.js');

await initStore();
const now = Date.now();
const day = 86400_000;

// 4 conversas em etapas diferentes
await saveConversation('5511990000001', {
  phone: '5511990000001', step: 'HANDOFF', data: { nome: 'Joao' },
  createdAt: now - day, updatedAt: now - 120000, lastUserAt: now - 120000, qualifiedAt: now - 120000,
});
await saveConversation('5511990000002', {
  phone: '5511990000002', step: 'AWAITING_PAYMENT', data: { nome: 'Marina' },
  objections: { preco: 2, juros: 1 },
  createdAt: now - day, updatedAt: now - 300000, lastUserAt: now - 300000,
});
await saveConversation('5511990000003', {
  phone: '5511990000003', step: 'AWAITING_ADDRESS', data: { nome: 'Carlos' },
  objections: { preco: 1 },
  createdAt: now, updatedAt: now - 480000, lastUserAt: now - 480000,
});
await saveConversation('5511990000004', {
  phone: '5511990000004', step: 'AWAITING_NAME', data: {},
  createdAt: now, updatedAt: now, lastUserAt: now,
});
await appendLead({ phone: '5511990000001', nome: 'Joao', qualifiedAt: new Date(now - 120000).toISOString() });

const s = await getStats();
const live = await getLive();
const F = Object.fromEntries(s.funnel.map((f) => [f.key, f.count]));

let pass = 0, fail = 0;
const must = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(ok ? `✅ ${name}` : `❌ ${name}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
};

must('total', s.kpis.total, 4);
must('qualificados', s.kpis.qualified, 1);
must('conversão %', s.kpis.conversion, 25);
must('funil Iniciaram', F.inicio, 4);
must('funil Endereço (>=AWAITING_ADDRESS)', F.AWAITING_ADDRESS, 3);
must('funil Pagamento (>=AWAITING_PAYMENT)', F.AWAITING_PAYMENT, 2);
must('funil Handoff', F.HANDOFF, 1);
must('objeção top = preço (3)', s.objections[0], { key: 'preco', count: 3 });
must('objeção juros (1)', s.objections.find((o) => o.key === 'juros').count, 1);
must('currentByStep AWAITING_PAYMENT', s.currentByStep.AWAITING_PAYMENT, 1);
must('currentByStep não conta HANDOFF', s.currentByStep.HANDOFF, undefined);
must('ao vivo: 4 linhas', live.rows.length, 4);
must('ao vivo: telefone mascarado', /•••/.test(live.rows[0].phone), true);
must('perDay tem 14 dias', s.perDay.length, 14);

await fs.rm('./data-test-panel', { recursive: true, force: true });
console.log(`\n${pass} passaram, ${fail} falharam`);
if (fail) process.exit(1);
