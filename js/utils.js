/* ═══════════════════════════════════════════════════════════════
   KARNALES — Utilidades / Formatters
   Funciones puras sin efectos secundarios.
═══════════════════════════════════════════════════════════════ */

const Utils = (() => {

  // ── Moneda ─────────────────────────────────────────────────
  function formatMoney(value) {
    const n = Number(value) || 0;
    return '$ ' + n.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  // ── Fechas ──────────────────────────────────────────────────
  function formatDate(str) {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    if (!y || !m || !d) return str;
    return `${d}/${m}/${y}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function formatDateTime(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Números ─────────────────────────────────────────────────
  function formatNumber(n) {
    return Number(n || 0).toLocaleString('es-AR');
  }

  // ── Strings ─────────────────────────────────────────────────
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function slugify(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  // ── Badge HTML ──────────────────────────────────────────────
  function badgeActivo(activo) {
    const v = activo === true || activo === 'true' || activo === 'TRUE';
    return v
      ? '<span class="badge badge-success">Activo</span>'
      : '<span class="badge badge-muted">Inactivo</span>';
  }

  function badgeRol(rol) {
    return rol === 'admin'
      ? '<span class="badge badge-gold">Admin</span>'
      : '<span class="badge badge-muted">Vendedor</span>';
  }

  function badgeTipo(tipo) {
    return tipo === 'Ingreso'
      ? '<span class="badge badge-success">Ingreso</span>'
      : '<span class="badge badge-danger">Egreso</span>';
  }

  function badgeStock(cantidad, minimo = 3) {
    const n = Number(cantidad) || 0;
    if (n === 0) return '<span class="badge badge-danger">Sin stock</span>';
    if (n <= minimo) return '<span class="badge badge-warning">Stock bajo</span>';
    return '<span class="badge badge-success">OK</span>';
  }

  // ── Sanitize para prevenir XSS ──────────────────────────────
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Debounce ────────────────────────────────────────────────
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // ── Descargar archivo ───────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCSV(columnas, datos, filename) {
    const rows = [
      columnas.join(','),
      ...datos.map(row =>
        columnas.map(col => {
          const v = row[col] ?? '';
          const s = String(v).replace(/"/g, '""');
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s}"` : s;
        }).join(',')
      ),
    ];
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
  }

  function downloadXLSX(columnas, datos, titulo, filename) {
    const ws = XLSX.utils.json_to_sheet(
      datos.map(row => {
        const obj = {};
        columnas.forEach(c => { obj[c] = row[c] ?? ''; });
        return obj;
      }),
      { header: columnas }
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31));
    XLSX.writeFile(wb, filename);
  }

  function downloadPDF(columnas, datos, titulo) {
    const win = window.open('', '_blank');
    if (!win) { alert('Permitir ventanas emergentes para exportar PDF'); return; }
    const rows = datos.map(row =>
      `<tr>${columnas.map(c => `<td>${esc(String(row[c] ?? ''))}</td>`).join('')}</tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${esc(titulo)}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;color:#111;}
        h1{font-size:16px;margin-bottom:12px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#111;color:#fff;padding:6px 8px;text-align:left;}
        td{padding:5px 8px;border-bottom:1px solid #ddd;}
        tr:nth-child(even) td{background:#f5f5f5;}
        @media print{button{display:none;}}
      </style></head><body>
      <h1>${esc(titulo)}</h1>
      <p style="color:#666;margin-bottom:12px;">Generado: ${new Date().toLocaleString('es-AR')}</p>
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
      <br/><br/>
      <table><thead><tr>${columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
  }

  return {
    formatMoney, formatDate, formatDateTime, formatNumber, today, currentMonth,
    capitalize, slugify, esc,
    badgeActivo, badgeRol, badgeTipo, badgeStock,
    debounce,
    downloadBlob, downloadCSV, downloadXLSX, downloadPDF,
  };

})();
