/* ═══════════════════════════════════════════════════════════════
   KARNALES — API wrapper
   Fetch centralizado con auth, loader y manejo de errores.
═══════════════════════════════════════════════════════════════ */

const API = (() => {

  const BASE = '/.netlify/functions';

  async function request(endpoint, options = {}, silent = false) {
    const token = Auth.getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (!silent) UI.showLoader();

    try {
      const res = await fetch(`${BASE}/${endpoint}`, {
        ...options,
        headers,
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        Auth.clear();
        UI.error('Sesión expirada. Iniciá sesión nuevamente.');
        App.navigate('login');
        return null;
      }

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      return data;
    } catch (err) {
      if (!silent) UI.error(err.message || 'Error de conexión');
      throw err;
    } finally {
      if (!silent) UI.hideLoader();
    }
  }

  const get    = (ep, params, silent)     => request(ep + (params ? '?' + new URLSearchParams(params) : ''), { method: 'GET' },    silent);
  const post   = (ep, body, silent)       => request(ep, { method: 'POST',   body: JSON.stringify(body) },  silent);
  const put    = (ep, body, silent)       => request(ep, { method: 'PUT',    body: JSON.stringify(body) },  silent);
  const del    = (ep, body, silent)       => request(ep, { method: 'DELETE', body: JSON.stringify(body) },  silent);

  // ── Endpoints concretos ─────────────────────────────────────

  const login       = (body)         => post('login', body, true);

  const getProductos = (params)      => get('productos', params);
  const getProducto  = (id)          => get('productos', { id });
  const createProducto = (body)      => post('productos', body);
  const updateProducto = (body)      => put('productos', body);
  const deleteProducto = (id)        => del('productos', { id });
  const getRubros    = ()            => get('productos', { rubros: true });

  const getVentas    = (params)      => get('ventas', params);
  const createVenta  = (body)        => post('ventas', body);

  const getCaja      = (params)      => get('caja', params);
  const createCajaMovimiento = (body)=> post('caja', body);

  const getMovimientos = (params)    => get('movimientos', params);

  const getReportes  = ()            => get('reportes');

  const getExportar  = (params)      => get('exportar', params);

  const getConfig    = (seccion)     => get('config', seccion ? { seccion } : undefined);
  const saveConfig   = (body)        => post('config', body);
  const getUsuarios  = ()            => get('config', { seccion: 'usuarios' });
  const createUsuario= (body)        => post('config?seccion=usuarios', body);
  const updateUsuario= (body)        => put('config?seccion=usuarios', body);
  const deleteUsuario= (usuario)     => del(`config?seccion=usuarios&usuario=${encodeURIComponent(usuario)}`);
  const createRubro  = (body)        => post('config?seccion=rubros', body);
  const updateRubro  = (body)        => put('config?seccion=rubros', body);
  const deleteRubro  = (id)          => del(`config?seccion=rubros&id=${encodeURIComponent(id)}`);
  const cambiarPassword = (body)     => post('config?seccion=cambiar-password', body);

  return {
    login,
    getProductos, getProducto, createProducto, updateProducto, deleteProducto, getRubros,
    getVentas, createVenta,
    getCaja, createCajaMovimiento,
    getMovimientos,
    getReportes,
    getExportar,
    getConfig, saveConfig,
    getUsuarios, createUsuario, updateUsuario, deleteUsuario,
    createRubro, updateRubro, deleteRubro,
    cambiarPassword,
  };

})();
