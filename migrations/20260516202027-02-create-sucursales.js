'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sucursales', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      direccion: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      distrito: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      ciudad: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Trujillo',
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      latitud: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      longitud: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      horario_apertura: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      horario_cierre: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      deletedAt: { type: Sequelize.DATE, allowNull: true }, // soft delete
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sucursales');
  },
};
