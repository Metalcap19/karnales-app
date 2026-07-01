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
      opt.textContent = `${p.nombre} (Stock: ${p.cantidad || 0})`;
      opt.dataset.precio   = p.precioVenta  || 0;
      opt.dataset.cantidad = p.cantidad     || 0;
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
      calcularPreview();
      return;
    }

    const cantidad = Number(opt.dataset.cantidad) || 0;
    const precio   = Number(opt.dataset.precio)   || 0;

    if (precioEl) precioEl.value = precio;

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

  // ── Preview de precio ─────────────────────────────────────────
  function calcularPreview() {
    const cantidad   = Number(document.getElementById('venta-cantidad')?.value)   || 0;
    const precio     = Number(document.getElementById('venta-precio')?.value)     || 0;
    const descuento  = Number(document.getElementById('venta-descuento')?.value)  || 0;

    const subtotal   = precio * cantidad;
    const descMonto  = subtotal * (descuento / 100);
    const total      = subtotal - descMonto;

    setText('prev-subtotal',  Utils.formatMoney(subtotal));
    setText('prev-descuento', '- ' + Utils.formatMoney(descMonto));
    setText('prev-total',     Utils.formatMoney(total));
  }

  // ── Historial de hoy ──────────────────────────────────────────
  function renderHistorialHoy(ventas) {
    const tbody    = document.getElementById('tbody-ventas-hoy');
    const totalEl  = document.getElementById('total-ventas-hoy');
    if (!tbody) return;

    const total = ventas.reduce((acc, v) => acc + (Number(v.precioFinal) || 0), 0);
    if (totalEl) totalEl.textContent = Utils.formatMoney(total);

    if (ventas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Sin ventas hoy</td></tr>`;
      return;
    }

    // Ordenar: más reciente primero
    const sorted = [...ventas].sort((a, b) =>
      (b.id || '').localeCompare(a.id || '')
    );

    tbody.innerHTML = sorted.map(v => `
      <tr>
        <td>
          <div style="font-weight:500;">${Utils.esc(v.producto || '—')}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(v.id || '')}</div>
        </td>
        <td>${v.cantidad || 1}</td>
        <td class="monto-positivo">${Utils.formatMoney(v.precioFinal)}</td>
        <td>${Utils.esc(v.formaPago || '—')}</td>
        <td>${Utils.esc(v.cliente || '—')}</td>
      </tr>
    `).join('');
  }

  // ── Confirmar venta ───────────────────────────────────────────
  async function confirmarVenta(e) {
    e.preventDefault();

    const productoId  = document.getElementById('venta-producto').value;
    const cantidad    = Number(document.getElementById('venta-cantidad').value)   || 0;
    const precio      = Number(document.getElementById('venta-precio').value)     || 0;
    const descuento   = Number(document.getElementById('venta-descuento').value)  || 0;
    const formaPago   = document.getElementById('venta-forma-pago').value;
    const cliente     = document.getElementById('venta-cliente').value.trim();
    const observ      = document.getElementById('venta-observaciones').value.trim();

    // Validaciones
    if (!productoId)  { UI.warning('Seleccioná un producto');    return; }
    if (cantidad < 1) { UI.warning('La cantidad debe ser mayor a 0'); return; }
    if (precio   < 1) { UI.warning('El precio debe ser mayor a 0');   return; }
    if (!formaPago)   { UI.warning('Seleccioná forma de pago');   return; }

    // Verificar stock disponible
    const opt = document.querySelector(`#venta-producto option[value="${productoId}"]`);
    const stockDisp = Number(opt?.dataset.cantidad) || 0;
    if (cantidad > stockDisp) {
      UI.error(`Stock insuficiente. Disponible: ${stockDisp}`);
      return;
    }

    const ok = await UI.confirm({
      message: '¿Confirmar venta?',
      sub: `${Utils.formatMoney(precio)} × ${cantidad} — ${Utils.formatMoney(precio * cantidad * (1 - descuento / 100))} total`,
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
        formaPago,
        cliente,
        observaciones: observ,
      });

      UI.success('Venta registrada correctamente');
      document.getElementById('form-venta').reset();
      document.getElementById('venta-stock-info').innerHTML = '';
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
    document.getElementById('form-venta')?.addEventListener('submit', confirmarVenta);
  }

  // ── Registro en el router ────────────────────────────────────
  App.register('ventas', cargar);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
