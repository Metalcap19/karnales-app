// Exportar datos en formato JSON para que el frontend genere Excel/CSV/PDF
//
// GET /api/exportar?tipo=stock
// GET /api/exportar?tipo=ventas&desde=2024-06-01&hasta=2024-06-30
// GET /api/exportar?tipo=caja&mes=2024-06
// GET /api/exportar?tipo=movimientos
// GET /api/exportar?tipo=reportes
//
// El frontend recibe los datos y genera el archivo con SheetJS o CSV nativo.

const { readSheet, respond, handleOptions } = require('./_sheets');
const { verifyAdmin } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return respond(405, { error: 'Método no permitido' });

  const auth = verifyAdmin(event);
  if (auth.error) return respond(auth.status, { error: auth.error });

  const params = event.queryStringParameters || {};
  const tipo   = params.tipo;

  if (!tipo) return respond(400, { error: 'Parámetro tipo requerido' });

  try {

    // ── Stock ─────────────────────────────────────────────────────────────────
    if (tipo === 'stock') {
      const rows = await readSheet('Productos!A:I');
      const datos = rows
        .filter(r => r[0])
        .map(r => ({
          ID:                r[0] || '',
          Nombre:            r[1] || '',
          Rubro:             r[2] || '',
          Cantidad:          Number(r[3]) || 0,
          'Precio Compra':   Number(r[4]) || 0,
          'Precio Venta':    Number(r[5]) || 0,
          'Valor en Stock':  (Number(r[3]) || 0) * (Number(r[5]) || 0),
          Activo:            r[6] === 'TRUE' ? 'Sí' : 'No',
          'Fecha Alta':      r[7] || '',
          'Última Modif.':   r[8] || '',
        }));

      return respond(200, {
        tipo: 'stock',
        titulo: 'Stock de Productos',
        columnas: ['ID','Nombre','Rubro','Cantidad','Precio Compra','Precio Venta','Valor en Stock','Activo','Fecha Alta','Última Modif.'],
        datos,
        total: datos.length,
      });
    }

    // ── Ventas ────────────────────────────────────────────────────────────────
    if (tipo === 'ventas') {
      const rows = await readSheet('Ventas!A:L');
      let datos = rows
        .filter(r => r[0])
        .map(r => ({
          Fecha:             r[0]  || '',
          'ID Venta':        r[1]  || '',
          'ID Producto':     r[2]  || '',
          Producto:          r[3]  || '',
          Cantidad:          Number(r[4])  || 0,
          'Precio Unitario': Number(r[5])  || 0,
          'Descuento %':     Number(r[6])  || 0,
          'Precio Final':    Number(r[7])  || 0,
          Cliente:           r[8]  || '',
          'Forma de Pago':   r[9]  || '',
          Usuario:           r[10] || '',
          Observaciones:     r[11] || '',
        }));

      if (params.desde) datos = datos.filter(d => d.Fecha >= params.desde);
      if (params.hasta) datos = datos.filter(d => d.Fecha <= params.hasta);
      if (params.mes)   datos = datos.filter(d => d.Fecha.startsWith(params.mes));

      datos.sort((a, b) => b.Fecha.localeCompare(a.Fecha));

      const totalVentas = datos.reduce((acc, d) => acc + d['Precio Final'], 0);

      return respond(200, {
        tipo: 'ventas',
        titulo: 'Historial de Ventas',
        columnas: ['Fecha','ID Venta','ID Producto','Producto','Cantidad','Precio Unitario','Descuento %','Precio Final','Cliente','Forma de Pago','Usuario','Observaciones'],
        datos,
        total: datos.length,
        totalVentas,
      });
    }

    // ── Caja ──────────────────────────────────────────────────────────────────
    if (tipo === 'caja') {
      const rows = await readSheet('Caja!A:G');
      let datos = rows
        .filter(r => r[0])
        .map(r => ({
          Fecha:          r[0] || '',
          Tipo:           r[1] || '',
          Concepto:       r[2] || '',
          Monto:          Number(r[3]) || 0,
          Usuario:        r[4] || '',
          Observaciones:  r[5] || '',
          Referencia:     r[6] || '',
        }));

      if (params.mes)   datos = datos.filter(d => d.Fecha.startsWith(params.mes));
      if (params.desde) datos = datos.filter(d => d.Fecha >= params.desde);
      if (params.hasta) datos = datos.filter(d => d.Fecha <= params.hasta);

      datos.sort((a, b) => b.Fecha.localeCompare(a.Fecha));

      const saldo    = datos.reduce((acc, d) => acc + d.Monto, 0);
      const ingresos = datos.filter(d => d.Monto > 0).reduce((acc, d) => acc + d.Monto, 0);
      const egresos  = datos.filter(d => d.Monto < 0).reduce((acc, d) => acc + d.Monto, 0);

      return respond(200, {
        tipo: 'caja',
        titulo: 'Movimientos de Caja',
        columnas: ['Fecha','Tipo','Concepto','Monto','Usuario','Observaciones','Referencia'],
        datos,
        total: datos.length,
        resumen: { saldo, ingresos, egresos },
      });
    }

    // ── Movimientos (alias de caja sin filtro de mes) ─────────────────────────
    if (tipo === 'movimientos') {
      const rows = await readSheet('Caja!A:G');
      let datos = rows
        .filter(r => r[0])
        .map(r => ({
          Fecha:         r[0] || '',
          Tipo:          r[1] || '',
          Concepto:      r[2] || '',
          Monto:         Number(r[3]) || 0,
          Usuario:       r[4] || '',
          Observaciones: r[5] || '',
          Referencia:    r[6] || '',
        }));

      if (params.desde) datos = datos.filter(d => d.Fecha >= params.desde);
      if (params.hasta) datos = datos.filter(d => d.Fecha <= params.hasta);

      datos.sort((a, b) => b.Fecha.localeCompare(a.Fecha));

      return respond(200, {
        tipo: 'movimientos',
        titulo: 'Todos los Movimientos',
        columnas: ['Fecha','Tipo','Concepto','Monto','Usuario','Observaciones','Referencia'],
        datos,
        total: datos.length,
      });
    }

    // ── Reporte resumen ───────────────────────────────────────────────────────
    if (tipo === 'reportes') {
      const [prodRows, ventaRows, cajaRows] = await Promise.all([
        readSheet('Productos!A:I'),
        readSheet('Ventas!A:L'),
        readSheet('Caja!A:G'),
      ]);

      const hoy = new Date().toISOString().slice(0, 10);
      const mes = new Date().toISOString().slice(0, 7);

      const productosActivos = prodRows.filter(r => r[0] && r[6] === 'TRUE');
      const costoStock = productosActivos.reduce((acc, r) => acc + (Number(r[3]) || 0) * (Number(r[4]) || 0), 0);
      const valorVentaStock = productosActivos.reduce((acc, r) => acc + (Number(r[3]) || 0) * (Number(r[5]) || 0), 0);

      const ventasHoy = ventaRows.filter(r => r[0] === hoy);
      const ventasMes = ventaRows.filter(r => r[0] && r[0].startsWith(mes));
      const cajaTodos = cajaRows.filter(r => r[0]);

      const datos = [
        { Indicador: 'Costo total del stock',       Valor: costoStock },
        { Indicador: 'Valor de venta del stock',     Valor: valorVentaStock },
        { Indicador: 'Ganancia potencial del stock', Valor: valorVentaStock - costoStock },
        { Indicador: 'Total de productos activos',   Valor: productosActivos.length },
        { Indicador: 'Ventas del día (cantidad)',     Valor: ventasHoy.length },
        { Indicador: 'Ventas del día (monto)',        Valor: ventasHoy.reduce((acc, r) => acc + (Number(r[7]) || 0), 0) },
        { Indicador: 'Ventas del mes (cantidad)',     Valor: ventasMes.length },
        { Indicador: 'Ventas del mes (monto)',        Valor: ventasMes.reduce((acc, r) => acc + (Number(r[7]) || 0), 0) },
        { Indicador: 'Saldo de caja actual',          Valor: cajaTodos.reduce((acc, r) => acc + (Number(r[3]) || 0), 0) },
      ];

      return respond(200, {
        tipo: 'reportes',
        titulo: `Reporte General — ${hoy}`,
        columnas: ['Indicador', 'Valor'],
        datos,
        total: datos.length,
      });
    }

    return respond(400, { error: `Tipo de exportación no válido: ${tipo}` });

  } catch (err) {
    console.error('Error en exportar:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
