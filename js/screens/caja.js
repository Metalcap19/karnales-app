/* ═══════════════════════════════════════════════════════════════
   KARNALES — Pantalla Caja
═══════════════════════════════════════════════════════════════ */

(function () {

  // ── Carga principal ─────────────────────────────────────────
  async function cargar() {
    try {
      const data = await API.getCaja();
      if (!data) return;
      renderSaldo(data.resumen || {});
      renderRecientes(data.movimientos || []);
    } catch (e) {
      console.error('Caja load error:', e);
    }
  }

  // ── Saldo y resumen ──────────────────────────────────────────
  function renderSaldo(resumen) {
    const saldo = resumen.saldo ?? 0;
    const el    = document.getElementById('caja-saldo');
    if (el) {
      el.textContent = Utils.formatMoney(saldo);
      el.className   = 'saldo-valor ' + (saldo >= 0 ? '' : 'monto-negativo');
    }
    setText('caja-ingresos-mes', Utils.formatMoney(resumen.ingresosPeriodo ?? resumen.ingresos ?? 0));
    setText('caja-egresos-mes',  Utils.formatMoney(Math.abs(resumen.egresosPeriodo ?? resumen.egresos ?? 0)));
  }

  // ── Últimos movimientos ──────────────────────────────────────
  function renderRecientes(movimientos) {
    const tbody = document.getElementById('tbody-caja-recientes');
    if (!tbody) return;

    // Mostrar los últimos 20 ordenados por fecha desc
    const lista = [...movimientos]
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      .slice(0, 20);

    if (lista.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Sin movimientos</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(m => {
      const monto    = Number(m.monto) || 0;
      const positivo = monto >= 0;
      return `<tr>
        <td>${Utils.formatDate(m.fecha)}</td>
        <td>
          <div>${Utils.esc(m.concepto || '—')}</div>
          ${m.observaciones ? `<div style="font-size:var(--font-size-xs);color:var(--text-muted);">${Utils.esc(m.observaciones)}</div>` : ''}
        </td>
        <td class="${positivo ? 'monto-positivo' : 'monto-negativo'}">
          ${positivo ? '' : '- '}${Utils.formatMoney(Math.abs(monto))}
        </td>
        <td>${Utils.esc(m.usuario || '—')}</td>
      </tr>`;
    }).join('');
  }

  // ── Registrar movimiento ─────────────────────────────────────
  async function registrarMovimiento(e) {
    e.preventDefault();

    const tipo        = document.getElementById('caja-tipo').value;
    const concepto    = document.getElementById('caja-concepto').value;
    const monto       = Number(document.getElementById('caja-monto').value) || 0;
    const observ      = document.getElementById('caja-observaciones').value.trim();

    if (!tipo)    { UI.warning('Seleccioná el tipo');    return; }
    if (!concepto){ UI.warning('Seleccioná un concepto'); return; }
    if (monto <= 0){ UI.warning('El monto debe ser mayor a 0'); return; }

    const ok = await UI.confirm({
      message: `¿Registrar ${tipo.toLowerCase()} de ${Utils.formatMoney(monto)}?`,
      sub: concepto,
      icon: tipo === 'Ingreso' ? '💰' : '💸',
      okText: 'Registrar',
      okClass: tipo === 'Ingreso' ? 'btn-primary' : 'btn-danger',
    });
    if (!ok) return;

    try {
      await API.createCajaMovimiento({ tipo, concepto, monto, observaciones: observ });
      UI.success(`${tipo} registrado`);
      document.getElementById('form-caja').reset();
      cargar();
    } catch {}
  }

  // ── Helper ────────────────────────────────────────────────────
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Eventos ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('form-caja')?.addEventListener('submit', registrarMovimiento);
  }

  // ── Registro en el router ────────────────────────────────────
  App.register('caja', cargar);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
