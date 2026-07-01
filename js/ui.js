/* ═══════════════════════════════════════════════════════════════
   KARNALES — UI Helpers
   Toast, loader, modal, confirm dialog, iconos Lucide.
═══════════════════════════════════════════════════════════════ */

const UI = (() => {

  // ── Toast ───────────────────────────────────────────────────
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const icons = {
      success: 'check-circle',
      error:   'x-circle',
      warning: 'alert-triangle',
      info:    'info',
    };

    el.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" style="width:16px;height:16px;flex-shrink:0;"></i>
      <span>${Utils.esc(message)}</span>
      <button class="toast-close" style="background:none;border:none;cursor:pointer;color:inherit;margin-left:auto;padding:0;">
        <i data-lucide="x" style="width:14px;height:14px;"></i>
      </button>
    `;

    container.appendChild(el);
    lucide.createIcons({ el });

    const close = () => {
      el.style.animation = 'slideOutRight 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    };

    el.querySelector('.toast-close').addEventListener('click', close);
    setTimeout(close, duration);
  }

  const success = (msg, ms)  => toast(msg, 'success', ms);
  const error   = (msg, ms)  => toast(msg, 'error',   ms);
  const warning = (msg, ms)  => toast(msg, 'warning', ms);
  const info    = (msg, ms)  => toast(msg, 'info',    ms);

  // ── Loader global ───────────────────────────────────────────
  let loaderCount = 0;

  function showLoader(text = 'Cargando...') {
    loaderCount++;
    const el = document.getElementById('global-loader');
    if (!el) return;
    const t = el.querySelector('.loader-text');
    if (t) t.textContent = text;
    el.classList.remove('hidden');
  }

  function hideLoader() {
    loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount === 0) {
      const el = document.getElementById('global-loader');
      if (el) el.classList.add('hidden');
    }
  }

  // ── Modal ───────────────────────────────────────────────────
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('active');
    document.body.style.overflow = '';
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop.active').forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('active');
    });
    document.body.style.overflow = '';
  }

  // Cierre con botones data-close y click fuera del modal
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
      return;
    }
    if (e.target.classList.contains('modal-backdrop') && e.target.classList.contains('active')) {
      closeModal(e.target.id);
    }
  });

  // Cierre con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // ── Confirm dialog ──────────────────────────────────────────
  function confirm({ message, sub = '', icon = '⚠️', okText = 'Confirmar', okClass = 'btn-danger' }) {
    return new Promise((resolve) => {
      document.getElementById('confirm-message').textContent = message;
      document.getElementById('confirm-sub').textContent     = sub;
      document.getElementById('confirm-icon').textContent    = icon;

      const btnOk     = document.getElementById('confirm-ok');
      const btnCancel = document.getElementById('confirm-cancel');

      btnOk.textContent  = okText;
      btnOk.className    = `btn ${okClass}`;

      openModal('modal-confirm');

      const cleanup = (result) => {
        closeModal('modal-confirm');
        btnOk.replaceWith(btnOk.cloneNode(true));
        btnCancel.replaceWith(btnCancel.cloneNode(true));
        resolve(result);
      };

      document.getElementById('confirm-ok').addEventListener('click', () => cleanup(true),  { once: true });
      document.getElementById('confirm-cancel').addEventListener('click', () => cleanup(false), { once: true });
    });
  }

  // ── Render Lucide icons (re-renderiza tras mutaciones DOM) ──
  function icons() {
    if (window.lucide) lucide.createIcons();
  }

  // ── Pagination helper ───────────────────────────────────────
  function renderPagination(containerId, paginacion, onPage) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { page, totalPages } = paginacion;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || i === totalPages ||
        (i >= page - 2 && i <= page + 2)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    container.innerHTML = `
      <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">
        <i data-lucide="chevron-left" style="width:14px;"></i>
      </button>
      ${pages.map(p =>
        p === '...'
          ? `<span class="page-btn" style="pointer-events:none;">…</span>`
          : `<button class="page-btn ${p === page ? 'active' : ''}" data-p="${p}">${p}</button>`
      ).join('')}
      <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-p="${page + 1}">
        <i data-lucide="chevron-right" style="width:14px;"></i>
      </button>
    `;

    container.querySelectorAll('[data-p]').forEach(btn => {
      btn.addEventListener('click', () => onPage(Number(btn.dataset.p)));
    });

    icons();
  }

  return {
    toast, success, error, warning, info,
    showLoader, hideLoader,
    openModal, closeModal, closeAllModals,
    confirm,
    icons,
    renderPagination,
  };

})();
