/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Movimientos
═══════════════════════════════════════════════════════════════ */

(function () {

  let paginaActual = 1;
  const LIMIT = 50;

  // ── Carga principal (inicializa fechas y carga usuarios) ─────
  async function cargar() {
    inicializarFechas();
    await cargarUsuarios();
    await buscar(1);
  }

  function inicializarFechas() {
    const hoy   = Utils.today();
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const desdeStr = desde.toISOString().slice(0, 10);

    const inpDesde = document.getElementById('mov-desde');
    const inpHasta = document.getElementById('mov-hasta');
    if (inpDesde && !inpDesde.value) inpDesde.value = desdeStr;
    if (inpHasta && !inpHasta.value) inpHasta.value = hoy;
  }

  async function cargarUsuarios() {
    try {
      const data = await API.getMovimientos({ page: 1, limit: 1 });
      if (!data?.usuarios) return;
      const sel = document.getElementById('mov-usuario');
      if (!sel) return;
      sel.innerHTML = '<option value="">Todos</option>';
      data.usuarios.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        sel.appendChild(opt);
      });
    } catch {}
  }

  // ── Buscar con filtros ───────────────────────────────────────
  async function buscar(page = 1) {
    paginaActual = page;

    const params = {
      page,
      limit: LIMIT,
    };

    const desde   = document.getElementById('mov-desde')?.value;
    const hasta   = document.getElementById('mov-hasta')?.value;
    const tipo    = document.getElementById('mov-tipo')?.value;
    const usuario = document.getElementById('mov-usuario')?.value;
    const texto   = document.getElementById('mov-buscar')?.value?.trim();

    if (desde)   params.desde   = desde;
    if (hasta)   params.hasta   = hasta;
    if (tipo)    params.tipo    = tipo;
    if (usuario) params.usuario = usuario;
    if (texto)   params.texto   = texto;

    try {
      const data = await API.getMovimientos(params);
      if (!data) return;
      renderResumen(data.resumen   || {});
      renderTabla(data.movimientos || []);
      UI.renderPagination('mov-paginacion', data.paginacion || { page: 1, totalPages: 1 }, buscar);
      setText('mov-total-registros', data.paginacion?.total ?? (data.movimientos?.length ?? 0));
    } catch (e) {
      console.error('Movimientos error:', e);
    }
  }

  // ── Resumen del período ──────────────────────────────────────
  function renderResumen(resumen) {
    setText('mov-total-ingresos', Utils.formatMoney(resumen.totalIngresos ?? 0));
    setText('mov-total-egresos',  Utils.formatMoney(Math.abs(resumen.totalEgresos ?? 0)));
  }

  // ── Tabla ────────────────────────────────────────────────────
  function renderTabla(movimientos) {
    const tbody = document.getElementById('tbody-movimientos');
    if (!tbody) return;

    if (movimientos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Sin movimientos para el período seleccionado</td></tr>`;
      return;
    }

    tbody.innerHTML = movimientos.map(m => {
      const monto    = Number(m.monto) || 0;
      const positivo = monto >= 0;
      return `<tr>
        <td>${Utils.formatDate(m.fecha)}</td>
        <td>${Utils.badgeTipo(m.tipo || (positivo ? 'Ingreso' : 'Egreso'))}</td>
        <td>${Utils.esc(m.concepto || '—')}</td>
        <td class="${positivo ? 'monto-positivo' : 'monto-negativo'}" style="font-weight:600;">
          ${positivo ? '' : '- '}${Utils.formatMoney(Math.abs(monto))}
        </td>
        <td>${Utils.esc(m.usuario || '—')}</td>
        <td style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(m.observaciones || '—')}</td>
        <td style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(m.referencia || '—')}</td>
      </tr>`;
    }).join('');
  }

  // ── Helper ────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('btn-filtrar-mov')?.addEventListener('click', () => buscar(1));

    // Enter en el campo de búsqueda
    document.getElementById('mov-buscar')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') buscar(1);
    });
  }

  // ── Registro en el router ────────────────────────────────────
  App.register('movimientos', cargar);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
