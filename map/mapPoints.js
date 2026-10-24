/* =============================================================
 * mapPoints.js — mantém os pontos DENTRO da área jogável do minimapa.
 * Cria uma máscara 128x128 da imagem: "jogável" = pixel diferente da cor
 * de fundo (canto da imagem) ou, em imagens com transparência, pixel opaco.
 * Ponto que já cai na área jogável NÃO é movido; só os que caem fora
 * são puxados para o pixel jogável mais próximo.
 * Carrega antes do dataLoader.js, por isso cria window.VD.
 * ============================================================= */
(function (VD) {
  'use strict';
  const SIZE = 128;
  const cache = new Map(); // src -> { grid, cells } | 'none'
  const clamp = (v) => Math.max(0.005, Math.min(0.995, Number(v)));

  function buildMask(img) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const d = ctx.getImageData(0, 0, SIZE, SIZE).data; // pode lançar erro se o canvas estiver "tainted" (file://)
    const at = (x, y) => { const i = (y * SIZE + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
    const corners = [at(0, 0), at(SIZE - 1, 0), at(0, SIZE - 1), at(SIZE - 1, SIZE - 1)];
    const bg = [0, 1, 2, 3].map((c) => corners.reduce((s, v) => s + v[c], 0) / 4);
    const transparentBg = bg[3] < 24;
    const grid = new Uint8Array(SIZE * SIZE), cells = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (d[i + 3] < 24) continue; // transparente
      const walkable = transparentBg || (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 45);
      if (walkable) { grid[y * SIZE + x] = 1; cells.push(x, y); }
    }
    // máscara degenerada (quase nada ou quase tudo marcado): não confiar
    const total = cells.length / 2;
    if (total < SIZE * SIZE * 0.03 || total > SIZE * SIZE * 0.97) return 'none';
    return { grid, cells };
  }

  function maskFor(img) {
    if (!img || !img.complete || !img.naturalWidth) return null; // ainda carregando: não cacheia
    const key = img.currentSrc || img.src;
    if (!cache.has(key)) {
      try { cache.set(key, buildMask(img)); } catch (e) { cache.set(key, 'none'); }
    }
    const mask = cache.get(key);
    return mask === 'none' ? null : mask;
  }

  function point(img, x, y, details = {}) {
    const px = Number(x), py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    const p = { ...details, x: clamp(px), y: clamp(py) };
    const mask = maskFor(img);
    if (!mask) return p;
    const ix = Math.min(SIZE - 1, Math.floor(p.x * SIZE)), iy = Math.min(SIZE - 1, Math.floor(p.y * SIZE));
    if (mask.grid[iy * SIZE + ix]) return p; // já está na área jogável: mantém a posição exata
    let best = -1, bestD = Infinity;
    for (let i = 0; i < mask.cells.length; i += 2) {
      const dx = mask.cells[i] - ix, dy = mask.cells[i + 1] - iy, dist = dx * dx + dy * dy;
      if (dist < bestD) { bestD = dist; best = i; }
    }
    if (best < 0) return p;
    return { ...p, x: (mask.cells[best] + 0.5) / SIZE, y: (mask.cells[best + 1] + 0.5) / SIZE };
  }

  VD.mapPoints = { point };
})((window.VD = window.VD || {}));
