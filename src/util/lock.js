// Serializa o processamento por chave (número do lead): garante que duas
// mensagens do mesmo contato não rodem a máquina de estados em paralelo.
const chains = new Map();

export function withLock(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  // roda fn depois que a anterior terminar (com sucesso ou erro)
  const run = prev.then(fn, fn);
  // encadeia a próxima de forma silenciosa; ao terminar, limpa a entrada se
  // ninguém mais estiver na fila daquele contato (evita crescimento do Map).
  const settled = run.then(noop, noop).then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  chains.set(key, settled);
  return run;
}

function noop() {}
