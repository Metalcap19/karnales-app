// Gestión de ventas
//
// GET /api/ventas               → lista todas las ventas
// GET /api/ventas?fecha=hoy     → ventas del día actual
// GET /api/ventas?mes=2024-06   → ventas del mes
// POST /api/ventas              → registra venta + descuenta stock + registra en caja
//
// Columnas Ventas (0-11):
// Fecha | IDVenta | ProductoID | Producto | Cantidad | PrecioUnitario |
// Descuento% | PrecioFinal | Cliente | FormaPago | Usuario | Observaciones
//
// Columnas Productos (0-8):
// ID | Nombre | Rubro | Cantidad | PrecioCompra | PrecioVenta | Activo | FechaAlta | FechaModificacion

const {
  readSheet, appendRow, updateRow, findRowIndex,
  nextVentaId, today, respond, handleOptions,
} = require('./_sheets');
const { verifyToken } = require('./_auth');

function rowToVenta(row) {
  return {
    fecha:          row[0]  || '',
    idVenta:        row[1]  || '',
    productoId:     row[2]  || '',
    producto:       row[3]  || '',
    cantidad:       Number(row[4])  || 0,
    precioUnitario: Number(row[5])  || 0,
    descuento:      Number(row[6])  || 0,
    precioFinal:    Number(row[7])  || 0,
    cliente:        row[8]  || '',
    formaPago:      row[9]  || '',
    usuario:        row[10] || '',
    observaciones:  row[11] || '',
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
      const rows = await readSheet('Ventas!A:L');
      let ventas = rows.filter(r => r[0]).map(rowToVenta);

      // Filtro por fecha exacta: ?fecha=2024-06-15 o ?fecha=hoy
      if (params.fecha) {
        const fechaFiltro = params.fecha === 'hoy' ? today() : params.fecha;
        ventas = ventas.filter(v => v.fecha === fechaFiltro);
      }

      // Filtro por mes: ?mes=2024-06
      if (params.mes) {
        ventas = ventas.filter(v => v.fecha.startsWith(params.mes));
      }

      // Ordenar descendente por fecha
      ventas.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.idVenta.localeCompare(a.idVenta));

      return respond(200, { ventas });
    }

    // ── POST (registrar venta) ────────────────────────────────────────────────
    if (method === 'POST') {
      const data = JSON.parse(event.body || '{}');
      const {
        productoId, cantidad, precioUnitario,
        descuento = 0, cliente = '', formaPago, observaciones = '',
      } = data;

      // Validaciones
      if (!productoId)     return respond(400, { error: 'Producto requerido' });
      if (!cantidad || cantidad <= 0) return respond(400, { error: 'Cantidad inválida' });
      if (!precioUnitario || precioUnitario <= 0) return respond(400, { error: 'Precio unitario inválido' });
      if (!formaPago)      return respond(400, { error: 'Forma de pago requerida' });

      // Verificar que el producto existe y tiene stock suficiente
      const prodRows = await readSheet('Productos!A:I');
      const prodRow = prodRows.find(r => r[0] === productoId && r[6] === 'TRUE');

      if (!prodRow) return respond(404, { error: 'Producto no encontrado o inactivo' });

      const stockActual = Number(prodRow[3]) || 0;
      if (stockActual < cantidad) {
        return respond(400, {
          error: `Stock insuficiente. Disponible: ${stockActual}`,
        });
      }

      // Calcular precio final
      const descuentoPct = Math.min(Math.max(Number(descuento), 0), 100);
      const precioFinal = parseFloat(
        ((Number(precioUnitario) * Number(cantidad)) * (1 - descuentoPct / 100)).toFixed(2)
      );

      // Generar ID de venta
      const idVenta = await nextVentaId();
      const fechaHoy = today();

      // 1. Registrar la venta
      const ventaRow = [
        fechaHoy,
        idVenta,
        productoId,
        prodRow[1], // nombre del producto en el momento de la venta
        Number(cantidad),
        Number(precioUnitario),
        descuentoPct,
        precioFinal,
        cliente.trim(),
        formaPago,
        auth.payload.usuario,
        observaciones.trim(),
      ];
      await appendRow('Ventas', ventaRow);

      // 2. Descontar stock del producto
      const nuevoStock = stockActual - Number(cantidad);
      const prodRowIndex = await findRowIndex('Productos', productoId);
      const prodActualizado = [
        prodRow[0], prodRow[1], prodRow[2],
        nuevoStock,
        prodRow[4], prodRow[5], prodRow[6],
        prodRow[7],
        fechaHoy, // FechaModificacion
      ];
      await updateRow('Productos', prodRowIndex, prodActualizado);

      // 3. Registrar ingreso en Caja
      const cajaRow = [
        fechaHoy,
        'Ingreso',
        'Venta',
        precioFinal,
        auth.payload.usuario,
        `${prodRow[1]} x${cantidad}${descuentoPct > 0 ? ` (${descuentoPct}% dto)` : ''}${cliente ? ` — ${cliente}` : ''}`,
        idVenta,
      ];
      await appendRow('Caja', cajaRow);

      return respond(201, {
        mensaje: 'Venta registrada correctamente',
        idVenta,
        precioFinal,
        nuevoStock,
      });
    }

    return respond(405, { error: 'Método no permitido' });

  } catch (err) {
    console.error('Error en ventas:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
