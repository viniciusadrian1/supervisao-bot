import { config } from '../config.js';

// Classificador NLU via OpenAI Chat Completions + Structured Outputs.
// IMPORTANTE: a IA SÓ entende/classifica — ela NUNCA escreve a resposta ao cliente.
// O bot responde sempre pelo roteiro fixo (messages/catalog.js).

export const OBJECTION_KEYS = ['preco', 'desconto', 'juros', 'pensar', 'garantia', 'prazo', 'uso_fotos'];

const SCHEMA = {
  name: 'lead_msg',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      objection: { type: ['string', 'null'], enum: [...OBJECTION_KEYS, null] },
      name: { type: ['string', 'null'] },
      payment: { type: ['string', 'null'], enum: ['vista', 'parcelado', null] },
    },
    required: ['objection', 'name', 'payment'],
  },
};

const SYSTEM = `Você é um classificador de mensagens de um chatbot de vendas de Tour Virtual 360º no Google Maps (Brasil). NÃO escreva resposta ao cliente — apenas classifique a mensagem do lead e devolva o JSON do schema.

Campos:
- "objection": se o lead está levantando uma destas dúvidas/objeções, use a chave; senão null.
  - preco: acha caro, pergunta o valor/preço ("quanto custa", "tá caro").
  - desconto: questiona ou pede o desconto à vista.
  - juros: pergunta se o parcelamento tem juros.
  - pensar: diz que vai pensar / decidir depois.
  - garantia: pergunta sobre garantia ou "e se não ficar bom".
  - prazo: pergunta quanto tempo demora / prazo de entrega.
  - uso_fotos: pergunta se pode usar as fotos em outros lugares / de quem são os arquivos.
  REGRA: se o lead está apenas RESPONDENDO a pergunta da etapa (não objetando), objection=null.
- "name": SOMENTE na etapa AWAITING_NAME, extraia o PRIMEIRO nome do lead (ex.: "pode me chamar de João" -> "João"; "sou a Ana Paula" -> "Ana"). Se não houver nome claro (xingamento, emoji, pergunta), null. Em outras etapas, null.
- "payment": SOMENTE na etapa AWAITING_PAYMENT, classifique a escolha do lead: "vista" (à vista, pix, 10%, desconto) ou "parcelado" (parcelar, 6x, cartão, dividir). Se o lead não escolheu (ex.: fez uma pergunta), null. Em outras etapas, null.`;

function isReasoningModel(model) {
  return /^(o\d|gpt-5)/i.test(model || '');
}

/** Monta o corpo do request conforme a geração do modelo (pura — testável). */
export function buildBody(model, step, text) {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Etapa atual: ${step}\nMensagem do lead: """${text}"""` },
    ],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
  };
  // GPT-5.x / série o: usam max_completion_tokens + reasoning_effort e IGNORAM temperature.
  // Modelos clássicos (gpt-4o-mini): usam max_tokens + temperature.
  if (isReasoningModel(model)) {
    body.max_completion_tokens = 600;
    body.reasoning_effort = config.openai.reasoningEffort;
  } else {
    body.max_tokens = 200;
    body.temperature = 0;
  }
  return body;
}

/** Chama a OpenAI e devolve { objection, name, payment } (lança em erro). */
export async function interpretOpenAI(step, text) {
  const body = buildBody(config.openai.model, step, text);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.openai.timeoutMs);
  try {
    const res = await fetch(config.openai.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI: resposta sem content');
    return normalizeNlu(JSON.parse(content));
  } finally {
    clearTimeout(timer);
  }
}

/** Valida/normaliza a saída do modelo (pura — testável sem rede). */
export function normalizeNlu(raw) {
  const out = { objection: null, name: null, payment: null };
  if (!raw || typeof raw !== 'object') return out;
  if (OBJECTION_KEYS.includes(raw.objection)) out.objection = raw.objection;
  if (typeof raw.name === 'string' && raw.name.trim()) out.name = cleanFirstName(raw.name);
  if (raw.payment === 'vista' || raw.payment === 'parcelado') out.payment = raw.payment;
  return out;
}

function cleanFirstName(s) {
  const first = s.trim().split(/\s+/)[0].replace(/[^\p{L}'-]/gu, '');
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}
