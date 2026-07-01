// Helper de verificación JWT
// Cada function (excepto login) llama a verifyToken antes de operar

const jwt = require('jsonwebtoken');

// Verifica el token del header Authorization: Bearer <token>
// Devuelve { payload } si es válido, o { error, status } si no
function verifyToken(event) {
  const authHeader =
    event.headers['authorization'] || event.headers['Authorization'] || '';

  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Token no proporcionado', status: 401 };
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return { payload };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { error: 'Sesión expirada. Iniciá sesión nuevamente.', status: 401 };
    }
    return { error: 'Token inválido', status: 401 };
  }
}

// Verifica token y además exige que el usuario sea admin
function verifyAdmin(event) {
  const result = verifyToken(event);
  if (result.error) return result;
  if (result.payload.rol !== 'admin') {
    return { error: 'Acceso denegado. Se requiere rol administrador.', status: 403 };
  }
  return result;
}

module.exports = { verifyToken, verifyAdmin };
