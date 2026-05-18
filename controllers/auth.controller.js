const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Usuario, Rol, Sucursal } = require('../models');

const generarTokens = (usuario) => {
  const payload = { id: usuario.id, rol: usuario.rol?.nombre, sucursal_id: usuario.sucursal_id };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  const refreshToken = jwt.sign({ id: usuario.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

// POST /api/auth/login
// Pantalla de admin / encargado / empleado (login interno)
const loginInterno = [
  // Validation middleware
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),

  // Controller logic
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
    }

    try {
      const { email, password } = req.body;

      const usuario = await Usuario.findOne({
        where: { email },
        include: [
          { model: Rol, as: 'rol' },
          { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
        ],
      });

      if (!usuario || !usuario.activo) {
        return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
      }

      // Bloquear si intenta entrar con rol de usuario/repartidor por esta ruta
      const rolesInternos = ['admin_superior', 'encargado_sucursal', 'empleado'];
      if (!rolesInternos.includes(usuario.rol.nombre)) {
        return res.status(403).json({ ok: false, mensaje: 'Use el login correspondiente a su rol' });
      }

      const passwordOk = await usuario.verificarPassword(password);
      if (!passwordOk) {
        return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
      }

      const { accessToken, refreshToken } = generarTokens(usuario);
      await usuario.update({ refresh_token: refreshToken, ultimo_login: new Date() });

      return res.json({
        ok: true,
        accessToken,
        refreshToken,
        usuario: usuario.toJSON(),
      });
    } catch (error) {
      console.error('loginInterno:', error);
      return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
    }
  },
];

// POST /api/auth/login-repartidor
const loginRepartidor = [
  // Validation middleware
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),

  // Controller logic
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
    }

    try {
      const { email, password } = req.body;

      const usuario = await Usuario.findOne({
        where: { email },
        include: [{ model: Rol, as: 'rol' }],
      });

      if (!usuario || !usuario.activo || usuario.rol.nombre !== 'repartidor') {
        return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
      }

      const passwordOk = await usuario.verificarPassword(password);
      if (!passwordOk) {
        return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
      }

      const { accessToken, refreshToken } = generarTokens(usuario);
      await usuario.update({ refresh_token: refreshToken, ultimo_login: new Date() });

      return res.json({ ok: true, accessToken, refreshToken, usuario: usuario.toJSON() });
    } catch (error) {
      console.error('loginRepartidor:', error);
      return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
    }
  },
];

// POST /api/auth/login-usuario  (clientes)
const loginUsuario = [
  // Validation middleware
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),

  // Controller logic
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
    }

    try {
      const { email, password } = req.body;

      const usuario = await Usuario.findOne({
        where: { email },
        include: [{ model: Rol, as: 'rol' }],
      });

      if (!usuario || !usuario.activo || usuario.rol.nombre !== 'usuario') {
        return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
      }

      const passwordOk = await usuario.verificarPassword(password);
      if (!passwordOk) {
        return res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
      }

      const { accessToken, refreshToken } = generarTokens(usuario);
      await usuario.update({ refresh_token: refreshToken, ultimo_login: new Date() });

      return res.json({ ok: true, accessToken, refreshToken, usuario: usuario.toJSON() });
    } catch (error) {
      console.error('loginUsuario:', error);
      return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
    }
  },
];

// POST /api/auth/refresh
const refresh = [
  // Validation middleware
  body('refreshToken').notEmpty().withMessage('refreshToken es requerido'),

  // Controller logic
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
    }

    try {
      const { refreshToken } = req.body;

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const usuario = await Usuario.findByPk(decoded.id, { include: [{ model: Rol, as: 'rol' }] });

      if (!usuario || usuario.refresh_token !== refreshToken || !usuario.activo) {
        return res.status(401).json({ ok: false, mensaje: 'Refresh token inválido' });
      }

      const tokens = generarTokens(usuario);
      await usuario.update({ refresh_token: tokens.refreshToken });

      return res.json({ ok: true, ...tokens });
    } catch (error) {
      return res.status(401).json({ ok: false, mensaje: 'Refresh token expirado o inválido' });
    }
  },
];

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await req.usuario.update({ refresh_token: null });
    return res.json({ ok: true, mensaje: 'Sesión cerrada' });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al cerrar sesión' });
  }
};

// POST /api/auth/registro  (solo para clientes/usuarios)
const registroUsuario = [
  // Validation middleware
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido es requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('telefono').optional().isMobilePhone().withMessage('Teléfono inválido'),

  // Controller logic
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, mensaje: 'Errores de validación', errores: errors.array() });
    }

    try {
      const { nombre, apellido, email, password, telefono } = req.body;

      const existe = await Usuario.findOne({ where: { email } });
      if (existe) return res.status(409).json({ ok: false, mensaje: 'El email ya está registrado' });

      const rolUsuario = await Rol.findOne({ where: { nombre: 'usuario' } });

      const usuario = await Usuario.create({
        nombre, apellido, email,
        password_hash: password, // el hook hace el hash
        telefono,
        rol_id: rolUsuario.id,
      });

      return res.status(201).json({ ok: true, usuario: usuario.toJSON() });
    } catch (error) {
      console.error('registroUsuario:', error);
      return res.status(500).json({ ok: false, mensaje: 'Error al registrar usuario' });
    }
  },
];

module.exports = { loginInterno, loginRepartidor, loginUsuario, refresh, logout, registroUsuario };