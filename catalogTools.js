/* =============================================================
 * catalogTools.js — utilidades do catálogo (equipes/jogadores)
 * IMPORTANTE: este arquivo carrega ANTES do dataLoader.js, então
 * ele mesmo precisa criar window.VD (antes estava `(window.VD)` e
 * dava "Cannot set properties of undefined").
 * ============================================================= */
(function (VD) {
  'use strict';
  const opposite = (side) => (side === 'Blue' ? 'Red' : 'Blue');

  /** Descobre em qual lado (Blue/Red) cada equipe do catálogo jogou nesta partida.
   *  1º: cruza os puuids dos jogadores do catálogo com os da partida (mais confiável).
   *  2º: se faltar, usa o placar (comportamento antigo). */
  function teamSides(file, blueRoundsWon, blueWon, matchPlayers) {
    const sides = {};
    const teams = (file && file.teams) || [];

    if (Array.isArray(matchPlayers) && matchPlayers.length) {
      const sideByPuuid = new Map(matchPlayers.map((p) => [p.puuid, p.team]));
      teams.forEach((team) => {
        const votes = {};
        ((file && file.players) || []).filter((p) => p.teamId === team.id).forEach((p) => {
          const side = sideByPuuid.get(p.puuid);
          if (side) votes[side] = (votes[side] || 0) + 1;
        });
        const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
        if (best) sides[team.id] = best[0];
      });
    }

    const [a, b] = teams;
    if (a && b) {
      if (sides[a.id] && !sides[b.id]) sides[b.id] = opposite(sides[a.id]);
      else if (sides[b.id] && !sides[a.id]) sides[a.id] = opposite(sides[b.id]);
      else if (!sides[a.id] && !sides[b.id]) {
        const scores = (file && file.scores) || [];
        const first = Number(blueRoundsWon) === Number(scores[0]) ? 'Blue'
          : Number(blueRoundsWon) === Number(scores[1]) ? 'Red'
            : blueWon ? 'Blue' : 'Red';
        sides[a.id] = first;
        sides[b.id] = opposite(first);
      }
    } else if (a && !sides[a.id]) {
      sides[a.id] = blueWon ? 'Blue' : 'Red';
    }
    return sides;
  }

  function playersForTeam(catalog, teamId) {
    const players = new Map();
    ((catalog && catalog.files) || []).filter((file) => (file.teams || []).some((team) => team.id === teamId)).forEach((file) => {
      (file.players || []).filter((player) => player.teamId === teamId).forEach((player) => {
        if (!players.has(player.puuid)) players.set(player.puuid, player);
      });
    });
    return [...players.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }

  VD.catalogTools = { teamSides, playersForTeam };
})((window.VD = window.VD || {}));
