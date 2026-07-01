/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Ventas
═══════════════════════════════════════════════════════════════ */

(function () {

  let productosCache = [];

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
      // Todo en deuda: ocultar zona dividida, setear deuda = total
      if (zona) zona.classList.add('hidden');
      if (labelCliente) labelCliente.textContent = 'Cliente *';
      syncDeudaTotal();
    } else {
      // Mostrar zona para dividir pago
      if (zona) zona.classList.remove('hidden');
      if (labelCliente) labelCliente.textContent = 'Cliente';
      calcularPreview();
    }
  }

  function syncDeudaTotal() {
    // Cuando forma de pago = "A pagar", deuda = total completo
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
    const tbody   = document.getElementById('tbody-ventas-hoy');
    const totalEl = document.getElementById('total-ventas-hoy');
    if (!tbody) return;

    const total = ventas.reduce((acc, v) => acc + (Number(v.precioFinal) || 0), 0);
    if (totalEl) totalEl.textContent = Utils.formatMoney(total);

    if (ventas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Sin ventas hoy</td></tr>`;
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
      </tr>`;
    }).join('');
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

      document.getElementById('form-venta').reset();
      document.getElementById('venta-stock-info').innerHTML = '';
      actualizarImagenVenta('');
      // Reset zona deuda
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
