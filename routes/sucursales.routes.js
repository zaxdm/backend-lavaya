const express = require('express');
const router = express.Router();

const sucursalesController = require('../controllers/sucursales.controller');
const sucursalesValidator = require('../middlewares/validators/sucursales.validator');
const validate = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, roleGuard } = require('../middlewares/auth.middleware');

/**
 * RUTAS DE SUCURSALES (Enterprise Piloto)
 * Endpoint base: /api/sucursales
 */

// Rutas Públicas (o que no requieren verifyToken explícitamente en el router si ya están protegidas a nivel app)
// Nota: en el routes/index.js original:
// router.get('/sucursales', sucursales.listarSucursales);
// router.get('/sucursales/:id', sucursales.obtenerSucursal);
// No estaban debajo de `router.use(verifyToken);` 
// (verifyToken estaba en la línea 45 de index.js, sucursales GET estaban en 18 y 19).
router.get('/', asyncHandler(sucursalesController.listarSucursales));
router.get('/:id', asyncHandler(sucursalesController.obtenerSucursal));

// Rutas Protegidas (se aplica verifyToken)
router.use(verifyToken);

router.post(
  '/',
  roleGuard('admin_superior'),
  sucursalesValidator.crearSucursalValidator,
  validate,
  asyncHandler(sucursalesController.crearSucursal)
);

router.put(
  '/:id',
  roleGuard('admin_superior', 'encargado_sucursal'),
  sucursalesValidator.actualizarSucursalValidator,
  validate,
  asyncHandler(sucursalesController.actualizarSucursal)
);

module.exports = router;
