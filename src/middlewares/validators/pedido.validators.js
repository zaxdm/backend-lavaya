// src/middlewares/validators/pedido.validators.js
const { body, param } = require('express-validator');

const ESTADOS_VALIDOS = [
  'PENDIENTE', 'CONFIRMADO', 'RECOLECTADO',
  'EN_PROCESO', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO',
  'RETRASADO', 'REPROGRAMADO',
];

// Franjas horarias válidas (deben coincidir con las del cliente Flutter/Next.js)
const FRANJAS_VALIDAS = [
  '08:00-10:00',
  '10:00-12:00',
  '12:00-14:00',
  '14:00-16:00',
  '16:00-18:00',
  '18:00-20:00',
];

// Mínimo de horas de anticipación: 0 (el cliente puede pedir desde la hora actual)
const MIN_HORAS_ANTICIPACION = 0;

// Flujo visible: Por recoger → En lavandería → En camino → Entregado
// RETRASADO:    se asigna automáticamente por el cron si la franja venció sin recolección
// REPROGRAMADO: el cliente reprogramó la fecha/franja de un pedido existente
const TRANSICIONES = {
  PENDIENTE:    ['CONFIRMADO', 'CANCELADO', 'REPROGRAMADO'],
  CONFIRMADO:   ['RECOLECTADO', 'CANCELADO', 'REPROGRAMADO'],
  RETRASADO:    ['CONFIRMADO', 'CANCELADO', 'REPROGRAMADO'], // admin/empleado puede reactivar
  REPROGRAMADO: ['CONFIRMADO', 'CANCELADO'],
  RECOLECTADO:  ['EN_PROCESO', 'EN_CAMINO'],
  EN_PROCESO:   ['LISTO', 'EN_CAMINO'],
  LISTO:        ['EN_CAMINO'],
  EN_CAMINO:    ['ENTREGADO', 'CANCELADO'],
  ENTREGADO:    [],
  CANCELADO:    [],
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
      if (!value) return true;
      const fecha = new Date(value);
      if (isNaN(fecha.getTime())) throw new Error('La fecha de recolección no es válida');
      // Solo validar que no sea más de 30 días en el futuro
      const maxFutura = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (fecha > maxFutura) {
        throw new Error('La fecha de recolección no puede ser más de 30 días en el futuro');
      }
      return true;
    }),

  body('franjaRecoleccion')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(FRANJAS_VALIDAS)
    .withMessage(`Franja inválida. Opciones: ${FRANJAS_VALIDAS.join(', ')}`),

  body('notasCliente')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 500 }).withMessage('Las notas no pueden superar 500 caracteres'),
];

const cambiarEstadoRules = [
  param('id').notEmpty().withMessage('ID de pedido requerido'),
  body('estado')
    .isIn(ESTADOS_VALIDOS).withMessage(`Estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`),
];

const reprogramarPedidoRules = [
  param('id').notEmpty().withMessage('ID de pedido requerido'),
  body('fechaRecoleccion')
    .notEmpty().withMessage('La nueva fecha de recolección es obligatoria')
    .isISO8601().withMessage('Formato de fecha inválido')
    .custom((value) => {
      const fecha = new Date(value);
      if (isNaN(fecha.getTime())) throw new Error('Fecha inválida');
      const maxFutura = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      if (fecha > maxFutura) throw new Error('No puede ser más de 30 días en el futuro');
      return true;
    }),
  body('franjaRecoleccion')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(FRANJAS_VALIDAS)
    .withMessage(`Franja inválida. Opciones: ${FRANJAS_VALIDAS.join(', ')}`),
];

module.exports = {
  crearPedidoRules, cambiarEstadoRules, reprogramarPedidoRules,
  TRANSICIONES, FRANJAS_VALIDAS,
};

