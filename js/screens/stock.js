/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Stock
═══════════════════════════════════════════════════════════════ */

(function () {

  const STOCK_MIN_DEFAULT = 3;

  const CLOUD_NAME    = 'nfnmeo2v';
  const UPLOAD_PRESET = 'karnales-productos';

  let todosLosProductos = [];
  let rubrosCache       = [];
  let sortCol           = 'nombre';
  let sortAsc           = true;
  let imagenPendienteURL = '';

  // ── Carga principal ─────────────────────────────────────────
  async function cargar() {
    try {
      const data = await API.getProductos();
      if (!data) return;
      todosLosProductos = data.productos || [];
      rubrosCache       = data.rubros    || [];
      poblarFiltroRubros();
      renderKPIs();
      renderTabla();
    } catch (e) {
      console.error('Stock load error:', e);
    }
  }

  // ── KPIs ────────────────────────────────────────────────────
  function renderKPIs() {
    const activos = todosLosProductos.filter(esActivo);
    const min     = STOCK_MIN_DEFAULT;
    setText('kpi-total-productos', activos.length);
    setText('kpi-valor-stock',     Utils.formatMoney(activos.reduce((a, p) => a + (Number(p.cantidad) || 0) * (Number(p.precioVenta) || 0), 0)));
    setText('kpi-sin-stock',       activos.filter(p => (Number(p.cantidad) || 0) === 0).length);
    setText('kpi-stock-bajo',      activos.filter(p => { const q = Number(p.cantidad) || 0; return q > 0 && q <= min; }).length);
  }

  // ── Filtro de rubros ─────────────────────────────────────────
  function poblarFiltroRubros() {
    const sel = document.getElementById('stock-filtro-rubro');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todos los rubros</option>';
    const rubros = [...new Set(todosLosProductos.map(p => p.rubro).filter(Boolean))].sort();
    rubros.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      sel.appendChild(opt);
    });
    sel.value = current;
  }

  // ── Render tabla ─────────────────────────────────────────────
  function renderTabla() {
    const buscar = (document.getElementById('stock-buscar')?.value || '').toLowerCase();
    const rubro  = document.getElementById('stock-filtro-rubro')?.value  || '';
    const estado = document.getElementById('stock-filtro-estado')?.value || 'activos';

    let lista = todosLosProductos.filter(p => {
      const activo = esActivo(p);
      if (estado === 'activos'   && !activo) return false;
      if (estado === 'inactivos' &&  activo) return false;
      if (rubro && p.rubro !== rubro) return false;
      if (buscar) {
        const hay = `${p.nombre} ${p.rubro} ${p.talle || ''} ${p.id}`.toLowerCase();
        if (!hay.includes(buscar)) return false;
      }
      return true;
    });

    lista.sort((a, b) => {
      let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
      if (!isNaN(Number(va)) && !isNaN(Number(vb))) { va = Number(va); vb = Number(vb); }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ?  1 : -1;
      return 0;
    });

    const tbody   = document.getElementById('tbody-stock');
    if (!tbody) return;
    const isAdmin = Auth.isAdmin();

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="table-empty">Sin productos que coincidan</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(p => {
      const cantidad   = Number(p.cantidad)     || 0;
      const pCompra    = Number(p.precioCompra)  || 0;
      const pVenta     = Number(p.precioVenta)   || 0;
      const activo     = esActivo(p);
      const thumb      = p.imagen
        ? `<img src="${Utils.esc(p.imagen)}" alt="" class="imagen-thumb" loading="lazy" />`
        : `<span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:var(--radius-md);background:var(--bg-raised);color:var(--text-muted);"><i data-lucide="image-off" style="width:16px;"></i></span>`;

      return `<tr>
        <td>${thumb}</td>
        <td>
          <div style="font-weight:500;">${Utils.esc(p.nombre)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(p.id)}</div>
        </td>
        <td>${Utils.esc(p.rubro || '—')}</td>
        <td>
          ${Utils.badgeStock(cantidad, STOCK_MIN_DEFAULT)}
          <span style="margin-left:4px;font-weight:600;">${cantidad}</span>
        </td>
        <td>${isAdmin ? Utils.formatMoney(pCompra) : '—'}</td>
        <td>${Utils.formatMoney(pVenta)}</td>
        <td>${isAdmin ? Utils.formatMoney(cantidad * pVenta) : '—'}</td>
        <td>
          ${Utils.esc(p.talle || '—')}
        </td>
        ${isAdmin ? `
        <td>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-ghost btn-sm" onclick="StockScreen.editar('${Utils.esc(p.id)}')" title="Editar">
              <i data-lucide="pencil" style="width:14px;"></i>
            </button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="StockScreen.eliminar('${Utils.esc(p.id)}','${Utils.esc(p.nombre)}')" title="Desactivar">
              <i data-lucide="trash-2" style="width:14px;"></i>
            </button>
          </div>
        </td>` : '<td></td>'}
      </tr>`;
    }).join('');

    UI.icons();
  }

  // ── Cloudinary upload ────────────────────────────────────────
  async function subirImagen(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);
    const progreso = document.getElementById('prod-imagen-progreso');
    if (progreso) progreso.classList.remove('hidden');
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Error subiendo imagen');
      const data = await res.json();
      return data.secure_url;
    } finally {
      if (progreso) progreso.classList.add('hidden');
    }
  }

  function mostrarPreviewImagen(url) {
    const preview     = document.getElementById('prod-imagen-preview');
    const placeholder = document.getElementById('prod-imagen-placeholder');
    const btnQuitar   = document.getElementById('btn-quitar-imagen');
    if (url) {
      if (preview)     { preview.src = url; preview.classList.remove('hidden'); }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnQuitar)   btnQuitar.classList.remove('hidden');
    } else {
      if (preview)     { preview.src = ''; preview.classList.add('hidden'); }
      if (placeholder) placeholder.classList.remove('hidden');
      if (btnQuitar)   btnQuitar.classList.add('hidden');
    }
  }

  function limpiarImagen() {
    imagenPendienteURL = '';
    const img  = document.getElementById('prod-imagen');
    const file = document.getElementById('prod-imagen-file');
    if (img)  img.value  = '';
    if (file) file.value = '';
    mostrarPreviewImagen('');
  }

  // ── Modal producto ───────────────────────────────────────────
  async function abrirModalProducto(id = null) {
    imagenPendienteURL = '';

    const selRubro = document.getElementById('prod-rubro');
    selRubro.innerHTML = '<option value="">— Seleccioná —</option>';
    try {
      const rubrosData = await API.getRubros();
      const rubros = rubrosData?.rubros || rubrosCache;
      rubros.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.nombre || r; opt.textContent = r.nombre || r;
        selRubro.appendChild(opt);
      });
    } catch {}

    if (id) {
      const prod = todosLosProductos.find(p => p.id === id);
      if (!prod) return;
      document.getElementById('modal-producto-titulo').textContent = 'Editar Producto';
      document.getElementById('prod-id').value            = prod.id;
      document.getElementById('prod-imagen').value        = prod.imagen || '';
      document.getElementById('prod-nombre').value        = prod.nombre || '';
      document.getElementById('prod-rubro').value         = prod.rubro  || '';
      document.getElementById('prod-talle').value         = prod.talle  || '';
      document.getElementById('prod-cantidad').value      = prod.cantidad || 0;
      document.getElementById('prod-precio-compra').value = prod.precioCompra || 0;
      document.getElementById('prod-precio-venta').value  = prod.precioVenta  || 0;
      document.getElementById('prod-activo').value        = esActivo(prod) ? 'true' : 'false';
      mostrarPreviewImagen(prod.imagen || '');
    } else {
      document.getElementById('modal-producto-titulo').textContent = 'Nuevo Producto';
      document.getElementById('form-producto').reset();
      document.getElementById('prod-id').value     = '';
      document.getElementById('prod-imagen').value = '';
      mostrarPreviewImagen('');
    }

    UI.openModal('modal-producto');
  }

  async function guardarProducto(e) {
    e.preventDefault();
    const id     = document.getElementById('prod-id').value;
    const imagen = document.getElementById('prod-imagen').value || imagenPendienteURL || '';

    const body = {
      nombre:       document.getElementById('prod-nombre').value.trim(),
      rubro:        document.getElementById('prod-rubro').value,
      talle:        document.getElementById('prod-talle').value.trim(),
      cantidad:     Number(document.getElementById('prod-cantidad').value)      || 0,
      precioCompra: Number(document.getElementById('prod-precio-compra').value) || 0,
      precioVenta:  Number(document.getElementById('prod-precio-venta').value)  || 0,
      activo:       document.getElementById('prod-activo').value === 'true',
      imagen,
    };

    if (!body.nombre || !body.rubro) { UI.warning('Completá nombre y rubro'); return; }

    try {
      if (id) {
        await API.updateProducto({ id, ...body });
        UI.success('Producto actualizado');
      } else {
        await API.createProducto(body);
        UI.success('Producto creado');
      }
      UI.closeModal('modal-producto');
      cargar();
    } catch {}
  }

  async function eliminar(id, nombre) {
    const ok = await UI.confirm({
      message: `¿Desactivar "${nombre}"?`,
      sub: 'El producto no se borrará, solo quedará inactivo.',
      icon: '⚠️',
    });
    if (!ok) return;
    try {
      await API.deleteProducto(id);
      UI.success('Producto desactivado');
      cargar();
    } catch {}
  }

  // ── Reporte Stock PDF ────────────────────────────────────────
  function abrirModalReporte() {
    // Poblar rubros en el select del modal de reporte
    const sel = document.getElementById('rep-rubro');
    if (sel) {
      sel.innerHTML = '<option value="">Todos los rubros</option>';
      const rubros = [...new Set(todosLosProductos.filter(esActivo).map(p => p.rubro).filter(Boolean))].sort();
      rubros.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        sel.appendChild(opt);
      });
    }
    UI.openModal('modal-reporte-stock');
  }

  function generarReportePDF() {
    const rubro      = document.getElementById('rep-rubro')?.value        || '';
    const talle      = (document.getElementById('rep-talle')?.value       || '').trim().toLowerCase();
    const soloStock  = document.getElementById('rep-solo-stock')?.checked ?? true;
    const conFotos   = document.getElementById('rep-con-fotos')?.checked  ?? true;
    const conPrecios = document.getElementById('rep-con-precios')?.checked ?? false;

    let lista = todosLosProductos.filter(esActivo);
    if (rubro)     lista = lista.filter(p => p.rubro === rubro);
    if (talle)     lista = lista.filter(p => (p.talle || '').toLowerCase().includes(talle));
    if (soloStock) lista = lista.filter(p => (Number(p.cantidad) || 0) > 0);

    if (lista.length === 0) {
      UI.warning('No hay productos que coincidan con los filtros.');
      return;
    }

    // Construir etiquetas de filtros aplicados
    const filtrosTexto = [
      rubro     ? `Rubro: ${rubro}`         : '',
      talle     ? `Talle: ${talle}`         : '',
      soloStock ? 'Con stock disponible'    : 'Todos (incluye sin stock)',
    ].filter(Boolean).join(' · ');

    const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const filas = lista.map(p => {
      const cantidad = Number(p.cantidad) || 0;
      const stockClass = cantidad === 0 ? 'stock-agotado' : cantidad <= 3 ? 'stock-bajo' : 'stock-ok';
      const stockLabel = cantidad === 0 ? 'Sin stock' : cantidad <= 3 ? `Stock bajo (${cantidad})` : cantidad;

      const fotoCell = conFotos
        ? `<td class="col-foto">${p.imagen ? `<img src="${p.imagen}" alt="" class="prod-img" />` : ''}</td>`
        : '';
      const precioCell = conPrecios
        ? `<td class="col-precio">${Utils.formatMoney(p.precioVenta)}</td>`
        : '';

      return `<tr>
        ${fotoCell}
        <td class="col-nombre"><strong>${Utils.esc(p.nombre)}</strong></td>
        <td class="col-rubro">${Utils.esc(p.rubro || '—')}</td>
        <td class="col-talle">${Utils.esc(p.talle || '—')}</td>
        <td class="col-stock ${stockClass}">${stockLabel}</td>
        ${precioCell}
      </tr>`;
    }).join('');

    const fotoTh   = conFotos   ? '<th class="col-foto">Foto</th>' : '';
    const precioTh = conPrecios ? '<th class="col-precio">Precio</th>' : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Reporte Stock — Karnales</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 24px; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #c9a84c; padding-bottom: 12px; }
  .logo   { font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #1a1a1a; }
  .logo span { color: #c9a84c; }
  .meta   { text-align: right; color: #555; font-size: 11px; line-height: 1.6; }
  .meta strong { color: #1a1a1a; font-size: 13px; }

  .filtros { background: #f7f4ec; border-left: 3px solid #c9a84c; padding: 6px 12px; margin-bottom: 16px; font-size: 11px; color: #555; }
  .filtros strong { color: #1a1a1a; }

  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1a1a1a; color: #c9a84c; }
  th { padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafaf8; }

  .col-foto   { width: 54px; }
  .col-nombre { font-weight: 600; }
  .col-rubro  { color: #555; }
  .col-talle  { font-weight: 600; text-align: center; width: 70px; }
  .col-stock  { text-align: center; width: 110px; font-weight: 600; }
  .col-precio { text-align: right; width: 90px; }

  .prod-img { width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }

  .stock-ok      { color: #1a7a4a; }
  .stock-bajo    { color: #b45309; }
  .stock-agotado { color: #b91c1c; }

  .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }

  @media print {
    body { padding: 10px; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="logo">KARNA<span>LES</span></div>
  <div class="meta">
    <strong>Reporte de Stock</strong><br/>
    Fecha: ${fecha}<br/>
    ${lista.length} producto${lista.length !== 1 ? 's' : ''}
  </div>
</div>

${filtrosTexto ? `<div class="filtros"><strong>Filtros:</strong> ${filtrosTexto}</div>` : ''}

<table>
  <thead>
    <tr>
      ${fotoTh}
      <th class="col-nombre">Producto</th>
      <th class="col-rubro">Rubro</th>
      <th class="col-talle">Talle</th>
      <th class="col-stock">Stock</th>
      ${precioTh}
    </tr>
  </thead>
  <tbody>
    ${filas}
  </tbody>
</table>

<div class="footer">Karnales — Sistema de Gestión · Generado el ${fecha}</div>

<script>
  // Esperar que las imágenes carguen antes de imprimir
  window.addEventListener('load', function() { window.print(); });
<\/script>
</body>
</html>`;

    UI.closeModal('modal-reporte-stock');
    const win = window.open('', '_blank');
    if (!win) { UI.warning('El navegador bloqueó la ventana emergente. Habilitala para este sitio.'); return; }
    win.document.write(html);
    win.document.close();
  }

  // ── Helpers ──────────────────────────────────────────────────
  function esActivo(p) {
    return p.activo === true || p.activo === 'true' || p.activo === 'TRUE';
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => abrirModalProducto());
    document.getElementById('form-producto')?.addEventListener('submit', guardarProducto);
    document.getElementById('btn-reporte-stock')?.addEventListener('click', abrirModalReporte);
    document.getElementById('btn-generar-reporte')?.addEventListener('click', generarReportePDF);

    // Upload imagen
    document.getElementById('prod-imagen-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { UI.warning('La imagen no puede superar 5 MB'); e.target.value = ''; return; }
      try {
        UI.showLoader('Subiendo imagen...');
        const url = await subirImagen(file);
        imagenPendienteURL = url;
        document.getElementById('prod-imagen').value = url;
        mostrarPreviewImagen(url);
        UI.success('Imagen subida');
      } catch (err) {
        UI.error('No se pudo subir la imagen. Intentá de nuevo.');
        console.error('Cloudinary upload error:', err);
      } finally {
        UI.hideLoader();
      }
    });

    document.getElementById('btn-quitar-imagen')?.addEventListener('click', limpiarImagen);

    document.getElementById('stock-buscar')?.addEventListener('input', Utils.debounce(renderTabla, 250));
    document.getElementById('stock-filtro-rubro')?.addEventListener('change', renderTabla);
    document.getElementById('stock-filtro-estado')?.addEventListener('change', renderTabla);

    document.querySelectorAll('#tabla-stock th[data-col]').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = true; }
        renderTabla();
      });
    });
  }

  App.register('stock', cargar);
  window.StockScreen = { editar: abrirModalProducto, eliminar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
