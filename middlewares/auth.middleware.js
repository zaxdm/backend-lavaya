const jwt = require('jsonwebtoken');
const { Usuario, Rol } = require('../models');

/**
 * Verifica el JWT en el header Authorization: Bearer <token>
 * Adjunta req.usuario con los datos del JWT para evitar queries a DB (Stateless)
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, ok: false, mensaje: 'Token no proporcionado', errorCode: 'MISSING_TOKEN' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adjuntamos directamente el payload del JWT
    // Esto da escalabilidad real evitando una query por cada request
    req.usuario = {
      id: decoded.id,
      rol: { nombre: decoded.rol },
      sucursal_id: decoded.sucursal_id
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, ok: false, mensaje: 'Token expirado', errorCode: 'EXPIRED_TOKEN' });
    }
    return res.status(401).json({ success: false, ok: false, mensaje: 'Token inválido', errorCode: 'INVALID_TOKEN' });
  }
};

/**
 * Restricción por roles.
 * Uso: roleGuard('admin_superior', 'encargado_sucursal')
 */
const roleGuard = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ ok: false, mensaje: 'No autenticado' });
    }
    const rolUsuario = req.usuario.rol?.nombre;
    if (!rolesPermitidos.includes(rolUsuario)) {
      return res.status(403).json({
        ok: false,
        mensaje: `Acceso denegado. Se requiere uno de: ${rolesPermitidos.join(', ')}`,
      });
    }
    next();
  };
};

/**
 * Verifica que el encargado solo acceda a su propia sucursal.
 * El admin_superior puede acceder a todo.
 * Usar después de verifyToken.
 * Requiere req.params.sucursalId o req.body.sucursal_id.
 */
const sucursalGuard = (req, res, next) => {
  const { usuario } = req;
  if (usuario.rol.nombre === 'admin_superior') return next();

  const sucursalId = parseInt(req.params.sucursalId || req.body.sucursal_id);
  if (!sucursalId || usuario.sucursal_id !== sucursalId) {
    return res.status(403).json({ ok: false, mensaje: 'No tienes acceso a esta sucursal' });
  }
  next();
};

module.exports = { verifyToken, roleGuard, sucursalGuard };
