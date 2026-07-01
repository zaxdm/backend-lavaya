// src/middlewares/validators/pedido.validators.js
const { body, param } = require('express-validator');

const ESTADOS_VALIDOS = [
  'PENDIENTE', 'CONFIRMADO', 'RECOLECTADO',
  'EN_PROCESO', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO',
  'RETRASADO', 'REPROGRAMADO',
];

// Franja horaria libre: cualquier valor "HH:MM-HH:MM" es válido.
// El cliente elige hora de inicio y hora de fin libremente.
const FRANJA_REGEX = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

/**
 * Valida que una franja tenga el formato HH:MM-HH:MM y que las horas sean válidas.
 * Permite franjas que cruzan la medianoche (p.ej. 22:00-03:00).
 */
function esFranjaValida(franja) {
  if (!franja || !FRANJA_REGEX.test(franja)) return false;
  const [ini, fin] = franja.split('-');
  const [hIni, mIni] = ini.split(':').map(Number);
  const [hFin, mFin] = fin.split(':').map(Number);
  return hIni >= 0 && hIni <= 23 && mIni >= 0 && mIni <= 59
      && hFin >= 0 && hFin <= 23 && mFin >= 0 && mFin <= 59;
}

// Mantenemos FRANJAS_VALIDAS como alias vacío para no romper imports que lo usen.
const FRANJAS_VALIDAS = null; // ya no se usa — ver esFranjaValida()

// Mínimo de horas de anticipación: 0 (el cliente puede pedir desde la hora actual)
const MIN_HORAS_ANTICIPACION = 0;

// Flujo simplificado: RECOLECTADO → EN_CAMINO directo (empleado da 1 clic "Listo")
// EN_PROCESO y LISTO ya no forman parte del flujo visible.
// RETRASADO:    se asigna automáticamente por el cron si la franja venció sin recolección
// REPROGRAMADO: el cliente reprogramó la fecha/franja de un pedido existente
const TRANSICIONES = {
  PENDIENTE:    ['CONFIRMADO', 'CANCELADO', 'REPROGRAMADO'],
  CONFIRMADO:   ['RECOLECTADO', 'CANCELADO', 'REPROGRAMADO'],
  RETRASADO:    ['CONFIRMADO', 'CANCELADO', 'REPROGRAMADO'], // admin/empleado puede reactivar
  REPROGRAMADO: ['CONFIRMADO', 'CANCELADO'],
  RECOLECTADO:  ['EN_CAMINO', 'CANCELADO'],  // empleado marca "Listo" → EN_CAMINO directo
  EN_CAMINO:    ['ENTREGADO', 'CANCELADO'],
  ENTREGADO:    [],
  CANCELADO:    [],
  // Estados legacy — se mantienen en el enum pero no son alcanzables por flujo normal
  EN_PROCESO:   [],
  LISTO:        [],
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
    .custom((v) => {
      if (!v) return true;
      if (!esFranjaValida(v)) throw new Error('Franja inválida. Formato esperado: HH:MM-HH:MM');
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
    .custom((v) => {
      if (!v) return true;
      if (!esFranjaValida(v)) throw new Error('Franja inválida. Formato esperado: HH:MM-HH:MM');
      return true;
    }),
];

module.exports = {
  crearPedidoRules, cambiarEstadoRules, reprogramarPedidoRules,
  TRANSICIONES, FRANJAS_VALIDAS,
};

