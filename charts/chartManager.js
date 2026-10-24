(function (VD) {
  'use strict';
  const instances = new Map();
  function destroy(id) {
    const canvas = document.getElementById(id);
    const registered = canvas && Chart.getChart(canvas);
    const tracked = instances.get(id);
    if (registered) registered.destroy();
    if (tracked && tracked !== registered) tracked.destroy();
    instances.delete(id);
  }
  function create(id, type, data, options = {}) {
    destroy(id);
    const canvas = document.getElementById(id);
    if (!canvas) throw new Error('canvas #' + id + ' não existe no index.html');
    const chart = new Chart(canvas, {
      type, data, options: { responsive: true, maintainAspectRatio: false, ...options },
    });
    instances.set(id, chart);
    /* Se o navegador pausar/atrasar o requestAnimationFrame (preview embutido, aba em segundo plano),
     * a animação nunca começa e o canvas fica em branco. Aqui forçamos um desenho síncrono. */
    setTimeout(() => {
      if (instances.get(id) !== chart || !chart.canvas || !chart.canvas.isConnected) return;
      try { if (!chart.width || !chart.height) chart.resize(); chart.update('none'); } catch (e) { /* gráfico já destruído */ }
    }, 700);
    return chart;
  }
  function destroyAll() {
    document.querySelectorAll('canvas').forEach((canvas) => {
      const chart = Chart.getChart(canvas);
      if (chart) chart.destroy();
    });
    instances.clear();
  }
  function resizeAll() { instances.forEach((chart) => chart.resize()); }
  VD.chartManager = { create, destroy, destroyAll, resizeAll };
})(window.VD);