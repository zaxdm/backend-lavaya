const { Usuario, Rol, Sucursal } = require('../models');
const AppError = require('../utils/AppError');

class UsuariosService {
  /**
   * Listar usuarios con paginación y validación de tenencia.
   */
  async listar(actor, filtros = {}, limit = 20, offset = 0) {
    const where = {};
    if (filtros.rol) where['$rol.nombre$'] = filtros.rol;
    if (filtros.activo !== undefined) where.activo = filtros.activo === 'true' || filtros.activo === true;

    // Validación de tenencia: Encargado solo ve su sucursal
    if (actor.rol.nombre === 'encargado_sucursal') {
      where.sucursal_id = actor.sucursal_id;
    } else if (filtros.sucursal_id) {
      where.sucursal_id = filtros.sucursal_id;
    }

    const { count, rows } = await Usuario.findAndCountAll({
      where,
      include: [
        { model: Rol, as: 'rol' },
        { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'], required: false },
      ],
      order: [['nombre', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return { total: count, usuarios: rows };
  }

  /**
   * Obtiene la lista de roles
   */
  async listarRoles() {
    return await Rol.findAll({ order: [['id', 'ASC']] });
  }

  /**
   * Crea un usuario validando permisos de tenencia
   */
  async crear(actor, datos) {
    const { nombre, apellido, email, password, telefono, dni, rol_id, sucursal_id } = datos;

    // Si el actor es encargado de sucursal, NO permitimos que cree roles superiores o para otras sucursales
    // (Por defecto el encargado no puede llegar a este método debido al roleGuard en las rutas, 
    // pero agregamos la validación a nivel servicio por seguridad en profundidad).
    if (actor.rol.nombre === 'encargado_sucursal') {
      if (sucursal_id && sucursal_id !== actor.sucursal_id) {
        throw new AppError('No tienes permisos para asignar a otra sucursal', 403, 'FORBIDDEN_BRANCH');
      }
      
      const rolObjetivo = await Rol.findByPk(rol_id);
      if (rolObjetivo.nombre === 'admin_superior') {
        throw new AppError('No tienes permisos para crear administradores', 403, 'FORBIDDEN_ROLE');
      }
    }

    const existe = await Usuario.findOne({ where: { email } });
    if (existe) throw new AppError('Email ya registrado', 409, 'DUPLICATE_EMAIL');

    if (dni) {
      const existeDni = await Usuario.findOne({ where: { dni } });
      if (existeDni) throw new AppError('DNI ya registrado', 409, 'DUPLICATE_DNI');
    }

    return await Usuario.create({
      nombre, apellido, email,
      password_hash: password, // el hook de Sequelize aplica bcrypt
      telefono, dni, rol_id,
      sucursal_id: sucursal_id || null
    });
  }

  /**
   * Actualiza un usuario resolviendo la vulnerabilidad IDOR
   */
  async actualizar(actor, targetId, datos) {
    const usuario = await Usuario.findByPk(targetId, { include: [{ model: Rol, as: 'rol' }] });
    if (!usuario) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

    // MÁXIMA SEGURIDAD: Prevenir IDOR y Escalamiento
    if (actor.rol.nombre === 'encargado_sucursal') {
      // 1. El encargado solo puede editar usuarios de su sucursal
      if (usuario.sucursal_id !== actor.sucursal_id) {
        throw new AppError('No tienes permisos sobre este usuario', 403, 'FORBIDDEN_USER_ACCESS');
      }
      // 2. No puede cambiar a un usuario a otra sucursal
      if (datos.sucursal_id && datos.sucursal_id !== actor.sucursal_id) {
        throw new AppError('No puedes mover usuarios a otra sucursal', 403, 'FORBIDDEN_BRANCH_MOVE');
      }
      // 3. No puede editar a un admin_superior
      if (usuario.rol.nombre === 'admin_superior') {
        throw new AppError('No puedes editar a un administrador', 403, 'FORBIDDEN_ROLE_ACCESS');
      }
    }

    await usuario.update(datos);
    return usuario;
  }

  /**
   * Elimina lógicamente un usuario
   */
  async eliminar(actor, targetId) {
    const usuario = await Usuario.findByPk(targetId);
    if (!usuario) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');

    // Se asume que esta ruta está protegida solo para admin_superior en la capa de rutas.
    await usuario.destroy();
  }

  /**
   * Cambia la contraseña del usuario logueado
   */
  async cambiarPassword(actor, passwordActual, passwordNueva) {
    const usuario = await Usuario.findByPk(actor.id);
    const ok = await usuario.verificarPassword(passwordActual);
    
    if (!ok) {
      throw new AppError('Contraseña actual incorrecta', 401, 'INVALID_PASSWORD');
    }
    
    await usuario.update({ password_hash: passwordNueva });
  }
}

module.exports = new UsuariosService();
