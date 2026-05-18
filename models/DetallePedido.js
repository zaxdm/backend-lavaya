const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class DetallePedido extends Model {}
DetallePedido.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  servicio_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  cantidad:            { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  precio_unitario:     { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  subtotal:            { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  descripcion_prenda:  { type: DataTypes.STRING(255), allowNull: true },
}, { sequelize, modelName: 'DetallePedido', tableName: 'detalle_pedidos', timestamps: true });

module.exports = DetallePedido;