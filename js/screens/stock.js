/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Stock
═══════════════════════════════════════════════════════════════ */

(function () {

  const STOCK_MIN_DEFAULT = 3;

  // Cloudinary config (upload directo desde el frontend)
  const CLOUD_NAME    = 'nfnmeo2v';
  const UPLOAD_PRESET = 'karnales-productos';

  let todosLosProductos = [];
  let rubrosCache       = [];
  let sortCol           = 'nombre';
  let sortAsc           = true;

  // URL de imagen pendiente (seteada al subir, antes de guardar el form)
  let imagenPendienteURL = '';

  // ── Carga principal ─────────────────────────────────────────
  async function cargar() {
    try {
      const data = await API.getProductos();
      if (!data) return;
      todosLosProductos = data.productos || [];
      rubrosCache       = data.rubros   || [];

      poblarFiltroRubros();
      renderKPIs();
      renderTabla();
    } catch (e) {
      console.error('Stock load error:', e);
    }
  }

  // ── KPIs ────────────────────────────────────────────────────
  function renderKPIs() {
    const activos = todosLosProductos.filter(p => p.activo === true || p.activo === 'true' || p.activo === 'TRUE');
    const min     = STOCK_MIN_DEFAULT;

    const total      = activos.length;
    const valorStock = activos.reduce((acc, p) => acc + (Number(p.cantidad) || 0) * (Number(p.precioVenta) || 0), 0);
    const sinStock   = activos.filter(p => (Number(p.cantidad) || 0) === 0).length;
    const stockBajo  = activos.filter(p => { const q = Number(p.cantidad) || 0; return q > 0 && q <= min; }).length;

    setText('kpi-total-productos', total);
    setText('kpi-valor-stock',     Utils.formatMoney(valorStock));
    setText('kpi-sin-stock',       sinStock);
    setText('kpi-stock-bajo',      stockBajo);
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
    const rubro  = document.getElementById('stock-filtro-rubro')?.value || '';
    const estado = document.getElementById('stock-filtro-estado')?.value || 'activos';

    let lista = todosLosProductos.filter(p => {
      const activo = p.activo === true || p.activo === 'true' || p.activo === 'TRUE';
      if (estado === 'activos'   && !activo) return false;
      if (estado === 'inactivos' &&  activo) return false;
      if (rubro && p.rubro !== rubro) return false;
      if (buscar) {
        const haystack = `${p.nombre} ${p.rubro} ${p.id}`.toLowerCase();
        if (!haystack.includes(buscar)) return false;
      }
      return true;
    });

    // Ordenar
    lista.sort((a, b) => {
      let va = a[sortCol] ?? '';
      let vb = b[sortCol] ?? '';
      if (!isNaN(Number(va)) && !isNaN(Number(vb))) { va = Number(va); vb = Number(vb); }
      else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ?  1 : -1;
      return 0;
    });

    const tbody = document.getElementById('tbody-stock');
    if (!tbody) return;
    const isAdmin = Auth.isAdmin();

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="table-empty">Sin productos que coincidan</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(p => {
      const cantidad   = Number(p.cantidad)    || 0;
      const pCompra    = Number(p.precioCompra) || 0;
      const pVenta     = Number(p.precioVenta)  || 0;
      const valorStock = cantidad * pVenta;
      const activo     = p.activo === true || p.activo === 'true' || p.activo === 'TRUE';
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
        <td>${isAdmin ? Utils.formatMoney(valorStock) : '—'}</td>
        <td>${Utils.badgeActivo(activo)}</td>
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const progreso = document.getElementById('prod-imagen-progreso');
    if (progreso) progreso.classList.remove('hidden');

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
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
    const input = document.getElementById('prod-imagen');
    if (input) input.value = '';
    const fileInput = document.getElementById('prod-imagen-file');
    if (fileInput) fileInput.value = '';
    mostrarPreviewImagen('');
  }

  // ── Modal nuevo/editar ───────────────────────────────────────
  async function abrirModalProducto(id = null) {
    // Reset imagen
    imagenPendienteURL = '';

    // Poblar rubros en el select del modal
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
      // Modo edición
      const prod = todosLosProductos.find(p => p.id === id);
      if (!prod) return;
      document.getElementById('modal-producto-titulo').textContent = 'Editar Producto';
      document.getElementById('prod-id').value            = prod.id;
      document.getElementById('prod-imagen').value        = prod.imagen || '';
      document.getElementById('prod-nombre').value        = prod.nombre || '';
      document.getElementById('prod-rubro').value         = prod.rubro  || '';
      document.getElementById('prod-cantidad').value      = prod.cantidad || 0;
      document.getElementById('prod-precio-compra').value = prod.precioCompra || 0;
      document.getElementById('prod-precio-venta').value  = prod.precioVenta  || 0;
      document.getElementById('prod-activo').value        = (prod.activo === true || prod.activo === 'true' || prod.activo === 'TRUE') ? 'true' : 'false';
      mostrarPreviewImagen(prod.imagen || '');
    } else {
      // Modo nuevo
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
      cantidad:     Number(document.getElementById('prod-cantidad').value)      || 0,
      precioCompra: Number(document.getElementById('prod-precio-compra').value) || 0,
      precioVenta:  Number(document.getElementById('prod-precio-venta').value)  || 0,
      activo:       document.getElementById('prod-activo').value === 'true',
      imagen,
    };

    if (!body.nombre || !body.rubro) {
      UI.warning('Completá nombre y rubro'); return;
    }

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

  // ── Helpers ──────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => abrirModalProducto());
    document.getElementById('form-producto')?.addEventListener('submit', guardarProducto);

    // Upload de imagen
    document.getElementById('prod-imagen-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validar tamaño máximo 5 MB
      if (file.size > 5 * 1024 * 1024) {
        UI.warning('La imagen no puede superar 5 MB');
        e.target.value = '';
        return;
      }

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

    // Quitar imagen
    document.getElementById('btn-quitar-imagen')?.addEventListener('click', limpiarImagen);

    // Búsqueda con debounce
    document.getElementById('stock-buscar')?.addEventListener(
      'input', Utils.debounce(renderTabla, 250)
    );

    // Filtros
    document.getElementById('stock-filtro-rubro')?.addEventListener('change', renderTabla);
    document.getElementById('stock-filtro-estado')?.addEventListener('change', renderTabla);

    // Orden por columna
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

  // ── Registro en el router ────────────────────────────────────
  App.register('stock', cargar);

  // ── Exponer para onclick inline ──────────────────────────────
  window.StockScreen = { editar: abrirModalProducto, eliminar };

  // ── Init (bindear eventos una sola vez) ──────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
