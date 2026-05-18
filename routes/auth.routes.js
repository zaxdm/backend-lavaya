const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authValidator = require('../middlewares/validators/auth.validator');
const validate = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../middlewares/auth.middleware');

/**
 * RUTAS DE AUTENTICACIÓN
 * Endpoint base: /api/auth
 */

router.post(
  '/login',
  authValidator.loginValidator,
  validate,
  asyncHandler(authController.loginInterno)
);

router.post(
  '/login-repartidor',
  authValidator.loginValidator,
  validate,
  asyncHandler(authController.loginRepartidor)
);

router.post(
  '/login-usuario',
  authValidator.loginValidator,
  validate,
  asyncHandler(authController.loginUsuario)
);

router.post(
  '/refresh',
  authValidator.refreshValidator,
  validate,
  asyncHandler(authController.refresh)
);

router.post(
  '/registro',
  authValidator.registroUsuarioValidator,
  validate,
  // Para registrar clientes: Usaremos temporalmente authController, 
  // pero la lógica la redirigiremos a usuariosService en el futuro si crece.
  // Nota: original code called authController.registroUsuario
  // The original function handles setting rol_id = 4 (usuario). 
  // We need to implement it in AuthController or reuse UsuariosController.
  // I will implement it now in AuthController to not break compatibility.
  asyncHandler(async (req, res) => {
    const usuariosService = require('../services/usuarios.service');
    // Para clientes de la app, el rol_id suele ser 4 ('usuario') y sucursal null
    const { nombre, apellido, email, password, telefono } = req.body;
    
    // Obtenemos rol_id de 'usuario' (hardcodeado a 4 en la base de datos o lo buscamos)
    // Para simplificar, pasamos los datos simulando que lo crea el sistema (actor con permisos)
    const actorSystem = { rol: { nombre: 'admin_superior' } }; 
    const nuevoUsuario = await usuariosService.crear(actorSystem, {
      nombre, apellido, email, password, telefono, rol_id: 4 // 4 = usuario cliente
    });

    const authService = require('../services/auth.service');
    const tokens = authService.generarTokens(nuevoUsuario);
    await authService.guardarRefreshToken(nuevoUsuario, tokens.refreshToken);

    const usuarioJSON = nuevoUsuario.toJSON();
    delete usuarioJSON.password_hash;

    res.status(201).json({
      success: true,
      ok: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      usuario: usuarioJSON
    });
  })
);

router.post(
  '/logout',
  verifyToken,
  asyncHandler(authController.logout)
);

module.exports = router;
