/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Exportar
═══════════════════════════════════════════════════════════════ */

(function () {

  // ── Carga principal ─────────────────────────────────────────
  function cargar() {
    // No carga datos al entrar, solo bindea botones
  }

  // ── Manejar click en botón exportar ─────────────────────────
  async function exportar(tipo, fmt) {
    try {
      UI.showLoader('Preparando datos...');
      const data = await API.getExportar({ tipo });
      UI.hideLoader();

      if (!data) return;

      const { titulo, columnas, datos } = data;
      const fecha    = Utils.today().replace(/-/g, '');
      const filename = `Karnales_${titulo.replace(/\s/g, '_')}_${fecha}`;

      if (fmt === 'xlsx') {
        Utils.downloadXLSX(columnas, datos, titulo, `${filename}.xlsx`);
        UI.success('Excel descargado');
      } else if (fmt === 'csv') {
        Utils.downloadCSV(columnas, datos, `${filename}.csv`);
        UI.success('CSV descargado');
      } else if (fmt === 'pdf') {
        Utils.downloadPDF(columnas, datos, titulo);
      }
    } catch (e) {
      UI.hideLoader();
      console.error('Exportar error:', e);
    }
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.querySelectorAll('[data-export][data-fmt]').forEach(btn => {
      btn.addEventListener('click', () => {
        exportar(btn.dataset.export, btn.dataset.fmt);
      });
    });
  }

  App.register('exportar', cargar);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
