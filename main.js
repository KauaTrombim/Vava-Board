/* =============================================================
 * main.js — CONTROLE DA INTERFACE
 * Renderiza placar, indicadores, tabela, mapa e gráficos a partir
 * do modelo normalizado por dataLoader.js. Não conhece o JSON bruto.
 * ============================================================= */
(function (VD) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = { match: null, matches: [], me: null, round: null, charts: {} };
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Configuração (edite aqui) ---- */
  // Pastas de dados, testadas em ordem. 'data/' fica ao lado do index.html (estrutura do VavaBoard);
// as outras cobrem o caso de o index estar numa subpasta.
const DATA_DIRS = ['data/', '/data/', '../data/'];
  const TEAM_PT = { Blue: 'Azul', Red: 'Vermelho' };
  const END_PT = { Elimination: 'Eliminação', Detonate: 'Spike detonada', Defuse: 'Spike desarmada' };
  const ROLE_PT = { Attacker: 'Ataque', Defender: 'Defesa' };
  const KPIS = [ // um item por indicador; adicione métricas aqui
    { key: 'acs', label: 'ACS', icon: 'bolt', dec: 0, title: 'Score médio por round' },
    { key: 'kd', label: 'K/D', icon: 'crosshair', dec: 2, title: 'Abates por morte', extra: (p) => `${p.kills}/${p.deaths}/${p.assists}` },
    { key: 'adr', label: 'ADR', icon: 'flame', dec: 0, title: 'Dano médio por round' },
    { key: 'hs', label: 'HS%', icon: 'target', dec: 0, title: 'Porcentagem de tiros na cabeça' },
    { key: 'kast', label: 'KAST', icon: 'shield', dec: 0, title: 'Rounds com abate, assistência, sobrevivência ou trade (%)' },
    { key: 'fk', label: 'PA', icon: 'star', dec: 0, title: 'Primeiros abates do round' },
  ];

  /* ---- Ícones (SVG de traço; use ic('nome')) ---- */
  const ICONS = {
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
    flag: '<path d="M5 21V4m0 0h12l-2 4 2 4H5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    sword: '<path d="M14 4h6v6L10 20l-6-6zM9 15l-4 4"/>',
    shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-5-4-6-4-11-3 2-6 5-6 9-1-1-2-2-2-4-2 2-2 4-2 6 0 4 3 7 7 7z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const ic = (n, cls = 'h-4 w-4') => `<svg class="${cls} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const hydrateIcons = () => document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ic(el.dataset.icon); });

  /* ---- Utilidades ---- */
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } },
  };
  const css = (name, a = 1) =>
    `rgba(${getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim().split(/\s+/).join(',')},${a})`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const avg = (arr, f) => arr.reduce((s, x) => s + f(x), 0) / (arr.length || 1);
  const me = () => state.match.players.find((p) => p.puuid === state.me);
  const pl = (id) => state.match.players.find((p) => p.puuid === id);
  const myTeam = () => me().team;
  const enemyTeam = () => (myTeam() === 'Blue' ? 'Red' : 'Blue');
  const tone = (team) => (team === myTeam() ? 'ally' : 'enemy');
  const teamPlayers = (t) => state.match.players.filter((p) => p.team === t);
  const named = (id) => { const p = pl(id); return p ? `<b class="text-${tone(p.team)}">${esc(p.name)}</b>` : '?'; };

  function countUp(el) {
    const to = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0;
    if (REDUCED) { el.textContent = fmt(to, dec); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)), dec);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.add('hidden'), 4500); };

  function setTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    store.set('vd-theme', theme);
    if (state.match) renderCharts();
  }

  /* ---- Seções de HTML ---- */
  function renderMeta() {
    const m = state.match;
    const item = (icon, text, title) => `<span class="inline-flex items-center gap-1.5 text-mute" title="${title}">${ic(icon)}<span class="text-ink">${esc(text)}</span></span>`;
    $('#matchMeta').innerHTML = [
      item('map', m.map, 'Mapa'), item('flag', m.mode, 'Modo'),
      item('calendar', m.startedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }), 'Início da partida'),
      item('clock', mmss(m.durationMs), 'Duração'), item('globe', m.region, 'Região'),
    ].join('');
  }

  function renderHero() {
    const m = state.match, my = myTeam(), en = enemyTeam();
    const a = m.teams[my], e = m.teams[en];
    const sides = (t) => { const s = m.sides[t] || {}; return `<p class="mt-2 flex items-center gap-3 text-sm text-mute"><span class="flex items-center gap-1" title="Rounds ganhos no ataque">${ic('sword')}${s.Attacker || 0}</span><span class="flex items-center gap-1" title="Rounds ganhos na defesa">${ic('shield')}${s.Defender || 0}</span></p>`; };
    $('#hero').innerHTML = `
      <div class="cut grid items-center gap-4 bg-panel p-5 sm:p-6 md:grid-cols-[1fr_auto_1fr]">
        <div><p class="font-display text-xl font-semibold text-ally">${TEAM_PT[my]}</p>
          <p class="font-display text-8xl font-bold leading-none text-ally" data-count="${a.roundsWon}">0</p>${sides(my)}</div>
        <p class="text-center font-display text-5xl font-bold ${a.won ? 'text-ally' : 'text-enemy'}">${a.won ? 'Vitória' : 'Derrota'}</p>
        <div class="md:text-right"><p class="font-display text-xl font-semibold text-enemy">${TEAM_PT[en]}</p>
          <p class="font-display text-8xl font-bold leading-none text-enemy" data-count="${e.roundsWon}">0</p>
          <div class="md:flex md:justify-end">${sides(en)}</div></div>
      </div>`;
  }

  function renderKpis() {
    const p = me(), mates = teamPlayers(p.team);
    const cells = KPIS.map((k) => {
      const team = avg(mates, (x) => x[k.key]);
      return `<div class="px-3 py-1"><div class="flex items-center gap-1.5 text-mute" title="${k.title}">${ic(k.icon)}<span class="text-sm">${k.label}</span></div>
        <p class="font-display text-5xl font-bold ${p[k.key] >= team ? 'text-ally' : 'text-enemy'}" data-count="${p[k.key]}" data-dec="${k.dec}">0</p>
        <p class="text-xs text-mute" title="Média da equipe">${k.extra ? esc(k.extra(p)) + ' · ' : ''}eq. ${fmt(team, k.dec)}</p></div>`;
    }).join('');
    $('#kpis').innerHTML = `<div class="mb-3 flex items-center gap-2">${ic('user')}<b>${esc(p.name)}</b><span class="text-sm text-mute">#${esc(p.tag)}, ${esc(p.agent)}</span></div>
      <div class="grid grid-cols-2 gap-y-3 md:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-line">${cells}</div>`;
  }

  function renderTimeline(animate) {
    $('#timeline').innerHTML = state.match.rounds.map((r, i) => {
      const t = tone(r.winner), sel = state.round === i ? 'ring-2 ring-ink' : '';
      return (i === 12 ? '<span class="mx-1 w-px self-stretch bg-line"></span>' : '') +
        `<button type="button" data-round="${i}" title="Round ${r.num}: ${ROLE_PT[r.role]} venceu, ${END_PT[r.type] || r.type}"
          class="${animate ? 'animate-chip' : ''} ${sel} flex h-12 w-9 flex-col items-center justify-center border-b-2 border-${t} bg-${t}/20 text-${t} hover:bg-${t}/40"
          style="animation-delay:${i * 40}ms"><span class="font-display text-lg font-bold leading-none">${r.num}</span><span class="text-[10px]">${r.role === 'Attacker' ? 'A' : 'D'}</span></button>`;
    }).join('');
  }

  function renderRound() {
    const el = $('#roundDetail'), r = state.match.rounds[state.round];
    if (!r) { el.innerHTML = '<p class="text-mute">Selecione um round para ver os abates aqui e no mapa.</p>'; return; }
    const head = `<p class="mb-2 flex flex-wrap items-center gap-x-3 font-semibold">Round ${r.num}<span class="flex items-center gap-1 font-normal text-mute">${ic(r.role === 'Attacker' ? 'sword' : 'shield')}${END_PT[r.type] || r.type}</span>${r.site ? `<span class="font-normal text-mute">Site ${esc(r.site)}</span>` : ''}</p>`;
    const rows = r.kills.map((k) => `<li>${mmss(k.t)} ${named(k.killer)} abateu ${named(k.victim)}${k.assists.length ? `, assist: ${k.assists.map(named).join(', ')}` : ''}</li>`).join('');
    el.innerHTML = head + `<ul class="space-y-1">${rows || '<li class="text-mute">Sem abates registrados.</li>'}</ul>`;
  }

  function renderBoard() {
    const cols = [['@crosshair', 'kills', 0, 'Abates'], ['@x', 'deaths', 0, 'Mortes'], ['@plus', 'assists', 0, 'Assistências'], ['K/D', 'kd', 2, 'Abates por morte'], ['ACS', 'acs', 0, 'Score médio por round'],
      ['ADR', 'adr', 0, 'Dano médio por round'], ['HS%', 'hs', 0, 'Tiros na cabeça'], ['KAST', 'kast', 0, 'Rounds com impacto'], ['@star', 'fk', 0, 'Primeiros abates'], ['@flame', 'mk', 0, 'Rounds com 2 ou mais abates']];
    const row = (p) => `<tr data-puuid="${p.puuid}" class="cursor-pointer border-t border-line/60 hover:bg-bg ${p.puuid === state.me ? 'bg-accent/10' : ''}">
      <td class="py-2 pl-2"><span class="mr-2 inline-block h-6 w-1 bg-${tone(p.team)} align-middle"></span><b>${esc(p.name)}</b> <span class="text-xs text-mute">#${esc(p.tag)}</span><span class="block pl-3 text-xs text-mute">${esc(p.agent)}</span></td>
      ${cols.map(([, k, d]) => `<td class="px-2 text-right">${fmt(p[k], d)}</td>`).join('')}</tr>`;
    const group = (t) => `<tr><th colspan="11" class="bg-bg px-2 py-1 font-display text-lg text-${tone(t)}">${TEAM_PT[t]}${t === myTeam() ? ' (sua equipe)' : ''}</th></tr>` +
      teamPlayers(t).sort((a, b) => b.acs - a.acs).map(row).join('');
    $('#board').innerHTML = `<thead class="text-mute"><tr><th class="py-1 pl-2 font-normal">Jogador</th>${cols.map(([h, , , t]) =>
      `<th class="px-2 text-right font-normal" title="${t}"><span class="inline-flex justify-end">${h[0] === '@' ? ic(h.slice(1)) : h}</span></th>`).join('')}</tr></thead>
      <tbody>${group(myTeam())}${group(enemyTeam())}</tbody>`;
  }

  /* ---- Gráficos ---- */
  function themeCharts() {
    const C = Chart.defaults;
    C.color = css('mute'); C.borderColor = css('line', 0.6); C.font.family = "'DM Sans', sans-serif";
    C.animation = REDUCED ? false : { duration: 900, easing: 'easeOutQuart' };
    C.plugins.legend.labels.usePointStyle = true; C.plugins.legend.labels.boxWidth = 8;
    Object.assign(C.plugins.tooltip, { backgroundColor: css('panel', 0.97), titleColor: css('ink'), bodyColor: css('ink'), borderColor: css('line'), borderWidth: 1, padding: 10 });
  }
  const make = (id, type, data, options = {}) => {
    if (state.charts[id]) state.charts[id].destroy();
    state.charts[id] = new Chart($('#' + id), { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
  };

  function chartRounds() {
    const m = state.match, my = myTeam(), en = enemyTeam();
    let cum = 0;
    make('cRounds', 'bar', {
      labels: m.rounds.map((r) => r.num),
      datasets: [
        { label: 'Equipamento da sua equipe', data: m.rounds.map((r) => r.loadout[my]), backgroundColor: css('ally', 0.55), borderRadius: 2, yAxisID: 'y', order: 2 },
        { label: 'Equipamento inimigo', data: m.rounds.map((r) => r.loadout[en]), backgroundColor: css('enemy', 0.55), borderRadius: 2, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Saldo de rounds', data: m.rounds.map((r) => (cum += r.winner === my ? 1 : -1)), borderColor: css('ink'), backgroundColor: css('ink'), stepped: true, pointRadius: 2, borderWidth: 2, yAxisID: 'y1', order: 1 },
      ],
    }, {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => v / 1000 + 'k' } }, y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } } },
      plugins: { tooltip: { callbacks: { title: (i) => 'Round ' + i[0].label } } },
    });
  }

  function chartEnd() {
    const m = state.match, my = myTeam(), en = enemyTeam(), types = ['Elimination', 'Detonate', 'Defuse'];
    const count = (t, ty) => m.rounds.filter((r) => r.winner === t && r.type === ty).length;
    make('cEnd', 'doughnut', {
      labels: [...types.map((t) => 'Sua equipe: ' + END_PT[t]), ...types.map((t) => 'Inimigos: ' + END_PT[t])],
      datasets: [{ data: [...types.map((t) => count(my, t)), ...types.map((t) => count(en, t))], borderColor: css('panel'), borderWidth: 2,
        backgroundColor: [css('ally'), css('ally', 0.65), css('ally', 0.35), css('enemy'), css('enemy', 0.65), css('enemy', 0.35)] }],
    }, { cutout: '58%', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 6 } } } });
  }

  function chartPlayers() {
    const ps = [...state.match.players].sort((a, b) => b.acs - a.acs);
    make('cPlayers', 'bar', {
      labels: ps.map((p) => p.name),
      datasets: [
        { label: 'ACS', data: ps.map((p) => Math.round(p.acs)), backgroundColor: ps.map((p) => css(tone(p.team), p.puuid === state.me ? 1 : 0.5)), yAxisID: 'y', order: 2 },
        { type: 'line', label: 'K/D', data: ps.map((p) => +p.kd.toFixed(2)), showLine: false, pointStyle: 'rectRot', pointRadius: 6, borderColor: css('ink'), backgroundColor: css('ink'), yAxisID: 'y1', order: 1 },
      ],
    }, { scales: { x: { grid: { display: false }, ticks: { maxRotation: 40 } }, y: { beginAtZero: true }, y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } } } });
  }

  function chartRadar() {
    const p = me(), all = state.match.players;
    const axes = [['ACS', 'acs'], ['ADR', 'adr'], ['HS%', 'hs'], ['KAST', 'kast'], ['K/D', 'kd'], ['PA', 'fk']];
    const max = Object.fromEntries(axes.map(([, k]) => [k, Math.max(...all.map((x) => x[k])) || 1]));
    const norm = (f) => axes.map(([, k]) => Math.round((f(k) / max[k]) * 100));
    const ds = (label, c, data, w) => ({ label, data, borderColor: css(c), backgroundColor: css(c, 0.18), borderWidth: w, pointRadius: 2 });
    make('cRadar', 'radar', {
      labels: axes.map(([l]) => l),
      datasets: [ds(p.name, 'accent', norm((k) => p[k]), 3), ds('Sua equipe', 'ally', norm((k) => avg(teamPlayers(myTeam()), (x) => x[k])), 1.5), ds('Inimigos', 'enemy', norm((k) => avg(teamPlayers(enemyTeam()), (x) => x[k])), 1.5)],
    }, { scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: css('line', 0.6) }, angleLines: { color: css('line', 0.6) }, pointLabels: { color: css('ink'), font: { size: 11 } } } } });
  }

  function chartPlayerRounds() {
    const p = me();
    make('cPlayerRounds', 'bar', {
      labels: state.match.rounds.map((r) => r.num),
      datasets: [
        { label: 'Abates', data: p.perRound.map((x) => x.k), backgroundColor: css('ally'), stack: 's', yAxisID: 'y', order: 2 },
        { label: 'Mortes', data: p.perRound.map((x) => -x.d), backgroundColor: css('enemy'), stack: 's', yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Dano', data: p.perRound.map((x) => x.dmg), borderColor: css('ink'), backgroundColor: css('ink'), tension: 0.35, pointRadius: 2, borderWidth: 2, yAxisID: 'y1', order: 1 },
      ],
    }, {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } }, y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } } },
      plugins: { tooltip: { callbacks: { title: (i) => 'Round ' + i[0].label, label: (c) => `${c.dataset.label}: ${Math.abs(c.raw)}` } } },
    });
  }

  /* Mapa: o canvas cobre a imagem; eixos vão de 0 a 1 (mesma escala da calibração do dataLoader). */
  function chartKills() {
    const m = state.match, meta = m.mapMeta, card = $('#mapCard');
    card.classList.toggle('hidden', !meta);
    if (!meta) return;
    $('#mapImg').src = meta.image;
    const sel = () => (state.round == null ? null : m.rounds[state.round].num);
    const hit = (raw) => sel() == null || raw.r === sel();
    const pts = (f) => m.kills.filter((k) => k.nx != null && f(k)).map((k) => ({ x: k.nx, y: k.ny, r: k.round }));
    const ds = (label, data, color, radius, extra = {}) => ({ label, data, borderWidth: 1,
      backgroundColor: (c) => css(color, hit(c.raw) ? 0.9 : 0.12), borderColor: (c) => css(color, hit(c.raw) ? 1 : 0.15),
      pointRadius: (c) => (hit(c.raw) ? radius + (sel() == null ? 0 : 2) : radius - 1), ...extra });
    make('cKills', 'scatter', {
      datasets: [
        ds('Abates aliados', pts((k) => k.killerTeam === myTeam() && k.killer !== state.me), 'ally', 4),
        ds('Abates inimigos', pts((k) => k.killerTeam !== myTeam()), 'enemy', 4),
        ds('Seus abates', pts((k) => k.killer === state.me), 'accent', 6),
        ds('Spike plantada', m.rounds.filter((r) => r.plant && r.plant.nx != null).map((r) => ({ x: r.plant.nx, y: r.plant.ny, r: r.num })), 'ink', 7, { pointStyle: 'triangle' }),
      ],
    }, {
      layout: { padding: 0 },
      scales: { x: { min: 0, max: 1, display: false }, y: { min: 0, max: 1, reverse: true, display: false } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: () => '', label: (c) => `${c.dataset.label}, round ${c.raw.r}` } } },
    });
  }

  function renderCharts() {
    Object.values(state.charts).forEach((c) => c.destroy());
    state.charts = {};
    themeCharts();
    [chartRounds, chartEnd, chartPlayers, chartRadar, chartPlayerRounds, chartKills].forEach((f) => f());
  }

  /* ---- Orquestração ---- */
  function renderAll(animate) {
    renderMeta(); renderHero(); renderKpis(); renderTimeline(animate); renderRound(); renderBoard(); renderCharts();
    document.querySelectorAll('[data-count]').forEach(countUp);
  }

  function fillSelect() {
    const m = state.match, sel = $('#playerSelect');
    const group = (t) => `<optgroup label="${TEAM_PT[t]}">${m.players.filter((p) => p.team === t).map((p) => `<option value="${p.puuid}">${esc(p.name)} #${esc(p.tag)} (${esc(p.agent)})</option>`).join('')}</optgroup>`;
    sel.innerHTML = group('Blue') + group('Red');
    sel.value = state.me;
  }

  function setMe(id) {
    state.me = id; store.set('vd-me', id); $('#playerSelect').value = id;
    renderAll(false);
  }

  function load(match) {
    state.match = match; state.round = null;
    const saved = store.get('vd-me');
    state.me = match.players.some((p) => p.puuid === saved) ? saved : match.players[0].puuid;
    $('#empty').classList.add('hidden');
    $('#dash').classList.remove('hidden');
    fillSelect();
    renderAll(true);
  }

  function loadAll(list) {
    state.matches = list;
    $('#matchSelect').innerHTML = list.map((it, i) => {
      const m = it.match, s = (t) => (m.teams[t] || {}).roundsWon;
      return `<option value="${i}">${esc(m.map)}, ${m.startedAt.toLocaleDateString('pt-BR')}, ${s('Blue')} x ${s('Red')}</option>`;
    }).join('');
    $('#matchGroup').classList.toggle('hidden', list.length < 2);
    load(list[0].match);
  }

  function init() {
    hydrateIcons();
    $('#btnTheme').addEventListener('click', () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark'));
    $('#playerSelect').addEventListener('change', (e) => setMe(e.target.value));
    $('#matchSelect').addEventListener('change', (e) => load(state.matches[+e.target.value].match));
    $('#timeline').addEventListener('click', (e) => {
      const b = e.target.closest('[data-round]'); if (!b) return;
      const i = +b.dataset.round;
      state.round = state.round === i ? null : i;
      renderTimeline(false); renderRound();
      if (state.charts.cKills) state.charts.cKills.update('none'); // só reavalia o destaque no mapa
    });
    $('#board').addEventListener('click', (e) => { const r = e.target.closest('[data-puuid]'); if (r) setMe(r.dataset.puuid); });
    VD.loader.bind({
      input: $('#fileInput'), dropTarget: document.body,
      onMatch: load, onError: (err) => toast(err.message),
      onDrag: (on) => document.body.classList.toggle('drag', on),
    });
    // Leitura automática da pasta de dados, sem pedir arquivos
    VD.loader.fromDirectory(DATA_DIRS).then(loadAll).catch((err) => { $('#emptyHint').textContent = err.message; });
  }

  VD.app = { load, setMe };
  document.addEventListener('DOMContentLoaded', init);
})(window.VD);
