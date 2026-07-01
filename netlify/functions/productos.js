// Gestión completa de productos
//
// GET    /api/productos              → lista todos los productos
// GET    /api/productos?id=PROD-001  → obtiene uno por ID
// GET    /api/productos?rubros=true  → lista solo los rubros activos
// POST   /api/productos              → crea producto nuevo
// PUT    /api/productos              → edita producto existente
// DELETE /api/productos?id=PROD-001  → elimina (desactiva) producto
//
// Columnas Productos (0-8):
// ID | Nombre | Rubro | Cantidad | PrecioCompra | PrecioVenta | Activo | FechaAlta | FechaModificacion
//
// Columnas Rubros (0-2):
// ID | Nombre | Activo

const { readSheet, appendRow, updateRow, findRowIndex, nextId, today, respond, handleOptions } = require('./_sheets');
const { verifyToken, verifyAdmin } = require('./_auth');

// Convierte fila array → objeto producto
function rowToProducto(row) {
  return {
    id:                row[0] || '',
    nombre:            row[1] || '',
    rubro:             row[2] || '',
    cantidad:          Number(row[3]) || 0,
    precioCompra:      Number(row[4]) || 0,
    precioVenta:       Number(row[5]) || 0,
    activo:            row[6] === 'TRUE',
    fechaAlta:         row[7] || '',
    fechaModificacion: row[8] || '',
  };
}

// Convierte objeto producto → fila array para Sheets
function productoToRow(p) {
  return [
    p.id,
    p.nombre,
    p.rubro,
    p.cantidad,
    p.precioCompra,
    p.precioVenta,
    p.activo ? 'TRUE' : 'FALSE',
    p.fechaAlta,
    p.fechaModificacion,
  ];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  // Todos los endpoints de productos requieren token válido
  const auth = verifyToken(event);
  if (auth.error) return respond(auth.status, { error: auth.error });

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (method === 'GET') {

      // GET ?rubros=true → devuelve lista de rubros activos para el dropdown
      if (params.rubros === 'true') {
        const rows = await readSheet('Rubros!A:C');
        const rubros = rows
          .filter(r => r[0] && r[2] === 'TRUE')
          .map(r => ({ id: r[0], nombre: r[1] }));
        return respond(200, { rubros });
      }

      // GET ?id=PROD-001 → devuelve un producto específico
      if (params.id) {
        const rows = await readSheet('Productos!A:I');
        const row = rows.find(r => r[0] === params.id);
        if (!row) return respond(404, { error: 'Producto no encontrado' });
        return respond(200, { producto: rowToProducto(row) });
      }

      // GET → devuelve todos los productos
      const rows = await readSheet('Productos!A:I');
      const productos = rows
        .filter(r => r[0]) // filtra filas vacías
        .map(rowToProducto);
      return respond(200, { productos });
    }

    // ── POST (crear) ──────────────────────────────────────────────────────────
    if (method === 'POST') {
      // Solo admin puede crear productos
      if (auth.payload.rol !== 'admin') {
        return respond(403, { error: 'Solo administradores pueden agregar productos' });
      }

      const data = JSON.parse(event.body || '{}');
      const { nombre, rubro, cantidad, precioCompra, precioVenta, activo } = data;

      if (!nombre || !rubro) {
        return respond(400, { error: 'Nombre y rubro son requeridos' });
      }

      const id = await nextId('Productos', 'PROD');
      const fechaHoy = today();

      const nuevo = {
        id,
        nombre: nombre.trim(),
        rubro: rubro.trim(),
        cantidad: Number(cantidad) || 0,
        precioCompra: Number(precioCompra) || 0,
        precioVenta: Number(precioVenta) || 0,
        activo: activo !== false,
        fechaAlta: fechaHoy,
        fechaModificacion: fechaHoy,
      };

      await appendRow('Productos', productoToRow(nuevo));
      return respond(201, { mensaje: 'Producto creado', producto: nuevo });
    }

    // ── PUT (editar) ──────────────────────────────────────────────────────────
    if (method === 'PUT') {
      if (auth.payload.rol !== 'admin') {
        return respond(403, { error: 'Solo administradores pueden editar productos' });
      }

      const data = JSON.parse(event.body || '{}');
      const { id, nombre, rubro, cantidad, precioCompra, precioVenta, activo } = data;

      if (!id) return respond(400, { error: 'ID requerido' });

      const rowIndex = await findRowIndex('Productos', id);
      if (rowIndex === -1) return respond(404, { error: 'Producto no encontrado' });

      // Leer datos actuales para no pisar campos que no se envían
      const rows = await readSheet('Productos!A:I');
      const current = rows.find(r => r[0] === id);
      if (!current) return respond(404, { error: 'Producto no encontrado' });

      const actualizado = {
        id,
        nombre:            nombre    !== undefined ? nombre.trim()       : current[1],
        rubro:             rubro     !== undefined ? rubro.trim()        : current[2],
        cantidad:          cantidad  !== undefined ? Number(cantidad)    : Number(current[3]),
        precioCompra:      precioCompra !== undefined ? Number(precioCompra) : Number(current[4]),
        precioVenta:       precioVenta  !== undefined ? Number(precioVenta)  : Number(current[5]),
        activo:            activo    !== undefined ? activo              : current[6] === 'TRUE',
        fechaAlta:         current[7],
        fechaModificacion: today(),
      };

      await updateRow('Productos', rowIndex, productoToRow(actualizado));
      return respond(200, { mensaje: 'Producto actualizado', producto: actualizado });
    }

    // ── DELETE (desactivar) ───────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (auth.payload.rol !== 'admin') {
        return respond(403, { error: 'Solo administradores pueden eliminar productos' });
      }

      const id = params.id;
      if (!id) return respond(400, { error: 'ID requerido' });

      const rowIndex = await findRowIndex('Productos', id);
      if (rowIndex === -1) return respond(404, { error: 'Producto no encontrado' });

      const rows = await readSheet('Productos!A:I');
      const current = rows.find(r => r[0] === id);
      if (!current) return respond(404, { error: 'Producto no encontrado' });

      // Desactiva en lugar de borrar para mantener historial
      const desactivado = {
        id,
        nombre:            current[1],
        rubro:             current[2],
        cantidad:          Number(current[3]),
        precioCompra:      Number(current[4]),
        precioVenta:       Number(current[5]),
        activo:            false,
        fechaAlta:         current[7],
        fechaModificacion: today(),
      };

      await updateRow('Productos', rowIndex, productoToRow(desactivado));
      return respond(200, { mensaje: 'Producto desactivado' });
    }

    return respond(405, { error: 'Método no permitido' });

  } catch (err) {
    console.error('Error en productos:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
