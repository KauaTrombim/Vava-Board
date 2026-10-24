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
    const chart = new Chart(document.getElementById(id), {
      type, data, options: { responsive: true, maintainAspectRatio: false, ...options },
    });
    instances.set(id, chart);
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