'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pedidos', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo: {
        // Código legible ej: LAV-2024-00123
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true,
      },
      usuario_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      sucursal_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      empleado_recepcion_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Empleado que recibió el pedido',
      },
      repartidor_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // 'presencial' | 'delivery' | 'recojo_a_domicilio'
      tipo_servicio: {
        type: Sequelize.ENUM('presencial', 'delivery', 'recojo_a_domicilio', 'recojo_y_entrega'),
        allowNull: false,
      },
      // 'recibido' | 'lavando' | 'secando' | 'planchando' | 'listo' | 'en_reparto' | 'entregado' | 'cancelado'
      estado: {
        type: Sequelize.ENUM(
          'recibido',
          'lavando',
          'secando',
          'planchando',
          'listo',
          'en_reparto',
          'entregado',
          'cancelado'
        ),
        allowNull: false,
        defaultValue: 'recibido',
      },
      // Dirección de recojo (si aplica)
      direccion_recojo: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      latitud_recojo: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      longitud_recojo: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      // Dirección de entrega (si aplica)
      direccion_entrega: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      latitud_entrega: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      longitud_entrega: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      peso_kg: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true,
        comment: 'Peso total en kg (se llena al recibir)',
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      descuento: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      costo_delivery: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Instrucciones especiales del cliente',
      },
      notas_internas: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notas solo visibles para empleados',
      },
      fecha_estimada_entrega: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      fecha_entrega_real: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('pedidos', ['codigo']);
    await queryInterface.addIndex('pedidos', ['usuario_id']);
    await queryInterface.addIndex('pedidos', ['sucursal_id']);
    await queryInterface.addIndex('pedidos', ['estado']);
    await queryInterface.addIndex('pedidos', ['repartidor_id']);

    // Detalle de pedido (qué servicios incluye)
    await queryInterface.createTable('detalle_pedidos', {
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
        onDelete: 'CASCADE',
      },
      servicio_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'servicios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      cantidad: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
        comment: 'kg o número de prendas según tipo_precio',
      },
      precio_unitario: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Precio al momento del pedido (snapshot)',
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      descripcion_prenda: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Descripción libre ej: camisa blanca, pantalón azul',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Historial de estados del pedido
    await queryInterface.createTable('historial_pedidos', {
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
        onDelete: 'CASCADE',
      },
      usuario_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Empleado que realizó el cambio de estado',
      },
      estado_anterior: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      estado_nuevo: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      comentario: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('historial_pedidos');
    await queryInterface.dropTable('detalle_pedidos');
    await queryInterface.dropTable('pedidos');
  },
};
