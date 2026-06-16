// src/middlewares/validators/repartidor.validators.js
const { body, param } = require('express-validator');

const ubicacionRules = [
  body('latitud').isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('longitud').isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
];

const fotoEntregaRules = [
  param('id').notEmpty().withMessage('ID de pedido requerido'),
  body('fotoUrl').notEmpty().withMessage('La URL de la foto es obligatoria'),
];

module.exports = { ubicacionRules, fotoEntregaRules };
