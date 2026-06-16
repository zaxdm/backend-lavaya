// src/routes/admin.routes.js
const { Router } = require('express');
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
