// src/middlewares/auth.middleware.js
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Verifica el token JWT en el header Authorization
 */
const authenticate = (req, res, next) => {
  console.log('Authenticate middleware called for path:', req.path);
  const authHeader = req.headers['authorization'];
  console.log('Auth header present:', !!authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No valid auth header');
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    console.log('Decoded token payload:', payload);
    req.user = payload; // { id, email, rol }
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

/**
 * Autoriza solo los roles indicados
 * Uso: authorize('ADMIN', 'EMPLEADO')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('Authorize middleware, allowed roles:', roles, 'user role:', req.user?.rol);
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
