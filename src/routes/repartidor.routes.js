// src/routes/repartidor.routes.js
const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { ubicacionRules, fotoEntregaRules } = require('../middlewares/validators/repartidor.validators');
const { cambiarEstadoRules } = require('../middlewares/validators/pedido.validators');
const {
  dashboard,
  pedidosDisponibles,
  misPedidos,
  aceptarPedido,
  cambiarEstadoPedido,
  actualizarUbicacion,
  subirFotoEntrega,
  cambiarDisponibilidad,
} = require('../controllers/repartidor.controller');

const router = Router();
router.use(authenticate);
router.use(authorize('REPARTIDOR', 'ADMIN'));

// ─── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', dashboard);

// ─── Disponibilidad ───────────────────────────────────────────
router.patch('/disponibilidad', cambiarDisponibilidad);

// ─── Ubicación GPS ────────────────────────────────────────────
router.patch('/ubicacion', ubicacionRules, validate, actualizarUbicacion);

// ─── Pedidos ──────────────────────────────────────────────────
router.get('/pedidos/disponibles',  pedidosDisponibles);
router.get('/pedidos/mis-pedidos',  misPedidos);
router.patch('/pedidos/:id/aceptar',      aceptarPedido);
router.patch('/pedidos/:id/estado',       cambiarEstadoRules, validate, cambiarEstadoPedido);
router.patch('/pedidos/:id/foto-entrega', fotoEntregaRules, validate, subirFotoEntrega);

module.exports = router;
