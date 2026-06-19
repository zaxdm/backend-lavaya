// src/routes/auth.routes.js
const { Router } = require('express');
const { register, login, loginGoogle, refresh, logout, me, solicitarResetPassword, resetPassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.post('/login/google', loginGoogle);
router.post('/refresh',  refresh);
router.post('/logout',   logout);
router.get('/me',        authenticate, me);
router.post('/password/reset-request', solicitarResetPassword);
router.post('/password/reset', resetPassword);

module.exports = router;
