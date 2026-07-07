/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Configuración
═══════════════════════════════════════════════════════════════ */

(function () {

  let tabActual = 'usuarios';

  // ── Carga principal ─────────────────────────────────────────
  async function cargar() {
    switchTab(tabActual);
  }

  // ── Tabs ─────────────────────────────────────────────────────
  function switchTab(tab) {
    tabActual = tab;

    document.querySelectorAll('.config-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab)
    );
    document.querySelectorAll('.config-panel').forEach(p =>
      p.classList.toggle('active', p.id === `tab-${tab}`)
    );

    const loaders = {
      usuarios:   cargarUsuarios,
      rubros:     cargarRubros,
      apariencia: cargarApariencia,
      password:   () => {},
    };
    if (loaders[tab]) loaders[tab]();
  }

  // ════════════════════════════════════════════════════════════
  // USUARIOS
  // ════════════════════════════════════════════════════════════

  async function cargarUsuarios() {
    try {
      const data = await API.getUsuarios();
      if (!data) return;
      renderTablaUsuarios(data.usuarios || []);
    } catch {}
  }

  function renderTablaUsuarios(usuarios) {
    const tbody = document.getElementById('tbody-usuarios');
    if (!tbody) return;

    if (usuarios.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Sin usuarios</td></tr>`;
      return;
    }

    const me = Auth.getUser()?.usuario;

    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td>
          <div style="font-weight:500;">${Utils.esc(u.usuario)}</div>
        </td>
        <td>${Utils.esc(u.nombre || '—')}</td>
        <td>${Utils.badgeRol(u.rol)}</td>
        <td>${Utils.badgeActivo(u.activo)}</td>
        <td>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-ghost btn-sm" onclick="ConfigScreen.editarUsuario('${Utils.esc(u.usuario)}')" title="Editar">
              <i data-lucide="pencil" style="width:14px;"></i>
            </button>
            ${u.usuario !== me ? `
            <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="ConfigScreen.desactivarUsuario('${Utils.esc(u.usuario)}','${Utils.esc(u.nombre || u.usuario)}')" title="Desactivar">
              <i data-lucide="user-x" style="width:14px;"></i>
            </button>` : '<span style="width:30px;display:inline-block;"></span>'}
          </div>
        </td>
      </tr>
    `).join('');

    UI.icons();
  }

  async function abrirModalUsuario(usuarioId = null) {
    const form = document.getElementById('form-usuario');
    form.reset();

    const pwdGroup = document.getElementById('usr-pwd-group');
    const pwdInput = document.getElementById('usr-contrasena');

    if (usuarioId) {
      document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuario';
      document.getElementById('usr-modo').value    = 'editar';
      document.getElementById('usr-usuario').value = usuarioId;
      document.getElementById('usr-usuario').readOnly = true;

      // Contraseña opcional en edición
      if (pwdGroup) {
        const label = pwdGroup.querySelector('.form-label');
        if (label) label.textContent = 'Nueva contraseña (dejar en blanco para no cambiar)';
      }
      if (pwdInput) pwdInput.required = false;

      // Buscar datos del usuario en la tabla
      const row = document.querySelector(`#tbody-usuarios tr td:first-child div`);
      // Cargamos desde la API para tener datos frescos
      try {
        const data = await API.getUsuarios();
        const u = (data?.usuarios || []).find(x => x.usuario === usuarioId);
        if (u) {
          document.getElementById('usr-nombre').value = u.nombre || '';
          document.getElementById('usr-rol').value    = u.rol    || 'vendedor';
          document.getElementById('usr-activo').value = (u.activo === true || u.activo === 'true' || u.activo === 'TRUE') ? 'true' : 'false';
        }
      } catch {}
    } else {
      document.getElementById('modal-usuario-titulo').textContent = 'Nuevo Usuario';
      document.getElementById('usr-modo').value = 'crear';
      document.getElementById('usr-usuario').readOnly = false;
      if (pwdGroup) {
        const label = pwdGroup.querySelector('.form-label');
        if (label) label.textContent = 'Contraseña *';
      }
      if (pwdInput) pwdInput.required = true;
    }

    UI.openModal('modal-usuario');
  }

  async function guardarUsuario(e) {
    e.preventDefault();
    const modo      = document.getElementById('usr-modo').value;
    const usuario   = document.getElementById('usr-usuario').value.trim().toLowerCase();
    const nombre    = document.getElementById('usr-nombre').value.trim();
    const contrasena = document.getElementById('usr-contrasena').value;
    const rol       = document.getElementById('usr-rol').value;
    const activo    = document.getElementById('usr-activo').value === 'true';

    if (!usuario) { UI.warning('Ingresá un nombre de usuario'); return; }
    if (!nombre)  { UI.warning('Ingresá el nombre completo');   return; }
    if (modo === 'crear' && !contrasena) { UI.warning('Ingresá una contraseña'); return; }
    if (contrasena && contrasena.length < 6) { UI.warning('La contraseña debe tener al menos 6 caracteres'); return; }

    const body = { usuario, nombre, rol, activo };
    if (contrasena) body.contrasena = contrasena;

    try {
      if (modo === 'crear') {
        await API.createUsuario(body);
        UI.success('Usuario creado');
      } else {
        await API.updateUsuario(body);
        UI.success('Usuario actualizado');
      }
      UI.closeModal('modal-usuario');
      cargarUsuarios();
    } catch {}
  }

  async function desactivarUsuario(usuario, nombre) {
    const ok = await UI.confirm({
      message: `¿Desactivar al usuario "${nombre}"?`,
      sub: 'No podrá ingresar al sistema.',
      icon: '⚠️',
    });
    if (!ok) return;
    try {
      await API.deleteUsuario(usuario);
      UI.success('Usuario desactivado');
      cargarUsuarios();
    } catch {}
  }

  // ════════════════════════════════════════════════════════════
  // RUBROS
  // ════════════════════════════════════════════════════════════

  async function cargarRubros() {
    try {
      const data = await API.getConfig('rubros');
      if (!data) return;
      renderTablaRubros(data.rubros || []);
    } catch {}
  }

  function renderTablaRubros(rubros) {
    const tbody = document.getElementById('tbody-rubros');
    if (!tbody) return;

    if (rubros.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Sin rubros</td></tr>`;
      return;
    }

    tbody.innerHTML = rubros.map(r => `
      <tr>
        <td style="color:var(--text-muted);font-size:var(--font-size-xs);">${Utils.esc(r.id || '—')}</td>
        <td style="font-weight:500;">${Utils.esc(r.nombre || '—')}</td>
        <td>${Utils.badgeActivo(r.activo)}</td>
        <td>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-ghost btn-sm" onclick="ConfigScreen.editarRubro('${Utils.esc(r.id)}','${Utils.esc(r.nombre)}','${r.activo}')" title="Editar">
              <i data-lucide="pencil" style="width:14px;"></i>
            </button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="ConfigScreen.desactivarRubro('${Utils.esc(r.id)}','${Utils.esc(r.nombre)}')" title="Desactivar">
              <i data-lucide="trash-2" style="width:14px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    UI.icons();
  }

  function abrirModalRubro(id = null, nombre = '', activo = 'true') {
    document.getElementById('modal-rubro-titulo').textContent = id ? 'Editar Rubro' : 'Nuevo Rubro';
    document.getElementById('rub-id').value     = id || '';
    document.getElementById('rub-nombre').value = nombre;
    document.getElementById('rub-activo').value = String(activo) === 'false' ? 'false' : 'true';
    UI.openModal('modal-rubro');
  }

  async function guardarRubro(e) {
    e.preventDefault();
    const id     = document.getElementById('rub-id').value;
    const nombre = document.getElementById('rub-nombre').value.trim();
    const activo = document.getElementById('rub-activo').value === 'true';

    if (!nombre) { UI.warning('Ingresá un nombre para el rubro'); return; }

    try {
      if (id) {
        await API.updateRubro({ id, nombre, activo });
        UI.success('Rubro actualizado');
      } else {
        await API.createRubro({ nombre, activo });
        UI.success('Rubro creado');
      }
      UI.closeModal('modal-rubro');
      cargarRubros();
    } catch {}
  }

  async function desactivarRubro(id, nombre) {
    const ok = await UI.confirm({
      message: `¿Desactivar el rubro "${nombre}"?`,
      sub: 'Los productos con este rubro no se verán afectados.',
      icon: '⚠️',
    });
    if (!ok) return;
    try {
      await API.deleteRubro(id);
      UI.success('Rubro desactivado');
      cargarRubros();
    } catch {}
  }

  // ════════════════════════════════════════════════════════════
  // APARIENCIA / CONFIG
  // ════════════════════════════════════════════════════════════

  async function cargarApariencia() {
    try {
      const data = await API.getConfig();
      if (!data?.config) return;
      const c = data.config;
      setVal('cfg-nombre',    c.nombreNegocio || 'Karnales');
      setVal('cfg-subtitulo', c.subtitulo     || 'Tienda Online');
      setVal('cfg-direccion', c.direccion     || '');
      setVal('cfg-telefono',  c.telefono      || '');
      setVal('cfg-stock-min', c.stockMinimo   || 3);
      const color = c.colorAcento || '#C9A84C';
      const colorEl = document.getElementById('cfg-color');
      const hexEl   = document.getElementById('cfg-color-hex');
      if (colorEl) colorEl.value = color;
      if (hexEl)   hexEl.value   = color;
    } catch {}
  }

  async function guardarApariencia(e) {
    e.preventDefault();
    const body = {
      nombreNegocio: document.getElementById('cfg-nombre').value.trim(),
      subtitulo:     document.getElementById('cfg-subtitulo').value.trim(),
      direccion:     document.getElementById('cfg-direccion').value.trim(),
      telefono:      document.getElementById('cfg-telefono').value.trim(),
      colorAcento:   document.getElementById('cfg-color-hex').value.trim(),
      stockMinimo:   Number(document.getElementById('cfg-stock-min').value) || 3,
    };
    try {
      await API.saveConfig(body);
      App.aplicarConfig(body);
      window.KarnalesConfig = Object.assign(window.KarnalesConfig || {}, body);
      UI.success('Configuración guardada');
    } catch {}
  }

  // ════════════════════════════════════════════════════════════
  // CONTRASEÑA
  // ════════════════════════════════════════════════════════════

  async function cambiarPassword(e) {
    e.preventDefault();
    const actual   = document.getElementById('pwd-actual').value;
    const nueva    = document.getElementById('pwd-nueva').value;
    const repetir  = document.getElementById('pwd-repetir').value;

    if (!actual || !nueva || !repetir) { UI.warning('Completá todos los campos'); return; }
    if (nueva !== repetir) { UI.error('Las contraseñas nuevas no coinciden'); return; }
    if (nueva.length < 6)  { UI.warning('La contraseña debe tener al menos 6 caracteres'); return; }

    try {
      await API.cambiarPassword({ contrasenaActual: actual, contrasenaNueva: nueva });
      UI.success('Contraseña actualizada correctamente');
      document.getElementById('form-password').reset();
    } catch {}
  }

  // ── Helpers ──────────────────────────────────────────────────
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  // ── Sincronizar color picker ↔ texto ─────────────────────────
  function bindColorSync() {
    const picker = document.getElementById('cfg-color');
    const hex    = document.getElementById('cfg-color-hex');
    picker?.addEventListener('input', () => { if (hex) hex.value = picker.value; });
    hex?.addEventListener('input',    () => {
      const v = hex.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(v) && picker) picker.value = v;
    });
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    // Tabs
    document.querySelectorAll('.config-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Formularios
    document.getElementById('form-usuario')?.addEventListener('submit', guardarUsuario);
    document.getElementById('form-rubro')?.addEventListener('submit', guardarRubro);
    document.getElementById('form-apariencia')?.addEventListener('submit', guardarApariencia);
    document.getElementById('form-password')?.addEventListener('submit', cambiarPassword);

    // Botones abrir modal
    document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => abrirModalUsuario());
    document.getElementById('btn-nuevo-rubro')?.addEventListener('click', () => abrirModalRubro());

    bindColorSync();
  }

  App.register('configuracion', cargar);

  // Exponer para onclick inline
  window.ConfigScreen = {
    editarUsuario:    abrirModalUsuario,
    desactivarUsuario,
    editarRubro:      abrirModalRubro,
    desactivarRubro,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
