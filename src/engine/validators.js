// Validação de endereço: exige CEP (8 dígitos) + número do imóvel.
// Enriquecemos com ViaCEP (best-effort) para confirmar e guardar cidade/UF.

const CEP_RE = /\b(\d{5})[-.\s]?(\d{3})\b/;

export function extractCep(text) {
  const m = (text || '').match(CEP_RE);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function hasHouseNumber(text) {
  // remove o CEP (qualquer separador) e sequências longas (telefones)
  const t = (text || '').replace(CEP_RE, ' ').replace(/\d{5,}/g, ' ');
  // procura um número de logradouro plausível: 1-5 dígitos isolado
  return /(?:^|[\s,.;])(?:n[º°o.]?\s*)?\d{1,5}(?=[\s,.;]|$)/i.test(t);
}

/**
 * Consulta ViaCEP. Retorna:
 *  - { invalid: true }            CEP não existe
 *  - { invalid: false, ...dados } CEP válido (logradouro, bairro, localidade, uf...)
 *  - null                          falha de rede / inconclusivo (não bloqueia o lead)
 */
export async function lookupCep(cep) {
  try {
    const digits = (cep || '').replace(/\D/g, '');
    if (digits.length !== 8) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return { invalid: true };
    return { invalid: false, ...data };
  } catch {
    return null;
  }
}

/** Valida o endereço informado pelo lead. */
export async function validateAddress(text) {
  const cep = extractCep(text);
  if (!cep) return { ok: false, reason: 'cep' };
  if (!hasHouseNumber(text)) return { ok: false, reason: 'numero' };

  const info = await lookupCep(cep);
  if (info && info.invalid) return { ok: false, reason: 'cep_invalido' };

  return {
    ok: true,
    cep,
    info: info && !info.invalid ? info : null,
    raw: (text || '').trim(),
  };
}
