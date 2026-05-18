const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class CategoriaEgreso extends Model {}
CategoriaEgreso.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nombre:      { type: DataTypes.STRING(100), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(255), allowNull: true },
}, { sequelize, modelName: 'CategoriaEgreso', tableName: 'categorias_egreso', timestamps: true });

module.exports = CategoriaEgreso;