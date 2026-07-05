// Gestión de deudores
//
// GET    /api/deudores                  → lista todos los deudores
// GET    /api/deudores?estado=pendiente → solo pendientes
// GET    /api/deudores?cliente=Juan     → filtrar por cliente
// PUT    /api/deudores                  → registrar pago parcial o total + caja
//
// Columnas Deudores (0-10):
// ID | Fecha | VentaID | Cliente | Producto | Monto | Estado | Vendedor | FechaPago | Observaciones | MontoPagado

const {
  readSheet, appendRow, updateRow, findRowIndex,
  nextId, today, respond, handleOptions,
} = require('./_sheets');
const { verifyToken } = require('./_auth');

function rowToDeudor(row) {
  const monto       = Number(row[5]) || 0;
  const montoPagado = Number(row[10]) || 0;
  return {
    id:            row[0] || '',
    fecha:         row[1] || '',
    ventaId:       row[2] || '',
    cliente:       row[3] || '',
    producto:      row[4] || '',
    monto,
    estado:        row[6] || 'Pendiente',
    vendedor:      row[7] || '',
    fechaPago:     row[8] || '',
    observaciones: row[9] || '',
    montoPagado,
    saldo:         Math.max(0, monto - montoPagado),
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
      const rows = await readSheet('Deudores!A:K');
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

    // ── PUT (pago parcial o total de deuda) ──────────────────────────────────
    if (method === 'PUT') {
      const data = JSON.parse(event.body || '{}');
      const { id, montoParcial, observaciones = '' } = data;

      if (!id)          return respond(400, { error: 'ID requerido' });
      if (!montoParcial || Number(montoParcial) <= 0)
                        return respond(400, { error: 'Monto de pago inválido' });

      const rowIndex = await findRowIndex('Deudores', id);
      if (rowIndex === -1) return respond(404, { error: 'Deudor no encontrado' });

      const rows = await readSheet('Deudores!A:K');
      const current = rows.find(r => r[0] === id);
      if (!current) return respond(404, { error: 'Deudor no encontrado' });

      if (current[6] === 'Pagado') {
        return respond(400, { error: 'Esta deuda ya fue saldada' });
      }

      const montoTotal    = Number(current[5]) || 0;
      const yaAbonado     = Number(current[10]) || 0;
      const saldo         = Math.max(0, montoTotal - yaAbonado);
      const pago          = Math.min(Number(montoParcial), saldo);

      if (pago <= 0) return respond(400, { error: 'El saldo ya está en cero' });

      const nuevoAbonado  = yaAbonado + pago;
      const quedaSaldo    = montoTotal - nuevoAbonado;
      const esFinal       = quedaSaldo <= 0;
      const fechaHoy      = today();

      await updateRow('Deudores', rowIndex, [
        current[0],                               // id
        current[1],                               // fecha original
        current[2],                               // ventaId
        current[3],                               // cliente
        current[4],                               // producto
        current[5],                               // monto total (no cambia)
        esFinal ? 'Pagado' : 'Pendiente',
        current[7],                               // vendedor
        esFinal ? fechaHoy : (current[8] || ''), // fechaPago solo si se salda
        observaciones.trim() || current[9],
        nuevoAbonado,                             // col K: acumulado pagado
      ]);

      // Cada pago se registra en Caja por separado con su fecha
      await appendRow('Caja', [
        fechaHoy,
        'Ingreso',
        'Venta',
        pago,
        auth.payload.usuario,
        `Cobro de deuda${esFinal ? ' (total)' : ' (parcial)'} — ${current[3]} — ${current[4]}`,
        current[2],
      ]);

      return respond(200, {
        mensaje: esFinal ? 'Deuda saldada' : `Pago registrado. Saldo restante: ${quedaSaldo}`,
        saldoRestante: Math.max(0, quedaSaldo),
        pagado: nuevoAbonado,
        esFinal,
      });
    }

    return respond(405, { error: 'Método no permitido' });

  } catch (err) {
    console.error('Error en deudores:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
