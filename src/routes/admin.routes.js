// src/routes/admin.routes.js
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  crearUsuarioRules,
  asignarRepartidorRules,
  catalogoRules,
} = require('../middlewares/validators/admin.validators');
const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  toggleEstadoUsuario,
  listarPedidos,
  asignarRepartidor,
  listarCatalogo,
  crearItemCatalogo,
  actualizarItemCatalogo,
  statsGenerales,
  pedidosPorDia,
  ingresosPorDia,
  prendasPopulares,
  listarRepartidores,
} = require('../controllers/admin.controller');
const {
  listarEmpresas,
  obtenerEmpresa,
  crearEmpresa,
  actualizarEmpresa,
  toggleActiva,
  obtenerContrato,
  crearContrato,
} = require('../controllers/b2b.controller');

const router = Router();
router.use(authenticate);
router.use(authorize('ADMIN'));

// ─── Usuarios ─────────────────────────────────────────────────
router.get('/usuarios',              listarUsuarios);
router.get('/usuarios/:id',          obtenerUsuario);
router.post('/usuarios',             crearUsuarioRules, validate, crearUsuario);
router.patch('/usuarios/:id/estado', toggleEstadoUsuario);

// ─── Migración: asignar plan BÁSICO a clientes sin membresía ──
// POST /api/admin/membresias/asignar-basico-masivo
router.post('/membresias/asignar-basico-masivo', async (req, res, next) => {
  try {
    // Encontrar todos los clientes activos sin ninguna membresía
    const sinMembresia = await prisma.usuario.findMany({
      where: {
        rol: 'CLIENTE',
        activo: true,
        membresias: { none: {} },
      },
      select: { id: true },
    });

    if (sinMembresia.length === 0) {
      return res.json({ mensaje: 'Todos los clientes ya tienen membresía', asignados: 0 });
    }

    const fechaFin = new Date('2099-12-31');
    const ahora    = new Date();

    await prisma.membresia.createMany({
      data: sinMembresia.map(u => ({
        id: uuidv4(),
        usuarioId: u.id,
        tipo: 'BASICO',
        estado: 'ACTIVA',
        fechaInicio: ahora,
        fechaFin,
        precio: 0,
        descuento: 0,
        pedidosGratis: 0,
      })),
    });

    res.json({
      mensaje: `Plan Básico asignado a ${sinMembresia.length} cliente(s)`,
      asignados: sinMembresia.length,
    });
  } catch (err) { next(err); }
});

// ─── Repartidores ─────────────────────────────────────────────
router.get('/repartidores', listarRepartidores);

// ─── Pedidos ──────────────────────────────────────────────────
router.get('/pedidos', listarPedidos);
router.patch(
  '/pedidos/:id/asignar-repartidor',
  asignarRepartidorRules, validate,
  asignarRepartidor
);

// ─── Catálogo ─────────────────────────────────────────────────
router.get('/catalogo',       listarCatalogo);
router.post('/catalogo',      catalogoRules, validate, crearItemCatalogo);
router.patch('/catalogo/:id', actualizarItemCatalogo);

// ─── B2B ──────────────────────────────────────────────────────
router.get('/b2b',                    listarEmpresas);
router.get('/b2b/:id',                obtenerEmpresa);
router.post('/b2b',                   crearEmpresa);
router.patch('/b2b/:id',              actualizarEmpresa);
router.patch('/b2b/:id/estado',       toggleActiva);
router.get('/b2b/:id/contrato',       obtenerContrato);
router.post('/b2b/:id/contrato',      crearContrato);

// ─── Reportes ─────────────────────────────────────────────────
router.get('/reportes/stats',             statsGenerales);
router.get('/reportes/pedidos-por-dia',   pedidosPorDia);
router.get('/reportes/ingresos-por-dia',  ingresosPorDia);
router.get('/reportes/prendas-populares', prendasPopulares);

module.exports = router;
