// Gestión de deudores
//
// GET    /api/deudores                  → lista todos los deudores
// GET    /api/deudores?estado=pendiente → solo pendientes
// GET    /api/deudores?cliente=Juan     → filtrar por cliente
// PUT    /api/deudores                  → marcar como pagado + registrar en caja
//
// Columnas Deudores (0-9):
// ID | Fecha | VentaID | Cliente | Producto | Monto | Estado | Vendedor | FechaPago | Observaciones

const {
  readSheet, appendRow, updateRow, findRowIndex,
  nextId, today, respond, handleOptions,
} = require('./_sheets');
const { verifyToken } = require('./_auth');

function rowToDeudor(row) {
  return {
    id:            row[0] || '',
    fecha:         row[1] || '',
    ventaId:       row[2] || '',
    cliente:       row[3] || '',
    producto:      row[4] || '',
    monto:         Number(row[5]) || 0,
    estado:        row[6] || 'Pendiente',
    vendedor:      row[7] || '',
    fechaPago:     row[8] || '',
    observaciones: row[9] || '',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const auth = verifyToken(event);
  if (auth.error) return respond(auth.status, { error: auth.error });

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const rows = await readSheet('Deudores!A:J');
      let deudores = rows.filter(r => r[0]).map(rowToDeudor);

      if (params.estado) {
        deudores = deudores.filter(d => d.estado.toLowerCase() === params.estado.toLowerCase());
      }
      if (params.cliente) {
        const q = params.cliente.toLowerCase();
        deudores = deudores.filter(d => d.cliente.toLowerCase().includes(q));
      }

      deudores.sort((a, b) => b.fecha.localeCompare(a.fecha));

      const totalPendiente = deudores
        .filter(d => d.estado === 'Pendiente')
        .reduce((acc, d) => acc + d.monto, 0);

      return respond(200, { deudores, totalPendiente });
    }

    // ── PUT (cobrar deuda) ────────────────────────────────────────────────────
    if (method === 'PUT') {
      const data = JSON.parse(event.body || '{}');
      const { id, observaciones = '' } = data;

      if (!id) return respond(400, { error: 'ID requerido' });

      const rowIndex = await findRowIndex('Deudores', id);
      if (rowIndex === -1) return respond(404, { error: 'Deudor no encontrado' });

      const rows = await readSheet('Deudores!A:J');
      const current = rows.find(r => r[0] === id);
      if (!current) return respond(404, { error: 'Deudor no encontrado' });

      if (current[6] === 'Pagado') {
        return respond(400, { error: 'Esta deuda ya fue cobrada' });
      }

      const fechaHoy = today();

      // Actualizar estado en Deudores
      await updateRow('Deudores', rowIndex, [
        current[0], // id
        current[1], // fecha
        current[2], // ventaId
        current[3], // cliente
        current[4], // producto
        current[5], // monto
        'Pagado',
        current[7], // vendedor
        fechaHoy,   // fechaPago
        observaciones.trim() || current[9],
      ]);

      // Registrar en Caja como ingreso
      await appendRow('Caja', [
        fechaHoy,
        'Ingreso',
        'Venta',
        Number(current[5]),
        auth.payload.usuario,
        `Cobro de deuda — ${current[3]} — ${current[4]}`,
        current[2], // ventaId como referencia
      ]);

      return respond(200, { mensaje: 'Deuda cobrada y registrada en caja' });
    }

    return respond(405, { error: 'Método no permitido' });

  } catch (err) {
    console.error('Error en deudores:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
