'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuarios', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      rol_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      sucursal_id: {
        // NULL para usuarios/clientes y admin_superior
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nombre: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      apellido: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },
      telefono: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      dni: {
        type: Sequelize.STRING(15),
        allowNull: true,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      foto_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      ultimo_login: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('usuarios', ['email']);
    await queryInterface.addIndex('usuarios', ['rol_id']);
    await queryInterface.addIndex('usuarios', ['sucursal_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuarios');
  },
};
