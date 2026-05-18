'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Categorías de egreso
    await queryInterface.createTable('categorias_egreso', {
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
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.bulkInsert('categorias_egreso', [
      { nombre: 'Insumos',       descripcion: 'Detergente, bolsas, jabón, etc.',      createdAt: new Date(), updatedAt: new Date() },
      { nombre: 'Sueldos',       descripcion: 'Pago de sueldos a empleados',           createdAt: new Date(), updatedAt: new Date() },
      { nombre: 'Servicios',     descripcion: 'Luz, agua, internet, etc.',             createdAt: new Date(), updatedAt: new Date() },
      { nombre: 'Mantenimiento', descripcion: 'Reparación de máquinas y local',        createdAt: new Date(), updatedAt: new Date() },
      { nombre: 'Transporte',    descripcion: 'Combustible, reparación de vehículos',  createdAt: new Date(), updatedAt: new Date() },
      { nombre: 'Otros',         descripcion: 'Gastos varios',                         createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Registro de egresos
    await queryInterface.createTable('egresos', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      sucursal_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      categoria_egreso_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'categorias_egreso', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      registrado_por_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      concepto: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      monto: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      comprobante_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      notas: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('egresos', ['sucursal_id']);
    await queryInterface.addIndex('egresos', ['fecha']);
    await queryInterface.addIndex('egresos', ['categoria_egreso_id']);

    // Inventario de insumos
    await queryInterface.createTable('insumos', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      sucursal_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      unidad: {
        type: Sequelize.STRING(30),
        allowNull: false,
        comment: 'kg, litros, unidades, etc.',
      },
      stock_actual: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      stock_minimo: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Alerta cuando el stock baje de este valor',
      },
      precio_unitario: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('insumos');
    await queryInterface.dropTable('egresos');
    await queryInterface.dropTable('categorias_egreso');
  },
};
