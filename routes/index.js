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

// Auth routes (no auth required)
router.get('/servicios', serviciosController.listar);
router.get('/servicios/categorias', serviciosController.listarCategorias);
router.get('/sucursales', sucursales.listarSucursales);
router.get('/sucursales/:id', sucursales.obtenerSucursal);

router.post('/auth/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
], authController.loginInterno);
router.post('/auth/login-repartidor', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
], authController.loginRepartidor);
router.post('/auth/login-usuario', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
], authController.loginUsuario);
router.post('/auth/refresh', [
  body('refreshToken').notEmpty().withMessage('refreshToken es requerido'),
], authController.refresh);
router.post('/auth/registro', [
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido es requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('telefono').optional().isMobilePhone().withMessage('Teléfono inválido'),
], authController.registroUsuario);

// Protected routes
router.use(verifyToken);

// Usuarios routes
router.get('/usuarios', roleGuard('admin_superior', 'encargado_sucursal'), usuarios.listarUsuarios);
router.get('/usuarios/roles', roleGuard('admin_superior'), usuarios.listarRoles);
router.post('/usuarios', [
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido es requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('telefono').optional().isMobilePhone().withMessage('Teléfono inválido'),
  body('dni').optional().isLength({ min: 8, max: 15 }).withMessage('DNI debe tener entre 8 y 15 caracteres'),
  body('rol_id').isInt({ gt: 0 }).withMessage('ID de rol inválido'),
  body('sucursal_id').optional().isInt({ gt: 0 }).withMessage('ID de sucursal inválido'),
], roleGuard('admin_superior'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, usuarios.crearUsuario);
router.put('/usuarios/:id', [
  body('nombre').optional().trim().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('apellido').optional().trim().notEmpty().withMessage('Apellido no puede estar vacío'),
  body('telefono').optional().isMobilePhone().withMessage('Teléfono inválido'),
  body('dni').optional().isLength({ min: 8, max: 15 }).withMessage('DNI debe tener entre 8 y 15 caracteres'),
  body('activo').optional().isBoolean().withMessage('Activo debe ser booleano'),
  body('sucursal_id').optional().isInt({ gt: 0 }).withMessage('ID de sucursal inválido'),
  body('foto_url').optional().isURL().withMessage('URL de foto inválida'),
], roleGuard('admin_superior', 'encargado_sucursal'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, usuarios.actualizarUsuario);
router.delete('/usuarios/:id', roleGuard('admin_superior'), usuarios.eliminarUsuario);
router.put('/usuarios/cambiar-password', [
  body('password_actual').isLength({ min: 6 }).withMessage('La contraseña actual debe tener al menos 6 caracteres'),
  body('password_nueva').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
], roleGuard('admin_superior', 'encargado_sucursal', 'empleado', 'usuario'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, usuarios.cambiarPassword);

// Sucursales routes
router.post('/sucursales', [
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('direccion').trim().notEmpty().withMessage('Dirección es requerida'),
  body('telefono').optional().isMobilePhone().withMessage('Teléfono inválido'),
  body('distrito').optional().isString().withMessage('Distrito debe ser texto'),
], roleGuard('admin_superior'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, sucursales.crearSucursal);
router.put('/sucursales/:id', [
  body('nombre').optional().trim().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('direccion').optional().trim().notEmpty().withMessage('Dirección no puede estar vacía'),
  body('telefono').optional().isMobilePhone().withMessage('Teléfono inválido'),
  body('distrito').optional().isString().withMessage('Distrito debe ser texto'),
  body('activo').optional().isBoolean().withMessage('Activo debe ser booleano'),
], roleGuard('admin_superior', 'encargado_sucursal'), (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
  }
  next();
}, sucursales.actualizarSucursal);

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