// Testa a normalização da saída do classificador + a montagem do request (sem rede).
// Uso: npm run test:nlu
import { normalizeNlu, buildBody } from '../src/nlu/openai.js';

let pass = 0;
let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    console.log(`✅ ${name}`);
    pass++;
  } else {
    console.log(`❌ ${name}\n   got = ${JSON.stringify(got)}\n   want= ${JSON.stringify(want)}`);
    fail++;
  }
}

check('objeção válida', normalizeNlu({ objection: 'juros', name: null, payment: null }), {
  objection: 'juros', name: null, payment: null,
});
check('objeção inválida -> null', normalizeNlu({ objection: 'xyz', name: null, payment: null }), {
  objection: null, name: null, payment: null,
});
check('nome composto -> primeiro nome', normalizeNlu({ objection: null, name: 'Ana Paula', payment: null }), {
  objection: null, name: 'Ana', payment: null,
});
check('nome com pontuação limpa', normalizeNlu({ objection: null, name: 'joão!!!', payment: null }), {
  objection: null, name: 'João', payment: null,
});
check('pagamento à vista', normalizeNlu({ objection: null, name: null, payment: 'vista' }), {
  objection: null, name: null, payment: 'vista',
});
check('pagamento inválido -> null', normalizeNlu({ objection: null, name: null, payment: 'boleto' }), {
  objection: null, name: null, payment: null,
});
check('objeto vazio', normalizeNlu({}), { objection: null, name: null, payment: null });
check('null', normalizeNlu(null), { objection: null, name: null, payment: null });

// --- montagem do request por geração de modelo ---
const classic = buildBody('gpt-4o-mini', 'AWAITING_NAME', 'oi');
check('gpt-4o-mini usa temperature', classic.temperature, 0);
check('gpt-4o-mini usa max_tokens', classic.max_tokens, 200);
check('gpt-4o-mini NÃO usa max_completion_tokens', classic.max_completion_tokens, undefined);
check('gpt-4o-mini NÃO usa reasoning_effort', classic.reasoning_effort, undefined);

const reasoning = buildBody('gpt-5.4-nano', 'AWAITING_NAME', 'oi');
check('gpt-5.x usa max_completion_tokens', reasoning.max_completion_tokens, 600);
check('gpt-5.x NÃO usa temperature', reasoning.temperature, undefined);
check('gpt-5.x NÃO usa max_tokens', reasoning.max_tokens, undefined);
check('gpt-5.x usa reasoning_effort', typeof reasoning.reasoning_effort, 'string');

check('response_format é json_schema', classic.response_format.type, 'json_schema');

console.log(`\n${pass} passaram, ${fail} falharam`);
if (fail) process.exit(1);
