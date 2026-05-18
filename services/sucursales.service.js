const { Sucursal, Usuario } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Servicio para la gestión de Sucursales.
 * Contiene la lógica de negocio y consultas a base de datos.
 */
class SucursalesService {
  
  /**
   * Obtiene todas las sucursales.
   * @param {Object} filtros - Filtros opcionales (ej. activo: true)
   * @returns {Promise<Array>} Lista de sucursales
   */
  async listar(filtros = {}) {
    // Por defecto listamos solo las activas, pero permitimos override
    const where = filtros.activo !== undefined ? { activo: filtros.activo } : { activo: true };
    
    return await Sucursal.findAll({
      where,
      order: [['nombre', 'ASC']]
    });
  }

  /**
   * Obtiene una sucursal por su ID, incluyendo empleados si es requerido.
   * @param {number} id - ID de la sucursal
   * @returns {Promise<Object>} Sucursal encontrada
   */
  async obtenerPorId(id) {
    const sucursal = await Sucursal.findByPk(id, {
      include: [
        { model: Usuario, as: 'empleados', attributes: ['id', 'nombre', 'apellido', '$rol.nombre$'], required: false },
      ],
    });

    if (!sucursal) {
      throw new AppError('Sucursal no encontrada', 404, 'SUCURSAL_NOT_FOUND');
    }

    return sucursal;
  }

  /**
   * Crea una nueva sucursal.
   * @param {Object} datos - Datos de la sucursal
   * @returns {Promise<Object>} Sucursal creada
   */
  async crear(datos) {
    return await Sucursal.create(datos);
  }

  /**
   * Actualiza una sucursal existente.
   * @param {number} id - ID de la sucursal
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Sucursal actualizada
   */
  async actualizar(id, datos) {
    const sucursal = await Sucursal.findByPk(id);
    
    if (!sucursal) {
      throw new AppError('Sucursal no encontrada', 404, 'SUCURSAL_NOT_FOUND');
    }

    return await sucursal.update(datos);
  }

  /**
   * Elimina lógicamente una sucursal (soft delete).
   * @param {number} id - ID de la sucursal
   * @returns {Promise<void>}
   */
  async eliminar(id) {
    const sucursal = await Sucursal.findByPk(id);
    
    if (!sucursal) {
      throw new AppError('Sucursal no encontrada', 404, 'SUCURSAL_NOT_FOUND');
    }

    await sucursal.destroy();
  }
}

module.exports = new SucursalesService();
