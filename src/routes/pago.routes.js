// src/routes/pago.routes.js
const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  crearOrdenPaypalRules,
  capturarPaypalRules,
  registrarEfectivoRules,
  confirmarEfectivoRules,
} = require('../middlewares/validators/pago.validators');
const {
  crearOrdenPaypal,
  capturarPagoPaypal,
  webhookPaypal,
  registrarPagoEfectivo,
  confirmarPagoEfectivo,
  obtenerPagoPorPedido,
  listarPagos,
  reembolsar,
} = require('../controllers/pago.controller');

const router = Router();

// ─── WEBHOOK PayPal (sin auth — PayPal lo llama directamente) ─
router.post('/paypal/webhook', webhookPaypal);

// A partir de aquí todas las rutas requieren autenticación
router.use(authenticate);

// ─── PayPal ───────────────────────────────────────────────────
router.post(
  '/paypal/crear-orden',
  authorize('CLIENTE'),
  crearOrdenPaypalRules, validate,
  crearOrdenPaypal
);

router.post(
  '/paypal/capturar',
  authorize('CLIENTE'),
  capturarPaypalRules, validate,
  capturarPagoPaypal
);

// ─── Efectivo ─────────────────────────────────────────────────
router.post(
  '/efectivo/registrar',
  authorize('CLIENTE'),
  registrarEfectivoRules, validate,
  registrarPagoEfectivo
);

router.patch(
  '/efectivo/confirmar',
  authorize('REPARTIDOR', 'ADMIN', 'EMPLEADO'),
  confirmarEfectivoRules, validate,
  confirmarPagoEfectivo
);

// ─── Consultas ────────────────────────────────────────────────
router.get(
  '/pedido/:pedidoId',
  authorize('CLIENTE', 'REPARTIDOR', 'ADMIN', 'EMPLEADO'),
  obtenerPagoPorPedido
);

router.get(
  '/',
  authorize('ADMIN', 'EMPLEADO'),
  listarPagos
);

// ─── Reembolso (Admin) ────────────────────────────────────────
router.patch(
  '/:id/reembolsar',
  authorize('ADMIN'),
  reembolsar
);

module.exports = router;
