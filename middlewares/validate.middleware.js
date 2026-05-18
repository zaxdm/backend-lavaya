/**
 * validate.middleware.js
 * 
 * Middleware que verifica si express-validator encontró errores en el request.
 * Envía una respuesta estandarizada si hay fallos.
 */
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Retornamos 400 con el formato acordado (y la estructura legacy para compatibilidad temporal)
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errorCode: 'VALIDATION_ERROR',
      details: errors.array(),
      
      // Legacy format
      ok: false,
      mensaje: 'Errores de validación',
      errores: errors.array()
    });
  }
  next();
};

module.exports = validate;
