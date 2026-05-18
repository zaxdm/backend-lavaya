/**
 * error.middleware.js
 * 
 * Middleware global para capturar y formatear errores.
 * Asegura que todas las respuestas de error tengan un formato consistente:
 * { success: false, message: '...', errorCode: '...', details: ... }
 */
const AppError = require('../utils/AppError');

const errorMiddleware = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Loguear error (idealmente usar Winston o similar aquí en el futuro)
  console.error('❌ Error capturado:', err);

  // Mapear errores conocidos de Sequelize o JWT a nuestro AppError si es necesario
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const message = err.errors.map(e => e.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR', err.errors);
  }

  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Token inválido', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expirado', 401, 'EXPIRED_TOKEN');
  }

  // Respuesta por defecto si no es un AppError conocido
  const statusCode = error.statusCode || 500;
  const errorCode = error.errorCode || 'INTERNAL_SERVER_ERROR';
  const message = error.isOperational ? error.message : 'Error interno del servidor';
  
  // Para la compatibilidad con el frontend actual (que usa 'ok: false' y 'mensaje'),
  // enviamos ambos formatos temporales hasta que todo el frontend se migre.
  // El usuario pidió: { success: false, message, errorCode, details }
  
  res.status(statusCode).json({
    // Nuevo formato Enterprise
    success: false,
    message: message,
    errorCode: errorCode,
    details: error.details || null,
    
    // Legacy para no romper el frontend actual
    ok: false,
    mensaje: message
  });
};

module.exports = errorMiddleware;
