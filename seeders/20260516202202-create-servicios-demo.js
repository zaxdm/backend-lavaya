'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First insert categories
    await queryInterface.bulkInsert('categorias_servicio', [
      { id: 1, nombre: 'Lavado', descripcion: 'Servicios de lavado de ropa', icono_url: null, activo: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, nombre: 'Secado', descripcion: 'Servicios de secado de ropa', icono_url: null, activo: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 3, nombre: 'Planchado', descripcion: 'Servicios de planchado de ropa', icono_url: null, activo: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 4, nombre: 'Lavado en seco', descripcion: 'Servicios de lavado en seco para prendas delicadas', icono_url: null, activo: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 5, nombre: 'Combo', descripcion: 'Paquetes que incluyen varios servicios', icono_url: null, activo: true, createdAt: new Date(), updatedAt: new Date() }
    ], {});

    // Then insert services
    await queryInterface.bulkInsert('servicios', [
      // Lavado
      { categoria_id: 1, nombre: 'Lavado estándar por kg', descripcion: 'Lavado tradicional por kilogramo', tipo_precio: 'por_kg', precio_base: 2.50, tiempo_estimado_horas: 2, activo: true, createdAt: new Date(), updatedAt: new Date() },
      { categoria_id: 1, nombre: 'Lavado express por prenda', descripcion: 'Lavado rápido por prenda individual', tipo_precio: 'por_prenda', precio_base: 3.00, tiempo_estimado_horas: 1, activo: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Secado
      { categoria_id: 2, nombre: 'Secado en máquina', descripcion: 'Secado automático en secadora', tipo_precio: 'por_kg', precio_base: 1.50, tiempo_estimado_horas: 1, activo: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Planchado
      { categoria_id: 3, nombre: 'Planchado sencillo', descripcion: 'Planchado básico de prendas', tipo_precio: 'por_prenda', precio_base: 2.00, tiempo_estimado_horas: 1, activo: true, createdAt: new Date(), updatedAt: new Date() },
      { categoria_id: 3, nombre: 'Planchado detallado', descripcion: 'Planchado con atención a detalles y doblez perfecto', tipo_precio: 'por_prenda', precio_base: 3.50, tiempo_estimado_horas: 2, activo: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Lavado en seco
      { categoria_id: 4, nombre: 'Lavado en seco estándar', descripcion: 'Lavado en seco para trajes y delicados', tipo_precio: 'por_prenda', precio_base: 8.00, tiempo_estimado_horas: 24, activo: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Combos
      { categoria_id: 5, nombre: 'Paquete Básico', descripcion: 'Lavado + Secado + Planchado sencillo', tipo_precio: 'paquete', precio_base: 5.00, tiempo_estimado_horas: 3, activo: true, createdAt: new Date(), updatedAt: new Date() },
      { categoria_id: 5, nombre: 'Paquete Premium', descripcion: 'Lavado express + Secado + Planchado detallado', tipo_precio: 'paquete', precio_base: 8.50, tiempo_estimado_horas: 3, activo: true, createdAt: new Date(), updatedAt: new Date() }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('servicios', null, {});
    await queryInterface.bulkDelete('categorias_servicio', null, {});
  }
};