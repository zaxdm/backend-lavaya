const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Usuario, Rol, Sucursal } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Servicio para la gestión de Autenticación y Autorización.
 */
class AuthService {
  /**
   * Genera los tokens de acceso y refresco para un usuario
   * @param {Object} usuario 
   * @returns {Object} { accessToken, refreshToken }
   */
  generarTokens(usuario) {
    const payload = { 
      id: usuario.id, 
      rol: usuario.rol?.nombre, 
      sucursal_id: usuario.sucursal_id 
    };

    // Access Token vive poco (ej. 8h)
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    
    // Refresh Token vive más tiempo (ej. 7d)
    const refreshToken = jwt.sign({ id: usuario.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    return { accessToken, refreshToken };
  }

  /**
   * Guarda el refresh token en la base de datos de manera segura (hasheado).
   * @param {Object} usuario Instancia del modelo Usuario
   * @param {string} refreshToken Token en texto plano
   */
  async guardarRefreshToken(usuario, refreshToken) {
    // Almacenamiento seguro del refresh token
    const salt = await bcrypt.genSalt(10);
    const hashedToken = await bcrypt.hash(refreshToken, salt);
    
    await usuario.update({ 
      refresh_token: hashedToken, 
      ultimo_login: new Date() 
    });
  }

  /**
   * Valida credenciales genéricas (email y password)
   * @param {string} email 
   * @param {string} password 
   * @param {Array<string>} rolesPermitidos Lista de roles que pueden hacer login por esta vía
   * @returns {Promise<Object>} Instancia del usuario
   */
  async validarCredenciales(email, password, rolesPermitidos = []) {
    const usuario = await Usuario.findOne({
      where: { email },
      include: [
        { model: Rol, as: 'rol' },
        { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'], required: false },
      ],
    });

    if (!usuario || !usuario.activo) {
      throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(usuario.rol.nombre)) {
      throw new AppError('Use el login correspondiente a su rol', 403, 'INVALID_ROLE_LOGIN');
    }

    const passwordOk = await usuario.verificarPassword(password);
    if (!passwordOk) {
      throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    return usuario;
  }

  /**
   * Lógica de refresco de token segura con soporte de migración legacy.
   * @param {string} refreshTokenPlainText 
   * @returns {Promise<Object>} { accessToken, refreshToken, usuario }
   */
  async refrescarToken(refreshTokenPlainText) {
    let decoded;
    try {
      decoded = jwt.verify(refreshTokenPlainText, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new AppError('Refresh token expirado o inválido', 401, 'EXPIRED_REFRESH_TOKEN');
    }

    const usuario = await Usuario.findByPk(decoded.id, { 
      include: [{ model: Rol, as: 'rol' }] 
    });

    if (!usuario || !usuario.activo || !usuario.refresh_token) {
      throw new AppError('Refresh token inválido', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Migración transparente: Si el token almacenado no empieza con $ (no es bcrypt), comparamos en plano
    const isHashed = usuario.refresh_token.startsWith('$');
    let isValid = false;

    if (isHashed) {
      isValid = await bcrypt.compare(refreshTokenPlainText, usuario.refresh_token);
    } else {
      // Legacy check
      isValid = (usuario.refresh_token === refreshTokenPlainText);
    }

    if (!isValid) {
      throw new AppError('Refresh token inválido', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Generar nuevos tokens
    const tokens = this.generarTokens(usuario);
    
    // Guardar el nuevo token siempre hasheado
    await this.guardarRefreshToken(usuario, tokens.refreshToken);

    return { ...tokens, usuario };
  }

  /**
   * Cierra la sesión invalidando el refresh token
   * @param {number} usuarioId 
   */
  async cerrarSesion(usuarioId) {
    const usuario = await Usuario.findByPk(usuarioId);
    if (usuario) {
      await usuario.update({ refresh_token: null });
    }
  }
}

module.exports = new AuthService();
