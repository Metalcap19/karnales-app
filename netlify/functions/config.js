// Gestión de configuración, usuarios y rubros
//
// GET  /api/config                        → lee toda la configuración
// POST /api/config                        → actualiza clave de configuración
// GET  /api/config?seccion=usuarios       → lista usuarios
// POST /api/config?seccion=usuarios       → crea usuario
// PUT  /api/config?seccion=usuarios       → edita usuario
// DELETE /api/config?seccion=usuarios&usuario=admin → desactiva usuario
// GET  /api/config?seccion=rubros         → lista rubros
// POST /api/config?seccion=rubros         → crea rubro
// PUT  /api/config?seccion=rubros         → edita rubro
// DELETE /api/config?seccion=rubros&id=RUB-001 → desactiva rubro
// POST /api/config?seccion=cambiar-password    → cambia contraseña propia
//
// Columnas Usuarios (0-4): Usuario | Contrasena_Hash | Nombre | Rol | Activo
// Columnas Rubros   (0-2): ID | Nombre | Activo
// Columnas Config   (0-1): Clave | Valor

const crypto = require('crypto');
const {
  readSheet, readSheetRaw, appendRow, updateRow, findRowIndex,
  nextId, today, respond, handleOptions,
} = require('./_sheets');
const { verifyToken, verifyAdmin } = require('./_auth');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const params  = event.queryStringParameters || {};
  const seccion = params.seccion || '';
  const method  = event.httpMethod;

  // cambiar-password solo requiere token válido (cualquier rol)
  // todo lo demás requiere admin
  let auth;
  if (seccion === 'cambiar-password') {
    auth = verifyToken(event);
  } else {
    auth = verifyAdmin(event);
  }
  if (auth.error) return respond(auth.status, { error: auth.error });

  try {

    // ══════════════════════════════════════════════════════════════════════════
    // CONFIGURACIÓN GENERAL
    // ══════════════════════════════════════════════════════════════════════════
    if (!seccion) {

      if (method === 'GET') {
        const rows = await readSheet('Config!A:B');
        const config = {};
        rows.forEach(r => { if (r[0]) config[r[0]] = r[1] || ''; });
        return respond(200, { config });
      }

      if (method === 'POST') {
        const data = JSON.parse(event.body || '{}');
        const { clave, valor } = data;
        if (!clave) return respond(400, { error: 'Clave requerida' });

        const raw = await readSheetRaw('Config!A:B');
        let rowIndex = -1;
        for (let i = 1; i < raw.length; i++) {
          if (raw[i][0] === clave) { rowIndex = i + 1; break; }
        }

        if (rowIndex === -1) {
          await appendRow('Config', [clave, valor || '']);
        } else {
          await updateRow('Config', rowIndex, [clave, valor || '']);
        }
        return respond(200, { mensaje: 'Configuración actualizada' });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // USUARIOS
    // ══════════════════════════════════════════════════════════════════════════
    if (seccion === 'usuarios') {

      if (method === 'GET') {
        const rows = await readSheet('Usuarios!A:E');
        const usuarios = rows
          .filter(r => r[0])
          .map(r => ({
            usuario: r[0],
            nombre:  r[2] || '',
            rol:     r[3] || 'vendedor',
            activo:  r[1] === 'TRUE' || r[4] === 'TRUE',
            // nunca devolver el hash
          }))
          // Corregir: Activo está en columna 4
          .map(u => u);

        // Re-mapear correctamente
        const usuariosCorrectos = rows
          .filter(r => r[0])
          .map(r => ({
            usuario: r[0],
            nombre:  r[2] || '',
            rol:     r[3] || 'vendedor',
            activo:  r[4] === 'TRUE',
          }));

        return respond(200, { usuarios: usuariosCorrectos });
      }

      if (method === 'POST') {
        const data = JSON.parse(event.body || '{}');
        const { usuario, contrasena, nombre, rol } = data;

        if (!usuario || !contrasena || !nombre) {
          return respond(400, { error: 'Usuario, contraseña y nombre son requeridos' });
        }
        if (!['admin', 'vendedor'].includes(rol)) {
          return respond(400, { error: 'Rol debe ser admin o vendedor' });
        }

        // Verificar que no exista
        const rows = await readSheet('Usuarios!A:A');
        const existe = rows.find(r => r[0] && r[0].toLowerCase() === usuario.toLowerCase());
        if (existe) return respond(409, { error: 'El usuario ya existe' });

        await appendRow('Usuarios', [
          usuario.toLowerCase().trim(),
          sha256(contrasena),
          nombre.trim(),
          rol,
          'TRUE',
        ]);
        return respond(201, { mensaje: 'Usuario creado correctamente' });
      }

      if (method === 'PUT') {
        const data = JSON.parse(event.body || '{}');
        const { usuario, nombre, rol, activo } = data;
        if (!usuario) return respond(400, { error: 'Usuario requerido' });

        const rowIndex = await findRowIndex('Usuarios', usuario.toLowerCase());
        if (rowIndex === -1) return respond(404, { error: 'Usuario no encontrado' });

        const rows = await readSheet('Usuarios!A:E');
        const current = rows.find(r => r[0] === usuario.toLowerCase());
        if (!current) return respond(404, { error: 'Usuario no encontrado' });

        await updateRow('Usuarios', rowIndex, [
          current[0],
          current[1], // hash no cambia por este endpoint
          nombre  !== undefined ? nombre.trim() : current[2],
          rol     !== undefined ? rol           : current[3],
          activo  !== undefined ? (activo ? 'TRUE' : 'FALSE') : current[4],
        ]);
        return respond(200, { mensaje: 'Usuario actualizado' });
      }

      if (method === 'DELETE') {
        const usuarioParam = params.usuario;
        if (!usuarioParam) return respond(400, { error: 'Usuario requerido' });

        // No permitir desactivar al propio usuario
        if (usuarioParam.toLowerCase() === auth.payload.usuario.toLowerCase()) {
          return respond(400, { error: 'No podés desactivar tu propio usuario' });
        }

        const rowIndex = await findRowIndex('Usuarios', usuarioParam.toLowerCase());
        if (rowIndex === -1) return respond(404, { error: 'Usuario no encontrado' });

        const rows = await readSheet('Usuarios!A:E');
        const current = rows.find(r => r[0] === usuarioParam.toLowerCase());
        if (!current) return respond(404, { error: 'Usuario no encontrado' });

        await updateRow('Usuarios', rowIndex, [
          current[0], current[1], current[2], current[3], 'FALSE',
        ]);
        return respond(200, { mensaje: 'Usuario desactivado' });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RUBROS
    // ══════════════════════════════════════════════════════════════════════════
    if (seccion === 'rubros') {

      if (method === 'GET') {
        const rows = await readSheet('Rubros!A:C');
        const rubros = rows
          .filter(r => r[0])
          .map(r => ({ id: r[0], nombre: r[1] || '', activo: r[2] === 'TRUE' }));
        return respond(200, { rubros });
      }

      if (method === 'POST') {
        const data = JSON.parse(event.body || '{}');
        const { nombre } = data;
        if (!nombre) return respond(400, { error: 'Nombre requerido' });

        const id = await nextId('Rubros', 'RUB');
        await appendRow('Rubros', [id, nombre.trim(), 'TRUE']);
        return respond(201, { mensaje: 'Rubro creado', id });
      }

      if (method === 'PUT') {
        const data = JSON.parse(event.body || '{}');
        const { id, nombre, activo } = data;
        if (!id) return respond(400, { error: 'ID requerido' });

        const rowIndex = await findRowIndex('Rubros', id);
        if (rowIndex === -1) return respond(404, { error: 'Rubro no encontrado' });

        const rows = await readSheet('Rubros!A:C');
        const current = rows.find(r => r[0] === id);
        if (!current) return respond(404, { error: 'Rubro no encontrado' });

        await updateRow('Rubros', rowIndex, [
          current[0],
          nombre !== undefined ? nombre.trim() : current[1],
          activo !== undefined ? (activo ? 'TRUE' : 'FALSE') : current[2],
        ]);
        return respond(200, { mensaje: 'Rubro actualizado' });
      }

      if (method === 'DELETE') {
        const id = params.id;
        if (!id) return respond(400, { error: 'ID requerido' });

        const rowIndex = await findRowIndex('Rubros', id);
        if (rowIndex === -1) return respond(404, { error: 'Rubro no encontrado' });

        const rows = await readSheet('Rubros!A:C');
        const current = rows.find(r => r[0] === id);
        if (!current) return respond(404, { error: 'Rubro no encontrado' });

        await updateRow('Rubros', rowIndex, [current[0], current[1], 'FALSE']);
        return respond(200, { mensaje: 'Rubro desactivado' });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CAMBIAR CONTRASEÑA PROPIA
    // ══════════════════════════════════════════════════════════════════════════
    if (seccion === 'cambiar-password' && method === 'POST') {
      const data = JSON.parse(event.body || '{}');
      const { contrasenaActual, contrasenaNueva } = data;

      if (!contrasenaActual || !contrasenaNueva) {
        return respond(400, { error: 'Contraseña actual y nueva son requeridas' });
      }
      if (contrasenaNueva.length < 6) {
        return respond(400, { error: 'La contraseña nueva debe tener al menos 6 caracteres' });
      }

      const rows = await readSheet('Usuarios!A:E');
      const userRow = rows.find(r => r[0] === auth.payload.usuario);
      if (!userRow) return respond(404, { error: 'Usuario no encontrado' });

      if (sha256(contrasenaActual) !== userRow[1]) {
        return respond(401, { error: 'Contraseña actual incorrecta' });
      }

      const rowIndex = await findRowIndex('Usuarios', auth.payload.usuario);
      await updateRow('Usuarios', rowIndex, [
        userRow[0], sha256(contrasenaNueva), userRow[2], userRow[3], userRow[4],
      ]);
      return respond(200, { mensaje: 'Contraseña actualizada correctamente' });
    }

    return respond(405, { error: 'Método o sección no válida' });

  } catch (err) {
    console.error('Error en config:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
