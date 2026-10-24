/* =============================================================
 * main.js — CONTROLE DA INTERFACE
 * Renderiza placar, indicadores, tabela, mapa e gráficos a partir
 * do modelo normalizado por dataLoader.js. Não conhece o JSON bruto.
 * ============================================================= */
(function (VD) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = { match: null, matches: [], me: null, round: null, charts: {}, catalog: null, selectedTeamId: null, selectedTeamName: null, selectedSide: null, selectedPlayerId: null, overview: true, aggregatePlayers: [], activeEntry: null, loadToken: 0, kill: null };
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
  const me = () => (state.overview && state.aggregatePlayers.find((p) => p.puuid === state.me)) || state.match.players.find((p) => p.puuid === state.me);
  const pl = (id) => state.match.players.find((p) => p.puuid === id) || (state.aggregatePlayers || []).find((p) => p.puuid === id);
  const myTeam = () => me().team;
  const enemyTeam = () => (myTeam() === 'Blue' ? 'Red' : 'Blue');
  const tone = (team) => (team === myTeam() ? 'ally' : 'enemy');
  const teamPlayers = (t) => (state.overview && state.aggregatePlayers.length ? state.aggregatePlayers : state.match.players).filter((p) => p.team === t);
  const named = (id) => { const p = pl(id); if (!p) return '?'; const color = p.puuid === state.me ? 'accent' : tone(p.team); return '<b class="text-' + color + '">' + esc(p.name) + '</b>'; };

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
    let a = m.teams[my] || { roundsWon: 0, won: false }, e = m.teams[en] || { roundsWon: 0, won: false };
    let sideSummary = m.sides;
    let wins = a.won ? 1 : 0, losses = e.won ? 1 : 0;
    if (state.overview && state.matches.length) {
      a = { roundsWon: 0 }; e = { roundsWon: 0 };
      sideSummary = { ours: { Attacker: 0, Defender: 0 }, enemy: { Attacker: 0, Defender: 0 } };
      wins = 0; losses = 0;
      state.matches.forEach((entry) => {
        const ours = entry.teamSide, enemy = ours === 'Blue' ? 'Red' : 'Blue';
        a.roundsWon += (entry.match.teams[ours] || {}).roundsWon || 0;
        e.roundsWon += (entry.match.teams[enemy] || {}).roundsWon || 0;
        if ((entry.match.teams[ours] || {}).won) wins++; else losses++;
        ['Attacker', 'Defender'].forEach((role) => {
          sideSummary.ours[role] += (entry.match.sides[ours] || {})[role] || 0;
          sideSummary.enemy[role] += (entry.match.sides[enemy] || {})[role] || 0;
        });
      });
      a.won = wins >= losses; e.won = !a.won;
    }
    const sides = (t) => {
      const s = state.overview ? sideSummary[t === my ? 'ours' : 'enemy'] : (sideSummary[t] || {});
      return '<p class="mt-2 flex items-center gap-3 text-sm text-mute"><span class="flex items-center gap-1" title="Rounds ganhos no ataque">' + ic('sword') + (s.Attacker || 0) + '</span><span class="flex items-center gap-1" title="Rounds ganhos na defesa">' + ic('shield') + (s.Defender || 0) + '</span></p>';
    };
    const center = state.overview ? wins + 'V · ' + losses + 'D' : (a.won ? 'Vitória' : 'Derrota');
    const ourLabel = state.overview ? state.selectedTeamName : TEAM_PT[my];
    const enemyLabel = state.overview ? 'Equipes adversárias' : TEAM_PT[en];
    $('#hero').innerHTML = '<div class="grid items-center gap-4 border-b border-line pb-4 md:grid-cols-[1fr_auto_1fr]">' +
      '<div><p class="font-display text-xl font-semibold text-ally">' + esc(ourLabel || 'Equipe') + '</p><p class="font-display text-7xl font-bold leading-none text-ally" data-count="' + a.roundsWon + '">0</p>' +
      '<p class="text-xs text-mute">rounds ganhos' + (state.overview ? ' · ' + state.matches.length + ' partidas' : '') + '</p>' + sides(my) + '</div>' +
      '<p class="text-center font-display text-4xl font-bold ' + (a.won ? 'text-ally' : 'text-enemy') + '">' + center + '</p>' +
      '<div class="md:text-right"><p class="font-display text-xl font-semibold text-enemy">' + esc(enemyLabel) + '</p><p class="font-display text-7xl font-bold leading-none text-enemy" data-count="' + e.roundsWon + '">0</p>' +
      '<p class="text-xs text-mute">rounds ganhos</p><div class="md:flex md:justify-end">' + sides(en) + '</div></div></div>';
  }
  function renderKpis() {
    const p = me(), mates = teamPlayers(p.team);
    const cells = KPIS.map((k) => {
      const team = avg(mates, (x) => x[k.key]);
      return `<div class="px-3 py-1"><div class="flex items-center gap-1.5 text-mute" title="${k.title}">${ic(k.icon)}<span class="text-sm">${k.label}</span></div>
        <p class="font-display text-5xl font-bold text-accent" data-count="${p[k.key]}" data-dec="${k.dec}">0</p>
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
    if (!r) { el.innerHTML = '<p class="text-mute">Selecione um round para ver os abates aqui e no mapa. Depois clique em um abate para ver onde todos estavam naquele momento.</p>'; return; }
    const mine = state.match.players.find((p) => p.puuid === state.me);
    const my = mine && mine.perRound && mine.perRound[state.round];
    const facts = [];
    if (r.planted) facts.push('Spike plantada aos <b class="text-ink">' + mmss(r.plantMs || (r.plant && r.plant.time) || 0) + '</b> do round' + (r.plant && r.plant.planter ? ' por ' + named(r.plant.planter) : ''));
    if (r.defuseMs) facts.push('Spike desarmada aos <b class="text-ink">' + mmss(r.defuseMs) + '</b>' + (r.defuser ? ' por ' + named(r.defuser) : ''));
    if (my) facts.push('Jogador: gasto <b class="text-ink">' + fmt(my.spent) + '</b> · saldo <b class="text-ink">' + fmt(my.remaining) + '</b> · vivo <b class="text-ink">' + (my.aliveMs / 1000).toFixed(0) + 's</b>' + (my.deathMs != null ? ' (morreu aos ' + mmss(my.deathMs) + ')' : ' (sobreviveu)'));
    facts.push('Equipamento: <b class="text-ally">' + fmt(r.loadout[myTeam()]) + '</b> x <b class="text-enemy">' + fmt(r.loadout[enemyTeam()]) + '</b>');
    const head = `<p class="mb-2 flex flex-wrap items-center gap-x-3 font-semibold">Round ${r.num}<span class="flex items-center gap-1 font-normal text-mute">${ic(r.role === 'Attacker' ? 'sword' : 'shield')}${END_PT[r.type] || r.type}</span>${r.site ? `<span class="font-normal text-mute">Site ${esc(r.site)}</span>` : ''}</p>` +
      '<ul class="mb-2 space-y-0.5 text-xs text-mute">' + facts.map((f) => '<li>' + f + '</li>').join('') + '</ul>';
    const rows = r.kills.map((k, i) => {
      const on = state.kill === i;
      return `<li><button type="button" data-kill="${i}" title="Clique para ver a posição de todos neste abate" class="w-full rounded px-1 py-0.5 text-left hover:bg-bg ${on ? 'bg-accent/15 ring-1 ring-accent' : ''}">${mmss(k.t)} ${named(k.killer)} abateu ${named(k.victim)}` +
        ` <span class="rounded bg-bg px-1 text-[11px] text-mute">${esc(k.weaponName || '')}${k.dmgKind && !['Arma', 'Habilidade'].includes(k.dmgKind) ? ' · ' + esc(k.dmgKind) : ''}</span>` +
        `${k.assists.length ? `, assist: ${k.assists.map(named).join(', ')}` : ''}</button></li>`;
    }).join('');
    const fx = (r.effects || []).map((e) => named(e.puuid) + ': ' + Object.entries(e).filter(([key, v]) => key.endsWith('Effects') && v).map(([key, v]) => key.replace('Effects', '') + ' ' + esc(typeof v === 'object' ? JSON.stringify(v) : v)).join(', '));
    el.innerHTML = head + `<ul class="space-y-0.5">${rows || '<li class="text-mute">Sem abates registrados.</li>'}</ul>` +
      (fx.length ? '<p class="mt-2 text-xs text-mute">Efeitos de habilidade registrados:</p><ul class="text-xs text-mute">' + fx.map((f) => '<li>' + f + '</li>').join('') + '</ul>' : '');
  }

  function renderMapInsights() {
    const host = $('#mapInsights');
    if (!host || !state.match) return;
    const deaths = state.match.kills.filter((k) => k.victim === state.me);
    const weapons = new Map(), areas = new Map(), teamAreas = new Map();
    deaths.forEach((k) => {
      if (k.weaponId) weapons.set(k.weaponId, (weapons.get(k.weaponId) || 0) + 1);
      if (k.nx != null && k.ny != null) {
        const area = Math.round(k.nx * 10) * 10 + '% / ' + Math.round(k.ny * 10) * 10 + '%';
        areas.set(area, (areas.get(area) || 0) + 1);
      }
    });
    state.match.kills.filter((k) => k.victimTeam === myTeam() && k.nx != null && k.ny != null).forEach((k) => {
      const area = Math.round(k.nx * 10) * 10 + '% / ' + Math.round(k.ny * 10) * 10 + '%';
      teamAreas.set(area, (teamAreas.get(area) || 0) + 1);
    });
    const topWeapons = [...weapons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    const topAreas = [...areas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topTeamAreas = [...teamAreas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const head = deaths.reduce((n, k) => n + (k.hits?.head || 0), 0);
    const body = deaths.reduce((n, k) => n + (k.hits?.body || 0), 0);
    const legs = deaths.reduce((n, k) => n + (k.hits?.legs || 0), 0);
    const planterDeaths = deaths.filter((k) => k.bombPlanter === state.me).length;
    const lowLoadout = deaths.filter((k) => k.killerLoadout != null && k.killerLoadout <= 4000).length;
    const list = (items, empty) => items.length ? items.map(([name, count]) => '<li>' + esc(name) + ' <b class="text-ink">×' + count + '</b></li>').join('') : '<li>' + empty + '</li>';
    host.innerHTML = '<div><b class="text-ink">Mortes do jogador</b><p>' + deaths.length + ' na partida</p><p>Spike plantada no round da morte: ' + planterDeaths + '</p><p>Eliminador com loadout ≤ 4.000: ' + lowLoadout + '</p></div>' +
      '<div><b class="text-ink">Armas mais usadas contra o jogador</b><ul class="mt-1 space-y-1">' + list(topWeapons, 'Sem arma identificada') + '</ul><p class="mt-2">Acertos ligados às mortes: cabeça ' + head + ' · corpo ' + body + ' · pernas ' + legs + '</p></div>' +
      '<div><b class="text-ink">Locais de maior incidência · jogador</b><ul class="mt-1 space-y-1">' + list(topAreas, 'Coordenadas não disponíveis') + '</ul><p class="mt-2">Coordenadas aproximadas do mapa</p></div>' +
      '<div><b class="text-ally">Locais de maior incidência · equipe</b><ul class="mt-1 space-y-1">' + list(topTeamAreas, 'Sem coordenadas da equipe') + '</ul><p class="mt-2">Mortes de aliados</p></div>';
  }
  const iconUrls = (agent) => ['jpeg', 'webp', 'png', 'jpg'].map((e) => 'assets/characters/' + encodeURIComponent(agent) + '_icon.' + e);
  VD.nextImg = (img) => { // onerror: tenta a próxima extensão; no fim, esconde
    const list = (img.dataset.srcs || '').split('|'), i = (+img.dataset.i || 0) + 1;
    if (i < list.length) { img.dataset.i = i; img.src = list[i]; } else img.style.display = 'none';
  };
  function renderRoster() {
    const host = $('#mapRoster');
    const round = state.match.rounds[state.round == null ? state.match.rounds.length - 1 : state.round];
    if (!host || !round) return;
    const dead = new Set(round.kills.map((k) => k.victim));
    host.innerHTML = state.match.players.map((p) => {
      const agent = p.agent === 'KAY/O' ? 'KAYO' : p.agent.replaceAll('/', '');
      const color = p.puuid === state.me ? 'accent' : (p.team === myTeam() ? 'ally' : 'enemy');
      const out = dead.has(p.puuid);
      return '<div class="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded border" style="border-color:' + css(color) + ';background-color:' + css(color, 0.22) + '" title="' + esc(p.name) + ' · ' + esc(p.agent) + (out ? ' · eliminado' : '') + '">' +
        '<img src="' + iconUrls(agent)[0] + '" data-srcs="' + iconUrls(agent).join('|') + '" data-i="0" alt="' + esc(p.agent) + '" class="h-9 w-9 object-contain" onerror="VD.nextImg(this)" />' +
        (out ? '<span class="absolute inset-0 grid place-items-center bg-black/55 text-3xl font-bold text-white">×</span>' : '') + '</div>';
    }).join('');
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
    /* Legenda: o marcador herdava backgroundColor (alpha .18 / array) e ficava vazio.
     * Agora usa dataset.legendColor ou a cor da borda, sempre sólida. */
    if (!VD._legendBase) VD._legendBase = Chart.defaults.plugins.legend.labels.generateLabels;
    C.plugins.legend.labels.generateLabels = function (chart) {
      const items = VD._legendBase.call(this, chart);
      items.forEach((item) => {
        const ds = chart.data.datasets[item.datasetIndex];
        if (!ds || item.index != null) return;
        const solid = ds.legendColor || (typeof ds.borderColor === 'string' ? ds.borderColor : null) || (typeof ds.backgroundColor === 'string' ? ds.backgroundColor : null);
        if (solid) { item.fillStyle = solid; item.strokeStyle = solid; }
        else { item.fillStyle = css('accent'); item.strokeStyle = css('accent'); }
        item.lineWidth = 2;
      });
      return items;
    };
    Object.assign(C.plugins.tooltip, { backgroundColor: css('panel', 0.97), titleColor: css('ink'), bodyColor: css('ink'), borderColor: css('line'), borderWidth: 1, padding: 10 });
  }
  const make = (id, type, data, options = {}) => {
    state.charts[id] = VD.chartManager.create(id, type, data, options);
  };

  function chartRounds() {
    const m = state.match, my = myTeam(), en = enemyTeam();
    if (state.overview && state.matches.length) {
      const labels = state.matches.map((entry) => entry.match.map + ' · ' + entry.match.startedAt.toLocaleDateString('pt-BR'));
      let balance = 0;
      make('cRounds', 'bar', { labels, datasets: [
        { label: 'Rounds da equipe', data: state.matches.map((entry) => (entry.match.teams[entry.teamSide] || {}).roundsWon || 0), backgroundColor: css('ally', 0.65), borderRadius: 2, order: 2 },
        { label: 'Rounds adversários', data: state.matches.map((entry) => (entry.match.teams[entry.teamSide === 'Blue' ? 'Red' : 'Blue'] || {}).roundsWon || 0), backgroundColor: css('enemy', 0.65), borderRadius: 2, order: 2 },
        { type: 'line', label: 'Saldo acumulado', data: state.matches.map((entry) => { balance += ((entry.match.teams[entry.teamSide] || {}).roundsWon || 0) - ((entry.match.teams[entry.teamSide === 'Blue' ? 'Red' : 'Blue'] || {}).roundsWon || 0); return balance; }), borderColor: css('ink'), backgroundColor: css('ink'), stepped: true, pointRadius: 2, borderWidth: 2, yAxisID: 'y1', order: 1 },
      ] }, { interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 45 } }, y: { beginAtZero: true, ticks: { precision: 0 } }, y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } } } });
      return;
    }
    let cum = 0;
    make('cRounds', 'bar', {
      labels: m.rounds.map((r) => r.num),
      datasets: [
        { label: 'Equipamento da sua equipe (valor)', data: m.rounds.map((r) => r.loadout[my]), backgroundColor: css('ally', 0.55), borderRadius: 2, yAxisID: 'y', order: 2 },
        { label: 'Equipamento inimigo (valor)', data: m.rounds.map((r) => r.loadout[en]), backgroundColor: css('enemy', 0.55), borderRadius: 2, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Gasto da sua equipe', data: m.rounds.map((r) => r.spent[my]), borderColor: css('ally'), backgroundColor: css('ally'), borderDash: [5, 4], pointRadius: 3, pointStyle: 'rectRot', borderWidth: 2, yAxisID: 'y', order: 1 },
        { type: 'line', label: 'Gasto inimigo', data: m.rounds.map((r) => r.spent[en]), borderColor: css('enemy'), backgroundColor: css('enemy'), borderDash: [5, 4], pointRadius: 3, pointStyle: 'rectRot', borderWidth: 2, yAxisID: 'y', order: 1 },
        { type: 'line', label: 'Saldo de rounds', data: m.rounds.map((r) => (cum += r.winner === my ? 1 : -1)), borderColor: css('ink'), backgroundColor: css('ink'), stepped: true, pointRadius: 2, borderWidth: 2, yAxisID: 'y1', order: 1 },
      ],
    }, {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, title: { display: true, text: 'Round' } }, y: { beginAtZero: true, title: { display: true, text: 'Créditos (equipamento e gasto)' }, ticks: { callback: (v) => v / 1000 + 'k' } }, y1: { position: 'right', title: { display: true, text: 'Saldo de rounds' }, grid: { drawOnChartArea: false }, ticks: { precision: 0 } } },
      plugins: { tooltip: { callbacks: { title: (i) => 'Round ' + i[0].label } } },
    });
  }
  function chartEnd() {
    const m = state.match, my = myTeam(), en = enemyTeam(), types = ['Elimination', 'Detonate', 'Defuse'];
    const count = (team, type) => state.overview && state.matches.length
      ? state.matches.reduce((sum, entry) => {
        const side = team === my ? entry.teamSide : (entry.teamSide === 'Blue' ? 'Red' : 'Blue');
        return sum + entry.match.rounds.filter((r) => r.winner === side && r.type === type).length;
      }, 0)
      : m.rounds.filter((r) => r.winner === team && r.type === type).length;
    make('cEnd', 'doughnut', {
      labels: [...types.map((t) => (state.overview ? state.selectedTeamName : 'Sua equipe') + ': ' + END_PT[t]), ...types.map((t) => (state.overview ? 'Adversários' : 'Inimigos') + ': ' + END_PT[t])],
      datasets: [{ data: [...types.map((t) => count(my, t)), ...types.map((t) => count(en, t))], borderColor: css('panel'), borderWidth: 2,
        backgroundColor: [css('ally'), css('ally', 0.65), css('ally', 0.35), css('enemy'), css('enemy', 0.65), css('enemy', 0.35)] }],
    }, { cutout: '58%', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 6 } } } });
  }
  function chartPlayers() {
    const source = state.overview && state.aggregatePlayers.length ? state.aggregatePlayers : state.match.players;
    const ps = [...source].sort((a, b) => b.acs - a.acs);
    make('cPlayers', 'bar', {
      labels: ps.map((p) => p.name),
      datasets: [
        { label: 'ACS', data: ps.map((p) => Math.round(p.acs)), backgroundColor: ps.map((p) => css(p.puuid === state.me ? 'accent' : tone(p.team), p.puuid === state.me ? 1 : 0.5)), yAxisID: 'y', order: 2 },
        { type: 'line', label: 'K/D', data: ps.map((p) => +p.kd.toFixed(2)), showLine: false, pointStyle: 'rectRot', pointRadius: 6, borderColor: css('ink'), backgroundColor: css('ink'), yAxisID: 'y1', order: 1 },
        { type: 'line', label: 'Tempo vivo médio (s/round)', data: ps.map((p) => +(p.aliveMs / Math.max(1, p.rounds) / 1000).toFixed(1)), showLine: false, pointStyle: 'triangle', pointRadius: 6, borderColor: css('accent'), backgroundColor: css('accent'), yAxisID: 'y2', order: 1 },
      ],
    }, {
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 40 } }, y: { beginAtZero: true, title: { display: true, text: 'ACS' } },
        y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'K/D' }, grid: { drawOnChartArea: false } },
        y2: { position: 'right', beginAtZero: true, title: { display: true, text: 'Tempo vivo (s)' }, grid: { drawOnChartArea: false } } },
      plugins: { tooltip: { callbacks: { afterBody: (items) => { const p = ps[items[0].dataIndex]; return p ? ['Abates/Mortes/Assist.: ' + p.kills + '/' + p.deaths + '/' + p.assists, 'Vivo em média ' + (p.aliveMs / Math.max(1, p.rounds) / 1000).toFixed(1) + 's por round'] : []; } } } },
    });
  }

  function chartRadar() {
    const p = me(), all = state.overview && state.aggregatePlayers.length ? state.aggregatePlayers : state.match.players;
    const axes = [['ACS', 'acs'], ['ADR', 'adr'], ['HS%', 'hs'], ['KAST', 'kast'], ['K/D', 'kd'], ['PA', 'fk']];
    const max = Object.fromEntries(axes.map(([, k]) => [k, Math.max(...all.map((x) => x[k])) || 1]));
    const norm = (f) => axes.map(([, k]) => Math.round((f(k) / max[k]) * 100));
    const ds = (label, c, data, w) => ({ label, data, borderColor: css(c), backgroundColor: css(c, 0.18), borderWidth: w, pointRadius: 2 });
    make('cRadar', 'radar', {
      labels: axes.map(([l]) => l),
      datasets: [ds(p.name, 'accent', norm((k) => p[k]), 3), ds('Sua equipe', 'ally', norm((k) => avg(teamPlayers(myTeam()), (x) => x[k])), 1.5), ds('Inimigos', 'enemy', norm((k) => avg(teamPlayers(enemyTeam()), (x) => x[k])), 1.5)],
    }, { scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: css('line', 0.6) }, angleLines: { color: css('line', 0.6) }, pointLabels: { color: css('ink'), font: { size: 11 } } } },
      plugins: { tooltip: { callbacks: { label: (c) => { const [name, key] = axes[c.dataIndex]; const who = c.datasetIndex === 0 ? p[key] : avg(teamPlayers(c.datasetIndex === 1 ? myTeam() : enemyTeam()), (x) => x[key]); return c.dataset.label + ' · ' + name + ': ' + fmt(who, key === 'kd' ? 2 : 0) + ' (' + c.raw + '% do melhor)'; } } } } });
  }

  function chartPlayerRounds() {
    const p = me();
    if (state.overview && state.matches.length) {
      const series = state.matches.map((entry) => {
        const player = entry.match.players.find((x) => x.puuid === state.me);
        return player || { kills: 0, deaths: 0, damage: 0 };
      });
      make('cPlayerRounds', 'bar', {
        labels: state.matches.map((entry) => entry.match.map + ' · ' + entry.match.startedAt.toLocaleDateString('pt-BR')),
        datasets: [
          { label: 'Abates', data: series.map((x) => x.kills), backgroundColor: css('ally'), yAxisID: 'y', order: 2 },
          { label: 'Mortes', data: series.map((x) => -x.deaths), backgroundColor: css('enemy'), yAxisID: 'y', order: 2 },
          { type: 'line', label: 'Dano total', data: series.map((x) => x.damage), borderColor: css('ink'), backgroundColor: css('ink'), tension: 0.35, pointRadius: 2, borderWidth: 2, yAxisID: 'y1', order: 1 },
        ],
      }, { interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 45 } }, y: { beginAtZero: true }, y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } } } });
      return;
    }
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
      plugins: { tooltip: { callbacks: { title: (i) => 'Round ' + i[0].label, label: (c) => c.dataset.label + ': ' + Math.abs(c.raw) } } },
    });
  }
  /* Mapa: o canvas cobre a imagem; eixos vão de 0 a 1 (mesma escala da calibração do dataLoader). */
  function chartKills() {
    const m = state.match, meta = m.mapMeta, card = $('#mapCard');
    card.classList.toggle('hidden', !meta);
    if (!meta) return;
    const mapImage = $('#mapImg');
    const urls = (meta.images || [meta.image]).map((u) => new URL(u, document.baseURI).href);
    if (mapImage.dataset.list !== urls.join('|')) {
      mapImage.dataset.list = urls.join('|'); mapImage.dataset.i = '0';
      mapImage.onerror = () => {
        const i = (+mapImage.dataset.i || 0) + 1;
        if (i < urls.length) { mapImage.dataset.i = i; mapImage.src = urls[i]; }
        else toast('Imagem do mapa não encontrada em assets/maps/ (' + m.map + ').');
      };
      mapImage.src = urls[0];
    }
    mapImage.onload = () => redrawMap(); // sempre com o estado atual (não com o closure antigo)

    const selected = (key) => { const el = document.querySelector('[data-map-filter="' + key + '"]'); return !el || el.checked; };
    const sel = () => (state.round == null ? null : m.rounds[state.round].num);
    const hit = (raw) => sel() == null || !!(raw && raw.r === sel()); // raw pode vir vazio (legenda/estilo do dataset)
    const pts = (f) => m.kills.filter((k) => Number.isFinite(k.nx) && Number.isFinite(k.ny) && f(k)).map((k) => VD.mapPoints.point(mapImage, k.nx, k.ny, { ...k, r: k.round, eventType: 'kill' })).filter(Boolean);
    const ds = (label, data, color, radius, extra = {}) => ({ label, data, borderWidth: 1,
      backgroundColor: (c) => css(color, hit(c.raw) ? 0.9 : 0.12), borderColor: (c) => css(color, hit(c.raw) ? 1 : 0.15),
      pointRadius: (c) => (hit(c.raw) ? radius + (sel() == null ? 0 : 2) : radius - 1), ...extra });
    const flag = (key) => { const el = document.querySelector('[data-map-filter="' + key + '"]'); return !!el && el.checked; };
    const killsOn = selected('kills'), heatOn = selected('heat'), plantsOn = selected('plants'), killerOn = flag('killer');
    const focus = selected('player');
    const inFocus = (k) => !focus || k.killer === state.me || k.victim === state.me;
    const killPts = (f) => killsOn ? pts((k) => inFocus(k) && f(k)) : [];
    const heatPts = (f) => heatOn ? pts((k) => inFocus(k) && (sel() == null || k.round === sel()) && f(k)) : [];
    const plantPts = plantsOn ? m.rounds.filter((r) => r.plant && Number.isFinite(r.plant.nx) && Number.isFinite(r.plant.ny)).map((r) => VD.mapPoints.point(mapImage, r.plant.nx, r.plant.ny, {
      x: r.plant.nx, y: r.plant.ny, r: r.num, eventType: 'plant', planter: r.plant.planter, site: r.site, time: r.plant.time, outcome: r.type,
    })).filter(Boolean) : [];
    const killerPts = killerOn ? m.kills.filter((k) => Number.isFinite(k.killerNx) && inFocus(k)).map((k) => VD.mapPoints.point(mapImage, k.killerNx, k.killerNy, { ...k, r: k.round, eventType: 'killerpos' })).filter(Boolean) : [];
    const ev = state.round != null && state.kill != null ? ((m.rounds[state.round] || {}).kills || [])[state.kill] : null;
    const posPts = ev ? ev.positions.map((q) => VD.mapPoints.point(mapImage, q.nx, q.ny, {
      r: ev.round, eventType: 'pos', puuid: q.puuid, t: ev.t, tone: q.puuid === state.me ? 'accent' : (q.team === myTeam() ? 'ally' : 'enemy'),
      role: q.puuid === ev.killer ? 'Eliminador' : q.puuid === ev.victim ? 'Vítima' : 'Em campo' })).filter(Boolean) : [];
    const linePts = ev && Number.isFinite(ev.killerNx) ? [VD.mapPoints.point(mapImage, ev.killerNx, ev.killerNy, { eventType: 'line' }), VD.mapPoints.point(mapImage, ev.nx, ev.ny, { eventType: 'line' })].filter(Boolean) : [];
    make('cKills', 'scatter', {
      datasets: [
        ds('Calor: equipe', heatPts((k) => k.victimTeam === myTeam() && k.victim !== state.me), 'ally', 16, { backgroundColor: () => css('ally', 0.18), borderColor: () => css('ally', 0.08), pointRadius: 16 }),
        ds('Calor: inimigos', heatPts((k) => k.victimTeam !== myTeam()), 'enemy', 16, { backgroundColor: () => css('enemy', 0.18), borderColor: () => css('enemy', 0.08), pointRadius: 16 }),
        ds('Calor: jogador', heatPts((k) => k.victim === state.me), 'accent', 19, { backgroundColor: () => css('accent', 0.22), borderColor: () => css('accent', 0.08), pointRadius: 19 }),
        ds('Abates aliados', killPts((k) => k.killerTeam === myTeam() && k.killer !== state.me), 'ally', 4),
        ds('Abates inimigos', killPts((k) => k.killerTeam !== myTeam()), 'enemy', 4),
        ds('Abates do jogador', killPts((k) => k.killer === state.me), 'accent', 6),
        ds('Spike plantada', plantPts, 'ink', 7, { pointStyle: 'triangle' }),
        ds('Posição do eliminador', killerPts, 'ink', 5, { pointStyle: 'rectRot', backgroundColor: (c) => css((c.raw || {}).killerTeam === myTeam() ? 'ally' : 'enemy', hit(c.raw) ? 0.25 : 0.05), borderColor: (c) => css('ink', hit(c.raw) ? 0.9 : 0.2), borderWidth: 2 }),
        { label: 'Linha do abate', data: linePts, showLine: true, borderColor: css('ink', 0.7), borderDash: [5, 4], borderWidth: 2, pointRadius: 0, order: -2 },
        { label: 'Posições no abate', data: posPts, order: -1, borderWidth: 2,
          backgroundColor: (c) => css((c.raw || {}).tone || 'ink', 0.95), borderColor: (c) => css((c.raw || {}).role === 'Em campo' ? 'panel' : 'ink', 1),
          pointStyle: (c) => ((c.raw || {}).role === 'Vítima' ? 'crossRot' : (c.raw || {}).role === 'Eliminador' ? 'rectRot' : 'circle'),
          pointRadius: (c) => ((c.raw || {}).role === 'Em campo' ? 6 : 9) },
      ],
    }, {
      animation: false,
      layout: { padding: 0 },
      scales: { x: { min: 0, max: 1, display: false }, y: { min: 0, max: 1, reverse: true, display: false } },
      plugins: { legend: { display: false }, tooltip: { filter: (item) => item.raw && item.raw.eventType !== 'line', callbacks: {
        title: (items) => { const p = items[0].raw; if (p.eventType === 'pos') return 'Posição no abate · Round ' + p.r + ' · ' + mmss(p.t); if (p.eventType === 'killerpos') return 'Posição do eliminador · Round ' + p.r + ' · ' + mmss(p.t); return 'Round ' + p.r + (p.eventType === 'kill' ? ' · ' + mmss(p.t) : p.time ? ' · spike em ' + mmss(p.time) : ''); },
        label: (c) => {
          const p = c.raw;
          if (p.eventType === 'pos') { const who = pl(p.puuid) || {}; return [(who.name || '?') + ' · ' + (who.agent || ''), p.role]; }
          if (p.eventType === 'killerpos') return ['Eliminador: ' + ((pl(p.killer) || {}).name || '?'), 'Vítima: ' + ((pl(p.victim) || {}).name || '?'), 'Com: ' + (p.weaponName || '?') + (p.dmgKind ? ' (' + p.dmgKind + ')' : '')];
          if (p.eventType === 'plant') { const result = p.outcome === 'Detonate' ? 'Spike detonada' : p.outcome === 'Defuse' ? 'Spike desarmada' : 'Spike não detonada'; return ['Spike plantada', 'Plantador: ' + ((pl(p.planter) || {}).name || 'não identificado'), p.site ? 'Local: site ' + p.site : 'Local: não informado', 'Resultado: ' + result]; }
          const killer = pl(p.killer), victim = pl(p.victim);
          return ['Morte: ' + ((victim || {}).name || 'jogador'), 'Eliminador: ' + ((killer || {}).name || 'não identificado'),
            'Arma/dano: ' + (p.weaponName || 'não informada') + (p.dmgKind ? ' (' + p.dmgKind + ')' : ''), 'Acertos: cabeça ' + (p.hits?.head || 0) + ' · corpo ' + (p.hits?.body || 0) + ' · pernas ' + (p.hits?.legs || 0), p.killerLoadout != null ? 'Loadout do eliminador: ' + fmt(p.killerLoadout) : 'Loadout não informado',
            p.assists.length ? 'Assistências: ' + p.assists.map((id) => ((pl(id) || {}).name || '?')).join(', ') : 'Sem assistência registrada'];
        },
      } } },
    });
  }
  /* Gráfico em aba escondida (display:none) nasce com tamanho 0 e fica em branco.
   * Por isso só desenhamos os visíveis; os demais ficam em `dirty` e são
   * desenhados por syncCharts() quando a aba for aberta (dashboardUI.js chama). */
  const CHART_FNS = { cRounds: chartRounds, cEnd: chartEnd, cPlayers: chartPlayers, cRadar: chartRadar, cPlayerRounds: chartPlayerRounds, cKills: chartKills };
  let dirty = new Set();
  const visible = (id) => { const c = document.getElementById(id); return !!c && c.getClientRects().length > 0; };
  const registerChart = (id, fn) => { CHART_FNS[id] = fn; };
  const onRender = (fn) => { renderHooks.push(fn); };
  function syncCharts() {
    if (!state.match) return;
    themeCharts();
    [...dirty].forEach((id) => {
      if (!visible(id)) return;
      dirty.delete(id);
      try { CHART_FNS[id](); } catch (err) { console.error('[VavaBoard] erro no gráfico ' + id + ':', err); }
    });
    VD.chartManager.resizeAll();
  }
  function redrawMap() { // refaz só o mapa (filtros, round, imagem carregada)
    if (!state.match) return;
    if (!visible('cKills')) { dirty.add('cKills'); return; }
    try { chartKills(); } catch (err) { console.error('[VavaBoard] erro no mapa:', err); }
  }
  function renderCharts() {
    VD.chartManager.destroyAll();
    state.charts = {};
    dirty = new Set(Object.keys(CHART_FNS));
    syncCharts();
  }

  /* ---- Orquestração ---- */
  const renderHooks = [];
  /* Cada etapa roda isolada: se uma falhar, as outras continuam e o erro aparece no console/toast. */
  function renderAll(animate) {
    const steps = [renderMeta, renderHero, renderKpis, () => renderTimeline(animate), renderRound, renderRoster, renderMapInsights, renderBoard, renderCharts, ...renderHooks];
    const failed = [];
    steps.forEach((fn) => { try { fn(); } catch (err) { failed.push(fn.name || 'etapa'); console.error('[VavaBoard] erro em ' + (fn.name || 'etapa') + ':', err); } });
    try {
      const titles = { cRounds: state.overview ? 'Rounds por partida' : 'Economia e saldo', cEnd: state.overview ? 'Resultados das partidas' : 'Vitórias por tipo', cPlayerRounds: state.overview ? 'Desempenho por partida' : 'Round a round do jogador' };
      Object.keys(titles).forEach((id) => { const canvas = document.getElementById(id); const heading = canvas && canvas.closest('article').querySelector('h2'); if (heading) heading.textContent = titles[id]; });
    } catch (err) { console.error(err); }
    document.querySelectorAll('[data-count]').forEach(countUp);
    if (failed.length) toast('Parte do painel falhou (' + failed.join(', ') + '). Veja o console (F12).');
  }

  function fillSelect() {
    const m = state.match, sel = $('#playerSelect');
    if (state.catalog && state.selectedTeamId) {
      const players = VD.loader.playersForTeam(state.catalog, state.selectedTeamId);
      sel.innerHTML = players.map((p) => {
        const agent = VD.loader.AGENTS[p.agentId] || 'Agente';
        return '<option value="' + esc(p.puuid) + '">' + esc(p.name) + ' #' + esc(p.tag) + ' (' + esc(agent) + ')</option>';
      }).join('');
    } else {
      const team = state.selectedSide || myTeam();
      sel.innerHTML = m.players.filter((p) => p.team === team).map((p) => '<option value="' + esc(p.puuid) + '">' + esc(p.name) + ' #' + esc(p.tag) + ' (' + esc(p.agent) + ')</option>').join('');
    }
    sel.disabled = false;
    sel.value = state.me;
  }

  function setMe(id) {
    state.me = id; store.set('vd-me', id); $('#playerSelect').value = id;
    renderAll(false);
  }

  function load(match) {
    state.match = match; state.round = null; state.kill = null;
    const saved = store.get('vd-me');
    const preferred = state.selectedPlayerId || saved;
    const roster = match.players.filter((p) => !state.selectedSide || p.team === state.selectedSide);
    state.me = match.players.some((p) => p.puuid === preferred) ? preferred : (roster[0] || match.players[0]).puuid;
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

  function teamOptions(catalog) {
    state.catalog = catalog;
    const teams = new Map();
    catalog.files.forEach((file) => file.teams.forEach((team) => teams.set(team.id, team.name)));
    const select = $('#teamSelect');
    select.innerHTML = '<option value="">Escolha uma equipe</option>' + [...teams.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([id, name]) => '<option value="' + esc(id) + '">' + esc(name) + '</option>').join('');
    const saved = store.get('vd-team');
    if (teams.has(saved)) { select.value = saved; chooseTeam(saved); }
  }

  function chooseTeam(teamId) {
    state.loadToken++;
    state.selectedTeamId = teamId || null;
    state.matches = []; state.aggregatePlayers = [];
    $('#matchTabs').classList.add('hidden'); $('#matchGroup').classList.add('hidden');
    $('#empty').classList.remove('hidden'); $('#dash').classList.add('hidden');
    state.selectedTeamName = state.catalog.files.flatMap((f) => f.teams).find((t) => t.id === teamId)?.name || '';
    state.selectedPlayerId = null;
    $('#playerSelect').disabled = true;
    if (!teamId) { $('#playerSelect').innerHTML = '<option>Selecione uma equipe primeiro</option>'; return; }
    store.set('vd-team', teamId);
    const members = VD.catalogTools.playersForTeam(state.catalog, teamId);
    $('#playerSelect').innerHTML = '<option value="">Selecione o jogador</option>' + members.map((p) => {
      const agent = VD.loader.AGENTS[p.agentId] || 'Agente';
      return '<option value="' + esc(p.puuid) + '">' + esc(p.name) + ' #' + esc(p.tag) + ' · ' + esc(agent) + '</option>';
    }).join('');
    $('#playerSelect').disabled = !members.length;
    $('#emptyHint').textContent = members.length + ' jogadores registrados em ' + state.selectedTeamName + '.';
    if (members.length) {
      const savedPlayer = store.get('vd-me');
      const preferred = members.some((player) => player.puuid === savedPlayer) ? savedPlayer : members[0].puuid;
      $('#playerSelect').value = preferred;
      choosePlayer(preferred);
    }
  }

  function buildAggregate() {
    const byId = new Map();
    const fields = ['score', 'kills', 'deaths', 'assists', 'rounds', 'damage', 'headshots', 'bodyshots', 'legshots', 'fk', 'fd', 'mk', 'kastRounds', 'aliveMs'];
    state.matches.forEach((entry) => {
      entry.match.players.forEach((player) => {
        const role = player.team === entry.teamSide ? 'ours' : 'enemy';
        if (!byId.has(player.puuid)) byId.set(player.puuid, { ...player, score: 0, kills: 0, deaths: 0, assists: 0, rounds: 0, damage: 0, headshots: 0, bodyshots: 0, legshots: 0, fk: 0, fd: 0, mk: 0, kastRounds: 0, aliveMs: 0, taken: { head: 0, body: 0, legs: 0 }, casts: {}, _role: role });
        const row = byId.get(player.puuid);
        if (row._role !== role) return;
        fields.forEach((key) => { row[key] += Number(player[key] || 0); });
        Object.keys(row.taken).forEach((key) => { row.taken[key] += Number((player.taken || {})[key] || 0); });
        Object.entries(player.casts || {}).forEach(([key, v]) => { row.casts[key] = (row.casts[key] || 0) + Number(v || 0); });
      });
    });
    const rows = [...byId.values()];
    rows.forEach((p) => {
      p.team = p._role === 'ours' ? state.selectedSide : (state.selectedSide === 'Blue' ? 'Red' : 'Blue');
      p.acs = p.rounds ? p.score / p.rounds : 0; p.adr = p.rounds ? p.damage / p.rounds : 0;
      const shots = p.headshots + p.bodyshots + p.legshots;
      p.hs = shots ? p.headshots / shots * 100 : 0; p.kd = p.deaths ? p.kills / p.deaths : p.kills;
      p.kast = p.rounds ? p.kastRounds / p.rounds * 100 : 0;
    });
    state.aggregatePlayers = rows;
  }

  function ensureMapLayerVisible() {
    const layers = ['kills', 'plants', 'heat'].map((key) => document.querySelector('[data-map-filter="' + key + '"]'));
    if (layers.some((input) => input && input.checked)) return;
    const kills = document.querySelector('[data-map-filter="kills"]');
    if (kills) { kills.checked = true; store.set('vd-map-filter-kills', '1'); }
  }
  async function choosePlayer(puuid) {
    if (!puuid || !state.selectedTeamId) return;
    state.selectedPlayerId = puuid; state.me = puuid;
    const requestToken = ++state.loadToken;
    ensureMapLayerVisible();
    $('#emptyHint').textContent = 'Carregando as partidas de ' + state.selectedTeamName + '…';
    try {
      const all = await VD.loader.loadTeam(state.catalog, state.selectedTeamId);
      if (requestToken !== state.loadToken || state.selectedPlayerId !== puuid) return;
      all.forEach((entry) => { entry.teamSide = entry.teamSides[state.selectedTeamId] || entry.teamSide; });
      const played = all.filter((entry) => entry.match.players.some((p) => p.puuid === puuid && p.team === entry.teamSide));
      if (!played.length) throw new Error('Jogador não encontrado nas partidas da equipe.');
      state.matches = played; state.selectedSide = played[0].teamSide;
      buildAggregate(); state.activeEntry = state.matches[0]; state.overview = true;
      const sel = $('#matchSelect');
      sel.innerHTML = state.matches.map((entry, i) => '<option value="' + i + '">' + esc(entry.match.map) + ' · ' + entry.match.startedAt.toLocaleDateString('pt-BR') + ' · ' + entry.match.teams.Blue.roundsWon + ' x ' + entry.match.teams.Red.roundsWon + '</option>').join('');
      $('#matchGroup').classList.toggle('hidden', state.matches.length < 2);
      $('#empty').classList.add('hidden'); $('#dash').classList.remove('hidden');
      load(state.activeEntry.match); renderMatchTabs();
    } catch (err) {
      if (requestToken !== state.loadToken) return;
      toast(err.message);
      $('#empty').classList.remove('hidden'); $('#dash').classList.add('hidden');
      $('#emptyHint').textContent = err.message;
    }
  }

  function renderMatchTabs() {
    const host = $('#matchTabs');
    if (!host) return;
    host.innerHTML = '';
    const add = (label, entry, overview) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.className = 'shrink-0 border-b-2 px-3 py-2 text-sm ' + ((overview ? state.overview : (!state.overview && state.activeEntry === entry)) ? 'border-accent text-ink' : 'border-transparent text-mute');
      button.addEventListener('click', () => {
        state.overview = overview;
        if (entry) { state.activeEntry = entry; state.selectedSide = entry.teamSide; load(entry.match); }
        else { state.activeEntry = state.matches[0]; state.selectedSide = state.activeEntry.teamSide; load(state.activeEntry.match); }
        renderMatchTabs();
      });
      host.appendChild(button);
    };
    add('Visão geral', null, true);
    state.matches.forEach((entry) => add(entry.match.map + ' · ' + entry.match.startedAt.toLocaleDateString('pt-BR'), entry, false));
    host.classList.remove('hidden');
    const matchSelect = $('#matchSelect'); if (matchSelect && state.activeEntry) matchSelect.value = String(state.matches.indexOf(state.activeEntry));
  }
  function init() {
    hydrateIcons();
    $('#teamSelect').addEventListener('change', (e) => chooseTeam(e.target.value));
    $('#playerSelect').addEventListener('change', (e) => choosePlayer(e.target.value));
    $('#matchSelect').addEventListener('change', (e) => { const entry = state.matches[+e.target.value]; if (entry) { state.overview = false; state.activeEntry = entry; state.selectedSide = entry.teamSide; load(entry.match); renderMatchTabs(); } });
    document.querySelectorAll('[data-map-filter]').forEach((el) => {
      const saved = store.get('vd-map-filter-' + el.dataset.mapFilter);
      if (saved !== null) el.checked = saved === '1';
      el.addEventListener('change', () => {
        store.set('vd-map-filter-' + el.dataset.mapFilter, el.checked ? '1' : '0');
        redrawMap();
      });
    });
    ensureMapLayerVisible(); // filtros salvos com tudo desmarcado deixavam o mapa vazio
    $('#timeline').addEventListener('click', (e) => {
      const b = e.target.closest('[data-round]'); if (!b) return;
      const i = +b.dataset.round;
      state.round = state.round === i ? null : i; state.kill = null;
      renderTimeline(false); renderRound(); renderRoster();
      redrawMap(); // refaz o mapa (destaque do round e mapa térmico)
    });
    $('#roundDetail').addEventListener('click', (e) => {
      const b = e.target.closest('[data-kill]'); if (!b) return;
      const i = +b.dataset.kill; state.kill = state.kill === i ? null : i;
      renderRound(); redrawMap();
    });
    $('#board').addEventListener('click', (e) => { const r = e.target.closest('[data-puuid]'); if (r) setMe(r.dataset.puuid); });
    VD.loader.bind({
      input: $('#fileInput'), dropTarget: document.body,
      onMatch: (match) => { state.overview = false; state.matches = []; state.aggregatePlayers = []; state.selectedSide = null; state.selectedTeamId = null; state.selectedPlayerId = null; $('#matchTabs').classList.add('hidden'); load(match); }, onError: (err) => toast(err.message),
      onDrag: (on) => document.body.classList.toggle('drag', on),
    });
    // Leitura automática da pasta de dados, sem pedir arquivos
    VD.loader.init(DATA_DIRS[0]).then(() => VD.loader.catalog(DATA_DIRS)).then(teamOptions).catch((err) => { console.error('[VavaBoard]', err); $('#emptyHint').textContent = err.message; });
  }

  VD.ctx = { state, me, myTeam, enemyTeam, tone, teamPlayers, css, esc, fmt, mmss, avg, ic, make, named, pl, END_PT, ROLE_PT, TEAM_PT };
  VD.app = { load, setMe, syncCharts, redrawMap, registerChart, onRender };
  document.addEventListener('DOMContentLoaded', init);
})(window.VD);
