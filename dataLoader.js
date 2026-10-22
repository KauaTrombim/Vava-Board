/* =============================================================
 * dataLoader.js — LEITURA E NORMALIZAÇÃO DOS DADOS
 * Única parte que conhece o formato bruto do JSON da partida.
 * Se o formato mudar, só este arquivo precisa ser alterado.
 * Expõe: window.VD.loader
 * ============================================================= */
(function (VD) {
  'use strict';

  /* ---- Tabelas de tradução (edite à vontade) ---- */
  const AGENTS = {
    '320b2a48-4d9b-a075-30f1-1f93a9b638fa': 'Sova',
    'eb93336a-449b-9c1b-0a54-a891f7921d69': 'Phoenix',
    '22697a3d-45bf-8dd7-4fec-84a9e28c69d7': 'Chamber',
    '8e253930-4c05-31dd-1b6c-968525494517': 'Omen',
    'bb2a4828-46eb-8cd1-e765-15848195d751': 'Neon',
    'add6443a-41bd-e414-f6ad-e58d267f4e95': 'Jett',
    'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc': 'Reyna',
    'f94c3b30-42be-e959-889c-5aa313dba261': 'Raze',
    '5f8d3a7f-467b-97f3-062c-13acf203c006': 'Breach',
    '117ed9e3-49f3-6512-3ccf-0cada7e3823b': 'Cypher',
    '569fdd95-4d10-43ab-ca70-79becc718b46': 'Sage',
    '707eab51-4836-f488-046a-cda6bf494859': 'Viper',
    '9f0d8ba9-4140-b941-57d3-a7ad57c6b417': 'Brimstone',
    '1e58de9c-4950-5125-93e9-a0aee9f98746': 'Killjoy',
    '7f94d92c-4234-0a36-9646-3a87eb8b5c89': 'Yoru',
    '601dbbe7-43ce-be57-2a40-4abd24953621': 'KAY/O',
    'dade69b4-4f5a-8528-247b-219e5a1facd6': 'Fade',
    'e370fa57-4757-3604-3648-499e1f642d3f': 'Gekko',
    '95b78ed7-4637-86d9-7e41-71ba8c293152': 'Harbor',
  };
  const MAPS = {
    Triad: 'Haven', Ascent: 'Ascent', Duality: 'Bind', Bonsai: 'Split', Port: 'Icebox',
    Foxtrot: 'Breeze', Canyon: 'Fracture', Pitt: 'Pearl', Jam: 'Lotus', Juliett: 'Sunset', Infinity: 'Abyss',
  };
  /* Calibração do mapa: converte coordenadas do jogo em posição normalizada (0 a 1) sobre a imagem.
   * nx = y_jogo * xm + xa ;  ny = x_jogo * ym + ya  (valores oficiais do valorant-api). Para novo mapa, adicione uma entrada. */
  const MAP_META = {
    Triad: { image: 'maps/Heaven.png', xm: 7.5e-05, ym: -7.5e-05, xa: 1.09345, ya: 0.642728 },
  };
  const TRADE_WINDOW_MS = 5000; // janela para contar um abate como "trade" no KAST

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

  function validate(raw) {
    if (!raw || !raw.matchInfo || !Array.isArray(raw.players) || !Array.isArray(raw.roundResults)) {
      throw new Error('Arquivo inválido: faltam matchInfo, players ou roundResults.');
    }
  }

  /** JSON bruto -> modelo simples usado pela interface. */
  function normalize(raw) {
    validate(raw);
    const mi = raw.matchInfo;
    const mapKey = String(mi.mapId || '').split('/').pop();
    const meta = MAP_META[mapKey] || null;
    const toMap = (loc) => (meta && loc && loc.x != null ? { nx: loc.y * meta.xm + meta.xa, ny: loc.x * meta.ym + meta.ya } : {});

    const players = raw.players.filter((p) => !p.isObserver).map((p) => ({
      puuid: p.puuid, name: p.gameName, tag: p.tagLine, team: p.teamId, level: p.accountLevel,
      agent: AGENTS[p.characterId] || 'Agente ' + String(p.characterId).slice(0, 4),
      score: p.stats.score, kills: p.stats.kills, deaths: p.stats.deaths, assists: p.stats.assists,
      rounds: p.stats.roundsPlayed || raw.roundResults.length, casts: p.stats.abilityCasts || {},
      damage: 0, headshots: 0, bodyshots: 0, legshots: 0,
      fk: 0, fd: 0, mk: 0, kastRounds: 0, perRound: [],
    }));
    const byId = new Map(players.map((p) => [p.puuid, p]));

    const rounds = [], kills = [], sides = {};

    raw.roundResults.forEach((r, i) => {
      const stats = r.playerStats || [];
      const evs = stats.flatMap((ps) => ps.kills || [])
        .sort((a, b) => a.timeSinceRoundStartMillis - b.timeSinceRoundStartMillis);
      const dead = new Set(evs.map((k) => k.victim));
      const assisted = new Set(evs.flatMap((k) => k.assistants || []));
      const traded = new Set();
      const loadout = { Blue: 0, Red: 0 };

      evs.forEach((k) => {
        const victim = byId.get(k.victim);
        const retaliation = evs.find((n) => n.victim === k.killer
          && n.timeSinceRoundStartMillis > k.timeSinceRoundStartMillis
          && n.timeSinceRoundStartMillis - k.timeSinceRoundStartMillis <= TRADE_WINDOW_MS
          && byId.get(n.killer) && victim && byId.get(n.killer).team === victim.team);
        if (retaliation) traded.add(k.victim);
      });

      if (evs[0]) {
        const fk = byId.get(evs[0].killer), fd = byId.get(evs[0].victim);
        if (fk) fk.fk++;
        if (fd) fd.fd++;
      }

      stats.forEach((ps) => {
        const p = byId.get(ps.puuid);
        if (!p) return;
        const hits = ps.damage || [];
        const nk = (ps.kills || []).length;
        const dmg = sum(hits, (d) => d.damage);
        p.damage += dmg;
        p.headshots += sum(hits, (d) => d.headshots);
        p.bodyshots += sum(hits, (d) => d.bodyshots);
        p.legshots += sum(hits, (d) => d.legshots);
        if (nk >= 2) p.mk++;
        if (nk > 0 || assisted.has(p.puuid) || !dead.has(p.puuid) || traded.has(p.puuid)) p.kastRounds++;
        loadout[p.team] += (ps.economy && ps.economy.loadoutValue) || 0;
        p.perRound[i] = { k: nk, d: dead.has(p.puuid) ? 1 : 0, dmg };
      });
      players.forEach((p) => { p.perRound[i] = p.perRound[i] || { k: 0, d: 0, dmg: 0 }; });

      const events = evs.map((k) => {
        const killer = byId.get(k.killer), victim = byId.get(k.victim);
        const loc = k.victimLocation || {};
        const ev = { round: i + 1, t: k.timeSinceRoundStartMillis, killer: k.killer, victim: k.victim,
          assists: k.assistants || [], ...toMap(loc),
          killerTeam: killer && killer.team, victimTeam: victim && victim.team };
        kills.push(ev);
        return ev;
      });

      const w = r.winningTeam;
      sides[w] = sides[w] || { Attacker: 0, Defender: 0 };
      sides[w][r.winningTeamRole]++;

      rounds.push({ num: i + 1, winner: w, role: r.winningTeamRole, type: r.roundResultCode,
        site: r.plantSite || null, plant: r.bombPlanter ? toMap(r.plantLocation) : null, planted: !!r.bombPlanter, plantMs: r.plantRoundTime || null,
        loadout, kills: events });
    });

    players.forEach((p) => {
      const shots = p.headshots + p.bodyshots + p.legshots;
      p.acs = p.score / p.rounds;
      p.adr = p.damage / p.rounds;
      p.hs = shots ? (p.headshots / shots) * 100 : 0;
      p.kd = p.deaths ? p.kills / p.deaths : p.kills;
      p.kast = (p.kastRounds / p.rounds) * 100;
    });

    const teams = {};
    (raw.teams || []).forEach((t) => { teams[t.teamId] = { id: t.teamId, won: t.won, roundsWon: t.roundsWon }; });

    return {
      id: mi.matchId, mapKey, mapMeta: meta, map: MAPS[mapKey] || mapKey, region: String(mi.region || '').toUpperCase(),
      mode: mi.provisioningFlowId === 'CustomGame' ? 'Partida personalizada' : (mi.isRanked ? 'Competitivo' : 'Partida'),
      startedAt: new Date(mi.gameStartMillis), durationMs: mi.gameLengthMillis,
      teams, sides, players, rounds, kills,
    };
  }

  /* ---- Fontes de dados ---- */
  const loader = {
    AGENTS, MAPS, MAP_META, normalize,
    parse(text) {
      let raw;
      try { raw = JSON.parse(text); } catch (e) { throw new Error('JSON inválido: não foi possível ler o arquivo.'); }
      return normalize(raw);
    },
    async fromUrl(url) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return loader.parse(await res.text());
    },
    /** Lista os .json de uma pasta: usa dir/manifest.json se existir, senão a listagem do servidor. */
    async listDir(dir) {
      const base = new URL(dir, document.baseURI);
      const abs = (n) => new URL(n, base).href;
      try {
        const r = await fetch(abs('manifest.json'), { cache: 'no-store' });
        if (r.ok) { const l = await r.json(); return (Array.isArray(l) ? l : l.files || []).map(abs); }
      } catch (e) { /* sem manifest: tenta a listagem */ }
      const r = await fetch(base.href, { cache: 'no-store' });
      if (!r.ok) throw new Error('Pasta ' + dir + ' não encontrada (HTTP ' + r.status + ').');
      const html = await r.text();
      const names = [...new Set([...html.matchAll(/href="([^"?#]+\.json)"/gi)].map((m) => m[1]))];
      return names.filter((n) => !/manifest\.json$/i.test(n)).map(abs);
    },
    /** Lê TODAS as partidas da pasta, sem interação. Retorna [{ name, match }] da mais recente para a mais antiga. */
    async fromDirectory(dirs) {
      const list = [].concat(dirs);
      if (location.protocol === 'file:') {
        throw new Error('Para ler a pasta ' + list[0] + ' automaticamente, sirva o projeto (ex.: python -m http.server) ou use "Abrir".');
      }
      let lastErr;
      for (const dir of list) { // usa a primeira pasta que existir e tiver partidas válidas
        try { return await loader._readDir(dir); } catch (e) { lastErr = e; }
      }
      throw new Error('Nenhuma partida encontrada em ' + list.join(', ') + '. ' + (lastErr ? lastErr.message : '') + ' Se o servidor não listar a pasta, crie data/manifest.json com a lista de nomes dos arquivos.');
    },
    async _readDir(dir) {
      const urls = await loader.listDir(dir);
      const done = await Promise.allSettled(urls.map((u) => loader.fromUrl(u).then((match) => ({ name: decodeURIComponent(u.split('/').pop()), match }))));
      const ok = done.filter((d) => d.status === 'fulfilled').map((d) => d.value);
      if (!ok.length) throw new Error('Nenhuma partida válida encontrada em ' + dir + '.');
      return ok.sort((a, b) => b.match.startedAt - a.match.startedAt);
    },
    fromFile(file) { return file.text().then(loader.parse); },

    /** Liga input[type=file] e arrastar-e-soltar. */
    bind({ input, dropTarget, onMatch, onError, onDrag = () => {} }) {
      const handle = (file) => { if (file) loader.fromFile(file).then(onMatch).catch(onError); };
      input.addEventListener('change', (e) => { handle(e.target.files[0]); input.value = ''; });
      dropTarget.addEventListener('dragover', (e) => { e.preventDefault(); onDrag(true); });
      dropTarget.addEventListener('dragleave', (e) => { if (e.target === dropTarget || !e.relatedTarget) onDrag(false); });
      dropTarget.addEventListener('drop', (e) => { e.preventDefault(); onDrag(false); handle(e.dataTransfer.files[0]); });
    },
  };

  VD.loader = loader;
})((window.VD = window.VD || {}));
