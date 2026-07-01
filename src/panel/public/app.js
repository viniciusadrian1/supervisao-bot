'use strict';

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

let FLOW = null;

// -------- abas --------
$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === btn));
  const id = btn.dataset.tab;
  document.querySelectorAll('.panel-tab').forEach((p) => p.classList.toggle('is-active', p.id === 'tab-' + id));
});

// -------- tempo relativo --------
function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

// -------- fetch helpers --------
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}

// -------- render: FLUXO (estático, com selos ao vivo) --------
function renderFlow(currentByStep) {
  const box = $('#flowNodes');
  if (!FLOW) return;
  box.innerHTML = FLOW.steps
    .map((st, i) => {
      const here = (currentByStep && currentByStep[st.step]) || 0;
      const badge = here ? `<span class="node__here">${here} aqui</span>` : '';
      const msgs = st.messages.map((m) => `<div class="bubble">${esc(m)}</div>`).join('');
      const conn = i < FLOW.steps.length - 1 ? '<div class="conn"></div>' : '';
      return `
        <div class="node ${st.step === 'HANDOFF' ? 'node--end' : ''}">
          <div class="node__h"><span class="node__ico">${esc(st.icon)}</span> ${esc(st.label)} ${badge}</div>
          <p class="node__desc">${esc(st.desc)}</p>
          <div class="node__msgs">${msgs}</div>
        </div>${conn}`;
    })
    .join('');
}

// -------- render: COPY --------
function renderCopy() {
  if (!FLOW) return;
  $('#copySteps').innerHTML = FLOW.steps
    .map(
      (st) => `
      <div class="copy-step">
        <div class="copy-step__h">${esc(st.icon)} ${esc(st.label)} <span class="copy-step__tag">· etapa</span></div>
        ${st.messages.map((m) => `<div class="bubble">${esc(m)}</div>`).join('')}
      </div>`
    )
    .join('');

  $('#copyReasks').innerHTML = FLOW.reasks
    .map(
      (r) => `<div class="copy-step"><div class="copy-step__h small">${esc(r.label)}</div><div class="bubble">${esc(r.text)}</div></div>`
    )
    .join('');

  $('#copyObjections').innerHTML = FLOW.objections
    .map(
      (o) => `<div class="copy-step"><div class="copy-step__h small">${esc(o.label)}</div><div class="bubble">${esc(o.text)}</div></div>`
    )
    .join('');
}

// -------- render: objeções (fluxo + ranking) --------
function renderObjections(objections) {
  const max = Math.max(1, ...(objections || []).map((o) => o.count));
  const labelOf = (key) => (FLOW?.objections.find((o) => o.key === key)?.label) || key;
  const html = (objections && objections.length)
    ? objections
        .map(
          (o) => `
        <div class="objrow">
          <span class="objrow__lbl">${esc(labelOf(o.key))}</span>
          <span class="objrow__bar"><span class="objrow__fill" style="width:${(100 * o.count) / max}%"></span></span>
          <span class="objrow__n">${o.count}</span>
        </div>`
        )
        .join('')
    : '<div class="empty">Nenhuma objeção registrada ainda.</div>';
  $('#objRank').innerHTML = html;
  $('#flowObjections').innerHTML = html;
}

// -------- render: KPIs + funil + perDay --------
function renderStats(s) {
  $('#kpiTotal').textContent = s.kpis.total;
  $('#kpiQual').textContent = s.kpis.qualified;
  $('#kpiConv').textContent = s.kpis.conversion + '%';
  $('#kpiActive').textContent = s.kpis.activeNow;

  const max = Math.max(1, ...s.funnel.map((f) => f.count));
  $('#funnel').innerHTML = s.funnel
    .map((f, i) => {
      const prev = i > 0 ? s.funnel[i - 1].count : f.count;
      const drop = i > 0 && prev > 0 ? Math.round((100 * (prev - f.count)) / prev) : 0;
      const final = f.key === 'HANDOFF';
      return `
      <div class="fbar ${final ? 'fbar--final' : ''}">
        <span class="fbar__lbl">${esc(f.label)}</span>
        <span class="fbar__track"><span class="fbar__fill" style="width:${(100 * f.count) / max}%"></span></span>
        <span class="fbar__n">${f.count}</span>
        <span class="fbar__drop">${i > 0 && drop > 0 ? '−' + drop + '%' : ''}</span>
      </div>`;
    })
    .join('');

  const pmax = Math.max(1, ...s.perDay.map((d) => d.count));
  $('#perDay').innerHTML = s.perDay
    .map((d) => `<div class="perday__bar" title="${esc(d.day)}: ${d.count}"><i style="height:${(100 * d.count) / pmax}%"></i></div>`)
    .join('');

  renderObjections(s.objections);
  renderFlow(s.currentByStep);
}

// -------- render: AO VIVO --------
function renderLive(live) {
  const box = $('#liveList');
  if (!live.rows.length) {
    box.innerHTML = '<div class="empty">Ainda sem conversas. Assim que os leads chegarem, aparecem aqui.</div>';
    return;
  }
  box.innerHTML = live.rows
    .map((r) => {
      const initial = esc((r.name || '?').trim().charAt(0).toUpperCase() || '?');
      return `
      <div class="liverow">
        <span class="avatar">${initial}</span>
        <span>
          <div class="liverow__name">${esc(r.name)}</div>
          <div class="liverow__phone">${esc(r.phone)}</div>
        </span>
        <span class="chip ${r.qualified ? 'chip--q' : ''}">${esc(r.stepLabel)}</span>
        <span class="liverow__ago">${ago(r.agoMs)}</span>
      </div>`;
    })
    .join('');
}

function setLive(on, label) {
  $('#liveDot').classList.toggle('is-live', on);
  $('#updatedLabel').textContent = label;
}

// -------- loop --------
async function poll() {
  try {
    const [stats, live] = await Promise.all([getJSON('api/stats'), getJSON('api/live')]);
    renderStats(stats);
    renderLive(live);
    setLive(true, 'atualizado ' + ago(0));
  } catch (e) {
    setLive(false, 'sem conexão — tentando…');
  }
}

(async function init() {
  try {
    FLOW = await getJSON('api/flow');
    renderCopy();
    renderFlow(null);
  } catch (e) {
    setLive(false, 'falha ao carregar o fluxo');
  }
  await poll();
  setInterval(poll, 5000);
})();
