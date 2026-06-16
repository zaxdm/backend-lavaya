// src/middlewares/validators/pedido.validators.js
const { body, param } = require('express-validator');

const ESTADOS_VALIDOS = [
  'PENDIENTE', 'CONFIRMADO', 'RECOLECTADO',
  'EN_PROCESO', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO',
];

// Mínimo de horas de anticipación para programar un recojo
const MIN_HORAS_ANTICIPACION = 1;

const TRANSICIONES = {
  PENDIENTE:   ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO:  ['RECOLECTADO', 'CANCELADO'],
  RECOLECTADO: ['EN_PROCESO'],
  EN_PROCESO:  ['LISTO'],
  LISTO:       ['EN_CAMINO'],
  EN_CAMINO:   ['ENTREGADO'],
  ENTREGADO:   [],
  CANCELADO:   [],
};

const crearPedidoRules = [
  body('direccionId')
    .notEmpty().withMessage('La dirección es obligatoria'),

  body('prendas')
    .isArray({ min: 1 }).withMessage('Debe incluir al menos una prenda'),

  body('prendas.*.tipo')
    .notEmpty().withMessage('Cada prenda debe tener un tipo'),

  body('prendas.*.cantidad')
    .isInt({ min: 1 }).withMessage('La cantidad debe ser un número entero mayor a 0'),

  body('metodoPago')
    .optional()
    .isIn(['PAYPAL', 'EFECTIVO']).withMessage('Método de pago debe ser PAYPAL o EFECTIVO'),

  body('fechaRecoleccion')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Formato de fecha inválido')
    .custom((value) => {
      if (!value) return true; // es opcional
      const fecha = new Date(value);
      if (isNaN(fecha.getTime())) {
        throw new Error('La fecha de recolección no es válida');
      }
      const ahora = new Date();
      const minFutura = new Date(ahora.getTime() + MIN_HORAS_ANTICIPACION * 60 * 60 * 1000);
      if (fecha < minFutura) {
        throw new Error(
          `La fecha de recolección debe ser al menos ${MIN_HORAS_ANTICIPACION} hora(s) en el futuro`
        );
      }
      // No más de 30 días en el futuro
      const maxFutura = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (fecha > maxFutura) {
        throw new Error('La fecha de recolección no puede ser más de 30 días en el futuro');
      }
      return true;
    }),

  body('notasCliente')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 }).withMessage('Las notas no pueden superar 500 caracteres'),
];

const cambiarEstadoRules = [
  param('id').notEmpty().withMessage('ID de pedido requerido'),
  body('estado')
    .isIn(ESTADOS_VALIDOS).withMessage(`Estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`),
];

module.exports = { crearPedidoRules, cambiarEstadoRules, TRANSICIONES };
