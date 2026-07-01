// POST /api/login
// Body: { usuario, contrasena }
// Responde: { token, usuario, nombre, rol } o error 401

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { readSheet, respond, handleOptions } = require('./_sheets');

// Columnas hoja Usuarios (0-indexed)
// 0: Usuario | 1: Contrasena_Hash | 2: Nombre | 3: Rol | 4: Activo

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Método no permitido' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Body inválido' });
  }

  const { usuario, contrasena } = body;

  if (!usuario || !contrasena) {
    return respond(400, { error: 'Usuario y contraseña son requeridos' });
  }

  let rows;
  try {
    rows = await readSheet('Usuarios!A:E');
  } catch (err) {
    console.error('Error leyendo Usuarios:', err);
    return respond(500, { error: 'Error conectando con la base de datos' });
  }

  // Buscar usuario activo
  const userRow = rows.find(
    r => r[0] && r[0].toLowerCase() === usuario.toLowerCase() && r[4] === 'TRUE'
  );

  if (!userRow) {
    return respond(401, { error: 'Usuario o contraseña incorrectos' });
  }

  const hashIngresado = sha256(contrasena);
  const hashGuardado = userRow[1] || '';

  if (hashIngresado !== hashGuardado) {
    return respond(401, { error: 'Usuario o contraseña incorrectos' });
  }

  // Generar JWT con expiración de 8 horas
  const payload = {
    usuario: userRow[0],
    nombre: userRow[2] || userRow[0],
    rol: userRow[3] || 'vendedor',
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

  return respond(200, {
    token,
    usuario: payload.usuario,
    nombre: payload.nombre,
    rol: payload.rol,
  });
};
