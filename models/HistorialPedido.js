const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class HistorialPedido extends Model {}
HistorialPedido.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  usuario_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  estado_anterior:  { type: DataTypes.STRING(50), allowNull: true },
  estado_nuevo:     { type: DataTypes.STRING(50), allowNull: false },
  comentario:       { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, modelName: 'HistorialPedido', tableName: 'historial_pedidos', timestamps: true });

module.exports = HistorialPedido;