import { M, OBJ } from '../messages/catalog.js';

// Mapa do fluxo (etapas/beats com o copy) para o painel desenhar.
// As respostas vêm do mesmo catálogo que o bot usa — então o painel sempre
// reflete o copy real. O campo `step` liga cada nó à etapa da máquina de estados
// (para o painel mostrar quantos leads estão "aqui agora").

export function getFlowMap() {
  const NOME = '{nome}';

  const steps = [
    {
      id: 'saudacao', step: 'AWAITING_NAME', icon: '👋', label: 'Saudação',
      desc: 'O bot responde o lead e pergunta o nome.',
      messages: [M.greeting()],
    },
    {
      id: 'nome', step: 'AWAITING_ADDRESS', icon: '🧑', label: 'Nome → Endereço',
      desc: 'Reforço de valor com o nome do lead e pede o endereço.',
      messages: [M.afterName(NOME)],
    },
    {
      id: 'video', step: 'AWAITING_POSTVIDEO', icon: '🎬', label: 'Confirma + Vídeo',
      desc: 'Confirma o endereço, envia o vídeo demonstrativo e convida a seguir.',
      messages: [M.addressConfirm('{endereço}'), M.videoIntro(), '🎬 [vídeo demonstrativo]', M.afterVideo()],
    },
    {
      id: 'site', step: 'AWAITING_SITE', icon: '🌐', label: 'Site / Instagram',
      desc: 'Pergunta se a empresa tem site ou Instagram.',
      messages: [M.askSite()],
    },
    {
      id: 'unidades', step: 'AWAITING_UNITS', icon: '🏪', label: 'Unidades',
      desc: 'Uma loja ou mais de uma unidade.',
      messages: [M.askUnits()],
    },
    {
      id: 'pagamento', step: 'AWAITING_PAYMENT', icon: '💳', label: 'Pagamento',
      desc: 'À vista (10% off) ou parcelado em 6x sem juros.',
      messages: [M.askPayment()],
    },
    {
      id: 'handoff', step: 'HANDOFF', icon: '✅', label: 'Resumo + Handoff',
      desc: 'Resumo do projeto e passagem para o atendente humano (mesmo número).',
      messages: [M.summary(NOME, '{endereço}', '{unidades}', '{pagamento}')],
    },
  ];

  const reasks = [
    { label: 'Nome não entendido', text: M.nameReask() },
    { label: 'Endereço incompleto (falta nº/CEP)', text: M.addressReask() },
    { label: 'CEP não encontrado', text: M.addressReaskCep() },
    { label: 'Pagamento não entendido', text: M.paymentReask() },
    { label: 'Mensagem não-texto (figurinha/áudio)', text: M.fallbackText() },
    { label: 'Reengajamento por inatividade', text: M.idle(NOME, '{pergunta da etapa atual}') },
  ];

  const objections = [
    { key: 'preco', label: 'Preço', text: OBJ.preco() },
    { key: 'desconto', label: 'Desconto', text: OBJ.desconto() },
    { key: 'juros', label: 'Juros', text: OBJ.juros() },
    { key: 'pensar', label: '"Vou pensar"', text: OBJ.pensar() },
    { key: 'garantia', label: 'Garantia', text: OBJ.garantia() },
    { key: 'prazo', label: 'Prazo', text: OBJ.prazo() },
    { key: 'uso_fotos', label: 'Uso das fotos', text: OBJ.uso_fotos() },
  ];

  return { steps, reasks, objections };
}
