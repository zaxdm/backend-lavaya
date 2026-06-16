// src/middlewares/validators/pago.validators.js
const { body } = require('express-validator');

const crearOrdenPaypalRules = [
  body('pedidoId').notEmpty().withMessage('El pedidoId es obligatorio'),
];

const capturarPaypalRules = [
  body('pedidoId').notEmpty().withMessage('El pedidoId es obligatorio'),
  body('paypalOrderId').notEmpty().withMessage('El paypalOrderId es obligatorio'),
  body('paypalCaptureId').notEmpty().withMessage('El paypalCaptureId es obligatorio'),
];

const registrarEfectivoRules = [
  body('pedidoId').notEmpty().withMessage('El pedidoId es obligatorio'),
];

const confirmarEfectivoRules = [
  body('pedidoId').notEmpty().withMessage('El pedidoId es obligatorio'),
];

module.exports = {
  crearOrdenPaypalRules,
  capturarPaypalRules,
  registrarEfectivoRules,
  confirmarEfectivoRules,
};
