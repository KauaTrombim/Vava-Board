/* =============================================================
 * extraCharts.js — gráficos e tabelas EXTRAS (economia, tempo vivo,
 * perfil, equipe, acertos no corpo, rounds da equipe, habilidades).
 * Usa o que main.js expõe em VD.ctx / VD.app. Carregar DEPOIS do main.js.
 * Para adicionar um gráfico: crie a função e chame A.registerChart('idDoCanvas', fn).
 * Para adicionar uma tabela/bloco HTML: A.onRender(fn).
 * ============================================================= */
(function (VD) {
  'use strict';
  const A = VD.app, X = VD.ctx;
  if (!A || !X) { console.error('[VavaBoard] extraCharts.js precisa carregar depois do main.js'); return; }
  const { state, css, esc, fmt, mmss, avg, make } = X;
  const $ = (s) => document.querySelector(s);

  /* Unidades de análise: no modo "Visão geral" todas as partidas da equipe; senão, só a partida aberta. */
  const units = () => (state.overview && state.matches.length
    ? state.matches.map((e) => ({ match: e.match, side: e.teamSide }))
    : [{ match: state.match, side: X.myTeam() }]);
  const playerIn = (match) => match.players.find((p) => p.puuid === state.me);
  const AXES = [['ACS', 'acs', 0], ['ADR', 'adr', 0], ['HS%', 'hs', 0], ['KAST', 'kast', 0], ['K/D', 'kd', 2], ['PA', 'fk', 0]]; // sentido horário
  const sec = (ms) => +(ms / 1000).toFixed(1);

  /* ---------- Economia do jogador x tempo vivo ---------- */
  function chartPlayerEco() {
    const rows = [];
    units().forEach((u) => { const p = playerIn(u.match); if (p) u.match.rounds.forEach((r, i) => rows.push({ r, pr: p.perRound[i] || {}, map: u.match.map })); });
    const label = (x) => (state.overview ? x.map.slice(0, 3) + ' ' + x.r.num : x.r.num);
    make('cPlayerEco', 'bar', {
      labels: rows.map(label),
      datasets: [
        { label: 'Gasto no round', data: rows.map((x) => x.pr.spent || 0), backgroundColor: css('ally', 0.7), legendColor: css('ally'), borderRadius: 2, yAxisID: 'y', order: 2 },
        { label: 'Saldo restante', data: rows.map((x) => x.pr.remaining || 0), backgroundColor: css('accent', 0.45), legendColor: css('accent'), borderRadius: 2, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Tempo vivo (s)', data: rows.map((x) => sec(x.pr.aliveMs || 0)), borderColor: css('ink'), backgroundColor: css('ink'), legendColor: css('ink'), borderWidth: 2, tension: 0.25,
          pointRadius: 4, pointStyle: rows.map((x) => (x.pr.deathMs != null ? 'crossRot' : 'circle')),
          pointBorderColor: rows.map((x) => css(x.pr.deathMs != null ? 'enemy' : 'ally')), pointBackgroundColor: rows.map((x) => css(x.pr.deathMs != null ? 'enemy' : 'ally')), yAxisID: 'y1', order: 1 },
      ],
    }, {
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, title: { display: true, text: 'Round' }, ticks: { maxTicksLimit: 30, maxRotation: 45 } },
        y: { beginAtZero: true, title: { display: true, text: 'Créditos' }, ticks: { callback: (v) => v / 1000 + 'k' } },
        y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'Tempo vivo (s)' }, grid: { drawOnChartArea: false } },
      },
      plugins: { tooltip: { callbacks: {
        title: (i) => { const x = rows[i[0].dataIndex]; return 'Round ' + x.r.num + (state.overview ? ' · ' + x.map : ''); },
        afterBody: (i) => { const x = rows[i[0].dataIndex]; return ['Equipamento: ' + fmt(x.pr.loadout || 0), 'Abates: ' + (x.pr.k || 0), x.pr.deathMs != null ? 'Morreu aos ' + mmss(x.pr.deathMs) : 'Sobreviveu ao round']; },
      } } },
    });
  }

  /* ---------- Créditos ganhos por ações (regras informadas) ---------- */
  const RULES = { win: 3000, loss: 1900, ot: 5000, kill: 200, plant: 300 };
  function renderCredits() {
    const host = $('#creditsBody'); if (!host || !state.match) return;
    const n = { win: 0, loss: 0, ot: 0, kill: 0, plant: 0 }; let spent = 0;
    units().forEach((u) => {
      const p = playerIn(u.match); if (!p) return;
      u.match.rounds.forEach((r, i) => {
        const pr = p.perRound[i] || {};
        if (r.num > 24) n.ot++; else if (r.winner === p.team) n.win++; else n.loss++;
        n.kill += pr.k || 0; spent += pr.spent || 0;
        const role = r.winner === p.team ? r.role : (r.role === 'Attacker' ? 'Defender' : 'Attacker');
        if (r.planted && role === 'Attacker') n.plant++;
      });
    });
    const lines = [['Vitória de round', n.win, RULES.win], ['Derrota de round', n.loss, RULES.loss], ['Impulso de prorrogação', n.ot, RULES.ot],
      ['Eliminações', n.kill, RULES.kill], ['Spike plantada (ataque)', n.plant, RULES.plant]];
    const total = lines.reduce((s, [, q, v]) => s + q * v, 0);
    host.innerHTML = '<table class="w-full text-left text-sm"><thead class="text-mute"><tr><th class="py-1 font-normal">Origem</th><th class="px-2 text-right font-normal">Qtd.</th><th class="px-2 text-right font-normal">Valor</th><th class="text-right font-normal">Total</th></tr></thead><tbody>' +
      lines.map(([name, q, v]) => '<tr class="border-t border-line/60"><td class="py-1.5">' + name + '</td><td class="px-2 text-right">' + q + '</td><td class="px-2 text-right text-mute">' + fmt(v) + '</td><td class="text-right font-bold text-ally">' + fmt(q * v) + '</td></tr>').join('') +
      '</tbody><tfoot><tr class="border-t border-line"><td class="py-1.5 font-bold" colspan="3">Créditos ganhos (regras)</td><td class="text-right font-display text-xl font-bold text-accent">' + fmt(total) + '</td></tr>' +
      '<tr><td class="py-1 text-mute" colspan="3">Créditos gastos (dados da partida)</td><td class="text-right font-bold text-enemy">' + fmt(spent) + '</td></tr></tfoot></table>' +
      '<p class="mt-2 text-xs text-mute">Estimativa pelas regras: 3.000 por vitória, 1.900 por derrota, 5.000 de impulso em cada round de prorrogação (no lugar do bônus de vitória/derrota), 200 por eliminação e 300 por spike plantada nos rounds em que a equipe atacou.</p>';
  }

  /* ---------- Corpo: onde mais acertou / recebeu ---------- */
  const rgb = (name) => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim().split(/\s+/).map(Number);
  function heat(t) { // 0 = frio (azul), .5 = roxo, 1 = quente (vermelho)
    const [a, b, c] = t < 0.5 ? [rgb('ally'), rgb('accent'), t * 2] : [rgb('accent'), rgb('enemy'), (t - 0.5) * 2];
    return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * c)).join(',') + ')';
  }
  function doll(c, title) {
    const total = c.head + c.body + c.legs, top = Math.max(c.head, c.body, c.legs, 1);
    const col = (k) => (total ? heat(c[k] / top) : css('mute', 0.25));
    const stroke = css('ink', 0.35);
    const zone = [['head', 'Cabeça'], ['body', 'Tronco e braços'], ['legs', 'Pernas']];
    const best = total ? zone.slice().sort((a, b) => c[b[0]] - c[a[0]])[0][1] : null;
    const svg = '<svg viewBox="0 0 120 262" class="h-64 w-auto shrink-0" role="img" aria-label="' + esc(title) + '" fill="none" stroke="' + stroke + '" stroke-width="1.5">' +
      '<circle cx="60" cy="28" r="18" fill="' + col('head') + '"/>' +
      '<rect x="38" y="52" width="44" height="82" rx="10" fill="' + col('body') + '"/>' +
      '<rect x="18" y="54" width="16" height="74" rx="8" fill="' + col('body') + '"/>' +
      '<rect x="86" y="54" width="16" height="74" rx="8" fill="' + col('body') + '"/>' +
      '<rect x="39" y="138" width="20" height="116" rx="9" fill="' + col('legs') + '"/>' +
      '<rect x="61" y="138" width="20" height="116" rx="9" fill="' + col('legs') + '"/></svg>';
    const list = zone.map(([k, name]) => {
      const pct = total ? (c[k] / total) * 100 : 0;
      return '<li><div class="flex justify-between gap-4"><span>' + name + '</span><b class="text-ink">' + fmt(c[k]) + ' · ' + fmt(pct, 0) + '%</b></div>' +
        '<div class="mt-1 h-1.5 w-full bg-line/50"><div class="h-1.5" style="width:' + pct + '%;background:' + col(k) + '"></div></div></li>';
    }).join('');
    return '<div><h3 class="mb-2 font-display text-xl font-semibold">' + title + '</h3><div class="flex items-center gap-5">' + svg +
      '<div class="min-w-0 flex-1 text-sm text-mute"><ul class="space-y-3">' + list + '</ul>' +
      '<p class="mt-3 text-xs">' + (best ? 'Zona mais atingida: <b class="text-ink">' + best + '</b>' : 'Sem dados de acertos.') + '</p></div></div></div>';
  }
  function renderHits() {
    const host = $('#hitsBody'); if (!host || !state.match) return;
    const p = X.me(); if (!p) { host.innerHTML = ''; return; }
    const given = { head: p.headshots || 0, body: p.bodyshots || 0, legs: p.legshots || 0 };
    const taken = p.taken || { head: 0, body: 0, legs: 0 };
    const bar = 'linear-gradient(90deg,' + heat(0) + ',' + heat(0.5) + ',' + heat(1) + ')';
    host.innerHTML = '<p class="mb-3 text-sm text-mute"><b class="text-ink">' + esc(p.name) + '</b> · ' + (state.overview ? 'todas as partidas da equipe' : 'partida inteira') + '</p>' +
      '<div class="grid gap-8 md:grid-cols-2">' + doll(given, 'Acertos dados') + doll(taken, 'Acertos recebidos') + '</div>' +
      '<div class="mt-4 flex items-center gap-3 text-xs text-mute"><span>Menos acertos</span><i class="h-2 w-40" style="background:' + bar + '"></i><span>Mais acertos</span></div>';
  }

  /* ---------- Perfil: tabela com os valores reais do radar ---------- */
  function renderProfileTable() {
    const host = $('#profileBody'); if (!host || !state.match) return;
    const p = X.me(), mates = X.teamPlayers(X.myTeam()), foes = X.teamPlayers(X.enemyTeam());
    host.innerHTML = '<table class="w-full text-left text-sm"><thead class="text-mute"><tr><th class="py-1 font-normal">Métrica</th><th class="px-2 text-right font-normal text-accent">' + esc(p.name) + '</th><th class="px-2 text-right font-normal text-ally">Sua equipe</th><th class="text-right font-normal text-enemy">Inimigos</th></tr></thead><tbody>' +
      AXES.map(([label, key, dec]) => '<tr class="border-t border-line/60"><td class="py-1.5">' + label + '</td><td class="px-2 text-right font-bold text-accent">' + fmt(p[key], dec) + '</td><td class="px-2 text-right">' + fmt(avg(mates, (x) => x[key]), dec) + '</td><td class="text-right">' + fmt(avg(foes, (x) => x[key]), dec) + '</td></tr>').join('') +
      '</tbody></table><p class="mt-2 text-xs text-mute">Médias da equipe e dos inimigos calculadas sobre os jogadores de cada lado.</p>';
  }

  /* ---------- Equipe: radar + abaixo da média ---------- */
  function chartTeamRadar() {
    const mates = X.teamPlayers(X.myTeam()), foes = X.teamPlayers(X.enemyTeam());
    const mean = (arr, k) => avg(arr, (x) => x[k]);
    const top = Object.fromEntries(AXES.map(([, k]) => [k, (Math.max(mean(mates, k), mean(foes, k)) * 1.15) || 1]));
    const real = [AXES.map(([, k]) => mean(mates, k)), AXES.map(([, k]) => mean(foes, k))];
    const norm = (vals) => vals.map((v, i) => Math.round((v / top[AXES[i][1]]) * 100));
    const ds = (label, c, vals) => ({ label, data: norm(vals), borderColor: css(c), backgroundColor: css(c, 0.2), legendColor: css(c), borderWidth: 2.5, pointRadius: 3 });
    make('cTeamRadar', 'radar', {
      labels: AXES.map(([l]) => l),
      datasets: [ds(state.overview && state.selectedTeamName ? state.selectedTeamName + ' (média)' : 'Sua equipe (média)', 'ally', real[0]), ds('Inimigos (média)', 'enemy', real[1])],
    }, {
      scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: css('line', 0.6) }, angleLines: { color: css('line', 0.6) }, pointLabels: { color: css('ink'), font: { size: 12 } } } },
      plugins: { tooltip: { callbacks: { label: (c) => { const [name, , dec] = AXES[c.dataIndex]; return c.dataset.label + ' · ' + name + ': ' + fmt(real[c.datasetIndex][c.dataIndex], dec); } } } },
    });
  }
  function renderBelowAvg() {
    const host = $('#belowBody'); if (!host || !state.match) return;
    const mates = X.teamPlayers(X.myTeam());
    host.innerHTML = '<table class="w-full text-left text-sm"><thead class="text-mute"><tr><th class="py-1 font-normal">Métrica</th><th class="px-2 text-right font-normal">Média</th><th class="font-normal">Abaixo da média</th></tr></thead><tbody>' +
      AXES.map(([label, key, dec]) => {
        const m = avg(mates, (x) => x[key]);
        const below = mates.filter((p) => p[key] < m).sort((a, b) => a[key] - b[key]);
        const chips = below.length ? below.map((p) => '<span class="mr-1 inline-block rounded border border-enemy/40 bg-enemy/10 px-1.5 py-0.5 text-xs">' + esc(p.name) + ' <b>' + fmt(p[key], dec) + '</b> <span class="text-enemy">' + fmt(((p[key] / (m || 1)) - 1) * 100, 0) + '%</span></span>').join('') : '<span class="text-xs text-mute">Ninguém</span>';
        return '<tr class="border-t border-line/60 align-top"><td class="py-1.5 font-bold">' + label + '</td><td class="px-2 py-1.5 text-right">' + fmt(m, dec) + '</td><td class="py-1.5">' + chips + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- Rounds da equipe: motivo da derrota x tempo, spike ---------- */
  const LOSS = { Elimination: 'Derrota: eliminados', Detonate: 'Derrota: spike detonada', Defuse: 'Derrota: spike desarmada', Timeout: 'Derrota: tempo esgotado' };
  function chartTeamRounds() {
    const rows = [];
    units().forEach((u) => u.match.rounds.forEach((r) => rows.push({ r, side: u.side, map: u.match.map, match: u.match })));
    const keyOf = (x) => (x.r.winner === x.side ? 'Vitória' : (LOSS[x.r.reason] || 'Derrota: outro'));
    const palette = { 'Vitória': css('ally', 0.85), 'Derrota: eliminados': css('enemy', 1), 'Derrota: spike detonada': css('enemy', 0.7), 'Derrota: spike desarmada': css('enemy', 0.45), 'Derrota: tempo esgotado': css('enemy', 0.25), 'Derrota: outro': css('mute', 0.6) };
    const keys = Object.keys(palette).filter((k) => rows.some((x) => keyOf(x) === k));
    const planted = (x) => (x.r.planted && x.r.plantMs ? sec(x.r.plantMs) : null);
    make('cTeamRounds', 'bar', {
      labels: rows.map((x) => (state.overview ? x.map.slice(0, 3) + ' ' + x.r.num : x.r.num)),
      datasets: [
        ...keys.map((k) => ({ label: k, data: rows.map((x) => (keyOf(x) === k ? sec(x.r.endMs) : null)), backgroundColor: palette[k], legendColor: palette[k], grouped: false, borderRadius: 2, order: 2 })),
        { type: 'line', label: 'Spike plantada (momento)', data: rows.map(planted), showLine: false, pointStyle: 'triangle', pointRadius: 7, pointHoverRadius: 9, borderColor: css('ink'), backgroundColor: css('ink'), legendColor: css('ink'), order: 1 },
        { type: 'line', label: 'Spike desarmada (momento)', data: rows.map((x) => (x.r.defuseMs ? sec(x.r.defuseMs) : null)), showLine: false, pointStyle: 'rectRot', pointRadius: 7, pointHoverRadius: 9, borderColor: css('accent'), backgroundColor: css('accent'), legendColor: css('accent'), order: 1 },
      ],
    }, {
      interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, title: { display: true, text: 'Round' }, ticks: { maxTicksLimit: 40, maxRotation: 45 } },
        y: { beginAtZero: true, title: { display: true, text: 'Tempo do round (s)' } } },
      plugins: { tooltip: { callbacks: {
        title: (i) => { const x = rows[i[0].dataIndex]; return 'Round ' + x.r.num + (state.overview ? ' · ' + x.map : ''); },
        label: (c) => c.dataset.label + ': ' + mmss(c.raw * 1000),
        afterBody: (i) => {
          const x = rows[i[0].dataIndex];
          return ['Duração estimada do round: ' + mmss(x.r.endMs), x.r.planted ? 'Spike plantada aos ' + mmss(x.r.plantMs) : 'Spike não plantada',
            'Lado da equipe: ' + (x.r.winner === x.side ? (x.r.role === 'Attacker' ? 'Ataque' : 'Defesa') : (x.r.role === 'Attacker' ? 'Defesa' : 'Ataque'))];
        },
      } } },
    });
  }

  /* ---------- Habilidades e tipo de dano (bloco em Estatísticas de jogo) ---------- */
  function renderAbilities() {
    const host = $('#abilityBody'); if (!host || !state.match) return;
    const group = (team) => X.teamPlayers(team).slice().sort((a, b) => b.acs - a.acs).map((p) => {
      const c = p.casts || {};
      return '<tr class="border-t border-line/60"><td class="py-1.5 pl-2"><span class="mr-2 inline-block h-5 w-1 bg-' + (p.puuid === state.me ? 'accent' : X.tone(p.team)) + ' align-middle"></span><b>' + esc(p.name) + '</b> <span class="text-xs text-mute">' + esc(p.agent) + '</span></td>' +
        ['grenadeCasts', 'ability1Casts', 'ability2Casts', 'ultimateCasts'].map((k) => '<td class="px-2 text-right">' + fmt(c[k] || 0) + '</td>').join('') + '</tr>';
    }).join('');
    const kills = state.match.kills;
    const count = (list) => { const o = {}; list.forEach((k) => { o[k.dmgKind || '?'] = (o[k.dmgKind || '?'] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ×' + v).join(' · ') || '—'; };
    const withFx = state.match.rounds.filter((r) => (r.effects || []).length).length;
    host.innerHTML = '<div class="grid gap-6 lg:grid-cols-3"><div class="overflow-x-auto lg:col-span-2"><table class="w-full min-w-[420px] text-left text-sm"><thead class="text-mute"><tr><th class="py-1 pl-2 font-normal">Jogador</th>' +
      ['Granada (C)', 'Hab. Q', 'Hab. E', 'Ultimate (X)'].map((h) => '<th class="px-2 text-right font-normal">' + h + '</th>').join('') + '</tr></thead><tbody>' + group(X.myTeam()) + group(X.enemyTeam()) + '</tbody></table>' +
      '<p class="mt-2 text-xs text-mute">Usos por partida' + (state.overview ? ' (somados nas partidas da equipe)' : '') + '. O JSON só traz o total de usos, não por round.</p></div>' +
      '<div class="space-y-3 text-sm"><div><b class="text-ink">Abates do jogador por tipo de dano</b><p class="text-mute">' + count(kills.filter((k) => k.killer === state.me)) + '</p></div>' +
      '<div><b class="text-ink">Mortes do jogador por tipo de dano</b><p class="text-mute">' + count(kills.filter((k) => k.victim === state.me)) + '</p></div>' +
      '<div><b class="text-ink">Efeito de habilidade em inimigos</b><p class="text-mute">' + (withFx ? withFx + ' round(s) com efeito registrado (veja no detalhe do round).' : 'O arquivo não registra efeitos de habilidade (campos *Effects vazios).') + '</p></div></div></div>';
  }

  A.registerChart('cPlayerEco', chartPlayerEco);
  A.registerChart('cTeamRadar', chartTeamRadar);
  A.registerChart('cTeamRounds', chartTeamRounds);
  [renderCredits, renderHits, renderProfileTable, renderBelowAvg, renderAbilities].forEach(A.onRender);
})(window.VD);
