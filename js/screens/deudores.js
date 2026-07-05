/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Deudores
═══════════════════════════════════════════════════════════════ */

(function () {

  let todosLosDeudores = [];
  let cobradosVisible  = false;

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
      const data = await API.getDeudores({});   // todos, sin filtro de estado
      if (!data) return;
      todosLosDeudores = data.deudores || [];
      renderKPIs(data);
      renderTabla();
      renderCobradas();
    } catch (e) {
      console.error('Deudores load error:', e);
    }
  }

  // ── KPIs ────────────────────────────────────────────────────
  function renderKPIs(data) {
    const pendientes = todosLosDeudores.filter(d => d.estado === 'Pendiente');
    setText('kpi-total-deuda',   Utils.formatMoney(data.totalPendiente || 0));
    setText('kpi-cant-deudores', pendientes.length);
  }

  // ── Tabla de pendientes ──────────────────────────────────────
  function renderTabla() {
    const buscar = (document.getElementById('deudores-buscar')?.value || '').toLowerCase();

    const lista = todosLosDeudores.filter(d => {
      if (d.estado !== 'Pendiente') return false;
      if (buscar) {
        const hay = `${d.cliente} ${d.producto} ${d.vendedor}`.toLowerCase();
        if (!hay.includes(buscar)) return false;
      }
      return true;
    });

    const tbody = document.getElementById('tbody-deudores');
    if (!tbody) return;

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Sin deudores pendientes</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(d => {
      const saldo    = d.saldo ?? d.monto;
      const abonado  = d.montoPagado || 0;

      const montoCol = `
        <div style="font-weight:700;color:var(--danger);">${Utils.formatMoney(saldo)}</div>
        ${abonado > 0
          ? `<div style="font-size:var(--font-size-xs);color:var(--text-muted);">Original: ${Utils.formatMoney(d.monto)} · Abonado: ${Utils.formatMoney(abonado)}</div>`
          : `<div style="font-size:var(--font-size-xs);color:var(--text-muted);">Deuda original: ${Utils.formatMoney(d.monto)}</div>`}`;

      return `<tr>
        <td style="font-size:var(--font-size-sm);">${Utils.esc(d.fecha)}</td>
        <td><strong>${Utils.esc(d.cliente || '—')}</strong></td>
        <td>${Utils.esc(d.producto || '—')}</td>
        <td>${montoCol}</td>
        <td style="font-size:var(--font-size-sm);">${Utils.esc(d.vendedor || '—')}</td>
        <td><span class="badge badge-danger">Pendiente</span></td>
        <td>
          <button class="btn btn-primary btn-sm"
            onclick="DeudoresScreen.abrirPago('${Utils.esc(d.id)}','${Utils.esc(d.cliente)}',${d.monto},${saldo},${abonado})">
            <i data-lucide="banknote" style="width:14px;"></i> Cobrar
          </button>
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" title="PDF deudor"
            onclick="DeudoresScreen.imprimirDeudor('${Utils.esc(d.id)}')">
            <i data-lucide="printer" style="width:14px;"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

    UI.icons();
  }

  // ── Tabla de cobradas ────────────────────────────────────────
  function renderCobradas() {
    const lista = todosLosDeudores.filter(d => d.estado === 'Pagado');
    const tbody = document.getElementById('tbody-cobradas');
    if (!tbody) return;

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Sin deudas cobradas</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(d => `<tr>
      <td style="font-size:var(--font-size-sm);">${Utils.esc(d.fecha)}</td>
      <td><strong>${Utils.esc(d.cliente || '—')}</strong></td>
      <td>${Utils.esc(d.producto || '—')}</td>
      <td style="font-weight:700;color:var(--success);">${Utils.formatMoney(d.monto)}</td>
      <td style="font-size:var(--font-size-sm);">${Utils.esc(d.vendedor || '—')}</td>
      <td style="font-size:var(--font-size-sm);">${Utils.esc(d.fechaPago || '—')}</td>
      <td>
        <button class="btn btn-ghost btn-sm" title="Reimprimir comprobante"
          onclick="DeudoresScreen.imprimirDeudor('${Utils.esc(d.id)}')">
          <i data-lucide="printer" style="width:14px;"></i>
        </button>
      </td>
    </tr>`).join('');

    UI.icons();
  }

  // ── Toggle sección cobradas ──────────────────────────────────
  function toggleCobradas() {
    const container = document.getElementById('cobradas-container');
    const btn       = document.getElementById('btn-toggle-cobradas');
    if (!container) return;
    cobradosVisible = !cobradosVisible;
    container.classList.toggle('hidden', !cobradosVisible);
    btn.innerHTML = cobradosVisible
      ? `<i data-lucide="chevron-up" style="width:14px;"></i> Ocultar`
      : `<i data-lucide="chevron-down" style="width:14px;"></i> Mostrar`;
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
      if (montoParcial > saldo) { UI.warning(`El monto no puede superar el saldo (${Utils.formatMoney(saldo)})`); return; }

      try {
        const res = await API.cobrarDeuda({ id, montoParcial, observaciones: obsInput.value.trim() });
        if (!res) return;
        UI.closeModal('modal-pago-parcial');
        UI.success(res.mensaje || 'Pago registrado');
        await cargar();
        if (res.esFinal) {
          const deudor = todosLosDeudores.find(d => d.id === id);
          if (deudor) generarPDFDeudor(deudor);
        }
      } catch {}
    }, { once: true });
  }

  // ── PDF individual del deudor ─────────────────────────────────
  function imprimirDeudor(id) {
    const d = todosLosDeudores.find(x => x.id === id);
    if (!d) { UI.warning('No se encontró el deudor'); return; }
    generarPDFDeudor(d);
  }

  function generarPDFDeudor(d) {
    const config  = window.KarnalesConfig || {};
    const negocio = config.nombreNegocio || 'Karnales';
    const hex     = config.colorAcento   || '#C9A84C';
    const dir     = config.direccion     || '';
    const tel     = config.telefono      || '';
    const metaLine = [dir, tel ? `Tel: ${tel}` : ''].filter(Boolean).join(' · ');

    const esPagado      = d.estado === 'Pagado';
    const saldo         = d.saldo ?? d.monto;
    const historial     = d.historialPagos || [];
    // precioOriginal = precio total del producto; si no existe (deudas viejas) usamos monto + lo pagado al comprar
    const precioOriginal = d.precioOriginal || (d.monto + (historial[0]?.monto || 0));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });

    const W  = 148;
    const M  = 14;
    const RW = W - M;
    const cr = parseInt(hex.slice(1, 3), 16);
    const cg = parseInt(hex.slice(3, 5), 16);
    const cb = parseInt(hex.slice(5, 7), 16);

    let y = M + 4;

    // ── encabezado ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(cr, cg, cb);
    doc.text(negocio.toUpperCase(), W / 2, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(esPagado ? 'COMPROBANTE DE PAGO' : 'ESTADO DE CUENTA', W / 2, y, { align: 'center' });
    y += 4;

    if (metaLine) {
      doc.text(metaLine, W / 2, y, { align: 'center' });
      y += 4;
    }

    doc.setDrawColor(cr, cg, cb);
    doc.setLineWidth(0.4);
    doc.line(M, y, RW, y);
    y += 5;

    function fila(label, valor, colorVal) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(label, M, y);
      if (colorVal) doc.setTextColor(...colorVal);
      else          doc.setTextColor(50, 50, 50);
      doc.text(String(valor), RW, y, { align: 'right' });
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.1);
      doc.line(M, y + 1.5, RW, y + 1.5);
      y += 6;
    }

    function separador() {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(M, y, RW, y);
      y += 4;
    }

    // ── datos del deudor ──
    fila('Cliente',     d.cliente  || '—');
    fila('Producto',    d.producto || '—');
    fila('Fecha venta', d.fecha    || '—');
    if (d.vendedor) fila('Vendedor', d.vendedor);

    separador();

    // ── precio original ──
    fila('Precio original', Utils.formatMoney(precioOriginal));

    // ── cada entrega con su fecha ──
    if (historial.length > 0) {
      historial.forEach((p, i) => {
        const label = i === 0 && historial.length > 0 && d.precioOriginal
          ? `Entregado al comprar (${p.fecha})`
          : `Entregado (${p.fecha})`;
        fila(label, Utils.formatMoney(p.monto), [22, 101, 52]);
      });
    }

    // ── saldo ──
    y += 2;
    if (esPagado) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(22, 101, 52);
      doc.text('DEUDA SALDADA', M, y);
      if (d.fechaPago) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(d.fechaPago, RW, y, { align: 'right' });
      }
      y += 8;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text('SALDO PENDIENTE', M, y);
      doc.setFontSize(14);
      doc.setTextColor(185, 28, 28);
      doc.text(Utils.formatMoney(saldo), RW, y, { align: 'right' });
      y += 8;
    }

    // ── pie ──
    y += 4;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(M, y, RW, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      esPagado ? 'Gracias por saldar su deuda' : 'Documento informativo de estado de cuenta',
      W / 2, y, { align: 'center' }
    );

    const nombreArchivo = `${esPagado ? 'Comprobante' : 'EstadoCuenta'}-${(d.cliente || d.id).replace(/[^a-zA-Z0-9]/g, '')}.pdf`;
    doc.save(nombreArchivo);
  }

  // ── Reporte PDF todos los pendientes ─────────────────────────
  function generarReportePDF() {
    const lista = todosLosDeudores.filter(d => d.estado === 'Pendiente');

    if (lista.length === 0) {
      UI.warning('No hay deudores pendientes para reportar.');
      return;
    }

    const config    = window.KarnalesConfig || {};
    const negocio   = config.nombreNegocio  || 'Karnales';
    const hex       = config.colorAcento    || '#C9A84C';
    const fecha     = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const totalPend = lista.reduce((acc, d) => acc + (d.saldo ?? d.monto), 0);

    const filas = lista.map(d => {
      const saldo   = d.saldo ?? d.monto;
      const abonado = d.montoPagado || 0;
      return `<tr>
        <td>${Utils.esc(d.fecha)}</td>
        <td><strong>${Utils.esc(d.cliente || '—')}</strong></td>
        <td>${Utils.esc(d.producto || '—')}</td>
        <td class="num">${Utils.formatMoney(d.monto)}</td>
        <td class="num" style="color:#b91c1c;">${Utils.formatMoney(saldo)}${abonado > 0 ? `<br/><span style="font-size:10px;color:#888;">Abonado: ${Utils.formatMoney(abonado)}</span>` : ''}</td>
        <td>${Utils.esc(d.vendedor || '—')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Reporte Deudores</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;padding:24px;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid ${hex};padding-bottom:12px;}
  .logo{font-size:22px;font-weight:800;letter-spacing:2px;color:${hex};}
  .meta{text-align:right;color:#444;font-size:11px;line-height:1.6;}
  .meta strong{color:#1a1a1a;font-size:13px;}
  table{width:100%;border-collapse:collapse;}
  thead tr{background:#1a1a1a;color:${hex};}
  th{padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;}
  td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top;}
  tr:nth-child(even) td{background:#fafaf8;}
  .num{text-align:right;font-weight:600;}
  .tot td{font-weight:700;background:#fff8e7;border-top:2px solid ${hex};}
  .tot .num{color:#166534;font-size:14px;}
  .footer{margin-top:20px;text-align:center;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:10px;}
  @media print{body{padding:10px;}@page{margin:1.5cm;}}
</style></head><body>
<div class="hdr">
  <div class="logo">${Utils.esc(negocio.toUpperCase())}</div>
  <div class="meta">
    <strong>Reporte de Deudores</strong><br/>
    Fecha: ${fecha}<br/>
    ${lista.length} deudor${lista.length !== 1 ? 'es' : ''} pendiente${lista.length !== 1 ? 's' : ''}
  </div>
</div>
<table>
  <thead><tr>
    <th>Fecha venta</th><th>Cliente</th><th>Producto</th>
    <th style="text-align:right;">Deuda orig.</th>
    <th style="text-align:right;">Saldo</th>
    <th>Vendedor</th>
  </tr></thead>
  <tbody>
    ${filas}
    <tr class="tot">
      <td colspan="4"><strong>TOTAL SALDO PENDIENTE</strong></td>
      <td class="num">${Utils.formatMoney(totalPend)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div class="footer">${Utils.esc(negocio)} — Sistema de Gestión · Generado el ${fecha}</div>
<script>window.addEventListener('load',function(){window.print();});<\/script>
</body></html>`;

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
    document.getElementById('deudores-buscar')?.addEventListener('input', Utils.debounce(renderTabla, 250));
    document.getElementById('btn-reporte-deudores')?.addEventListener('click', generarReportePDF);
    document.getElementById('btn-toggle-cobradas')?.addEventListener('click', toggleCobradas);
  }

  App.register('deudores', cargar);
  window.DeudoresScreen = { abrirPago, imprimirDeudor };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
