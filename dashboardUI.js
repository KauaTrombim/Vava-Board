(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var dash = document.querySelector('#dash');
    if (!dash || dash.dataset.uiReady) return;
    dash.dataset.uiReady = '1';
    var panels = Array.from(dash.children).filter(function (node) { return node.tagName === 'SECTION'; });
    var nav = document.createElement('nav');
    nav.className = 'flex flex-wrap gap-2 border-b border-line py-2';
    var labels = ['Estatísticas gerais', 'Estatísticas de jogo', 'Gráficos', 'Tabela de comparação'];
    labels.forEach(function (label, i) {
      var button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.className = 'border border-line px-3 py-2 text-sm hover:border-accent';
      button.addEventListener('click', function () {
        panels.forEach(function (panel) { panel.classList.toggle('hidden', panel.dataset.view !== String(i)); });
        Array.from(nav.children).forEach(function (item) { item.classList.toggle('bg-accent/20', item === button); });
        requestAnimationFrame(function () {
          if (window.VD.app && window.VD.app.syncCharts) window.VD.app.syncCharts(true);
          else if (window.VD.chartManager) window.VD.chartManager.resizeAll();
        });
      });
      nav.appendChild(button);
    });
    panels.forEach(function (panel, i) { panel.dataset.view = String(i); });
    dash.prepend(nav); nav.children[0].click();

    /* Sub-abas da seção Gráficos (cada bloco data-sub do index.html vira uma aba) */
    var charts = document.querySelector('#chartsSection');
    if (charts) {
      var subs = Array.from(charts.children).filter(function (node) { return node.dataset && node.dataset.sub; });
      var subNav = document.createElement('nav');
      subNav.className = 'flex flex-wrap gap-1 border-b border-line';
      subs.forEach(function (panel) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = panel.dataset.label || panel.dataset.sub;
        b.className = 'border-b-2 border-transparent px-3 py-2 text-sm text-mute hover:text-ink';
        b.addEventListener('click', function () {
          subs.forEach(function (p) { p.classList.toggle('hidden', p !== panel); });
          Array.from(subNav.children).forEach(function (c) {
            var on = c === b;
            c.classList.toggle('border-accent', on); c.classList.toggle('text-ink', on);
            c.classList.toggle('border-transparent', !on); c.classList.toggle('text-mute', !on);
          });
          requestAnimationFrame(function () { if (window.VD.app && window.VD.app.syncCharts) window.VD.app.syncCharts(true); });
        });
        subNav.appendChild(b);
      });
      charts.prepend(subNav);
      if (subNav.children[0]) subNav.children[0].click();
    }

    Array.from(dash.querySelectorAll('canvas')).filter(function (canvas) { return canvas.id !== 'cKills'; }).forEach(function (canvas) {
      var card = canvas.closest('article');
      var heading = card && card.querySelector('h2');
      if (!card || !heading || card.dataset.zoomReady) return;
      card.dataset.zoomReady = 'true';
      var button = document.createElement('button');
      button.type = 'button'; button.textContent = 'Ampliar gráfico';
      button.className = 'ml-auto border border-line px-2 py-1 text-xs hover:border-accent';
      button.addEventListener('click', function () {
        var open = card.dataset.zoomed === 'true';
        card.dataset.zoomed = open ? 'false' : 'true';
        if (!open) {
          card.dataset.savedStyle = card.getAttribute('style') || '';
          card.style.position = 'fixed'; card.style.inset = '3vh 3vw'; card.style.zIndex = '60';
          card.style.overflow = 'auto'; card.style.background = 'rgb(var(--panel))'; card.style.padding = '1.5rem';
          card.style.boxShadow = '0 0 0 100vmax rgba(0,0,0,.82)';
          var region = canvas.parentElement; region.dataset.savedStyle = region.getAttribute('style') || ''; region.style.height = '72vh';
        } else {
          card.setAttribute('style', card.dataset.savedStyle || '');
          var region = canvas.parentElement; region.setAttribute('style', region.dataset.savedStyle || '');
        }
        button.textContent = open ? 'Ampliar gráfico' : 'Minimizar gráfico';
        window.dispatchEvent(new Event('resize'));
      });
      heading.after(button);
    });    var mapCard = document.querySelector('#mapCard');
    var mapTitle = mapCard && mapCard.querySelector('h2');
    if (mapTitle) {
      var expand = document.createElement('button');
      expand.type = 'button'; expand.textContent = 'Ampliar mapa';
      expand.className = 'border border-line px-2 py-1 text-xs';
      var mapBox = mapCard.querySelector('#mapBox');
      var mapInsights = mapCard.querySelector('#mapInsights');
      expand.addEventListener('click', function () {
        var open = mapCard.dataset.expanded === 'true';
        mapCard.dataset.expanded = open ? 'false' : 'true';
        if (!open) {
          mapCard.dataset.savedStyle = mapCard.getAttribute('style') || '';
          mapCard.style.position = 'fixed'; mapCard.style.inset = '2vh 2vw'; mapCard.style.zIndex = '60';
          mapCard.style.overflow = 'auto'; mapCard.style.background = 'rgb(var(--panel))';
          mapCard.style.boxShadow = '0 0 0 100vmax rgba(0,0,0,.82)';
          mapCard.style.gridColumn = '1 / -1';
          mapCard.style.display = 'grid';
          mapCard.style.gridTemplateColumns = window.innerWidth < 760 ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(280px, 34%)';
          mapCard.style.gridTemplateRows = window.innerWidth < 760 ? 'auto auto minmax(0, 1fr) auto auto' : 'auto auto minmax(0, 1fr) auto';
          mapCard.style.height = '96vh';
          Array.from(mapCard.children).forEach(function (child) { child.dataset.savedStyle = child.getAttribute('style') || ''; });
          mapCard.children[0].style.gridColumn = '1 / -1';
          mapCard.children[1].style.gridColumn = '1 / -1';
          if (mapBox) { mapBox.style.maxWidth = 'min(72vh, 850px)'; mapBox.style.gridColumn = '1'; mapBox.style.gridRow = '3'; }
          if (mapCard.children[3]) { mapCard.children[3].style.gridColumn = '1'; mapCard.children[3].style.gridRow = window.innerWidth < 760 ? '4' : '4'; }
          if (mapInsights) {
            mapInsights.style.gridColumn = window.innerWidth < 760 ? '1' : '2';
            mapInsights.style.gridRow = window.innerWidth < 760 ? '5' : '3 / span 2';
            mapInsights.style.overflow = 'auto';
            mapInsights.style.gridTemplateColumns = '1fr';
          }
        } else {
          mapCard.setAttribute('style', mapCard.dataset.savedStyle || '');
          if (mapBox) mapBox.style.maxWidth = '';
          Array.from(mapCard.children).forEach(function (child) { child.setAttribute('style', child.dataset.savedStyle || ''); });
        }
        expand.textContent = open ? 'Ampliar mapa' : 'Minimizar mapa';
        if (window.Chart && window.VD.app) setTimeout(function () { window.dispatchEvent(new Event('resize')); window.VD.app.redrawMap(); }, 80);
      });
      mapTitle.after(expand);
    }
  });
})();