// Gestión de caja
//
// GET /api/caja              → todos los movimientos + saldo actual
// GET /api/caja?fecha=hoy    → movimientos del día
// GET /api/caja?mes=2024-06  → movimientos del mes
// POST /api/caja             → registra movimiento manual
//
// Columnas Caja (0-6):
// Fecha | Tipo | Concepto | Monto | Usuario | Observaciones | IDReferencia

const {
  readSheet, appendRow, today, respond, handleOptions,
} = require('./_sheets');
const { verifyToken, verifyAdmin } = require('./_auth');

function rowToCaja(row) {
  return {
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

  // Caja solo visible para admin
  const auth = verifyAdmin(event);
  if (auth.error) return respond(auth.status, { error: auth.error });

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const rows = await readSheet('Caja!A:G');
      let movimientos = rows.filter(r => r[0]).map(rowToCaja);

      // Filtro por fecha exacta
      if (params.fecha) {
        const fechaFiltro = params.fecha === 'hoy' ? today() : params.fecha;
        movimientos = movimientos.filter(m => m.fecha === fechaFiltro);
      }

      // Filtro por mes YYYY-MM
      if (params.mes) {
        movimientos = movimientos.filter(m => m.fecha.startsWith(params.mes));
      }

      // Ordenar descendente
      movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha));

      // Calcular saldo total (siempre sobre TODOS los movimientos, sin filtro)
      const todosLosMovimientos = rows.filter(r => r[0]).map(rowToCaja);
      const saldo    = todosLosMovimientos.reduce((acc, m) => acc + m.monto, 0);
      const ingresos = todosLosMovimientos.filter(m => m.monto > 0).reduce((acc, m) => acc + m.monto, 0);
      const egresos  = todosLosMovimientos.filter(m => m.monto < 0).reduce((acc, m) => acc + m.monto, 0);

      // Totales del período filtrado
      const ingresosPerido = movimientos.filter(m => m.monto > 0).reduce((acc, m) => acc + m.monto, 0);
      const egresosPerido  = movimientos.filter(m => m.monto < 0).reduce((acc, m) => acc + m.monto, 0);

      return respond(200, {
        movimientos,
        resumen: {
          saldo,
          ingresos,
          egresos,
          ingresosPerido,
          egresosPerido,
        },
      });
    }

    // ── POST (registrar movimiento manual) ────────────────────────────────────
    if (method === 'POST') {
      const data = JSON.parse(event.body || '{}');
      const { tipo, concepto, monto, observaciones = '' } = data;

      if (!tipo)    return respond(400, { error: 'Tipo requerido (Ingreso / Egreso)' });
      if (!concepto) return respond(400, { error: 'Concepto requerido' });
      if (monto === undefined || monto === null || monto === '') {
        return respond(400, { error: 'Monto requerido' });
      }

      const tiposValidos = ['Ingreso', 'Egreso'];
      if (!tiposValidos.includes(tipo)) {
        return respond(400, { error: 'Tipo debe ser Ingreso o Egreso' });
      }

      const conceptosValidos = [
        'Venta', 'Retiro de ganancias', 'Pago de sueldo',
        'Compra de mercadería', 'Otro',
      ];
      if (!conceptosValidos.includes(concepto)) {
        return respond(400, { error: 'Concepto no válido' });
      }

      // Monto: positivo para ingresos, negativo para egresos
      const montoFinal = tipo === 'Egreso'
        ? -Math.abs(Number(monto))
        : Math.abs(Number(monto));

      const cajaRow = [
        today(),
        tipo,
        concepto,
        montoFinal,
        auth.payload.usuario,
        observaciones.trim(),
        '', // IDReferencia vacío en movimientos manuales
      ];

      await appendRow('Caja', cajaRow);

      return respond(201, {
        mensaje: 'Movimiento registrado correctamente',
        monto: montoFinal,
      });
    }

    return respond(405, { error: 'Método no permitido' });

  } catch (err) {
    console.error('Error en caja:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
