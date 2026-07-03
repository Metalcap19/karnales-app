/* ═══════════════════════════════════════════════════════════════
   KARNALES — SPA Router & Bootstrap
   Controla navegación entre pantallas, login/logout, header.
═══════════════════════════════════════════════════════════════ */

const App = (() => {

  const screenLoaders = {};
  let currentScreen = null;

  // ── Aplicar configuración visual ─────────────────────────────
  function aplicarConfig(config) {
    if (!config) return;

    // Color de acento → actualiza todas las variables --gold-*
    const color = config.colorAcento || '';
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const root = document.documentElement;
      const lighten = (v, a) => Math.min(v + a, 255);
      root.style.setProperty('--gold',        color);
      root.style.setProperty('--gold-light',  `rgb(${lighten(r,30)},${lighten(g,30)},${lighten(b,30)})`);
      root.style.setProperty('--gold-dim',    `rgba(${r},${g},${b},0.15)`);
      root.style.setProperty('--gold-border', `rgba(${r},${g},${b},0.35)`);
      root.style.setProperty('--border-gold', `rgba(${r},${g},${b},0.4)`);
      root.style.setProperty('--shadow-gold', `0 0 20px rgba(${r},${g},${b},0.2)`);
    }

    // Nombre del negocio
    if (config.nombreNegocio) {
      const titulo = config.nombreNegocio.toUpperCase();
      const portadaTitle = document.querySelector('.portada-title');
      const loginSpan    = document.querySelector('.login-title span');
      if (portadaTitle) portadaTitle.textContent = titulo;
      if (loginSpan)    loginSpan.textContent    = config.nombreNegocio;
      document.title = `${config.nombreNegocio} — Sistema de Gestión`;
    }

    // Subtítulo portada
    if (config.subtitulo) {
      const el = document.querySelector('.portada-subtitle');
      if (el) el.textContent = config.subtitulo;
    }
  }

  // ── Registro de loaders por pantalla ────────────────────────
  function register(name, fn) {
    screenLoaders[name] = fn;
  }

  // ── Navegar a una pantalla ───────────────────────────────────
  function navigate(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const target = document.getElementById(`screen-${name}`);
    if (!target) { console.warn(`Screen not found: ${name}`); return; }

    target.classList.add('active');
    currentScreen = name;

    const header = document.getElementById('app-header');
    const noHeader = ['portada', 'login'];
    if (header) {
      if (noHeader.includes(name)) header.classList.remove('visible');
      else                         header.classList.add('visible');
    }

    UI.icons();

    if (screenLoaders[name]) {
      try { screenLoaders[name](); } catch (e) { console.error('Screen load error:', e); }
    }
  }

  // ── Login ────────────────────────────────────────────────────
  async function doLogin(usuario, contrasena) {
    UI.showLoader('Iniciando sesión...');
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    try {
      const data = await API.login({ usuario, contrasena });
      if (!data) return;
      Auth.save(data.token, { usuario: data.usuario, nombre: data.nombre, rol: data.rol });
      await afterLogin();
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || 'Usuario o contraseña incorrectos';
    } finally {
      UI.hideLoader();
    }
  }

  async function afterLogin() {
    const user = Auth.getUser();
    if (!user) { navigate('login'); return; }

    // Actualizar header
    const elNombre = document.getElementById('header-nombre');
    const elRol    = document.getElementById('header-rol');
    const elMenu   = document.getElementById('menu-nombre');
    if (elNombre) elNombre.textContent = user.nombre;
    if (elRol)    elRol.textContent    = user.rol === 'admin' ? 'Administrador' : 'Vendedor';
    if (elMenu)   elMenu.textContent   = user.nombre;

    Auth.applyRole();

    // Cargar y aplicar configuración visual
    try {
      const configData = await API.getConfig();
      if (configData?.config) {
        aplicarConfig(configData.config);
        window.KarnalesConfig = configData.config;
      }
    } catch {}

    navigate('menu');
  }

  function doLogout() {
    Auth.clear();
    if (window.KarnalesCharts) {
      Object.values(window.KarnalesCharts).forEach(c => { try { c.destroy(); } catch {} });
      window.KarnalesCharts = {};
    }
    navigate('portada');
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function init() {
    UI.icons();

    document.getElementById('btn-ir-login')?.addEventListener('click', () => navigate('login'));

    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usuario    = document.getElementById('login-usuario').value.trim();
      const contrasena = document.getElementById('login-contrasena').value;
      if (!usuario || !contrasena) return;
      await doLogin(usuario, contrasena);
    });

    const savedUser = localStorage.getItem('karnales_remember_user');
    if (savedUser) {
      const inp = document.getElementById('login-usuario');
      if (inp) { inp.value = savedUser; document.getElementById('login-recordar').checked = true; }
    }
    document.getElementById('login-recordar')?.addEventListener('change', (e) => {
      if (!e.target.checked) localStorage.removeItem('karnales_remember_user');
    });
    document.getElementById('form-login')?.addEventListener('submit', () => {
      const recordar = document.getElementById('login-recordar').checked;
      if (recordar) localStorage.setItem('karnales_remember_user', document.getElementById('login-usuario').value.trim());
    });

    document.getElementById('btn-logout')?.addEventListener('click', doLogout);
    document.getElementById('btn-logout-menu')?.addEventListener('click', doLogout);
    document.getElementById('btn-menu-principal')?.addEventListener('click', () => navigate('menu'));

    document.querySelectorAll('.menu-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.screen));
    });

    if (Auth.isLoggedIn()) {
      afterLogin();
    } else {
      navigate('portada');
    }
  }

  window.addEventListener('load', init);

  // Exponer aplicarConfig para que configuracion.js lo llame al guardar
  return { navigate, register, doLogout, aplicarConfig };

})();
