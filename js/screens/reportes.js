/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Reportes
═══════════════════════════════════════════════════════════════ */

(function () {

  // Registro de instancias Chart.js para poder destruirlas al recargar
  window.KarnalesCharts = window.KarnalesCharts || {};

  const CHART_DEFAULTS = {
    color:        '#C9A84C',
    colorDim:     'rgba(201,168,76,0.15)',
    success:      '#4ADE80',
    danger:       '#F87171',
    info:         '#60A5FA',
    textColor:    '#B8B0A4',
    gridColor:    'rgba(255,255,255,0.06)',
    font:         'Inter, sans-serif',
  };

  // ── Carga principal ─────────────────────────────────────────
  async function cargar() {
    try {
      const data = await API.getReportes();
      if (!data) return;
      renderKPIs(data);
      renderAlertas(data.stock || {});
      renderGraficos(data.graficos || {});
    } catch (e) {
      console.error('Reportes error:', e);
    }
  }

  // ── KPIs ────────────────────────────────────────────────────
  function renderKPIs(data) {
    const s = data.stock   || {};
    const v = data.ventas  || {};
    const c = data.caja    || {};

    setText('rep-costo-stock',    Utils.formatMoney(s.costoStock       ?? 0));
    setText('rep-valor-stock',    Utils.formatMoney(s.valorVentaStock  ?? 0));
    setText('rep-ganancia',       Utils.formatMoney(s.gananciaPotencial ?? 0));
    setText('rep-ventas-hoy',     Utils.formatMoney(v.montoHoy         ?? 0));
    setText('rep-ventas-hoy-cant', `${v.cantidadHoy ?? 0} operaciones`);
    setText('rep-ventas-mes',     Utils.formatMoney(v.montoMes         ?? 0));
    setText('rep-ventas-mes-cant', `${v.cantidadMes ?? 0} operaciones`);
    setText('rep-saldo',          Utils.formatMoney(c.saldo            ?? 0));
    setText('rep-ingresos-mes',   Utils.formatMoney(c.ingresosMes      ?? 0));
    setText('rep-egresos-mes',    Utils.formatMoney(Math.abs(c.egresosMes ?? 0)));
  }

  // ── Alertas de stock ─────────────────────────────────────────
  function renderAlertas(stock) {
    const sinStockEl  = document.getElementById('lista-sin-stock');
    const stockBajoEl = document.getElementById('lista-stock-bajo');

    if (sinStockEl) {
      const lista = stock.productosSinStock || [];
      sinStockEl.innerHTML = lista.length === 0
        ? '<p class="text-muted text-sm">Sin alertas</p>'
        : lista.map(p => `
            <div class="alerta-item">
              <span class="badge badge-danger" style="margin-right:6px;">0</span>
              ${Utils.esc(p.nombre || p)}
            </div>`).join('');
    }

    if (stockBajoEl) {
      const lista = stock.productosStockBajo || [];
      stockBajoEl.innerHTML = lista.length === 0
        ? '<p class="text-muted text-sm">Sin alertas</p>'
        : lista.map(p => `
            <div class="alerta-item">
              <span class="badge badge-warning" style="margin-right:6px;">${p.cantidad ?? '?'}</span>
              ${Utils.esc(p.nombre || p)}
            </div>`).join('');
    }
  }

  // ── Gráficos ─────────────────────────────────────────────────
  function renderGraficos(graficos) {
    crearGraficoVentasDia(graficos.ventasPorDia    || []);
    crearGraficoTopProductos(graficos.topProductos  || []);
    crearGraficoRubros(graficos.ventasPorRubro      || []);
    crearGraficoIngEgr(graficos.ingresosVsEgresos   || []);
  }

  function destroyChart(key) {
    if (window.KarnalesCharts[key]) {
      try { window.KarnalesCharts[key].destroy(); } catch {}
      delete window.KarnalesCharts[key];
    }
  }

  function baseOptions(extraScales = {}) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 11 } } },
        tooltip: {
          backgroundColor: '#1E1E1E',
          titleColor: CHART_DEFAULTS.color,
          bodyColor: CHART_DEFAULTS.textColor,
          borderColor: CHART_DEFAULTS.colorDim,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: CHART_DEFAULTS.textColor, font: { size: 10 } },
          grid:  { color: CHART_DEFAULTS.gridColor },
          ...extraScales.x,
        },
        y: {
          ticks: { color: CHART_DEFAULTS.textColor, font: { size: 10 } },
          grid:  { color: CHART_DEFAULTS.gridColor },
          ...extraScales.y,
        },
      },
    };
  }

  function crearGraficoVentasDia(data) {
    destroyChart('ventasDia');
    const canvas = document.getElementById('chart-ventas-dia');
    if (!canvas) return;
    window.KarnalesCharts.ventasDia = new Chart(canvas, {
      type: 'bar',
      data: {
        labels:   data.map(d => Utils.formatDate(d.fecha)),
        datasets: [{
          label: 'Ventas ($)',
          data:  data.map(d => d.total || 0),
          backgroundColor: CHART_DEFAULTS.colorDim,
          borderColor:     CHART_DEFAULTS.color,
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        ...baseOptions(),
        plugins: {
          ...baseOptions().plugins,
          legend: { display: false },
        },
      },
    });
  }

  function crearGraficoTopProductos(data) {
    destroyChart('topProductos');
    const canvas = document.getElementById('chart-top-productos');
    if (!canvas) return;
    window.KarnalesCharts.topProductos = new Chart(canvas, {
      type: 'bar',
      data: {
        labels:   data.map(d => d.nombre || d.producto || '?'),
        datasets: [{
          label: 'Unidades vendidas',
          data:  data.map(d => d.cantidad || 0),
          backgroundColor: CHART_DEFAULTS.color,
          borderRadius: 4,
        }],
      },
      options: {
        ...baseOptions({ x: {}, y: { beginAtZero: true } }),
        indexAxis: 'y',
        plugins: {
          ...baseOptions().plugins,
          legend: { display: false },
        },
      },
    });
  }

  function crearGraficoRubros(data) {
    destroyChart('rubros');
    const canvas = document.getElementById('chart-rubros');
    if (!canvas) return;

    const COLORS = [
      '#C9A84C','#E8C97A','#6B4A2A','#4ADE80','#F87171',
      '#60A5FA','#FBBF24','#A78BFA','#34D399','#FB923C',
    ];

    window.KarnalesCharts.rubros = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels:   data.map(d => d.rubro || '?'),
        datasets: [{
          data:            data.map(d => d.total || 0),
          backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]),
          borderColor:     '#141414',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: CHART_DEFAULTS.textColor, font: { size: 11 }, boxWidth: 12 },
          },
          tooltip: baseOptions().plugins.tooltip,
        },
        scales: {},
      },
    });
  }

  function crearGraficoIngEgr(data) {
    destroyChart('ingEgr');
    const canvas = document.getElementById('chart-ing-egr');
    if (!canvas) return;
    window.KarnalesCharts.ingEgr = new Chart(canvas, {
      type: 'bar',
      data: {
        labels:   data.map(d => d.mes || '?'),
        datasets: [
          {
            label: 'Ingresos',
            data:  data.map(d => d.ingresos || 0),
            backgroundColor: 'rgba(74,222,128,0.3)',
            borderColor:     CHART_DEFAULTS.success,
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Egresos',
            data:  data.map(d => Math.abs(d.egresos || 0)),
            backgroundColor: 'rgba(248,113,113,0.3)',
            borderColor:     CHART_DEFAULTS.danger,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: baseOptions(),
    });
  }

  // ── Helper ────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('btn-actualizar-reportes')?.addEventListener('click', cargar);
  }

  App.register('reportes', cargar);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
