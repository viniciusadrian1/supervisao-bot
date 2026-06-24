import { OBJ } from '../messages/catalog.js';

// Detector simples por palavra-chave. As frases são específicas o suficiente
// para não confundir com respostas normais do fluxo. (No passo de pagamento a
// detecção é desligada — ver flow.js — porque "à vista" colidiria com desconto.)
const RULES = [
  { key: 'juros',     kw: ['juros', 'tem juro'] },
  { key: 'desconto',  kw: ['desconto', 'por que 10', 'porque 10', '10% a vista', '10% à vista'] },
  { key: 'preco',     kw: ['preço', 'preco', 'quanto custa', 'quanto fica', 'quanto é', 'quanto e', 'qual o valor', 'valores', 'tabela de'] },
  { key: 'pensar',    kw: ['vou pensar', 'preciso pensar', 'pensar melhor', 'depois eu vejo', 'quero pensar'] },
  { key: 'garantia',  kw: ['garantia', 'e se não ficar', 'e se nao ficar', 'não gostar', 'nao gostar', 'e se não gostar'] },
  { key: 'prazo',     kw: ['quanto tempo', 'prazo', 'demora', 'quando fica pronto', 'quando fica'] },
  { key: 'uso_fotos', kw: ['usar as fotos', 'posso usar as fotos', 'as fotos são minhas', 'as fotos sao minhas', 'direito das fotos', 'direitos das fotos'] },
];

export function detectObjection(text) {
  const t = (text || '').toLowerCase();
  for (const r of RULES) {
    if (r.kw.some((k) => t.includes(k))) {
      return { key: r.key, reply: OBJ[r.key]() };
    }
  }
  return null;
}
