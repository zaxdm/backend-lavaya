const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Import controllers
const authController = require('../controllers/auth.controller');
const { usuarios, sucursales, pagos, egresos, reviews } = require('../controllers/controllers');
const estadisticasController = require('../controllers/estadisticas.controller');
const pedidosController = require('../controllers/pedidos.controller');
const serviciosController = require('../controllers/servicios.controller');

// Import middlewares
const { verifyToken, roleGuard, sucursalGuard } = require('../middlewares/auth.middleware');

// Nuevas Rutas Modulares (V2)
router.use('/sucursales', require('./sucursales.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/usuarios', require('./usuarios.routes'));

// Auth routes (no auth required)
router.get('/servicios', serviciosController.listar);
router.get('/servicios/categorias', serviciosController.listarCategorias);

// Rutas de Auth migradas a routes/auth.routes.js

// Protected routes
router.use(verifyToken);

// Rutas de Usuarios migradas a routes/usuarios.routes.js

// Rutas de Sucursales migradas a routes/sucursales.routes.js

// Pagos routes
router.post('/pagos', [
  body('pedido_id').isInt({ gt: 0 }).withMessage('ID de pedido inválido'),
  body('metodo_pago').isIn(['efectivo', 'paypal']).withMessage('Método de pago debe ser efectivo o paypal'),
  body('monto').isDecimal({ gt: 0 }).withMessage('Monto debe ser mayor que cero'),
  body('referencia_externa').optional().isString().withMessage('Referencia externa debe ser texto'),
  body('tipo_comprobante').optional().isIn(['boleta', 'factura', 'ninguno']).withMessage('Tipo de comprobante inválido'),
  body('numero_comprobante').optional().isString().withMessage('Número de comprobante debe ser texto'),
  body('notas').optional().isString().withMessage('Notas debe ser texto'),
], roleGuard('admin_superior', 'encargado_sucursal', 'empleado'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, pagos.registrarPago);
router.get('/pagos', roleGuard('admin_superior', 'encargado_sucursal', 'empleado'), pagos.listarPagos);

// Egresos routes
router.get('/egresos', roleGuard('admin_superior', 'encargado_sucursal'), egresos.listarEgresos);
router.get('/egresos/categorias', roleGuard('admin_superior', 'encargado_sucursal'), egresos.listarCategoriasEgreso);
router.post('/egresos', [
  body('sucursal_id').isInt({ gt: 0 }).withMessage('ID de sucursal inválido'),
  body('categoria_egreso_id').isInt({ gt: 0 }).withMessage('ID de categoría de egreso inválido'),
  body('concepto').trim().notEmpty().withMessage('Concepto es requerido'),
  body('monto').isDecimal({ gt: 0 }).withMessage('Monto debe ser mayor que cero'),
  body('fecha').isISO8601().toDate().withMessage('Fecha debe ser válida (YYYY-MM-DD)'),
  body('comprobante_url').optional().isURL().withMessage('URL de comprobante inválida'),
  body('notas').optional().isString().withMessage('Notas debe ser texto'),
], roleGuard('admin_superior', 'encargado_sucursal'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, egresos.crearEgreso);
router.delete('/egresos/:id', roleGuard('admin_superior', 'encargado_sucursal'), egresos.eliminarEgreso);

// Reviews routes
router.post('/reviews', [
  body('pedido_id').isInt({ gt: 0 }).withMessage('ID de pedido inválido'),
  body('calificacion').isInt({ min: 1, max: 5 }).withMessage('Calificación debe estar entre 1 y 5'),
  body('comentario').optional().isString().withMessage('Comentario debe ser texto'),
], roleGuard('usuario'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, reviews.crearReview);
router.get('/reviews', roleGuard('admin_superior', 'encargado_sucursal', 'empleado', 'usuario'), reviews.listarReviews);
router.put('/reviews/:id/responder', [
  body('respuesta').trim().notEmpty().withMessage('Respuesta es requerida'),
], roleGuard('admin_superior', 'encargado_sucursal'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, reviews.responderReview);

// Estadisticas routes
router.get('/estadisticas/resumen', roleGuard('admin_superior', 'encargado_sucursal', 'empleado'), estadisticasController.resumenGeneral);
router.get('/estadisticas/ingresos-mensuales', roleGuard('admin_superior', 'encargado_sucursal', 'empleado'), estadisticasController.ingresosMensuales);
router.get('/estadisticas/ingresos-diarios', roleGuard('admin_superior', 'encargado_sucursal', 'empleado'), estadisticasController.ingresosDiarios);
router.get('/estadisticas/ranking-sucursales', roleGuard('admin_superior'), estadisticasController.rankingSucursales);

// Pedidos routes
router.get('/pedidos', roleGuard('admin_superior', 'encargado_sucursal', 'empleado', 'repartidor', 'usuario'), pedidosController.listar);
router.get('/pedidos/:id', roleGuard('admin_superior', 'encargado_sucursal', 'empleado', 'repartidor', 'usuario'), pedidosController.obtener);
router.post('/pedidos', [
  body('usuario_id').optional().isInt({ gt: 0 }).withMessage('ID de usuario inválido'),
  body('sucursal_id').isInt({ gt: 0 }).withMessage('ID de sucursal requerido'),
  body('tipo_servicio').isIn(['presencial', 'delivery', 'recojo_a_domicilio', 'recojo_y_entrega']).withMessage('Tipo de servicio inválido'),
  body('direccion_recojo').optional().isString().withMessage('Dirección de recogida debe ser texto'),
  body('latitud_recojo').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitud de recogida inválida'),
  body('longitud_recojo').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitud de recogida inválida'),
  body('direccion_entrega').optional().isString().withMessage('Dirección de entrega debe ser texto'),
  body('latitud_entrega').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitud de entrega inválida'),
  body('longitud_entrega').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitud de entrega inválida'),
  body('notas').optional().isString().withMessage('Notas debe ser texto'),
  body('detalles').isArray({ min: 1 }).withMessage('Debe proporcionar al menos un detalle de pedido'),
  body('detalles.*.servicio_id').isInt({ gt: 0 }).withMessage('ID de servicio en detalle inválido'),
  body('detalles.*.cantidad').isDecimal({ gt: 0 }).withMessage('Cantidad en detalle debe ser mayor que cero'),
  body('detalles.*.descripcion_prenda').optional().isString().withMessage('Descripción de prenda debe ser texto'),
], roleGuard('admin_superior', 'encargado_sucursal', 'empleado', 'usuario'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, pedidosController.crear);
router.patch('/pedidos/:id/estado', [
  body('estado').isIn(['recibido', 'lavando', 'secando', 'planchando', 'listo', 'en_reparto', 'entregado', 'cancelado']).withMessage('Estado inválido'),
  body('comentario').optional().isString().withMessage('Comentario debe ser texto'),
], roleGuard('admin_superior', 'encargado_sucursal', 'empleado', 'repartidor', 'usuario'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, pedidosController.cambiarEstado);
router.patch('/pedidos/:id/asignar-repartidor', [
  body('repartidor_id').isInt({ gt: 0 }).withMessage('ID de repartidor inválido'),
], roleGuard('admin_superior', 'encargado_sucursal', 'empleado'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, pedidosController.asignarRepartidor);

// Servicios
router.post('/servicios',
  roleGuard('admin_superior'),
  serviciosController.crear
);
router.put('/servicios/:id',
  roleGuard('admin_superior'),
  serviciosController.actualizar
);
router.delete('/servicios/:id',
  roleGuard('admin_superior'),
  serviciosController.eliminar
);

module.exports = router;