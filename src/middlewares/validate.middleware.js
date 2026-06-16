// src/middlewares/validate.middleware.js
// Middleware genérico que ejecuta reglas de express-validator y retorna errores formateados
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Datos de entrada inválidos',
      detalle: errors.array().map(e => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  next();
};

module.exports = validate;
