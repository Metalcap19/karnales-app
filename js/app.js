/* ═══════════════════════════════════════════════════════════════
   KARNALES — SPA Router & Bootstrap
   Controla navegación entre pantallas, login/logout, header.
═══════════════════════════════════════════════════════════════ */

const App = (() => {

  // Mapa de screen-name → función de carga (definida en cada screens/*.js)
  const screenLoaders = {};

  let currentScreen = null;

  // ── Registro de loaders por pantalla ────────────────────────
  function register(name, fn) {
    screenLoaders[name] = fn;
  }

  // ── Navegar a una pantalla ───────────────────────────────────
  function navigate(name) {
    // Ocultar todas las screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const target = document.getElementById(`screen-${name}`);
    if (!target) { console.warn(`Screen not found: ${name}`); return; }

    target.classList.add('active');
    currentScreen = name;

    // Mostrar/ocultar header
    const header = document.getElementById('app-header');
    const noHeader = ['portada', 'login'];
    if (header) header.style.display = noHeader.includes(name) ? 'none' : '';

    // Re-renderizar íconos Lucide en la nueva pantalla
    UI.icons();

    // Ejecutar loader de datos si existe
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
      afterLogin();
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || 'Usuario o contraseña incorrectos';
    } finally {
      UI.hideLoader();
    }
  }

  function afterLogin() {
    const user = Auth.getUser();
    if (!user) { navigate('login'); return; }

    // Actualizar header
    const elNombre = document.getElementById('header-nombre');
    const elRol    = document.getElementById('header-rol');
    const elMenu   = document.getElementById('menu-nombre');
    if (elNombre) elNombre.textContent = user.nombre;
    if (elRol)    elRol.textContent    = user.rol === 'admin' ? 'Administrador' : 'Vendedor';
    if (elMenu)   elMenu.textContent   = user.nombre;

    // Aplicar visibilidad por rol
    Auth.applyRole();

    navigate('menu');
  }

  function doLogout() {
    Auth.clear();

    // Destruir instancias de Chart.js si existen
    if (window.KarnalesCharts) {
      Object.values(window.KarnalesCharts).forEach(c => { try { c.destroy(); } catch {} });
      window.KarnalesCharts = {};
    }

    navigate('portada');
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function init() {
    // Íconos iniciales
    UI.icons();

    // Portada → Login
    document.getElementById('btn-ir-login')?.addEventListener('click', () => navigate('login'));

    // Formulario de login
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usuario   = document.getElementById('login-usuario').value.trim();
      const contrasena = document.getElementById('login-contrasena').value;
      if (!usuario || !contrasena) return;
      await doLogin(usuario, contrasena);
    });

    // Recordar usuario
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
      if (recordar) {
        localStorage.setItem('karnales_remember_user', document.getElementById('login-usuario').value.trim());
      }
    });

    // Botones logout
    document.getElementById('btn-logout')?.addEventListener('click', doLogout);
    document.getElementById('btn-logout-menu')?.addEventListener('click', doLogout);

    // Botón menú principal desde header
    document.getElementById('btn-menu-principal')?.addEventListener('click', () => navigate('menu'));

    // Botones del menú principal
    document.querySelectorAll('.menu-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.screen));
    });

    // ── Determinar pantalla inicial ──────────────────────────
    if (Auth.isLoggedIn()) {
      afterLogin();
    } else {
      navigate('portada');
    }
  }

  // ── Inicializar cuando el DOM esté listo ─────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { navigate, register, doLogout };

})();
