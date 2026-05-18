const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class CategoriaServicio extends Model {}
CategoriaServicio.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nombre:      { type: DataTypes.STRING(100), allowNull: false, unique: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  icono_url:   { type: DataTypes.STRING(500), allowNull: true },
  activo:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'CategoriaServicio', tableName: 'categorias_servicio', timestamps: true });

module.exports = CategoriaServicio;