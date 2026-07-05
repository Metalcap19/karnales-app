/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Deudores
═══════════════════════════════════════════════════════════════ */

(function () {

  let todosLosDeudores = [];

  // ── Modal de pago parcial (se crea una sola vez) ─────────────
  function asegurarModal() {
    if (document.getElementById('modal-pago-parcial')) return;

    const el = document.createElement('div');
    el.id        = 'modal-pago-parcial';
    el.className = 'modal-backdrop hidden';
    el.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <h3 class="modal-title">Registrar pago</h3>
          <button class="btn btn-ghost btn-sm" data-close="modal-pago-parcial">
            <i data-lucide="x" style="width:16px;"></i>
          </button>
        </div>
        <div class="modal-body">
          <div id="pago-info" style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-4);font-size:var(--font-size-sm);display:grid;gap:6px;"></div>
          <div class="form-group">
            <label class="form-label" for="pago-monto">Monto que paga ahora *</label>
            <input type="number" id="pago-monto" class="form-input" min="1" step="1" placeholder="0"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="pago-obs">Observaciones</label>
            <input type="text" id="pago-obs" class="form-input" placeholder="Opcional"/>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-close="modal-pago-parcial">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirmar-pago">
            <i data-lucide="check" style="width:16px;"></i> Confirmar pago
          </button>
        </div>
      </div>`;
    document.body.appendChild(el);
    UI.icons();
  }

  // ── Carga principal ─────────────────────────────────────────
  async function cargar() {
    try {
      const estado = document.getElementById('deudores-filtro-estado')?.value ?? 'Pendiente';
      const data   = await API.getDeudores(estado ? { estado } : {});
      if (!data) return;
      todosLosDeudores = data.deudores || [];
      renderKPIs(data);
      renderTabla();
    } catch (e) {
      console.error('Deudores load error:', e);
    }
  }

  // ── KPIs ────────────────────────────────────────────────────
  function renderKPIs(data) {
    const pendientes = todosLosDeudores.filter(d => d.estado === 'Pendiente');
    setText('kpi-total-deuda',    Utils.formatMoney(data.totalPendiente || 0));
    setText('kpi-cant-deudores',  pendientes.length);
  }

  // ── Render tabla ─────────────────────────────────────────────
  function renderTabla() {
    const buscar = (document.getElementById('deudores-buscar')?.value || '').toLowerCase();

    let lista = todosLosDeudores.filter(d => {
      if (buscar) {
        const hay = `${d.cliente} ${d.producto} ${d.vendedor}`.toLowerCase();
        if (!hay.includes(buscar)) return false;
      }
      return true;
    });

    const tbody = document.getElementById('tbody-deudores');
    if (!tbody) return;

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Sin deudores que coincidan</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(d => {
      const pendiente  = d.estado === 'Pendiente';
      const saldo      = d.saldo ?? d.monto;
      const abonado    = d.montoPagado || 0;
      const tienePagos = abonado > 0;

      const estadoBadge = pendiente
        ? `<span class="badge badge-danger">Pendiente</span>`
        : `<span class="badge badge-success">Pagado</span>`;

      const montoCol = pendiente
        ? `<div style="font-weight:700;color:var(--danger);">${Utils.formatMoney(saldo)}</div>
           ${tienePagos ? `<div style="font-size:var(--font-size-xs);color:var(--text-muted);">Total: ${Utils.formatMoney(d.monto)} · Abonado: ${Utils.formatMoney(abonado)}</div>` : ''}`
        : `<div style="font-weight:700;color:var(--success);">${Utils.formatMoney(d.monto)}</div>`;

      const acciones = pendiente
        ? `<button class="btn btn-primary btn-sm"
             onclick="DeudoresScreen.abrirPago('${Utils.esc(d.id)}','${Utils.esc(d.cliente)}',${d.monto},${saldo},${abonado})">
             <i data-lucide="banknote" style="width:14px;"></i> Cobrar
           </button>`
        : `<span style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(d.fechaPago || '')}</span>`;

      return `<tr>
        <td style="font-size:var(--font-size-sm);">${Utils.esc(d.fecha)}</td>
        <td><strong>${Utils.esc(d.cliente || '—')}</strong></td>
        <td>${Utils.esc(d.producto || '—')}</td>
        <td>${montoCol}</td>
        <td style="font-size:var(--font-size-sm);">${Utils.esc(d.vendedor || '—')}</td>
        <td>${estadoBadge}</td>
        <td>${acciones}</td>
      </tr>`;
    }).join('');

    UI.icons();
  }

  // ── Abrir modal de pago ───────────────────────────────────────
  function abrirPago(id, cliente, monto, saldo, abonado) {
    asegurarModal();

    const infoEl = document.getElementById('pago-info');
    infoEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);">Cliente</span>
        <strong>${Utils.esc(cliente)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);">Deuda original</span>
        <span>${Utils.formatMoney(monto)}</span>
      </div>
      ${abonado > 0 ? `
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--text-muted);">Ya abonado</span>
        <span style="color:var(--success);">${Utils.formatMoney(abonado)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px;margin-top:2px;">
        <span style="font-weight:600;">Saldo pendiente</span>
        <span style="font-weight:700;color:var(--danger);">${Utils.formatMoney(saldo)}</span>
      </div>`;

    const montoInput = document.getElementById('pago-monto');
    const obsInput   = document.getElementById('pago-obs');
    montoInput.value = saldo;
    obsInput.value   = '';
    montoInput.max   = saldo;

    UI.openModal('modal-pago-parcial');
    setTimeout(() => montoInput.focus(), 100);

    const btnConfirmar = document.getElementById('btn-confirmar-pago');
    const nuevo = btnConfirmar.cloneNode(true);
    btnConfirmar.replaceWith(nuevo);

    nuevo.addEventListener('click', async () => {
      const montoParcial = Number(montoInput.value);
      if (!montoParcial || montoParcial <= 0) { UI.warning('Ingresá un monto válido'); return; }
      if (montoParcial > saldo)               { UI.warning(`El monto no puede superar el saldo (${Utils.formatMoney(saldo)})`); return; }

      try {
        const res = await API.cobrarDeuda({ id, montoParcial, observaciones: obsInput.value.trim() });
        if (!res) return;
        UI.closeModal('modal-pago-parcial');
        UI.success(res.mensaje || 'Pago registrado');
        cargar();
      } catch {}
    }, { once: true });
  }

  // ── Reporte PDF ──────────────────────────────────────────────
  function generarReportePDF() {
    const lista = todosLosDeudores.filter(d => d.estado === 'Pendiente');

    if (lista.length === 0) {
      UI.warning('No hay deudores pendientes para reportar.');
      return;
    }

    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const totalPendiente = lista.reduce((acc, d) => acc + (d.saldo ?? d.monto), 0);

    const filas = lista.map(d => {
      const saldo   = d.saldo ?? d.monto;
      const abonado = d.montoPagado || 0;
      return `<tr>
        <td>${Utils.esc(d.fecha)}</td>
        <td><strong>${Utils.esc(d.cliente || '—')}</strong></td>
        <td>${Utils.esc(d.producto || '—')}</td>
        <td class="monto">${Utils.formatMoney(saldo)}${abonado > 0 ? `<br/><span style="font-size:10px;color:#888;">Abonado: ${Utils.formatMoney(abonado)}</span>` : ''}</td>
        <td>${Utils.esc(d.vendedor || '—')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Reporte Deudores — Karnales</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:12px; color:#1a1a1a; background:#fff; padding:24px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; border-bottom:2px solid #c9a84c; padding-bottom:12px; }
  .logo   { font-size:22px; font-weight:800; letter-spacing:2px; }
  .logo span { color:#c9a84c; }
  .meta   { text-align:right; color:#555; font-size:11px; line-height:1.6; }
  .meta strong { color:#1a1a1a; font-size:13px; }
  table { width:100%; border-collapse:collapse; }
  thead tr { background:#1a1a1a; color:#c9a84c; }
  th { padding:8px 10px; text-align:left; font-size:11px; text-transform:uppercase; }
  td { padding:7px 10px; border-bottom:1px solid #eee; vertical-align:middle; }
  tr:nth-child(even) td { background:#fafaf8; }
  .monto { text-align:right; font-weight:700; color:#b91c1c; }
  .total-row td { font-weight:700; background:#fff8e7; border-top:2px solid #c9a84c; }
  .total-row .monto { color:#1a7a4a; font-size:14px; }
  .footer { margin-top:20px; text-align:center; font-size:10px; color:#aaa; border-top:1px solid #eee; padding-top:10px; }
  @media print { body { padding:10px; } @page { margin:1.5cm; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">KARNA<span>LES</span></div>
  <div class="meta">
    <strong>Reporte de Deudores</strong><br/>
    Fecha: ${fecha}<br/>
    ${lista.length} deudor${lista.length !== 1 ? 'es' : ''} pendiente${lista.length !== 1 ? 's' : ''}
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Fecha venta</th>
      <th>Cliente</th>
      <th>Producto</th>
      <th style="text-align:right;">Saldo</th>
      <th>Vendedor</th>
    </tr>
  </thead>
  <tbody>
    ${filas}
    <tr class="total-row">
      <td colspan="3"><strong>TOTAL PENDIENTE</strong></td>
      <td class="monto">${Utils.formatMoney(totalPendiente)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div class="footer">Karnales — Sistema de Gestión · Generado el ${fecha}</div>
<script>window.addEventListener('load', function(){ window.print(); });<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { UI.warning('El navegador bloqueó la ventana emergente. Habilitala para este sitio.'); return; }
    win.document.write(html);
    win.document.close();
  }

  // ── Helpers ──────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('deudores-filtro-estado')?.addEventListener('change', cargar);
    document.getElementById('deudores-buscar')?.addEventListener('input', Utils.debounce(renderTabla, 250));
    document.getElementById('btn-reporte-deudores')?.addEventListener('click', generarReportePDF);
  }

  App.register('deudores', cargar);
  window.DeudoresScreen = { abrirPago };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
