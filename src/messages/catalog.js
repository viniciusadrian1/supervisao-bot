import { config } from '../config.js';

// ====================================================================
// TODA a copy do bot fica aqui (fácil de editar sem mexer na lógica).
// Baseada no "Script para Bot de WhatsApp - LP SUPERVISÃO".
// Regra: tom amigável, direto, 1 ideia por mensagem, usar o nome do lead.
// ====================================================================

export const M = {
  // Saudação (logo após o lead chegar da LP)
  greeting: () =>
`Olá! Que excelente decisão! 🚀

Deixa eu ser direto: empresas com Tour 360º recebem *42% mais pedidos de rota*. Publicação permanente, sem mensalidade, Autorizada Google.

Como posso te chamar?`,

  // Não conseguimos extrair um nome
  nameReask: () =>
`Desculpa, acho que não peguei seu nome 😅 Como posso te chamar?`,

  // Reforço de valor (após o nome) + pede endereço
  afterName: (nome) =>
`Ótimo, ${nome}!

Enquanto seus concorrentes perdem clientes com um perfil vazio no Google, você vai destacar o interior do seu negócio em 360º. Simples assim.

Qual é o seu endereço completo? (Rua, número e CEP)`,

  // Endereço incompleto (faltou número ou CEP)
  addressReask: () =>
`Faltou o *número* do imóvel e/ou o *CEP* 🙏

Pode me mandar o endereço completo? Ex.: _Rua das Flores, 123 — 01234-567_`,

  // CEP não encontrado na base
  addressReaskCep: () =>
`Hmm, não localizei esse CEP 🤔

Pode conferir e me mandar de novo o endereço com o CEP certinho?`,

  // Confirmação do endereço
  addressConfirm: (endereco) =>
`Perfeito! 📍

Anotado: ${endereco}. Já registrei certinho pra gente localizar o seu espaço.`,

  // Intro do vídeo
  videoIntro: () =>
`Maravilha! Agora deixa eu te mostrar como fica. 🎬

Veja como o seu espaço vai aparecer no Google com o Tour 360º:`,

  videoCaption: () => `Seu Tour Virtual 360º no Google 🎥`,

  // Reação após o vídeo
  afterVideo: () =>
`Viu só? O cliente entra, navega pelo seu espaço, sente a atmosfera e chega praticamente decidido a comprar.

Vamos transformar isso para você? 🚀`,

  // Pergunta 3 — site/redes
  askSite: () =>
`Você tem um site ou Instagram da sua empresa? (Se não tiver, sem problema, só me avisar 😉)`,

  // Pergunta 4 — unidades
  askUnits: () =>
`Perfeito! 🏪

Você quer criar o Tour Virtual para *uma loja* ou para *mais de uma unidade*?`,

  // Pergunta 5 — pagamento
  askPayment: () =>
`Ótimo! Último detalhe.

Qual é a sua preferência de pagamento?

💳 À vista com 10% de desconto (você economiza e ativa rápido)
💰 Parcelado em até 6x sem juros no cartão`,

  // Não entendemos a forma de pagamento
  paymentReask: () =>
`Só pra confirmar 🙂 você prefere *à vista* (com 10% de desconto) ou *parcelado* em até 6x sem juros?`,

  // Conclusão + handoff
  summary: (nome, endereco, unidades, pagamento) =>
`Maravilha, ${nome}! Tudo certo. ✅

*Resumo do seu projeto:*
📍 Endereço: ${endereco}
🏪 Unidades: ${unidades}
💳 Pagamento: ${pagamento}

Já passei tudo para o nosso especialista. Ele te chama em pouquinhos minutos com a proposta personalizada e o próximo passo.

Enquanto isso, conheça melhor a gente: ${config.siteUrl}

Até já! 🚀`,

  // Pediram algo que não é texto (figurinha, áudio) no meio do fluxo
  fallbackText: () =>
`Consegue me mandar essa resposta em texto, por favor? 🙏 Assim eu anoto certinho pra você.`,

  // Reengajamento por inatividade (repete a pergunta atual)
  idle: (nome, pergunta) =>
`Oi${nome ? ' ' + nome : ''}! Nosso especialista está aguardando suas informações. Podemos continuar? 😊

${pergunta}`,
};

// ---- Respostas de objeção (gatilhadas por palavra-chave) ----
export const OBJ = {
  preco: () =>
`Começamos em *R$ 590* (sem mensalidade). Mas, para te passar o pacote ideal, preciso saber o tamanho do seu espaço. Pode me mandar o seu endereço? 😉`,
  desconto: () =>
`Oferecemos 10% de desconto à vista porque você economiza e a gente processa mais rápido. Mas sem pressão: dá pra parcelar em 6x sem juros também. 💳`,
  juros: () =>
`Não tem juros! Você parcela em até 6x no cartão sem custo adicional. O valor é o mesmo, só dividido em parcelas menores. 👍`,
  pensar: () =>
`Normal querer pensar! Mas essa condição é por tempo limitado. Nosso especialista te explica tudo em 2 minutos e você decide com segurança. Vamos lá? ⏳`,
  garantia: () =>
`Somos Autorizada Google (Trusted Photographer) e seguimos os padrões mais rigorosos de qualidade. Se não ficar perfeito, não publicamos. Sua imagem é nossa prioridade! 💯`,
  prazo: () =>
`Captura em 30 minutos, edição profissional e publicação em poucos dias. Tudo rápido e com qualidade de cinema. 🎬`,
  uso_fotos: () =>
`Sim! Os arquivos são 100% seus. Você usa no site, nas redes sociais, em campanhas... onde quiser, quantas vezes quiser. 📸`,
};
