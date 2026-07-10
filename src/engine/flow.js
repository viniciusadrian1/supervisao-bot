import { getProvider } from '../providers/index.js';
import { M, OBJ } from '../messages/catalog.js';
import { detectObjection } from './objections.js';
import { interpret } from '../nlu/index.js';
import { validateAddress } from './validators.js';
import { getConversation, saveConversation, appendLead } from '../store/index.js';
import { typingDelay, sleep } from '../util/humanize.js';
import { config, videoUrl } from '../config.js';
import { log } from '../util/logger.js';

export const STEP = {
  NEW: 'NEW',
  AWAITING_NAME: 'AWAITING_NAME',
  AWAITING_ADDRESS: 'AWAITING_ADDRESS',
  AWAITING_POSTVIDEO: 'AWAITING_POSTVIDEO',
  AWAITING_SITE: 'AWAITING_SITE',
  AWAITING_UNITS: 'AWAITING_UNITS',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  HANDOFF: 'HANDOFF',
};

const provider = getProvider();

/** Pergunta atual de cada passo (usada no reengajamento por inatividade). */
export function currentQuestion(step) {
  switch (step) {
    case STEP.AWAITING_NAME: return 'Como posso te chamar?';
    case STEP.AWAITING_ADDRESS: return 'Qual é o seu endereço completo? (Rua, número e CEP)';
    case STEP.AWAITING_POSTVIDEO: return 'Vamos transformar isso para você?';
    case STEP.AWAITING_SITE: return M.askSite();
    case STEP.AWAITING_UNITS: return 'Você quer o Tour para uma loja ou mais de uma unidade?';
    case STEP.AWAITING_PAYMENT: return 'Qual a sua preferência: à vista (10% off) ou 6x sem juros?';
    default: return '';
  }
}

/** Envia um texto com "digitando..." + um respiro entre mensagens. */
async function send(phone, text) {
  await provider.sendText(phone, text, { delay: typingDelay(text) });
  await sleep(500);
}

async function sendVideoStep(phone) {
  const url = videoUrl();
  if (!url) {
    log.warn('Sem VIDEO_URL/PUBLIC_URL — pulando o envio do vídeo');
    return;
  }
  try {
    await provider.sendVideo(phone, url, M.videoCaption(), { delay: 1500 });
    await sleep(900);
  } catch (e) {
    log.error('Falha ao enviar vídeo:', e.message);
  }
}

// ---- helpers de dados ----
function cleanName(text) {
  let t = (text || '').trim();
  const m = t.match(
    /(?:pode\s+me\s+chamar\s+de|me\s+chama(?:r)?\s+de|meu\s+nome\s+é|meu\s+nome\s+e|me\s+chamo|sou\s+o|sou\s+a|sou)\s+(.+)/i
  );
  if (m) t = m[1];
  t = t.replace(/^(?:de|da|do|dos|das)\s+/i, ''); // tira preposição de "sou de ..."
  t = t.replace(/[^\p{L}\s'-]/gu, ' ').trim(); // remove emojis/pontuação/dígitos
  const first = t.split(/\s+/).filter(Boolean)[0] || '';
  if (!first) return null; // nenhuma letra -> re-perguntar
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function prettyAddress(d) {
  let s = d.endereco || '';
  if (d.cidade && !s.toLowerCase().includes(d.cidade.toLowerCase())) {
    s += ` — ${d.cidade}${d.uf ? '/' + d.uf : ''}`;
  }
  return s;
}

/** Reconhece a forma de pagamento por regras, ou null se não entendeu. */
function normalizePayment(text) {
  const t = (text || '').toLowerCase();
  if (/(à\s*vista|a\s*vista|\bvista\b|10\s*%|desconto|pix)/.test(t)) return 'À vista (10% de desconto)';
  if (/(parcel|6\s*x|cart|crédito|credito|vezes)/.test(t)) return 'Parcelado em até 6x sem juros';
  return null;
}

/** Mapeia a categoria de pagamento da IA para o rótulo fixo do roteiro. */
function mapPayment(kind) {
  if (kind === 'vista') return 'À vista (10% de desconto)';
  if (kind === 'parcelado') return 'Parcelado em até 6x sem juros';
  return null;
}

/** Contabiliza uma objeção respondida (por tipo) — alimenta o painel. */
function recordObjection(conv, key) {
  if (!key) return;
  conv.objections = conv.objections || {};
  conv.objections[key] = (conv.objections[key] || 0) + 1;
}

/** Preserva o pushName ao (re)iniciar uma conversa. */
function keepName(conv, msg) {
  const name = conv?.data?.pushName || msg.name || '';
  return name ? { pushName: name } : {};
}

async function onHandoff(conv) {
  // Idempotente: se o lead já foi registrado (ex.: retomado por #bot e re-qualificado),
  // não duplica a linha no leads.jsonl nem o aviso ao gestor.
  if (conv.leadAppended) return;
  conv.leadAppended = true;
  await saveConversation(conv.phone, conv);

  await appendLead({
    phone: conv.phone,
    nome: conv.data.nome || '',
    endereco: prettyAddress(conv.data),
    cep: conv.data.cep || '',
    site: conv.data.site || '',
    unidades: conv.data.unidades || '',
    pagamento: conv.data.pagamento || '',
    qualifiedAt: new Date(conv.qualifiedAt || Date.now()).toISOString(),
  }).catch((e) => log.error('appendLead:', e.message));

  // Aviso opcional para um número de gestor (se atendimento for em OUTRO número).
  if (config.ownerNumber && config.ownerNumber !== conv.phone) {
    const aviso =
`🔔 Novo lead qualificado!
Nome: ${conv.data.nome || '-'}
WhatsApp: ${conv.phone}
Endereço: ${prettyAddress(conv.data)}
Site/IG: ${conv.data.site || '-'}
Unidades: ${conv.data.unidades || '-'}
Pagamento: ${conv.data.pagamento || '-'}`;
    provider.sendText(config.ownerNumber, aviso, { delay: 0 }).catch(() => {});
  }

  log.info('Lead qualificado e em handoff:', conv.phone, '-', conv.data.nome);
}

/**
 * Processa uma mensagem recebida (já normalizada pelo provider).
 * msg = { from, name, text, type, messageId, isText }
 */
export async function handleIncoming(msg) {
  const phone = msg.from;
  const now = Date.now();
  const text = msg.text || '';
  const isResume = !!config.resumeKeyword && text.toLowerCase().trim() === config.resumeKeyword;

  let conv = await getConversation(phone);

  // ---- ATIVAÇÃO ----
  // Primeiro contato de um número ATIVA o bot (qualquer mensagem de texto). Um número que
  // já foi atendido (HANDOFF) NÃO re-dispara — fica em silêncio (salvo #bot), para não
  // atropelar o atendimento humano nem responder o mesmo número mais de uma vez.
  if (!conv) {
    if (!msg.isText || !msg.text) return; // 1º contato sem texto (figurinha/áudio) -> ignora
    conv = { phone, step: STEP.NEW, data: keepName(null, msg), createdAt: now };
  } else if (conv.step === STEP.HANDOFF) {
    if (!isResume) return;
    conv = { phone, step: STEP.NEW, data: keepName(conv, msg), createdAt: conv.createdAt || now };
  }
  // senão: conversa em andamento -> continua o fluxo no switch abaixo.

  // A partir daqui o bot VAI agir. Marca como lido só agora (não "lê" o que ignora).
  if (msg.messageId) provider.markRead([msg.messageId]).catch(() => {});
  conv.lastUserAt = now;
  conv.updatedAt = now;
  conv.followUpSent = false; // o lead respondeu
  if (msg.name && !conv.data.pushName) conv.data.pushName = msg.name;

  // Mensagem não-texto no meio do fluxo (figurinha, áudio, imagem)
  if (conv.step !== STEP.NEW && (!msg.isText || !msg.text)) {
    await saveConversation(phone, conv);
    await send(phone, M.fallbackText());
    return;
  }

  // Interpreta a mensagem: IA (se houver chave OpenAI) entende objeção/nome/pagamento;
  // sem IA (ou se ela falhar) cai nas regras determinísticas. As RESPOSTAS são sempre
  // as do roteiro fixo — a IA só classifica/extrai.
  const ai = conv.step !== STEP.NEW ? await interpret(conv.step, text) : null;
  const objKey = ai ? ai.objection : detectObjection(text)?.key || null;
  const obj = objKey && OBJ[objKey] ? { key: objKey, reply: OBJ[objKey]() } : null;

  switch (conv.step) {
    case STEP.NEW: {
      conv.step = STEP.AWAITING_NAME;
      await saveConversation(phone, conv);
      await send(phone, M.greeting());
      break;
    }

    case STEP.AWAITING_NAME: {
      // pergunta/objeção tem prioridade sobre extrair nome
      if (obj) {
        recordObjection(conv, obj.key);
        await saveConversation(phone, conv);
        await send(phone, obj.reply);
        return;
      }
      const nome = ai ? ai.name : cleanName(text);
      if (!nome) {
        await saveConversation(phone, conv);
        await send(phone, M.nameReask());
        return;
      }
      conv.data.nome = nome;
      conv.step = STEP.AWAITING_ADDRESS;
      await saveConversation(phone, conv);
      await send(phone, M.afterName(nome));
      break;
    }

    case STEP.AWAITING_ADDRESS: {
      // Valida o endereço PRIMEIRO — assim, se vier "Rua X, 123, CEP, mas quanto custa?",
      // capturamos o endereço em vez de perdê-lo por causa da objeção.
      const v = await validateAddress(text);
      if (v.ok) {
        conv.data.endereco = v.raw;
        conv.data.cep = v.cep;
        if (v.info) {
          conv.data.logradouro = v.info.logradouro || '';
          conv.data.bairro = v.info.bairro || '';
          conv.data.cidade = v.info.localidade || '';
          conv.data.uf = v.info.uf || '';
        }
        conv.step = STEP.AWAITING_POSTVIDEO;
        await saveConversation(phone, conv);
        await send(phone, M.addressConfirm(prettyAddress(conv.data)));
        await send(phone, M.videoIntro());
        await sendVideoStep(phone);
        await send(phone, M.afterVideo());
        break;
      }
      // Não validou: se for objeção, responde; senão re-pergunta.
      if (obj) recordObjection(conv, obj.key);
      await saveConversation(phone, conv);
      if (obj) {
        await send(phone, obj.reply);
      } else {
        await send(phone, v.reason === 'cep_invalido' ? M.addressReaskCep() : M.addressReask());
      }
      return;
    }

    case STEP.AWAITING_POSTVIDEO: {
      if (obj) {
        recordObjection(conv, obj.key);
        await saveConversation(phone, conv);
        await send(phone, obj.reply);
        return;
      }
      conv.step = STEP.AWAITING_SITE;
      await saveConversation(phone, conv);
      await send(phone, M.askSite());
      break;
    }

    case STEP.AWAITING_SITE: {
      // Objeção só é tratada aqui se veio da IA (sem IA, palavra-chave daria falso
      // positivo numa resposta livre — então tratamos como o site).
      if (obj && ai) {
        recordObjection(conv, obj.key);
        await saveConversation(phone, conv);
        await send(phone, obj.reply);
        return;
      }
      conv.data.site = text.trim();
      conv.step = STEP.AWAITING_UNITS;
      await saveConversation(phone, conv);
      await send(phone, M.askUnits());
      break;
    }

    case STEP.AWAITING_UNITS: {
      if (obj && ai) {
        recordObjection(conv, obj.key);
        await saveConversation(phone, conv);
        await send(phone, obj.reply);
        return;
      }
      conv.data.unidades = text.trim();
      conv.step = STEP.AWAITING_PAYMENT;
      await saveConversation(phone, conv);
      await send(phone, M.askPayment());
      break;
    }

    case STEP.AWAITING_PAYMENT: {
      // Objeção tem prioridade: "tem juros no parcelamento?" é pergunta, não escolha
      // (senão "parcelamento" casaria como "parcelado"). Responde e re-pergunta.
      if (obj) {
        recordObjection(conv, obj.key);
        await saveConversation(phone, conv);
        await send(phone, obj.reply);
        await send(phone, M.paymentReask());
        return;
      }
      const pay = ai ? mapPayment(ai.payment) : normalizePayment(text);
      if (!pay) {
        await saveConversation(phone, conv);
        await send(phone, M.paymentReask());
        return;
      }
      conv.data.pagamento = pay;
      conv.step = STEP.HANDOFF;
      conv.qualifiedAt = now;
      await saveConversation(phone, conv);
      await send(
        phone,
        M.summary(conv.data.nome || '', prettyAddress(conv.data), conv.data.unidades || '-', pay)
      );
      await onHandoff(conv);
      break;
    }

    default:
      log.warn('Passo desconhecido:', conv.step);
  }
}
