# Karnales App — Especificación de Diseño
**Fecha:** 2026-06-30  
**Versión:** 1.0  
**Estado:** Aprobado

---

## 1. Descripción del Proyecto

Sistema de gestión comercial completo para **Karnales — Tienda Online** (zapatillas y botines, Cerrito 641). Aplicación web SPA (Single Page Application) profesional, diseñada para uso diario en un negocio real, publicada en Netlify, con Google Sheets como base de datos y Netlify Functions como backend.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6 puro (sin frameworks) |
| Backend | Netlify Functions (Node.js) |
| Base de datos | Google Sheets (API v4 oficial) |
| Autenticación Google | Service Account (JSON como variable de entorno) |
| Autenticación usuarios | JWT firmado con secret key (variable de entorno Netlify) |
| Gráficos | Chart.js via CDN |
| Exportar Excel | SheetJS (xlsx) via CDN |
| Deploy | Netlify (free tier) |

---

## 3. Arquitectura

```
BROWSER (HTML + CSS + JS puro)
        │
        │  fetch() con Authorization: Bearer <JWT>
        ▼
NETLIFY FUNCTIONS (Node.js)
  ├── /login
  ├── /productos
  ├── /ventas
  ├── /caja
  ├── /movimientos
  ├── /reportes
  ├── /config
  └── /exportar
        │
        │  googleapis + google-auth-library
        ▼
GOOGLE SHEETS API v4
        │
        ▼
GOOGLE SHEETS (ID: 1_SgExGaeSbYnNAAuHEvLoCW4SX6yS5dlITTq-nKK-0k)
```

**Regla fundamental:** El frontend NUNCA habla con Google Sheets directamente. Solo `api.js` hace fetch a las Functions. Solo las Functions leen/escriben en Google Sheets.

---

## 4. Estructura de Archivos

```
karnales-app/
│
├── index.html
├── netlify.toml
├── package.json
│
├── assets/
│   └── Fondo pag inicial.png
│
├── css/
│   ├── variables.css
│   ├── base.css
│   ├── components.css
│   └── screens.css
│
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── api.js
│   ├── ui.js
│   ├── utils.js
│   └── screens/
│       ├── stock.js
│       ├── ventas.js
│       ├── caja.js
│       ├── movimientos.js
│       ├── reportes.js
│       ├── exportar.js
│       └── configuracion.js
│
└── netlify/
    └── functions/
        ├── _sheets.js       # Helper: conexión Google Sheets
        ├── _auth.js         # Helper: verificación JWT
        ├── login.js
        ├── productos.js
        ├── ventas.js
        ├── caja.js
        ├── movimientos.js
        ├── reportes.js
        ├── config.js
        └── exportar.js
```

---

## 5. Modelo de Datos (Google Sheets)

### Hoja: Productos
`ID | Nombre | Rubro | Cantidad | PrecioCompra | PrecioVenta | Activo | FechaAlta | FechaModificacion`

- ID: `PROD-001`, `PROD-002`... (auto-generado por Function)
- Activo: `TRUE` / `FALSE`
- Fechas: ISO 8601

### Hoja: Ventas
`Fecha | IDVenta | ProductoID | Producto | Cantidad | PrecioUnitario | Descuento% | PrecioFinal | Cliente | FormaPago | Usuario | Observaciones`

- IDVenta: `VTA-YYYYMMDD-NNN`
- PrecioFinal = (PrecioUnitario × Cantidad) × (1 - Descuento/100)
- PrecioUnitario: ingresado manualmente (no se autocompleta)
- FormaPago: Efectivo / Transferencia / Tarjeta / Otro

### Hoja: Caja
`Fecha | Tipo | Concepto | Monto | Usuario | Observaciones | IDReferencia`

- Monto positivo = ingreso, negativo = egreso
- Saldo = SUM(Monto), calculado en tiempo real
- IDReferencia: IDVenta si viene de una venta
- Conceptos: Venta / Retiro de ganancias / Pago de sueldo / Compra de mercadería / Otro

### Hoja: Usuarios
`Usuario | Contrasena_Hash | Nombre | Rol | Activo`

- Contraseña: hash SHA-256, nunca texto plano
- Rol: `admin` / `vendedor`

### Hoja: Rubros
`ID | Nombre | Activo`

- ID: `RUB-001`, `RUB-002`...

### Hoja: Config
`Clave | Valor`

Claves: `negocio_nombre`, `negocio_subtitulo`, `negocio_direccion`, `negocio_telefono`, `negocio_logo`, `color_acento`, `moneda_simbolo`, `stock_minimo_alerta`, `version`

---

## 6. Autenticación y Seguridad

### Login
1. Usuario envía `usuario` + `contraseña` a `POST /login`
2. Function hashea la contraseña con SHA-256
3. Compara contra `Contrasena_Hash` en hoja Usuarios
4. Si coincide: genera JWT firmado con `JWT_SECRET` (variable de entorno)
5. JWT payload: `{ usuario, nombre, rol, exp: now + 8h }`
6. Frontend guarda JWT en `sessionStorage`
7. Opción "Recordar usuario": guarda solo el nombre de usuario en `localStorage` (no el token)

### Verificación en cada request
Cada Function (excepto `/login`) llama a `_auth.js` que:
1. Lee el header `Authorization: Bearer <token>`
2. Verifica firma y expiración
3. Retorna el payload o 401

### Permisos por Rol
| Función | admin | vendedor |
|---|---|---|
| Stock — ver | ✅ | ✅ |
| Stock — agregar/editar/eliminar | ✅ | ❌ |
| Ventas — registrar | ✅ | ✅ |
| Caja — ver y registrar | ✅ | ❌ |
| Movimientos | ✅ | ❌ |
| Reportes | ✅ | ❌ |
| Exportar | ✅ | ❌ |
| Configuración | ✅ | ❌ |

---

## 7. Pantallas y Funcionalidades

### Portada
- Fondo permanente (`Fondo pag inicial.png`) con overlay negro semitransparente
- Logo Karnales centrado
- Botón grande "Ingresar" → navega a Login
- Footer: "Creado por SmartCAP"

### Login
- Campos: Usuario + Contraseña
- Checkbox "Recordar usuario"
- Validación contra hoja Usuarios via Function
- Manejo de errores con mensajes claros
- Al autenticar: guarda JWT, navega a Menú Principal

### Menú Principal
- 7 botones grandes en grilla
- Stock / Ventas / Caja / Movimientos / Reportes / Exportar / Configuración
- Botón "Cerrar Sesión" en esquina
- Muestra nombre del usuario logueado
- Configuración oculto si rol = vendedor

### Stock
- Tabla con columnas: Producto, Rubro, Cantidad, Precio Compra, Precio Venta, Valor en Stock, Acciones
- Buscador instantáneo (filtra mientras escribe)
- Filtros: por Rubro, por Activo/Todos
- Ordenar por cualquier columna
- Botón "Agregar Producto" → modal
- Acciones por fila: Editar (modal), Desactivar/Activar, Eliminar (con confirmación)
- Modal Agregar/Editar: Nombre, Rubro (dropdown desde hoja Rubros), Cantidad, Precio Compra, Precio Venta, Activo
- Alerta visual para productos con stock bajo (config: `stock_minimo_alerta`)
- Alerta visual para productos sin stock (Cantidad = 0)

### Ventas
- Sección superior: formulario nueva venta
  - Producto: dropdown (busca por nombre, muestra stock disponible)
  - Cantidad
  - Precio Unitario (campo manual, NO se autocompleta)
  - Descuento %
  - Precio Final (calculado en tiempo real, solo lectura)
  - Cliente (opcional)
  - Forma de Pago: dropdown (Efectivo / Transferencia / Tarjeta / Otro)
  - Observaciones (opcional)
  - Botón Confirmar Venta (con confirmación)
- Al confirmar: descuenta stock, registra en Ventas, registra ingreso en Caja
- Sección inferior: historial de ventas del día actual
- Indicador de carga durante operación

### Caja
- Card destacada: Saldo Actual (suma en tiempo real)
- Cards resumen: Total Ingresos / Total Egresos (del día y del mes)
- Formulario nuevo movimiento:
  - Tipo: Ingreso / Egreso
  - Concepto: dropdown (Venta / Retiro de ganancias / Pago de sueldo / Compra de mercadería / Otro)
  - Monto
  - Observaciones
  - Botón Registrar
- Tabla de movimientos recientes

### Movimientos
- Tabla cronológica descendente
- Columnas: Fecha, Tipo, Concepto, Monto, Usuario, Observaciones
- Filtros: rango de fechas, usuario, tipo (Ingreso/Egreso), búsqueda por texto
- Paginación (50 registros por página)

### Reportes
**KPIs de Stock:**
- Costo total del stock (SUM de PrecioCompra × Cantidad)
- Valor de venta del stock (SUM de PrecioVenta × Cantidad)
- Ganancia potencial (diferencia)
- Productos sin stock
- Productos con stock bajo

**KPIs de Ventas:**
- Ventas del día (cantidad y monto)
- Ventas del mes (cantidad y monto)

**KPIs de Caja:**
- Saldo actual
- Ingresos del mes
- Egresos del mes

**Gráficos (Chart.js):**
- Ventas por día (últimos 30 días) — línea
- Productos más vendidos (top 10) — barras horizontales
- Ventas por rubro — dona
- Ingresos vs Egresos por mes — barras agrupadas

### Exportar
- Grilla de opciones: Stock / Caja / Ventas / Movimientos / Reportes
- Formatos: Excel (.xlsx via SheetJS), CSV, PDF (via print CSS)
- Cada combinación genera y descarga el archivo directamente en el browser

### Configuración (solo admin)
**Usuarios:**
- Tabla de usuarios activos
- Agregar usuario (modal): usuario, nombre, contraseña, rol
- Editar usuario
- Cambiar contraseña propia
- Desactivar usuario

**Rubros:**
- Tabla de rubros
- Agregar / Editar / Desactivar rubro

**Apariencia:**
- Nombre del negocio
- Subtítulo
- Color de acento (color picker)
- Logo (URL de imagen)

---

## 8. Paleta de Colores

| Variable CSS | Valor | Uso |
|---|---|---|
| `--bg-deep` | `#080808` | Fondo base |
| `--bg-surface` | `#141414` | Cards, modales |
| `--bg-elevated` | `#1E1E1E` | Tablas, inputs |
| `--gold` | `#C9A84C` | Acento principal |
| `--gold-light` | `#E8C97A` | Hover dorado |
| `--brown` | `#6B4A2A` | Acento secundario |
| `--silver` | `#9CA3AF` | Texto secundario |
| `--text-primary` | `#F0EDE8` | Texto principal |
| `--text-muted` | `#6B7280` | Texto deshabilitado |
| `--success` | `#4ADE80` | Ingresos, positivo |
| `--danger` | `#F87171` | Egresos, errores |
| `--border` | `#2A2A2A` | Bordes de cards |

---

## 9. Variables de Entorno Netlify

```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SPREADSHEET_ID=1_SgExGaeSbYnNAAuHEvLoCW4SX6yS5dlITTq-nKK-0k
JWT_SECRET=<string aleatorio seguro>
```

---

## 10. Escalabilidad Futura

La arquitectura está preparada para agregar sin reescribir:
- **Código de barras:** agregar campo `CodigoBarras` en Productos, nueva Function `GET /productos?barcode=xxx`
- **Tickets:** nueva Function `exportar.js` con endpoint de ticket, CSS de impresión
- **Proveedores / Clientes / Cuentas Corrientes:** nuevas hojas en el mismo Sheets, nuevas Functions, nuevas pantallas SPA
- **Compras / Pedidos:** ídem
- **Múltiples sucursales:** agregar campo `Sucursal` en todas las hojas, filtro por sucursal en Functions
- **App móvil:** las Functions son una API REST estándar, cualquier cliente puede consumirlas
- **Sincronización en tiempo real:** agregar polling o WebSockets en `api.js` sin cambiar las Functions

---

## 11. Decisiones de Diseño

| Decisión | Razón |
|---|---|
| Vanilla JS sin frameworks | Sin build step, sin dependencias que romper, desplegable en segundos |
| sessionStorage para JWT | Más seguro que localStorage (no persiste entre pestañas/sesiones) |
| SHA-256 en Functions | La contraseña nunca viaja hasheada desde el cliente |
| Chart.js + SheetJS via CDN | Sin npm install en frontend, sin bundler |
| Una sola planilla Google Sheets | Simplicidad de mantenimiento y permisos |
| Service Account | No requiere intervención humana, funciona 24/7 sin expiración de tokens |
| PrecioUnitario manual en ventas | El negocio maneja distintos precios según forma de pago |
