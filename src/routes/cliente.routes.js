// src/routes/cliente.routes.js
const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const prisma = require('../config/prisma');
const {
  actualizarPerfilRules,
  agregarDireccionRules,
  calificarRules,
} = require('../middlewares/validators/cliente.validators');
const {
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  listarDirecciones,
  agregarDireccion,
  actualizarDireccion,
  eliminarDireccion,
  historialPedidos,
  obtenerPuntos,
  canjear,
  calificarPedido,
} = require('../controllers/cliente.controller');

const router = Router();
router.use(authenticate);
router.use(authorize('CLIENTE', 'ADMIN'));

// ─── Catálogo de prendas (para que el cliente pueda crear pedidos) ────────────
router.get('/catalogo', async (req, res, next) => {
  try {
    const catalogo = await prisma.catalogoPrenda.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        precioUnitario: true,
        precioExtra: true,
        activo: true,
      },
    });
    res.json(catalogo);
  } catch (err) { next(err); }
});

// ─── Perfil ──────────────────────────────────────────────────
router.get('/perfil',    obtenerPerfil);
router.patch('/perfil',  actualizarPerfilRules, validate, actualizarPerfil);
router.patch('/password', cambiarPassword);

// ─── Direcciones ─────────────────────────────────────────────
router.get('/direcciones',       listarDirecciones);
router.post('/direcciones',      agregarDireccionRules, validate, agregarDireccion);
router.patch('/direcciones/:id', actualizarDireccion);
router.delete('/direcciones/:id', eliminarDireccion);

// ─── Pedidos / historial ─────────────────────────────────────
router.get('/pedidos', historialPedidos);

// ─── Calificar ───────────────────────────────────────────────
router.post('/pedidos/:id/calificar', calificarRules, validate, calificarPedido);

// ─── Puntos ──────────────────────────────────────────────────
router.get('/puntos',          obtenerPuntos);
router.post('/puntos/canjear', canjear);

// ─── Membresías ──────────────────────────────────────────────
router.get('/membresias', async (req, res, next) => {
  try {
    const membresias = await prisma.membresia.findMany({
      where: { usuarioId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(membresias);
  } catch (err) { next(err); }
});

module.exports = router;
