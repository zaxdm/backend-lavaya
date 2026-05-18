const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Insumo extends Model {}
Insumo.init({
  id:             { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  sucursal_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  nombre:         { type: DataTypes.STRING(150), allowNull: false },
  unidad:         { type: DataTypes.STRING(30), allowNull: false },
  stock_actual:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  stock_minimo:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  precio_unitario:{ type: DataTypes.DECIMAL(10, 2), allowNull: true },
}, { sequelize, modelName: 'Insumo', tableName: 'insumos', timestamps: true });

module.exports = Insumo;