const express = require('express');
const router = express.Router();

const usuariosController = require('../controllers/usuarios.controller');
const usuariosValidator = require('../middlewares/validators/usuarios.validator');
const validate = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, roleGuard } = require('../middlewares/auth.middleware');

/**
 * RUTAS DE USUARIOS
 * Endpoint base: /api/usuarios
 */

// Todas las rutas requieren estar logueado
router.use(verifyToken);

router.get(
  '/',
  roleGuard('admin_superior', 'encargado_sucursal'),
  asyncHandler(usuariosController.listarUsuarios)
);

router.get(
  '/roles',
  roleGuard('admin_superior'),
  asyncHandler(usuariosController.listarRoles)
);

router.post(
  '/',
  roleGuard('admin_superior'),
  usuariosValidator.crearUsuarioValidator,
  validate,
  asyncHandler(usuariosController.crearUsuario)
);

router.put(
  '/:id',
  roleGuard('admin_superior', 'encargado_sucursal'),
  usuariosValidator.actualizarUsuarioValidator,
  validate,
  asyncHandler(usuariosController.actualizarUsuario)
);

router.delete(
  '/:id',
  roleGuard('admin_superior'),
  asyncHandler(usuariosController.eliminarUsuario)
);

router.put(
  '/me/cambiar-password', // Renombrado lógicamente, pero capturamos el original también
  usuariosValidator.cambiarPasswordValidator,
  validate,
  asyncHandler(usuariosController.cambiarPassword)
);

// Fallback legacy exacto para no romper Frontend: /usuarios/cambiar-password
router.put(
  '/cambiar-password',
  usuariosValidator.cambiarPasswordValidator,
  validate,
  asyncHandler(usuariosController.cambiarPassword)
);

module.exports = router;
