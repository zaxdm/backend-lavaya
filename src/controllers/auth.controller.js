// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');

// ─── Registro ────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, telefono, rol } = req.body;

    // Rol permitido al registrarse públicamente
    const rolPermitido = ['CLIENTE', 'REPARTIDOR'].includes(rol) ? rol : 'CLIENTE';

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const usuario = await prisma.usuario.create({
      data: {
        id: uuidv4(),
        nombre,
        apellido,
        email,
        passwordHash,
        telefono,
        rol: rolPermitido,
        puntos: {
          create: { saldo: 0, totalGanados: 0, totalCanjeados: 0 },
        },
      },
      select: {
        id: true, nombre: true, apellido: true, email: true, rol: true, createdAt: true,
      },
    });

    // Si es repartidor, crear perfil de repartidor
    if (rolPermitido === 'REPARTIDOR') {
      await prisma.repartidor.create({
        data: { id: uuidv4(), usuarioId: usuario.id },
      });
    }

    const accessToken = generateAccessToken({ id: usuario.id, email: usuario.email, rol: usuario.rol });
    const refreshToken = generateRefreshToken({ id: usuario.id });

    await prisma.refreshToken.create({
      data: {
        id: uuidv4(),
        token: refreshToken,
        usuarioId: usuario.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({ usuario, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
};

// ─── Login ───────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    console.log('Login request received for email:', req.body.email);
    const { email, password } = req.body;

    console.log('Finding user...');
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    console.log('User found:', usuario ? usuario.id : 'NOT FOUND');
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    console.log('Comparing password...');
    const valida = await bcrypt.compare(password, usuario.passwordHash);
    if (!valida) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    console.log('Generating tokens...');
    const accessToken = generateAccessToken({ id: usuario.id, email: usuario.email, rol: usuario.rol });
    const refreshToken = generateRefreshToken({ id: usuario.id });

    console.log('Saving refresh token...');
    await prisma.refreshToken.create({
      data: {
        id: uuidv4(),
        token: refreshToken,
        usuarioId: usuario.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    console.log('Login successful!');
    res.json({
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Error in login endpoint:', err);
    console.error('Stack trace:', err.stack);
    next(err);
  }
};

// ─── Refresh Token ───────────────────────────────────────────
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });

    const payload = verifyRefreshToken(refreshToken);

    const tokenDB = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!tokenDB || tokenDB.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const newAccessToken = generateAccessToken({ id: usuario.id, email: usuario.email, rol: usuario.rol });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
};

// ─── Logout ──────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    next(err);
  }
};

// ─── Perfil propio ───────────────────────────────────────────
const me = async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, nombre: true, apellido: true, email: true,
        telefono: true, rol: true, fotoPerfil: true,
        emailVerificado: true, createdAt: true,
        puntos: { select: { saldo: true } },
        membresias: { where: { estado: 'ACTIVA' }, select: { tipo: true, fechaFin: true } },
      },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, me };
