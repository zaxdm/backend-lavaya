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

// ─── Puntos del repartidor ────────────────────────────────────
router.get('/puntos', async (req, res, next) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const prisma = require('../config/prisma');
    const puntos = await prisma.puntos.upsert({
      where:  { usuarioId: req.user.id },
      update: {},
      create: { id: uuidv4(), usuarioId: req.user.id, saldo: 0, totalGanados: 0, totalCanjeados: 0 },
    });
    res.json({ saldo: puntos.saldo, totalGanados: puntos.totalGanados });
  } catch (err) { next(err); }
});

// ─── Token FCM ────────────────────────────────────────────────
// PATCH /api/repartidores/fcm-token
// La app Flutter llama a este endpoint cada vez que obtiene un token
// FCM nuevo (al iniciar sesión y cuando FCM refresca el token).
router.patch('/fcm-token', async (req, res, next) => {
  try {
    const prisma = require('../config/prisma');
    const { token } = req.body;

    if (!token || typeof token !== 'string' || token.trim() === '') {
      return res.status(400).json({ error: 'Token FCM requerido' });
    }

    const repartidor = await prisma.repartidor.findUnique({
      where: { usuarioId: req.user.id },
    });
    if (!repartidor) {
      return res.status(404).json({ error: 'Perfil de repartidor no encontrado' });
    }

    await prisma.repartidor.update({
      where: { id: repartidor.id },
      data:  { fcmToken: token.trim() },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Disponibilidad ───────────────────────────────────────────
router.patch('/disponibilidad', cambiarDisponibilidad);

// ─── Ubicación GPS ────────────────────────────────────────────
router.patch('/ubicacion', ubicacionRules, validate, actualizarUbicacion);

// ─── Pedidos ──────────────────────────────────────────────────
router.get('/pedidos/disponibles',        pedidosDisponibles);
router.get('/pedidos/mis-pedidos',        misPedidos);
router.patch('/pedidos/:id/aceptar',      aceptarPedido);
router.patch('/pedidos/:id/estado',       cambiarEstadoRules, validate, cambiarEstadoPedido);
router.patch('/pedidos/:id/foto-entrega', fotoEntregaRules,   validate, subirFotoEntrega);

module.exports = router;

