// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const prisma = require('../config/prisma');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Configurar transporter según entorno
let transporter;
let resend;
if (process.env.NODE_ENV === 'production' && process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'stebandioses@gmail.com',
    port: parseInt(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'stebandioses@gmail.com',
      pass: process.env.EMAIL_PASS || 'aL655TEC9030',
    },
  });
}

// Función helper para generar código de 6 dígitos
const generarCodigo6Digitos = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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

// ─── Login/Registro con Google ─────────────────────────────────────────
const loginGoogle = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    // Verificar el token de Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ error: 'Token de Google inválido' });
    }
    const { sub: googleId, email, name, picture, email_verified } = payload;
    const [nombre, ...apellidoParts] = name?.split(' ') || ['Usuario', 'Nuevo'];
    const apellido = apellidoParts.join(' ') || 'Sin Apellido';

    // Buscar usuario por email
    let usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      // El usuario no existe, lo CREAMOS (registro con Google)
      usuario = await prisma.usuario.create({
        data: {
          id: uuidv4(),
          nombre,
          apellido,
          email,
          passwordHash: null, // No hay password porque es Google
          googleId,
          emailVerificado: email_verified || true,
          fotoPerfil: picture,
          rol: 'CLIENTE', // Por defecto rol cliente
          puntos: {
            create: { saldo: 0, totalGanados: 0, totalCanjeados: 0 },
          },
        },
      });
    } else if (!usuario.googleId) {
      // El usuario existe pero no tiene googleId, lo actualizamos
      usuario = await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          googleId,
          emailVerificado: email_verified || true,
          fotoPerfil: picture || usuario.fotoPerfil,
        },
      });
    }

    // Generar tokens como en login normal
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
    console.error('Error en Google login:', err);
    next(err);
  }
};

// ─── Solicitar Reset de Contraseña ───────────────────────────────────────────
const solicitarResetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Se requiere el email' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      // Por seguridad, respondemos lo mismo que si existiera para no revelar emails
      return res.json({ mensaje: 'Si el email existe, se ha enviado un código de recuperación' });
    }

    // Generar código de 6 dígitos y fecha de expiración (10 minutos)
    const codigoReset = generarCodigo6Digitos();
    const tokenResetExpira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { tokenReset: codigoReset, tokenResetExpira },
    });

    // Enviar email con el código
    try {
      const fromEmail = process.env.EMAIL_FROM || 'no-reply@lavaya.com';
      const subject = 'Código de recuperación de contraseña - LavaYa';
      const text = `Tu código de recuperación es: ${codigoReset}\nEste código expira en 10 minutos.`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C3AED;">Recuperación de Contraseña - LavaYa</h2>
          <p>Hola ${usuario.nombre},</p>
          <p>Tu código de recuperación es:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #7C3AED; padding: 20px; background: #F3E8FF; border-radius: 10px; text-align: center;">
            ${codigoReset}
          </div>
          <p>Este código expira en 10 minutos.</p>
          <p>Si no solicitaste esto, ignora este correo.</p>
          <p style="margin-top: 30px; color: #999; font-size: 12px;">
            Saludos,<br>
            El equipo de LavaYa
          </p>
        </div>
      `;

      console.log('📧 Intentando enviar email...');
      console.log('   - Resend disponible:', !!resend);
      console.log('   - Transporter disponible:', !!transporter);
      console.log('   - NODE_ENV:', process.env.NODE_ENV);

      if (resend) {
        console.log('📨 Enviando con Resend...');
        const resendResult = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject,
          text,
          html,
        });
        console.log('✅ Resend result:', resendResult);
      } else if (transporter) {
        console.log('📨 Enviando con Nodemailer/Ethereal...');
        const info = await transporter.sendMail({ from: fromEmail, to: email, subject, text, html });
        console.log('✅ Nodemailer result:', info);
        if (process.env.EMAIL_HOST === 'smtp.ethereal.email') {
          console.log('📭 Preview URL:', nodemailer.getTestMessageUrl(info));
        }
      } else {
        console.log('⚠️ No hay método de envío disponible!');
      }
      
      console.log('✅ Código de reset para', email, ':', codigoReset);
    } catch (emailError) {
      console.error('❌ Error al enviar email:', emailError);
      console.error('   - Error details:', JSON.stringify(emailError, null, 2));
      // Si falla el email, por ahora seguimos y mostramos el código en consola (solo para desarrollo)
      console.log('🔢 Código de reset generado para', email, ':', codigoReset);
    }

    res.json({ mensaje: 'Si el email existe, se ha enviado un código de recuperación' });
  } catch (err) {
    next(err);
  }
};

// ─── Verificar Código de Reset ───────────────────────────────────────────
const verificarCodigoReset = async (req, res, next) => {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigo) {
      return res.status(400).json({ error: 'Se requieren email y código' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || usuario.tokenReset !== codigo || !usuario.tokenResetExpira || usuario.tokenResetExpira < new Date()) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    res.json({ mensaje: 'Código verificado correctamente' });
  } catch (err) {
    next(err);
  }
};

// ─── Resetear Contraseña ───────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { email, codigo, nuevaPassword } = req.body;
    if (!email || !codigo || !nuevaPassword) {
      return res.status(400).json({ error: 'Se requieren email, código y nueva contraseña' });
    }
    if (nuevaPassword.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || usuario.tokenReset !== codigo || !usuario.tokenResetExpira || usuario.tokenResetExpira < new Date()) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    // Hash de la nueva contraseña
    const passwordHash = await bcrypt.hash(nuevaPassword, 12);

    // Actualizar contraseña y limpiar tokens de reset
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        tokenReset: null,
        tokenResetExpira: null,
        refreshTokens: { deleteMany: {} }, // Cerrar todas las sesiones
      },
    });

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, loginGoogle, refresh, logout, me, solicitarResetPassword, verificarCodigoReset, resetPassword };
