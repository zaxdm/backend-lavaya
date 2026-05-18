const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Servicio extends Model {}
Servicio.init({
  id:                      { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  categoria_id:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  nombre:                  { type: DataTypes.STRING(150), allowNull: false },
  descripcion:             { type: DataTypes.TEXT, allowNull: true },
  tipo_precio:             { type: DataTypes.ENUM('por_kg', 'por_prenda', 'paquete'), allowNull: false, defaultValue: 'por_kg' },
  precio_base:             { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  tiempo_estimado_horas:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  activo:                  { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'Servicio', tableName: 'servicios', timestamps: true });

module.exports = Servicio;