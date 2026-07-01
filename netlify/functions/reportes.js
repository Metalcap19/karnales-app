// Reportes y KPIs del negocio
//
// GET /api/reportes → devuelve todos los indicadores y datos para gráficos
//
// Columnas Productos (0-8):
// ID | Nombre | Rubro | Cantidad | PrecioCompra | PrecioVenta | Activo | FechaAlta | FechaModificacion
//
// Columnas Ventas (0-11):
// Fecha | IDVenta | ProductoID | Producto | Cantidad | PrecioUnitario |
// Descuento% | PrecioFinal | Cliente | FormaPago | Usuario | Observaciones
//
// Columnas Caja (0-6):
// Fecha | Tipo | Concepto | Monto | Usuario | Observaciones | IDReferencia

const { readSheet, respond, handleOptions } = require('./_sheets');
const { verifyAdmin } = require('./_auth');

function mesActual() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Últimos N días en formato YYYY-MM-DD
function ultimosDias(n) {
  const dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'GET') return respond(405, { error: 'Método no permitido' });

  const auth = verifyAdmin(event);
  if (auth.error) return respond(auth.status, { error: auth.error });

  try {
    // Leer las tres hojas en paralelo
    const [prodRows, ventaRows, cajaRows] = await Promise.all([
      readSheet('Productos!A:I'),
      readSheet('Ventas!A:L'),
      readSheet('Caja!A:G'),
    ]);

    const hoy  = fechaHoy();
    const mes  = mesActual();

    // ── KPIs de Stock ─────────────────────────────────────────────────────────
    const productosActivos = prodRows.filter(r => r[0] && r[6] === 'TRUE');
    const productosTodos   = prodRows.filter(r => r[0]);

    const costoStock = productosActivos.reduce(
      (acc, r) => acc + (Number(r[3]) || 0) * (Number(r[4]) || 0), 0
    );
    const valorVentaStock = productosActivos.reduce(
      (acc, r) => acc + (Number(r[3]) || 0) * (Number(r[5]) || 0), 0
    );
    const gananciaPotencial = valorVentaStock - costoStock;

    const config = await readSheet('Config!A:B');
    const stockMinEntry = config.find(r => r[0] === 'stock_minimo_alerta');
    const stockMin = Number(stockMinEntry?.[1] || 3);

    const sinStock   = productosActivos.filter(r => (Number(r[3]) || 0) === 0);
    const stockBajo  = productosActivos.filter(r => {
      const qty = Number(r[3]) || 0;
      return qty > 0 && qty <= stockMin;
    });

    // ── KPIs de Ventas ────────────────────────────────────────────────────────
    const ventasHoy = ventaRows.filter(r => r[0] === hoy);
    const ventasMes = ventaRows.filter(r => r[0] && r[0].startsWith(mes));

    const totalVentasHoy    = ventasHoy.reduce((acc, r) => acc + (Number(r[7]) || 0), 0);
    const cantidadVentasHoy = ventasHoy.length;
    const totalVentasMes    = ventasMes.reduce((acc, r) => acc + (Number(r[7]) || 0), 0);
    const cantidadVentasMes = ventasMes.length;

    // ── KPIs de Caja ──────────────────────────────────────────────────────────
    const cajaTodos     = cajaRows.filter(r => r[0]);
    const cajaMes       = cajaTodos.filter(r => r[0].startsWith(mes));

    const saldoTotal    = cajaTodos.reduce((acc, r) => acc + (Number(r[3]) || 0), 0);
    const ingresosMes   = cajaMes.filter(r => Number(r[3]) > 0).reduce((acc, r) => acc + (Number(r[3]) || 0), 0);
    const egresosMes    = cajaMes.filter(r => Number(r[3]) < 0).reduce((acc, r) => acc + (Number(r[3]) || 0), 0);

    // ── Gráfico 1: Ventas por día (últimos 30 días) ───────────────────────────
    const dias30 = ultimosDias(30);
    const ventasPorDia = dias30.map(dia => {
      const total = ventaRows
        .filter(r => r[0] === dia)
        .reduce((acc, r) => acc + (Number(r[7]) || 0), 0);
      return { fecha: dia, total };
    });

    // ── Gráfico 2: Productos más vendidos (top 10 por cantidad) ──────────────
    const conteoProductos = {};
    ventaRows.forEach(r => {
      if (!r[3]) return;
      const nombre = r[3];
      const qty    = Number(r[4]) || 0;
      conteoProductos[nombre] = (conteoProductos[nombre] || 0) + qty;
    });
    const topProductos = Object.entries(conteoProductos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    // ── Gráfico 3: Ventas por rubro ───────────────────────────────────────────
    // Mapear ProductoID → Rubro desde Productos
    const rubroMap = {};
    prodRows.forEach(r => { if (r[0]) rubroMap[r[0]] = r[2] || 'Sin rubro'; });

    const ventasPorRubro = {};
    ventaRows.forEach(r => {
      if (!r[2]) return;
      const rubro = rubroMap[r[2]] || 'Sin rubro';
      ventasPorRubro[rubro] = (ventasPorRubro[rubro] || 0) + (Number(r[7]) || 0);
    });
    const graficoRubros = Object.entries(ventasPorRubro)
      .sort((a, b) => b[1] - a[1])
      .map(([rubro, total]) => ({ rubro, total }));

    // ── Gráfico 4: Ingresos vs Egresos por mes (últimos 6 meses) ─────────────
    const meses6 = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      meses6.push(d.toISOString().slice(0, 7));
    }

    const ingresosVsEgresos = meses6.map(m => {
      const movsMes  = cajaTodos.filter(r => r[0] && r[0].startsWith(m));
      const ingresos = movsMes.filter(r => Number(r[3]) > 0).reduce((acc, r) => acc + (Number(r[3]) || 0), 0);
      const egresos  = Math.abs(movsMes.filter(r => Number(r[3]) < 0).reduce((acc, r) => acc + (Number(r[3]) || 0), 0));
      return { mes: m, ingresos, egresos };
    });

    return respond(200, {
      stock: {
        costoStock,
        valorVentaStock,
        gananciaPotencial,
        totalProductos:   productosActivos.length,
        sinStock:         sinStock.map(r => ({ id: r[0], nombre: r[1] })),
        stockBajo:        stockBajo.map(r => ({ id: r[0], nombre: r[1], cantidad: Number(r[3]) })),
      },
      ventas: {
        hoy:  { total: totalVentasHoy,  cantidad: cantidadVentasHoy },
        mes:  { total: totalVentasMes,  cantidad: cantidadVentasMes },
      },
      caja: {
        saldo:       saldoTotal,
        ingresosMes,
        egresosMes,
      },
      graficos: {
        ventasPorDia,
        topProductos,
        ventasPorRubro: graficoRubros,
        ingresosVsEgresos,
      },
    });

  } catch (err) {
    console.error('Error en reportes:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
