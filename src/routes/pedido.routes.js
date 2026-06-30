// src/routes/pedido.routes.js
const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  crearPedidoRules,
  cambiarEstadoRules,
  reprogramarPedidoRules,
} = require('../middlewares/validators/pedido.validators');
const {
  crearPedido,
  obtenerPedido,
  cambiarEstado,
  cancelarPedido,
  listarPedidos,
  asignarRepartidor,
  reprogramarPedido,
} = require('../controllers/pedido.controller');

const router = Router();
router.use(authenticate);

// Listar pedidos (cliente: los suyos / admin-empleado: todos)
router.get(
  '/',
  authorize('CLIENTE', 'ADMIN', 'EMPLEADO'),
  listarPedidos
);

// Crear pedido
router.post(
  '/',
  authorize('CLIENTE'),
  crearPedidoRules,
  validate,
  crearPedido
);

// Detalle de un pedido
router.get(
  '/:id',
  authorize('CLIENTE', 'ADMIN', 'EMPLEADO', 'REPARTIDOR'),
  obtenerPedido
);

// Cambiar estado (Empleado y Repartidor con sus limitaciones; Admin puede cualquier cosa)
router.patch(
  '/:id/estado',
  authorize('REPARTIDOR', 'EMPLEADO', 'ADMIN'),
  cambiarEstadoRules,
  validate,
  cambiarEstado
);

// Reprogramar (cliente cambia fecha/franja de un pedido no recolectado aún)
router.patch(
  '/:id/reprogramar',
  authorize('CLIENTE', 'ADMIN'),
  reprogramarPedidoRules,
  validate,
  reprogramarPedido
);

// Cancelar
router.patch(
  '/:id/cancelar',
  authorize('CLIENTE', 'ADMIN'),
  cancelarPedido
);

// Asignar repartidor (solo Admin)
router.patch(
  '/:id/asignar-repartidor',
  authorize('ADMIN'),
  asignarRepartidor
);

module.exports = router;

