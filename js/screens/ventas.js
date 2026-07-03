/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Ventas
═══════════════════════════════════════════════════════════════ */

(function () {

  let productosCache = [];
  let ventasHoyCache = [];

  // ── Carga principal ─────────────────────────────────────────
  async function cargar() {
    await Promise.all([cargarProductos(), cargarVentasHoy()]);
  }

  async function cargarProductos() {
    try {
      const data = await API.getProductos();
      if (!data) return;
      productosCache = (data.productos || []).filter(p =>
        p.activo === true || p.activo === 'true' || p.activo === 'TRUE'
      );
      poblarSelectProductos();
    } catch (e) {
      console.error('Ventas: error cargando productos', e);
    }
  }

  async function cargarVentasHoy() {
    try {
      const data = await API.getVentas({ fecha: 'hoy' });
      if (!data) return;
      renderHistorialHoy(data.ventas || []);
    } catch (e) {
      console.error('Ventas: error cargando ventas de hoy', e);
    }
  }

  // ── Poblar select de productos ────────────────────────────────
  function poblarSelectProductos() {
    const sel = document.getElementById('venta-producto');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Seleccioná un producto —</option>';
    productosCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.nombre}${p.talle ? ' · T' + p.talle : ''} (Stock: ${p.cantidad || 0})`;
      opt.dataset.precio   = p.precioVenta  || 0;
      opt.dataset.cantidad = p.cantidad     || 0;
      opt.dataset.imagen   = p.imagen       || '';
      opt.dataset.talle    = p.talle        || '';
      if ((Number(p.cantidad) || 0) === 0) opt.disabled = true;
      sel.appendChild(opt);
    });
  }

  // ── Info stock al seleccionar producto ────────────────────────
  function actualizarStockInfo() {
    const sel      = document.getElementById('venta-producto');
    const infoEl   = document.getElementById('venta-stock-info');
    const precioEl = document.getElementById('venta-precio');

    if (!sel || !infoEl) return;

    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
      infoEl.innerHTML = '';
      if (precioEl) precioEl.value = '';
      actualizarImagenVenta('');
      calcularPreview();
      return;
    }

    const cantidad = Number(opt.dataset.cantidad) || 0;
    const precio   = Number(opt.dataset.precio)   || 0;

    if (precioEl) precioEl.value = precio;
    actualizarImagenVenta(opt.dataset.imagen || '');

    const STOCK_MIN = 3;
    if (cantidad === 0) {
      infoEl.innerHTML = `<span class="stock-disponible-agotado">Sin stock disponible</span>`;
    } else if (cantidad <= STOCK_MIN) {
      infoEl.innerHTML = `<span class="stock-disponible-bajo">Stock bajo: ${cantidad} unidades</span>`;
    } else {
      infoEl.innerHTML = `<span class="stock-disponible-ok">Disponible: ${cantidad} unidades</span>`;
    }

    calcularPreview();
  }

  // ── Imagen del producto seleccionado ─────────────────────────
  function actualizarImagenVenta(url) {
    const imgEl = document.getElementById('venta-producto-img');
    if (!imgEl) return;
    if (url) { imgEl.src = url; imgEl.classList.remove('hidden'); }
    else      { imgEl.src = ''; imgEl.classList.add('hidden'); }
  }

  // ── Pago dividido ─────────────────────────────────────────────
  function actualizarZonaDeuda() {
    const formaPago = document.getElementById('venta-forma-pago')?.value || '';
    const zona      = document.getElementById('venta-deuda-zona');
    const labelCliente = document.getElementById('venta-cliente-label');

    if (formaPago === 'A pagar') {
      if (zona) zona.classList.add('hidden');
      if (labelCliente) labelCliente.textContent = 'Cliente *';
      syncDeudaTotal();
    } else {
      if (zona) zona.classList.remove('hidden');
      if (labelCliente) labelCliente.textContent = 'Cliente';
      calcularPreview();
    }
  }

  function syncDeudaTotal() {
    const total = getTotal();
    const pagadoEl = document.getElementById('venta-monto-pagado');
    const deudaEl  = document.getElementById('venta-monto-deuda');
    if (pagadoEl) pagadoEl.value = 0;
    if (deudaEl)  deudaEl.value  = total.toFixed(2);
    actualizarPreviewDeuda(total, 0);
  }

  function actualizarDeudaDesdeInput() {
    const total       = getTotal();
    const pagadoEl    = document.getElementById('venta-monto-pagado');
    const deudaEl     = document.getElementById('venta-monto-deuda');
    const pagado      = Math.min(Math.max(Number(pagadoEl?.value) || 0, 0), total);
    const deuda       = parseFloat((total - pagado).toFixed(2));
    if (deudaEl) deudaEl.value = deuda;
    actualizarPreviewDeuda(deuda, pagado);
  }

  function actualizarPreviewDeuda(deuda, pagado) {
    const deudaRow  = document.getElementById('prev-deuda-row');
    const ahoraRow  = document.getElementById('prev-ahora-row');
    const deudaEl   = document.getElementById('prev-deuda');
    const ahoraEl   = document.getElementById('prev-ahora');

    if (deuda > 0) {
      if (deudaRow) deudaRow.style.display = '';
      if (ahoraRow) ahoraRow.style.display = '';
      if (deudaEl)  deudaEl.textContent    = Utils.formatMoney(deuda);
      if (ahoraEl)  ahoraEl.textContent    = Utils.formatMoney(pagado);
    } else {
      if (deudaRow) deudaRow.style.display = 'none';
      if (ahoraRow) ahoraRow.style.display = 'none';
    }
  }

  function getTotal() {
    const cantidad  = Number(document.getElementById('venta-cantidad')?.value)  || 0;
    const precio    = Number(document.getElementById('venta-precio')?.value)    || 0;
    const descuento = Number(document.getElementById('venta-descuento')?.value) || 0;
    return parseFloat(((precio * cantidad) * (1 - descuento / 100)).toFixed(2));
  }

  // ── Preview de precio ─────────────────────────────────────────
  function calcularPreview() {
    const cantidad  = Number(document.getElementById('venta-cantidad')?.value)  || 0;
    const precio    = Number(document.getElementById('venta-precio')?.value)    || 0;
    const descuento = Number(document.getElementById('venta-descuento')?.value) || 0;

    const subtotal  = precio * cantidad;
    const descMonto = subtotal * (descuento / 100);
    const total     = subtotal - descMonto;

    setText('prev-subtotal',  Utils.formatMoney(subtotal));
    setText('prev-descuento', '- ' + Utils.formatMoney(descMonto));
    setText('prev-total',     Utils.formatMoney(total));

    const formaPago = document.getElementById('venta-forma-pago')?.value || '';
    if (formaPago === 'A pagar') {
      syncDeudaTotal();
    } else {
      actualizarDeudaDesdeInput();
    }
  }

  // ── Historial de hoy ──────────────────────────────────────────
  function renderHistorialHoy(ventas) {
    ventasHoyCache = ventas;
    const tbody   = document.getElementById('tbody-ventas-hoy');
    const totalEl = document.getElementById('total-ventas-hoy');
    if (!tbody) return;

    const total = ventas.reduce((acc, v) => acc + (Number(v.precioFinal) || 0), 0);
    if (totalEl) totalEl.textContent = Utils.formatMoney(total);

    if (ventas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Sin ventas hoy</td></tr>`;
      return;
    }

    const sorted = [...ventas].sort((a, b) => (b.idVenta || '').localeCompare(a.idVenta || ''));

    tbody.innerHTML = sorted.map(v => {
      const tieneDeuda = (Number(v.montoDeuda) || 0) > 0;
      return `<tr>
        <td>
          <div style="font-weight:500;">${Utils.esc(v.producto || '—')}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(v.idVenta || '')}</div>
        </td>
        <td>${v.cantidad || 1}</td>
        <td class="monto-positivo">${Utils.formatMoney(v.precioFinal)}</td>
        <td>
          ${Utils.esc(v.formaPago || '—')}
          ${tieneDeuda ? `<br/><span style="font-size:var(--font-size-xs);color:var(--danger);">Debe: ${Utils.formatMoney(v.montoDeuda)}</span>` : ''}
        </td>
        <td>${Utils.esc(v.cliente || '—')}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="VentasScreen.imprimirComprobante('${Utils.esc(v.idVenta || '')}')" title="Imprimir comprobante">
            <i data-lucide="printer" style="width:14px;"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

    UI.icons();
  }

  // ── Comprobante de venta ──────────────────────────────────────
  function generarComprobante(datos) {
    const config   = window.KarnalesConfig || {};
    const negocio  = config.nombreNegocio || 'Karnales';
    const color    = config.colorAcento   || '#C9A84C';
    const dir      = config.direccion     || '';
    const tel      = config.telefono      || '';

    const {
      idVenta, fecha, producto, talle, cantidad,
      precioUnitario, descuento, total,
      formaPago, cliente, observaciones,
      montoDeuda, montoPagadoAhora, vendedor,
    } = datos;

    const tieneDeuda = (montoDeuda || 0) > 0;
    const tieneDesc  = (descuento  || 0) > 0;
    const subtotal   = (precioUnitario || 0) * (cantidad || 1);
    const metaLines  = [dir, tel ? `Tel: ${tel}` : ''].filter(Boolean).join(' · ');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Comprobante ${Utils.esc(idVenta || '')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,Helvetica,sans-serif;background:#141414;color:#E8E0D5;display:flex;justify-content:center;padding:24px;}
  .v{width:480px;background:#1E1E1E;border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:28px 32px;}
  .hdr{text-align:center;border-bottom:2px solid ${color};padding-bottom:14px;margin-bottom:14px;}
  .neg{font-size:22px;font-weight:800;letter-spacing:2px;color:${color};}
  .tit{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8A8078;margin-top:4px;}
  .meta{font-size:11px;color:#8A8078;margin-top:6px;}
  .row{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,.06);}
  .lbl{color:#8A8078;}
  .val{font-weight:500;text-align:right;}
  .sec{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);}
  .total .lbl{color:#E8E0D5;font-weight:700;font-size:14px;}
  .total .val{color:${color};font-weight:800;font-size:20px;}
  .deuda .val{color:#F87171;}
  .ahora .val{color:#4ADE80;}
  .ftr{text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid rgba(201,168,76,.2);font-size:11px;color:#8A8078;}
  @media print{
    body{background:#fff;color:#111;padding:0;}
    .v{background:#fff;border:1px solid #ccc;color:#111;width:100%;border-radius:0;}
    .neg{color:${color};}
    .lbl{color:#555;}
    .total .lbl{color:#111;}
    .total .val{color:${color};}
    .deuda .val{color:#b91c1c;}
    .ahora .val{color:#166534;}
    .ftr{color:#aaa;border-top:1px solid #eee;}
    .row{border-bottom:1px solid #eee;}
  }
</style>
</head>
<body>
<div class="v">
  <div class="hdr">
    <div class="neg">${Utils.esc(negocio.toUpperCase())}</div>
    <div class="tit">Comprobante de Venta</div>
    ${metaLines ? `<div class="meta">${Utils.esc(metaLines)}</div>` : ''}
  </div>

  <div class="row"><span class="lbl">N° Venta</span><span class="val">${Utils.esc(idVenta || '—')}</span></div>
  <div class="row"><span class="lbl">Fecha</span><span class="val">${Utils.esc(fecha || '—')}</span></div>
  <div class="row"><span class="lbl">Vendedor</span><span class="val">${Utils.esc(vendedor || '—')}</span></div>

  <div class="sec">
    <div class="row"><span class="lbl">Producto</span><span class="val">${Utils.esc(producto || '—')}</span></div>
    ${talle ? `<div class="row"><span class="lbl">Talle</span><span class="val">${Utils.esc(talle)}</span></div>` : ''}
    <div class="row"><span class="lbl">Cantidad</span><span class="val">${cantidad || 1}</span></div>
    <div class="row"><span class="lbl">Precio unitario</span><span class="val">${Utils.formatMoney(precioUnitario)}</span></div>
    ${tieneDesc ? `<div class="row"><span class="lbl">Subtotal</span><span class="val">${Utils.formatMoney(subtotal)}</span></div>
    <div class="row"><span class="lbl">Descuento ${descuento}%</span><span class="val">- ${Utils.formatMoney(subtotal - total)}</span></div>` : ''}
    <div class="row total"><span class="lbl">TOTAL</span><span class="val">${Utils.formatMoney(total)}</span></div>
  </div>

  <div class="sec">
    <div class="row"><span class="lbl">Forma de pago</span><span class="val">${Utils.esc(formaPago || '—')}</span></div>
    ${tieneDeuda ? `
    <div class="row ahora"><span class="lbl">Pagado ahora</span><span class="val">${Utils.formatMoney(montoPagadoAhora)}</span></div>
    <div class="row deuda"><span class="lbl">Queda a pagar</span><span class="val">${Utils.formatMoney(montoDeuda)}</span></div>` : ''}
  </div>

  ${(cliente || observaciones) ? `
  <div class="sec">
    ${cliente       ? `<div class="row"><span class="lbl">Cliente</span><span class="val">${Utils.esc(cliente)}</span></div>` : ''}
    ${observaciones ? `<div class="row"><span class="lbl">Obs.</span><span class="val">${Utils.esc(observaciones)}</span></div>` : ''}
  </div>` : ''}

  <div class="ftr">Gracias por su compra</div>
</div>
<script>window.addEventListener('load',function(){window.print();});<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      UI.warning('El navegador bloqueó la ventana emergente. Habilitala para este sitio.');
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  function imprimirComprobante(idVenta) {
    const v = ventasHoyCache.find(x => x.idVenta === idVenta);
    if (!v) { UI.warning('No se encontró la venta'); return; }
    const user = Auth.getUser();
    generarComprobante({
      idVenta:          v.idVenta,
      fecha:            v.fecha,
      producto:         v.producto,
      talle:            v.talle || '',
      cantidad:         v.cantidad,
      precioUnitario:   v.precioUnitario,
      descuento:        v.descuento,
      total:            v.precioFinal,
      formaPago:        v.formaPago,
      cliente:          v.cliente,
      observaciones:    v.observaciones,
      montoDeuda:       v.montoDeuda || 0,
      montoPagadoAhora: (v.precioFinal || 0) - (v.montoDeuda || 0),
      vendedor:         v.usuario || user?.nombre || '',
    });
  }

  // ── Confirmar venta ───────────────────────────────────────────
  async function confirmarVenta(e) {
    e.preventDefault();

    const productoId = document.getElementById('venta-producto').value;
    const cantidad   = Number(document.getElementById('venta-cantidad').value)   || 0;
    const precio     = Number(document.getElementById('venta-precio').value)     || 0;
    const descuento  = Number(document.getElementById('venta-descuento').value)  || 0;
    const formaPago  = document.getElementById('venta-forma-pago').value;
    const cliente    = document.getElementById('venta-cliente').value.trim();
    const observ     = document.getElementById('venta-observaciones').value.trim();

    const total      = getTotal();
    const formaPagoEfectiva = formaPago === 'A pagar' ? 'A pagar' : formaPago;
    const montoDeuda = formaPago === 'A pagar'
      ? total
      : Math.max(Number(document.getElementById('venta-monto-deuda')?.value) || 0, 0);

    // Validaciones
    if (!productoId)  { UI.warning('Seleccioná un producto');         return; }
    if (cantidad < 1) { UI.warning('La cantidad debe ser mayor a 0'); return; }
    if (precio   < 1) { UI.warning('El precio debe ser mayor a 0');   return; }
    if (!formaPago)   { UI.warning('Seleccioná forma de pago');       return; }
    if (montoDeuda > 0 && !cliente) {
      UI.warning('El nombre del cliente es requerido cuando queda algo a pagar');
      return;
    }

    const opt = document.querySelector(`#venta-producto option[value="${productoId}"]`);
    const stockDisp = Number(opt?.dataset.cantidad) || 0;
    if (cantidad > stockDisp) {
      UI.error(`Stock insuficiente. Disponible: ${stockDisp}`);
      return;
    }

    const montoPagadoAhora = total - montoDeuda;
    const subText = montoDeuda > 0
      ? `Total: ${Utils.formatMoney(total)} · Paga ahora: ${Utils.formatMoney(montoPagadoAhora)} · A pagar: ${Utils.formatMoney(montoDeuda)}`
      : `${Utils.formatMoney(total)} total`;

    const ok = await UI.confirm({
      message: '¿Confirmar venta?',
      sub: subText,
      icon: '🛒',
      okText: 'Confirmar',
      okClass: 'btn-primary',
    });
    if (!ok) return;

    try {
      await API.createVenta({
        productoId,
        cantidad,
        precioUnitario: precio,
        descuento,
        formaPago: formaPagoEfectiva,
        cliente,
        observaciones: observ,
        montoDeuda,
      });

      UI.success(montoDeuda > 0
        ? `Venta registrada. Queda pendiente: ${Utils.formatMoney(montoDeuda)}`
        : 'Venta registrada correctamente'
      );

      // Generar comprobante automáticamente
      const user = Auth.getUser();
      generarComprobante({
        idVenta:          '—',
        fecha:            Utils.today(),
        producto:         opt?.textContent?.split(' (')[0] || '',
        talle:            opt?.dataset?.talle || '',
        cantidad,
        precioUnitario:   precio,
        descuento,
        total,
        formaPago:        formaPagoEfectiva,
        cliente,
        observaciones:    observ,
        montoDeuda,
        montoPagadoAhora,
        vendedor:         user?.nombre || user?.usuario || '',
      });

      document.getElementById('form-venta').reset();
      document.getElementById('venta-stock-info').innerHTML = '';
      actualizarImagenVenta('');
      const zona = document.getElementById('venta-deuda-zona');
      if (zona) zona.classList.add('hidden');
      actualizarPreviewDeuda(0, 0);
      calcularPreview();
      await cargar();
    } catch {}
  }

  // ── Helper ────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('venta-producto')?.addEventListener('change', actualizarStockInfo);
    document.getElementById('venta-cantidad')?.addEventListener('input',  calcularPreview);
    document.getElementById('venta-precio')?.addEventListener('input',    calcularPreview);
    document.getElementById('venta-descuento')?.addEventListener('input', calcularPreview);
    document.getElementById('venta-forma-pago')?.addEventListener('change', () => {
      actualizarZonaDeuda();
      calcularPreview();
    });
    document.getElementById('venta-monto-pagado')?.addEventListener('input', actualizarDeudaDesdeInput);
    document.getElementById('form-venta')?.addEventListener('submit', confirmarVenta);
  }

  App.register('ventas', cargar);
  window.VentasScreen = { imprimirComprobante };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
