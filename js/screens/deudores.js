/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Deudores
═══════════════════════════════════════════════════════════════ */

(function () {

  let todosLosDeudores = [];

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
      const pendiente = d.estado === 'Pendiente';
      const estadoBadge = pendiente
        ? `<span class="badge badge-danger">Pendiente</span>`
        : `<span class="badge badge-success">Pagado</span>`;

      const acciones = pendiente
        ? `<button class="btn btn-primary btn-sm" onclick="DeudoresScreen.cobrar('${Utils.esc(d.id)}','${Utils.esc(d.cliente)}','${d.monto}')">
             <i data-lucide="check" style="width:14px;"></i> Cobrar
           </button>`
        : `<span style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(d.fechaPago || '')}</span>`;

      return `<tr>
        <td style="font-size:var(--font-size-sm);">${Utils.esc(d.fecha)}</td>
        <td><strong>${Utils.esc(d.cliente || '—')}</strong></td>
        <td>${Utils.esc(d.producto || '—')}</td>
        <td style="font-weight:700;color:${pendiente ? 'var(--danger)' : 'var(--success)'};">
          ${Utils.formatMoney(d.monto)}
        </td>
        <td style="font-size:var(--font-size-sm);">${Utils.esc(d.vendedor || '—')}</td>
        <td>${estadoBadge}</td>
        <td>${acciones}</td>
      </tr>`;
    }).join('');

    UI.icons();
  }

  // ── Cobrar deuda ─────────────────────────────────────────────
  async function cobrar(id, cliente, monto) {
    const ok = await UI.confirm({
      message: `¿Cobrar deuda de ${Utils.esc(cliente)}?`,
      sub: `${Utils.formatMoney(Number(monto))} — se registrará como ingreso en Caja.`,
      icon: '💰',
      okText: 'Cobrar',
      okClass: 'btn-primary',
    });
    if (!ok) return;

    try {
      await API.cobrarDeuda({ id });
      UI.success('Deuda cobrada y registrada en caja');
      cargar();
    } catch {}
  }

  // ── Reporte PDF ──────────────────────────────────────────────
  function generarReportePDF() {
    const lista = todosLosDeudores.filter(d => d.estado === 'Pendiente');

    if (lista.length === 0) {
      UI.warning('No hay deudores pendientes para reportar.');
      return;
    }

    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const totalPendiente = lista.reduce((acc, d) => acc + d.monto, 0);

    const filas = lista.map(d => `<tr>
      <td>${Utils.esc(d.fecha)}</td>
      <td><strong>${Utils.esc(d.cliente || '—')}</strong></td>
      <td>${Utils.esc(d.producto || '—')}</td>
      <td class="monto">${Utils.formatMoney(d.monto)}</td>
      <td>${Utils.esc(d.vendedor || '—')}</td>
    </tr>`).join('');

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
      <th style="text-align:right;">Monto</th>
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
  window.DeudoresScreen = { cobrar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
