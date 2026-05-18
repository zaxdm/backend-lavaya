/**
 * asyncHandler.js
 * 
 * Wrapper para controladores asíncronos.
 * Captura errores (promesas rechazadas) y los envía al middleware global de errores,
 * eliminando la necesidad de usar bloques try/catch repetitivos en los controladores.
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
