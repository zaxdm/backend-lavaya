'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      nombre: {
        type: Sequelize.ENUM(
          'admin_superior',
          'encargado_sucursal',
          'empleado',
          'repartidor',
          'usuario'
        ),
        allowNull: false,
        unique: true,
      },

      descripcion: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('roles');
  },
};