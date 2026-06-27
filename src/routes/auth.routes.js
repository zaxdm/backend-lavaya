// src/routes/auth.routes.js
const { Router } = require('express');
const { register, login, loginGoogle, refresh, logout, me, solicitarResetPassword, verificarCodigoReset, resetPassword, verificarEmail, reenviarCodigoVerificacion, enviarCodigoVerificacion, verificarCodigoPrevio } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.post('/login/google', loginGoogle);
router.post('/refresh',  refresh);
router.post('/logout',   logout);
router.get('/me',        authenticate, me);
router.post('/password/reset-request', solicitarResetPassword);
router.post('/password/verify-code', verificarCodigoReset);
router.post('/password/reset', resetPassword);

router.post('/verificar-email', verificarEmail);
router.post('/reenviar-codigo', reenviarCodigoVerificacion);

// Verificación pre-registro (inline en el formulario)
router.post('/enviar-codigo-verificacion', enviarCodigoVerificacion);
router.post('/verificar-codigo-previo', verificarCodigoPrevio);

module.exports = router;
