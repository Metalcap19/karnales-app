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
      const fechaEl = document.getElementById('ventas-fecha-filtro');
      const fecha   = fechaEl?.value || Utils.today();
      const data    = await API.getVentas({ fecha });
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
    const config  = window.KarnalesConfig || {};
    const negocio = config.nombreNegocio || 'Karnales';
    const hex     = config.colorAcento   || '#C9A84C';
    const dir     = config.direccion     || '';
    const tel     = config.telefono      || '';

    const {
      idVenta, fecha, producto, talle, cantidad,
      precioUnitario, descuento, total,
      formaPago, cliente, observaciones,
      montoDeuda, montoPagadoAhora, vendedor,
    } = datos;

    const tieneDeuda = (montoDeuda || 0) > 0;
    const tieneDesc  = (descuento  || 0) > 0;
    const subtotal   = (precioUnitario || 0) * (cantidad || 1);
    const metaLine   = [dir, tel ? `Tel: ${tel}` : ''].filter(Boolean).join(' · ');

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
    doc.setTextColor(160, 160, 160);
    doc.text('COMPROBANTE DE VENTA', W / 2, y, { align: 'center' });
    y += 4;

    if (metaLine) {
      doc.text(metaLine, W / 2, y, { align: 'center' });
      y += 4;
    }

    doc.setDrawColor(cr, cg, cb);
    doc.setLineWidth(0.4);
    doc.line(M, y, RW, y);
    y += 5;

    // ── fila label / valor ──
    function fila(label, valor, colorVal) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(160, 160, 160);
      doc.text(label, M, y);
      if (colorVal) doc.setTextColor(...colorVal);
      doc.text(String(valor), RW, y, { align: 'right' });
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(M, y + 1.5, RW, y + 1.5);
      y += 6;
    }

    function separador() {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(M, y, RW, y);
      y += 4;
    }

    // ── datos cabecera ──
    fila('N° Venta',  idVenta || '—');
    fila('Fecha',     fecha   || '—');
    fila('Vendedor',  vendedor || '—');

    separador();

    // ── producto ──
    fila('Producto',       producto || '—');
    if (talle) fila('Talle', talle);
    fila('Cantidad',       String(cantidad || 1));
    fila('Precio unitario', Utils.formatMoney(precioUnitario));

    if (tieneDesc) {
      fila('Subtotal',         Utils.formatMoney(subtotal));
      fila(`Descuento ${descuento}%`, '- ' + Utils.formatMoney(subtotal - total));
    }

    // TOTAL
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(160, 160, 160);
    doc.text('TOTAL', M, y);
    doc.setFontSize(14);
    doc.setTextColor(cr, cg, cb);
    doc.text(Utils.formatMoney(total), RW, y, { align: 'right' });
    y += 8;

    separador();

    // ── pago ──
    fila('Forma de pago', formaPago || '—');
    if (tieneDeuda) {
      fila('Pagado ahora',   Utils.formatMoney(montoPagadoAhora), [22, 101, 52]);
      fila('Queda a pagar',  Utils.formatMoney(montoDeuda),       [185, 28, 28]);
    }

    if (cliente || observaciones) {
      separador();
      if (cliente)       fila('Cliente', cliente);
      if (observaciones) fila('Obs.',    observaciones);
    }

    // ── pie ──
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(M, y, RW, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(170, 170, 170);
    doc.text('Gracias por su compra', W / 2, y, { align: 'center' });

    const nombreArchivo = `Comprobante-${(idVenta || Utils.today()).replace(/[^a-zA-Z0-9-]/g, '')}.pdf`;
    doc.save(nombreArchivo);
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
    // Inicializar fecha del historial en hoy
    const fechaFiltroEl = document.getElementById('ventas-fecha-filtro');
    if (fechaFiltroEl) {
      fechaFiltroEl.value = Utils.today();
      fechaFiltroEl.addEventListener('change', cargarVentasHoy);
    }

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
