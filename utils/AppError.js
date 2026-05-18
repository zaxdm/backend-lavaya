/**
 * AppError.js
 * 
 * Clase personalizada para el manejo estandarizado de errores operacionales.
 * Permite definir el status HTTP y un código de error específico.
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Marca el error como operacional (esperado) y no como un bug de programación

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
