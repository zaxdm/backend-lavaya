// src/middlewares/auth.middleware.js
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Verifica el token JWT en el header Authorization
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload; // { id, email, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

/**
 * Autoriza solo los roles indicados
 * Uso: authorize('ADMIN', 'EMPLEADO')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
