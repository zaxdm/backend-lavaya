'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('sucursales', [
      {
        id: 1,
        nombre: 'Sucursal Central',
        direccion: 'Av. Principal 123',
        telefono: '555-1234',
        distrito: 'Centro',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        nombre: 'Sucursal Norte',
        direccion: 'Calle Norte 456',
        telefono: '555-5678',
        distrito: 'Norte',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('sucursales', null, {});
  }
};