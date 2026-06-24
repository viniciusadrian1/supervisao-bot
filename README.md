# Supervisão 360 — Bot de WhatsApp (qualificação de leads)

Chatbot que recebe o lead vindo da landing page no WhatsApp, **qualifica em 5 perguntas**
(nome → endereço com CEP → *envia o vídeo demonstrativo* → site/Instagram → unidades →
forma de pagamento), responde objeções e **passa para um atendente humano no mesmo número**.

- **Provedor de WhatsApp:** UAZAPI (REST, não-oficial, SaaS BR)
- **Runtime:** Node.js (sem framework pesado, só Express) — `type: module`
- **Deploy:** Render (Web Service persistente) — `render.yaml` incluso
- **Persistência:** arquivos JSON (1 por conversa) + `leads.jsonl` (sem dependência nativa)

> O bot foi desenhado **provider-agnostic**: toda a lógica é igual; trocar de
> UAZAPI para WAHA/Cloud API é só escrever outro arquivo em `src/providers/`.

---

## 🧠 Como o fluxo funciona

```
(lead chega da LP) → NEW
  → AWAITING_NAME        "Como posso te chamar?"
  → AWAITING_ADDRESS     valida CEP (ViaCEP) + número do imóvel
  → AWAITING_POSTVIDEO   confirma endereço + ENVIA O VÍDEO + "Vamos transformar?"
  → AWAITING_SITE        "Tem site ou Instagram?"
  → AWAITING_UNITS       "Uma loja ou mais de uma unidade?"
  → AWAITING_PAYMENT     "À vista (10% off) ou 6x sem juros?"
  → HANDOFF              resumo + bot PAUSA (humano assume o mesmo número)
```

- **Objeções** (preço, desconto, juros, "vou pensar", garantia, prazo, uso das fotos):
  respondidas a qualquer momento por palavra-chave, sem perder o passo atual.
- **Inatividade (+30 min):** reengaja o lead repetindo a pergunta atual (uma vez).
- **Handoff:** ao terminar, o bot entra em silêncio naquele contato. Como o número é o
  mesmo, o atendente abre o **WhatsApp Web/app** e continua a conversa normalmente.
  Para reativar o bot num contato, mande a palavra `#bot` (configurável).
- **Anti-loop:** ignora mensagens enviadas por nós (`fromMe`/`wasSentByApi`) e de grupos.

---

## 🗂️ Estrutura

```
supervisao-bot/
├── src/
│   ├── server.js              # Express: POST /webhook + GET /health + serve /media
│   ├── config.js              # lê o .env
│   ├── providers/
│   │   ├── index.js           # factory (escolhe por PROVIDER)
│   │   ├── uazapi.js          # adapter UAZAPI (sendText, sendVideo, markRead, parseIncoming)
│   │   └── mock.js            # provedor de teste (não envia nada)
│   ├── engine/
│   │   ├── flow.js            # máquina de estados (o coração)
│   │   ├── objections.js      # detector + respostas rápidas
│   │   ├── validators.js      # CEP + número + ViaCEP
│   │   └── idle.js            # reengajamento por inatividade
│   ├── nlu/                   # IA OPCIONAL (OpenAI): só ENTENDE, não responde
│   │   ├── index.js           # interpret() com fallback p/ regras
│   │   └── openai.js          # chamada à OpenAI (Structured Outputs)
│   ├── messages/catalog.js    # TODA a copy (edite aqui sem mexer na lógica)
│   ├── store/index.js         # persistência (JSON + JSONL)
│   └── util/                  # logger, lock por contato, humanização
├── scripts/                   # connect, status, setup:webhook, simulate
├── media/demo.mp4             # vídeo demonstrativo (servido em /media/demo.mp4)
├── render.yaml                # blueprint de deploy do Render
└── .env.example
```

---

## ▶️ Rodar e testar localmente

```bash
npm install
cp .env.example .env        # (no Windows: copy .env.example .env)

# 1) Testar o fluxo inteiro SEM enviar nada (provedor mock):
npm run simulate            # imprime a conversa completa no terminal

# 2) Rodar o servidor de verdade:
npm start                   # sobe na porta 3000
```

`npm run simulate` é a forma mais rápida de revisar a copy e a lógica — ele simula um
lead respondendo cada etapa e mostra exatamente o que o bot enviaria.

---

## 🔌 Passo a passo de produção

### 1. Criar a instância na UAZAPI e conectar o número
1. Crie a instância no painel da UAZAPI e pegue o **token da instância** e o
   **subdomínio** do seu servidor (ex.: `https://free.uazapi.com`).
2. Preencha `UAZAPI_BASE_URL` e `UAZAPI_TOKEN` no `.env`.
3. Conecte o número do cliente (leia o QR pelo painel, ou):
   ```bash
   npm run connect            # mostra QR
   npm run status             # confirma "connected: true"
   ```

> ⚠️ Use de preferência um **número dedicado** do cliente (não o pessoal). API não-oficial
> tem risco de bloqueio — ver "Anti-ban" abaixo.

### 2. Subir no Render
1. Suba este projeto para um repositório Git.
2. No Render: **New → Blueprint** e aponte para o repo (ele lê o `render.yaml`),
   **ou** crie um **Web Service** manual: build `npm install`, start `npm start`,
   health check `/health`, e adicione um **disco persistente** em `/data`.
3. Configure as variáveis de ambiente (Environment):
   - `PUBLIC_URL` = a URL que o Render te deu (ex.: `https://supervisao-bot.onrender.com`)
   - `UAZAPI_BASE_URL`, `UAZAPI_TOKEN`
   - `WEBHOOK_SECRET` (opcional, recomendado — um texto aleatório)
   - `DATA_DIR=/data`
4. Faça o deploy e abra `PUBLIC_URL/health` — deve responder `{"ok":true,...}` e mostrar a URL do vídeo.

### 3. Registrar o webhook
Com `PUBLIC_URL` e `UAZAPI_TOKEN` definidos:
```bash
npm run setup:webhook
```
Isso aponta a UAZAPI para `PUBLIC_URL/webhook` (ou `/webhook/SEU_SEGREDO`).
Também dá para configurar pelo painel da UAZAPI.

### 4. Ligar a landing page
Os botões de WhatsApp da LP já mandam o lead pro número com uma mensagem pronta.
**Qualquer** primeira mensagem do lead dispara a saudação do bot — não precisa de texto
específico. (Se quiser, padronize a mensagem da LP; o bot funciona de qualquer forma.)

### 5. Testar de verdade
Mande uma mensagem do seu WhatsApp pessoal para o número do bot e percorra o fluxo.
O vídeo deve chegar **tocável** (nativo) após a confirmação do endereço.

---

## ✏️ Editar a copy
Tudo que o bot fala está em [`src/messages/catalog.js`](src/messages/catalog.js).
Edite os textos e reinicie — a lógica não muda.

## 🎥 Trocar o vídeo
Substitua `media/demo.mp4` (servido em `PUBLIC_URL/media/demo.mp4`), **ou** aponte
`VIDEO_URL` no `.env` para um `.mp4` hospedado em outro lugar (link direto, não página de YouTube).

## 📇 Leads
Cada lead qualificado é gravado em `DATA_DIR/leads.jsonl` (uma linha JSON por lead).
Defina `OWNER_NUMBER` se quiser também um **aviso** num número de gestor a cada lead.

---

## 🧠 Camada de IA (opcional — OpenAI)
O bot funciona **sem IA** (nas regras determinísticas). Se você definir `OPENAI_API_KEY`,
ele liga uma camada de **entendimento**: a IA classifica a mensagem do lead (qual objeção
é, qual o nome, qual a forma de pagamento) mesmo dita de qualquer jeito — mas **as respostas
continuam saindo do roteiro fixo** (`messages/catalog.js`). A IA **nunca** escreve texto pro
cliente, então não há risco de inventar preço ou promessa.

- **Ligar:** defina `OPENAI_API_KEY` (e, se quiser, `OPENAI_MODEL`) no `.env`/Render.
- **Modelo:** padrão `gpt-4o-mini` (barato e disponível em qualquer conta). Recomendado
  atual: `gpt-5.4-nano`/`gpt-5.4-mini`. O código se ajusta sozinho aos parâmetros de cada
  geração (GPT-5.x usa `max_completion_tokens`/`reasoning_effort`; gpt-4o-mini usa `temperature`).
- **Custo:** ~frações de centavo por mensagem (1 classificação curta por mensagem).
- **À prova de falha:** se a OpenAI cair, demorar ou a chave faltar, o bot **volta sozinho
  pras regras** — o atendimento nunca para.
- **Testar a normalização (sem rede):** `npm run test:nlu`.

## 🛡️ Anti-ban (API não-oficial)
A UAZAPI conecta como WhatsApp comum — há risco real de bloqueio do número. Mitigações
já embutidas e recomendadas:
- O bot **só responde quem mandou mensagem** (nunca dispara em massa).
- **"Digitando..."** e atrasos humanos entre mensagens (configuráveis em `TYPING_*`).
- Marca as mensagens como lidas.
- Use um **número dedicado**, faça *aquecimento* (uso gradual) e mantenha volume moderado.
- Monitore a conexão (`npm run status`); se cair, reconecte (`npm run connect`).

> Se o risco de bloqueio for inaceitável, troque o adapter por **WhatsApp Cloud API
> oficial** (risco ~zero) — a arquitetura já está pronta para isso.

---

## Variáveis de ambiente
Veja [`.env.example`](.env.example) — todas estão comentadas.
