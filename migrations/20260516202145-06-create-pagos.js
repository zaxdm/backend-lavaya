'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pagos', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      pedido_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'pedidos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      empleado_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Empleado que registró el pago',
      },
      // 'efectivo' | 'tarjeta' | 'yape' | 'plin' | 'transferencia'
      metodo_pago: {
        type: Sequelize.ENUM('efectivo', 'tarjeta', 'yape', 'plin', 'transferencia'),
        allowNull: false,
      },
      // 'pendiente' | 'pagado' | 'parcial' | 'reembolsado'
      estado: {
        type: Sequelize.ENUM('pendiente', 'pagado', 'parcial', 'reembolsado'),
        allowNull: false,
        defaultValue: 'pendiente',
      },
      monto: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      referencia_externa: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Número de operación Yape/Plin/transferencia',
      },
      comprobante_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Foto del comprobante de pago',
      },
      // 'boleta' | 'factura' | 'ninguno'
      tipo_comprobante: {
        type: Sequelize.ENUM('boleta', 'factura', 'ninguno'),
        allowNull: false,
        defaultValue: 'ninguno',
      },
      numero_comprobante: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      fecha_pago: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('pagos', ['pedido_id']);
    await queryInterface.addIndex('pagos', ['estado']);
    await queryInterface.addIndex('pagos', ['metodo_pago']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pagos');
  },
};
