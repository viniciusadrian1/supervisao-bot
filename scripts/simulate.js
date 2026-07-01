// Simula uma conversa completa SEM enviar nada (PROVIDER=mock).
// Passa pelo parseIncoming real (formato UAZAPI/Baileys) + máquina de estados.
// Uso: npm run simulate
process.env.PROVIDER = 'mock';
process.env.IDLE_ENABLED = 'false';
process.env.DATA_DIR = './data-test';
process.env.PUBLIC_URL = process.env.PUBLIC_URL || 'https://exemplo.com';

const { handleIncoming } = await import('../src/engine/flow.js');
const { getProvider } = await import('../src/providers/index.js');
const { initStore } = await import('../src/store/index.js');

const provider = getProvider();
await initStore();
const phone = '5511988887777';

// --- 1) Sanity check do parseIncoming (UAZAPI manda messageType "conversation") ---
const parsed = provider.parseIncoming({
  event: 'messages',
  data: {
    chatid: `${phone}@s.whatsapp.net`,
    senderName: 'Lead Teste',
    fromMe: false,
    messageType: 'conversation', // <- NÃO é "text"; o parser tem que reconhecer
    text: 'oi',
    messageid: 'm0',
  },
});
console.log('parseIncoming ->', JSON.stringify(parsed));
if (!parsed || !parsed.isText || parsed.from !== phone) {
  console.error('❌ FALHA: parseIncoming não reconheceu texto/numero');
  process.exit(1);
}
console.log(`✅ parseIncoming OK (isText=${parsed.isText}, from=${parsed.from})\n`);

let n = 0;
async function user(text, type = 'conversation') {
  console.log(`\n⏳ ───────────────────────────────\n👤 lead: ${text}`);
  const msg = provider.parseIncoming({
    event: 'messages',
    data: {
      chatid: `${phone}@s.whatsapp.net`,
      senderName: 'Lead Teste',
      fromMe: false,
      messageType: type,
      text,
      messageid: 'm' + ++n,
    },
  });
  await handleIncoming(msg);
}

console.log('===== SIMULAÇÃO DO FLUXO =====');

// Mensagem que NÃO é o gatilho -> o bot deve IGNORAR (não atrapalha o atendimento humano).
await user('Oi, tudo bem? Queria uma informação sobre preços');
if (provider.sent.length !== 0) {
  console.error('❌ FALHA: o bot respondeu uma mensagem que NÃO é o gatilho');
  process.exit(1);
}
console.log('✅ bot ignorou a mensagem não-gatilho (silêncio p/ atendimento humano)\n');

// Mensagem-GATILHO (pré-preenchida pelos botões da LP) -> ATIVA o bot.
await user('Olá! Vim pelo site e quero meu Tour Virtual 360º no Google Maps 🚀');
await user('😀👍'); // nome inválido (só emoji) -> deve RE-PERGUNTAR o nome
await user('Pode me chamar de João'); // -> pede endereço
await user('Fica na Rua das Flores, sem o cep agora'); // -> pede número+CEP
await user('Rua das Flores, 123 - 01310-100, São Paulo, mas quanto custa?'); // MISTA: valida endereço + ignora objeção
await user('Adorei, vamos sim!'); // pós-vídeo -> site
await user('Tenho sim, @minhaempresa no Instagram'); // -> unidades
await user('Só uma loja por enquanto'); // -> pagamento
await user('Tem juros no parcelamento?'); // objeção em pagamento -> responde + RE-PERGUNTA (não fecha lixo)
await user('Pode ser à vista'); // -> resumo + handoff
await user('mais uma dúvida...'); // handoff -> silêncio
console.log('\n===== FIM =====');
