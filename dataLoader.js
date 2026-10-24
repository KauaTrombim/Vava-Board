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
    '41fb69c1-4189-7b37-f117-bcaf1e96f1bf': 'Astra',
    '1dbf2edd-4729-0984-3115-daa5eed44993': 'Clove',
    'cc8b64c8-4b25-4ff9-6e7f-37b4da43d235': 'Deadlock',
    '0e38b510-41a8-5780-5e8f-568b2a4f2d6c': 'Iso',
    'b444168c-4e35-8076-db47-ef9bf368f384': 'Tejo',
    'df1cb487-4902-002e-5c17-d28e83e78588': 'Veto',
    '6f2a04ca-43e0-be17-7f36-b3908627744d': 'Vyse',
    'efba5359-4016-a1e5-7626-b1ae76895940': 'Waylay',
    '92eeef5d-43b5-1d4a-8d03-b3927a09034b': 'Miks',
  };
  const MAPS = {
    Triad: 'Haven', Ascent: 'Ascent', Duality: 'Bind', Bonsai: 'Split', Port: 'Icebox',
    Foxtrot: 'Breeze', Canyon: 'Fracture', Pitt: 'Pearl', Jam: 'Lotus', Juliett: 'Sunset', Infinity: 'Abyss', Plummet: 'Corrode',
  };
  /* Calibração do mapa (valorant-api.com/v1/maps): [multiplicador, xScalarToAdd, yScalarToAdd]
   * nx = y_jogo * mult + xa ;  ny = x_jogo * (-mult) + ya
   * Confira/ajuste em https://valorant-api.com/v1/maps (campos xMultiplier, xScalarToAdd, yScalarToAdd). */
  const MAP_CAL = {
    Triad: [7.5e-05, 1.09345, 0.642728],     // Haven
    Ascent: [7e-05, 0.813895, 0.573242],
    Duality: [5.9e-05, 0.576941, 0.967566],  // Bind
    Bonsai: [7.8e-05, 0.842188, 0.697578],   // Split
    Port: [7.2e-05, 0.460214, 0.304687],     // Icebox
    Foxtrot: [7e-05, 0.465123, 0.833078],    // Breeze
    Canyon: [7.8e-05, 0.556952, 1.155886],   // Fracture
    Pitt: [7.8e-05, 0.480469, 0.916016],     // Pearl
    Jam: [7.2e-05, 0.454789, 0.917752],      // Lotus
    Juliett: [7.8e-05, 0.5, 0.515625],       // Sunset  (conferir)
    Infinity: [8.1e-05, 0.5, 0.5],           // Abyss   (conferir)
    Plummet: [7e-05, 0.526158, 0.5],         // Corrode (conferir)
  };
  /* Seus arquivos são .jpeg; tenta as outras extensões se não achar. */
  const IMG_EXT = ['jpeg', 'webp', 'png', 'jpg'];
  const mapImages = (name) => IMG_EXT.map((e) => 'assets/maps/' + name + '_minimap.' + e);
  const MAP_META = {};
  Object.keys(MAPS).forEach((key) => {
    const cal = MAP_CAL[key], images = mapImages(MAPS[key]);
    MAP_META[key] = cal
      ? { images, image: images[0], xm: cal[0], ym: -cal[0], xa: cal[1], ya: cal[2] }
      : { images, image: images[0] };
  });
  const MAP_BOUNDS = {};
  const ROUND_MS = 100000;  // tempo máximo de um round (sem contar a fase de compra)
  const SPIKE_MS = 45000;   // tempo da spike plantada até detonar
  /* UUID da arma (finishingDamage.damageItem) -> nome. Se aparecer "Arma xxxx", adicione o UUID aqui. */
  const WEAPONS = {
    '29a0cfab-485b-f5d5-779a-b59f85e204a8': 'Classic', '42da8ccc-40d5-affc-beec-15aa47b42eda': 'Shorty',
    '44d4e95c-4157-0037-81b2-17841bf2e8e3': 'Frenzy', '1baa85b4-4c70-1284-64bb-6481dfc3bb4e': 'Ghost',
    'e336c6b8-418d-9340-d77f-7a9e4cfe0702': 'Sheriff', 'f7e1b454-4ad4-1063-ec0a-159e56b58941': 'Stinger',
    '462080d1-4035-2937-7c09-27aa2a5c27a7': 'Spectre', '910be174-449b-c412-ab22-d0873436b21b': 'Bucky',
    'ec845bf4-4f79-ddda-a3da-0db3774b2794': 'Judge', 'ae3de142-4d85-2547-dd26-4e90bed35cf7': 'Bulldog',
    '4ade7faa-4cf1-8376-95ef-39884480959b': 'Guardian', 'ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a': 'Phantom',
    '9c82e19d-4575-0200-1a81-3eacf00cf872': 'Vandal', 'c4883e50-4494-202c-3ec3-6b8a9284f00b': 'Marshal',
    'a03b24d3-4319-996d-0f8c-94bbfba1dfc7': 'Operator', '55d8a0f4-4274-ca67-fe2c-06ab45efdf58': 'Ares',
    '63e6c2b6-4a8e-869c-3d4c-e38355226584': 'Odin', '2f59173c-4bed-b6c3-2191-dea9b58be9c7': 'Faca',
  };
  const SLOTS = { grenade: 'Habilidade C', grenadeability: 'Habilidade C', ability1: 'Habilidade Q', ability2: 'Habilidade E', ultimate: 'Ultimate (X)' };
  function weaponName(id, type) {
    if (type === 'Bomb') return 'Spike';
    if (type === 'Fall') return 'Queda';
    if (type === 'Melee') return WEAPONS[String(id).toLowerCase()] || 'Faca';
    if (type === 'Ability') return SLOTS[String(id || '').toLowerCase()] || 'Habilidade';
    return WEAPONS[String(id || '').toLowerCase()] || (id ? 'Arma ' + String(id).slice(0, 4) : 'Desconhecida');
  }
  const KINDS = { Weapon: 'Arma', Ability: 'Habilidade', Bomb: 'Spike', Melee: 'Corpo a corpo', Fall: 'Queda' };
  const damageKind = (type) => KINDS[type] || type || 'Desconhecido';
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
    const mapName = MAPS[mapKey] || mapKey;
    const meta = MAP_META[mapKey] || { images: mapImages(mapName), image: mapImages(mapName)[0] };
    const bounds = MAP_BOUNDS[mapKey];
    const toMap = (loc) => {
      if (!loc || loc.x == null || loc.y == null) return {};
      if (meta.xm != null) return { nx: loc.y * meta.xm + meta.xa, ny: loc.x * meta.ym + meta.ya };
      if (!bounds || bounds.maxX === bounds.minX || bounds.maxY === bounds.minY) return {};
      return { nx: Math.max(0.01, Math.min(0.99, (loc.y - bounds.minY) / (bounds.maxY - bounds.minY))),
        ny: Math.max(0.01, Math.min(0.99, (bounds.maxX - loc.x) / (bounds.maxX - bounds.minX))) };
    };

    const players = raw.players.filter((p) => !p.isObserver).map((p) => ({
      puuid: p.puuid, name: p.gameName, tag: p.tagLine, team: p.teamId, level: p.accountLevel,
      agent: AGENTS[p.characterId] || 'Agente ' + String(p.characterId).slice(0, 4),
      score: p.stats.score, kills: p.stats.kills, deaths: p.stats.deaths, assists: p.stats.assists,
      rounds: p.stats.roundsPlayed || raw.roundResults.length, casts: p.stats.abilityCasts || {},
      damage: 0, headshots: 0, bodyshots: 0, legshots: 0,
      fk: 0, fd: 0, mk: 0, kastRounds: 0, perRound: [], taken: { head: 0, body: 0, legs: 0 }, aliveMs: 0,
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
      const loadout = { Blue: 0, Red: 0 }, spent = { Blue: 0, Red: 0 }, remaining = { Blue: 0, Red: 0 };
      const lastKill = evs.length ? evs[evs.length - 1].timeSinceRoundStartMillis : 0;
      const plantMs0 = r.bombPlanter ? (r.plantRoundTime || 0) : 0;
      const defuseMs = r.bombDefuser ? (r.defuseRoundTime || 0) : 0;
      const loserTeam = r.winningTeam === 'Blue' ? 'Red' : 'Blue';
      const loserSize = players.filter((p) => p.team === loserTeam).length;
      const loserDead = [...dead].filter((id) => (byId.get(id) || {}).team === loserTeam).length;
      let reason = r.roundResultCode || 'Elimination';
      if (reason === 'Elimination' && loserSize && loserDead < loserSize) reason = 'Timeout';
      /* O JSON não traz a duração do round: estimamos pelo último evento (abate, plant, defuse),
       * +45 s se a spike detonou, ou 100 s se o tempo acabou. */
      let endMs = reason === 'Defuse' && defuseMs ? defuseMs : reason === 'Detonate' && plantMs0 ? plantMs0 + SPIKE_MS : reason === 'Timeout' ? ROUND_MS : lastKill;
      endMs = Math.max(endMs || 0, lastKill, plantMs0, defuseMs);

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
        const eco = ps.economy || {};
        const deathEv = evs.find((k) => k.victim === p.puuid);
        const aliveMs = Math.min(deathEv ? deathEv.timeSinceRoundStartMillis : endMs, endMs);
        p.aliveMs += aliveMs;
        spent[p.team] += eco.spent || 0; remaining[p.team] += eco.remaining || 0;
        hits.forEach((d) => {
          const v = byId.get(d.receiver);
          if (v) { v.taken.head += d.headshots || 0; v.taken.body += d.bodyshots || 0; v.taken.legs += d.legshots || 0; }
        });
        p.perRound[i] = { k: nk, d: dead.has(p.puuid) ? 1 : 0, dmg, spent: eco.spent || 0, remaining: eco.remaining || 0,
          loadout: eco.loadoutValue || 0, aliveMs, deathMs: deathEv ? deathEv.timeSinceRoundStartMillis : null };
      });
      players.forEach((p) => { if (!p.perRound[i]) { p.aliveMs += endMs; p.perRound[i] = { k: 0, d: 0, dmg: 0, spent: 0, remaining: 0, loadout: 0, aliveMs: endMs, deathMs: null }; } });

      const events = evs.map((k) => {
        const killer = byId.get(k.killer), victim = byId.get(k.victim);
        const loc = k.victimLocation || {};
        const killerStats = stats.find((ps) => ps.puuid === k.killer) || {};
        const victimStats = stats.find((ps) => ps.puuid === k.victim) || {};
        const hits = (killerStats.damage || []).filter((d) => d.receiver === k.victim);
        const ev = { round: i + 1, t: k.timeSinceRoundStartMillis, killer: k.killer, victim: k.victim,
          assists: k.assistants || [], ...toMap(loc),
          killerTeam: killer && killer.team, victimTeam: victim && victim.team,
          weaponId: k.finishingDamage && k.finishingDamage.damageItem, damageType: k.finishingDamage && k.finishingDamage.damageType,
          hits: { head: sum(hits, (d) => d.headshots || 0), body: sum(hits, (d) => d.bodyshots || 0), legs: sum(hits, (d) => d.legshots || 0), damage: sum(hits, (d) => d.damage || 0) },
          killerLoadout: (killerStats.economy || {}).loadoutValue || null, victimLoadout: (victimStats.economy || {}).loadoutValue || null,
          bombPlanter: r.bombPlanter || null };
        const posList = (k.playerLocations || []).map((q) => {
          const pp = byId.get(q.puuid);
          return { puuid: q.puuid, team: pp && pp.team, view: q.viewRadians, ...toMap(q.location) };
        }).filter((q) => Number.isFinite(q.nx) && Number.isFinite(q.ny));
        const kp = posList.find((q) => q.puuid === k.killer);
        ev.positions = posList; ev.killerNx = kp ? kp.nx : null; ev.killerNy = kp ? kp.ny : null;
        ev.dmgKind = damageKind(ev.damageType); ev.weaponName = weaponName(ev.weaponId, ev.damageType);
        kills.push(ev);
        return ev;
      });

      const w = r.winningTeam;
      sides[w] = sides[w] || { Attacker: 0, Defender: 0 };
      sides[w][r.winningTeamRole]++;

      rounds.push({ num: i + 1, winner: w, role: r.winningTeamRole, type: r.roundResultCode,
        site: r.plantSite || null, plant: r.bombPlanter ? { ...toMap(r.plantLocation), planter: r.bombPlanter, time: r.plantRoundTime || null } : null, planted: !!r.bombPlanter, plantMs: r.plantRoundTime || null,
        loadout, spent, remaining, reason, endMs, defuseMs, defuser: r.bombDefuser || null,
        effects: stats.map((ps) => ({ puuid: ps.puuid, ...(ps.ability || {}) }))
          .filter((e) => ['grenadeEffects', 'ability1Effects', 'ability2Effects', 'ultimateEffects'].some((key) => e[key])),
        kills: events });
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
    async fromUrl(url, tries = 2) {
      let res, lastErr;
      for (let i = 0; i < tries && !res; i++) {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (r.status >= 500) throw new Error('HTTP ' + r.status);
          res = r;
        } catch (e) { lastErr = e; await new Promise((ok) => setTimeout(ok, 250)); }
      }
      if (!res) throw lastErr;
      if (!res.ok) throw new Error('HTTP ' + res.status + ' em ' + decodeURIComponent(String(url).split('/').pop()));
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
      const links = [...html.matchAll(/href="([^"?#]+)"/gi)].map((m) => m[1]);
      const names = [...new Set(links.filter((n) => /\.json$/i.test(n) && !/manifest\.json$/i.test(n)))];
      const folders = [...new Set(links.filter((n) => /\/$/.test(n) && n !== './' && n !== '../'))];
      const nested = await Promise.allSettled(folders.map((n) => loader.listDir(abs(n))));
      return [...names.map(abs), ...nested.filter((x) => x.status === 'fulfilled').flatMap((x) => x.value)];
    },
    /** Lê TODAS as partidas da pasta, sem interação. Retorna [{ name, match }] da mais recente para a mais antiga. */
    async init(dir) {
      try {
        const base = new URL(dir || 'data/', document.baseURI);
        const res = await fetch(new URL('mapBounds.json', base), { cache: 'no-store' });
        if (res.ok) Object.assign(MAP_BOUNDS, await res.json());
      } catch (e) { /* opcional: sem mapBounds.json usa só a calibração oficial */ }
    },
    async catalog(dirs) {
      let lastErr;
      for (const dir of [].concat(dirs)) {
        const base = new URL(dir, document.baseURI);
        try {
          const res = await fetch(new URL('catalog.json', base), { cache: 'no-store' });
          if (!res.ok) throw new Error('Catálogo não encontrado em ' + dir);
          const files = await res.json();
          return { root: base, files: Array.isArray(files) ? files : files.files || [] };
        } catch (err) { lastErr = err; }
      }
      throw lastErr || new Error('Catálogo de partidas não encontrado.');
    },
    async readCatalogMatch(catalog, file) {
      const url = new URL(file.path.split('/').map(encodeURIComponent).join('/'), catalog.root);
      const match = await loader.fromUrl(url.href);
      const blueTeam = match.teams.Blue || {};
      const teamSides = VD.catalogTools.teamSides(file, blueTeam.roundsWon, blueTeam.won, match.players);
      return { name: file.name, file, match, teamSides };
    },
    playersForTeam(catalog, teamId) {
      return VD.catalogTools.playersForTeam(catalog, teamId);
    },
    async previewTeam(catalog, teamId) {
      const file = catalog.files.find((f) => f.teams.some((t) => t.id === teamId));
      if (!file) throw new Error('Equipe sem partidas no catálogo.');
      return loader.readCatalogMatch(catalog, file);
    },
    loadTeam(catalog, teamId) {
      loader._teamCache = loader._teamCache || new Map();
      const key = catalog.root.href + '|' + teamId;
      if (!loader._teamCache.has(key)) {
        const p = loader._loadTeam(catalog, teamId);
        loader._teamCache.set(key, p);
        p.catch(() => loader._teamCache.delete(key)); // não cacheia falha
      }
      return loader._teamCache.get(key).then((list) => list.slice());
    },
    async _loadTeam(catalog, teamId) {
      const files = catalog.files.filter((f) => (f.teams || []).some((t) => t.id === teamId));
      const ok = [], failed = [];
      for (let i = 0; i < files.length; i += 8) {
        const part = files.slice(i, i + 8);
        const batch = await Promise.allSettled(part.map((f) => loader.readCatalogMatch(catalog, f)));
        batch.forEach((x, j) => (x.status === 'fulfilled' ? ok.push(x.value) : failed.push({ file: part[j].path, reason: x.reason && x.reason.message })));
      }
      if (failed.length) console.warn('[VavaBoard] ' + failed.length + ' partida(s) não carregaram:', failed);
      if (!ok.length) throw new Error('Não foi possível carregar partidas desta equipe.' + (failed[0] ? ' (' + failed[0].reason + ')' : ''));
      return ok.sort((a, b) => b.match.startedAt - a.match.startedAt);
    },
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
