/* ═══════════════════════════════════════════════════════════════
   KARNALES — Auth frontend
   Gestión de token JWT, sesión, roles.
═══════════════════════════════════════════════════════════════ */

const Auth = (() => {

  const TOKEN_KEY  = 'karnales_token';
  const USER_KEY   = 'karnales_user';

  // ── Guardar sesión ──────────────────────────────────────────
  function save(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  // ── Limpiar sesión ──────────────────────────────────────────
  function clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  // ── Leer token ──────────────────────────────────────────────
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  // ── Leer usuario ────────────────────────────────────────────
  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY)) || null;
    } catch {
      return null;
    }
  }

  // ── Está autenticado ─────────────────────────────────────────
  function isLoggedIn() {
    const token = getToken();
    if (!token) return false;

    // Verificación de expiración local (el servidor también verifica)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        clear();
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  // ── Es admin ─────────────────────────────────────────────────
  function isAdmin() {
    const user = getUser();
    return user?.rol === 'admin';
  }

  // ── Aplicar visibilidad según rol ────────────────────────────
  function applyRole() {
    const admin = isAdmin();
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = admin ? '' : 'none';
    });
  }

  return { save, clear, getToken, getUser, isLoggedIn, isAdmin, applyRole };

})();
