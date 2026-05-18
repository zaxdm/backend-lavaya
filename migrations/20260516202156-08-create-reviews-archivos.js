'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Reviews / Comentarios del cliente
    await queryInterface.createTable('reviews', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      pedido_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true, // 1 review por pedido
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      usuario_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sucursal_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      calificacion: {
        // 1 a 5 estrellas
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
      },
      comentario: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      respuesta_empresa: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Respuesta del encargado/admin a la reseña',
      },
      visible: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('reviews', ['sucursal_id']);
    await queryInterface.addIndex('reviews', ['usuario_id']);

    // Archivos multimedia (fotos de prendas, comprobantes, etc.)
    await queryInterface.createTable('archivos', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      entidad_tipo: {
        // 'pedido' | 'pago' | 'egreso' | 'usuario' | 'sucursal'
        type: Sequelize.ENUM('pedido', 'pago', 'egreso', 'usuario', 'sucursal'),
        allowNull: false,
        comment: 'Tabla a la que pertenece el archivo',
      },
      entidad_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'ID del registro al que pertenece',
      },
      subido_por_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      nombre_original: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      nombre_archivo: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Nombre con que se guardó en el servidor/nube',
      },
      url: {
        type: Sequelize.STRING(1000),
        allowNull: false,
      },
      tipo_mime: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      tamaño_bytes: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('archivos', ['entidad_tipo', 'entidad_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('archivos');
    await queryInterface.dropTable('reviews');
  },
};
