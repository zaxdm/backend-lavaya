'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('roles', [
      {
        nombre: 'admin_superior',
        descripcion: 'Administrador con acceso total',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'encargado_sucursal',
        descripcion: 'Encargado de una sucursal específica',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'empleado',
        descripcion: 'Empleado de lavandería',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'usuario',
        descripcion: 'Cliente que usa los servicios',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'repartidor',
        descripcion: 'Personal de entrega y recogida',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};