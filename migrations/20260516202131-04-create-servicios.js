'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Categorías de servicio (Lavado, Secado, Planchado, Lavado en seco, etc.)
    await queryInterface.createTable('categorias_servicio', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      icono_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Servicios concretos con precios
    await queryInterface.createTable('servicios', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      categoria_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'categorias_servicio', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // 'por_kg' | 'por_prenda' | 'paquete'
      tipo_precio: {
        type: Sequelize.ENUM('por_kg', 'por_prenda', 'paquete'),
        allowNull: false,
        defaultValue: 'por_kg',
      },
      precio_base: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      tiempo_estimado_horas: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Tiempo estimado de procesamiento en horas',
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('servicios');
    await queryInterface.dropTable('categorias_servicio');
  },
};
