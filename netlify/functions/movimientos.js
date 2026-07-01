// Vista cronológica de todos los movimientos de caja
//
// GET /api/movimientos                          → todos los movimientos
// GET /api/movimientos?desde=2024-06-01&hasta=2024-06-30
// GET /api/movimientos?usuario=admin
// GET /api/movimientos?tipo=Ingreso
// GET /api/movimientos?texto=zapatilla
// GET /api/movimientos?page=1&limit=50          → paginación
//
// Columnas Caja (0-6):
// Fecha | Tipo | Concepto | Monto | Usuario | Observaciones | IDReferencia

const { readSheet, today, respond, handleOptions } = require('./_sheets');
const { verifyAdmin } = require('./_auth');

function rowToMovimiento(row, index) {
  return {
    _index:       index,
    fecha:        row[0] || '',
    tipo:         row[1] || '',
    concepto:     row[2] || '',
    monto:        Number(row[3]) || 0,
    usuario:      row[4] || '',
    observaciones: row[5] || '',
    idReferencia: row[6] || '',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return respond(405, { error: 'Método no permitido' });

  const auth = verifyAdmin(event);
  if (auth.error) return respond(auth.status, { error: auth.error });

  const params = event.queryStringParameters || {};

  try {
    const rows = await readSheet('Caja!A:G');
    let movimientos = rows
      .filter(r => r[0])
      .map((r, i) => rowToMovimiento(r, i));

    // ── Filtros ───────────────────────────────────────────────────────────────

    if (params.desde) {
      movimientos = movimientos.filter(m => m.fecha >= params.desde);
    }

    if (params.hasta) {
      movimientos = movimientos.filter(m => m.fecha <= params.hasta);
    }

    if (params.usuario) {
      movimientos = movimientos.filter(
        m => m.usuario.toLowerCase() === params.usuario.toLowerCase()
      );
    }

    if (params.tipo) {
      movimientos = movimientos.filter(
        m => m.tipo.toLowerCase() === params.tipo.toLowerCase()
      );
    }

    if (params.texto) {
      const texto = params.texto.toLowerCase();
      movimientos = movimientos.filter(
        m =>
          m.concepto.toLowerCase().includes(texto) ||
          m.observaciones.toLowerCase().includes(texto) ||
          m.idReferencia.toLowerCase().includes(texto)
      );
    }

    // Ordenar descendente (más recientes primero)
    movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha) || b._index - a._index);

    // ── Totales del período filtrado ──────────────────────────────────────────
    const totalIngresos = movimientos
      .filter(m => m.monto > 0)
      .reduce((acc, m) => acc + m.monto, 0);

    const totalEgresos = movimientos
      .filter(m => m.monto < 0)
      .reduce((acc, m) => acc + m.monto, 0);

    // ── Paginación ────────────────────────────────────────────────────────────
    const page  = Math.max(1, parseInt(params.page  || '1',  10));
    const limit = Math.min(200, parseInt(params.limit || '50', 10));
    const total = movimientos.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const pagina = movimientos.slice(offset, offset + limit);

    // Limpiar campo interno antes de responder
    pagina.forEach(m => delete m._index);

    // Lista de usuarios únicos (para el filtro del frontend)
    const usuarios = [...new Set(
      rows.filter(r => r[4]).map(r => r[4])
    )];

    return respond(200, {
      movimientos: pagina,
      paginacion: { page, limit, total, totalPages },
      resumen: { totalIngresos, totalEgresos },
      usuarios,
    });

  } catch (err) {
    console.error('Error en movimientos:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
