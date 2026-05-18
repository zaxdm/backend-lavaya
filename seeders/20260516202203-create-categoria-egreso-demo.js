'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('categorias_egreso', [
      {
        id: 1,
        nombre: 'Alquiler',
        descripcion: 'Pago de alquiler de locales',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        nombre: 'Servicios',
        descripcion: 'Electricidad, agua, internet, teléfono',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 3,
        nombre: 'Nómina',
        descripcion: 'Sueldos y salarios de empleados',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 4,
        nombre: 'Insumos',
        descripcion: 'Detergentes, suavizantes, bolsas, etc.',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 5,
        nombre: 'Mantenimiento',
        descripcion: 'Reparaciones y mantenimiento de equipos',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 6,
        nombre: 'Marketing',
        descripcion: 'Publicidad y promoción',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 7,
        nombre: 'Impuestos',
        descripcion: 'Pago de impuestos y tasas municipales',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 8,
        nombre: 'Otros',
        descripcion: 'Gastos diversos no clasificados',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('categorias_egreso', null, {});
  }
};