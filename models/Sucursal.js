const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Sucursal extends Model {}
Sucursal.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nombre:           { type: DataTypes.STRING(100), allowNull: false },
  direccion:        { type: DataTypes.STRING(255), allowNull: false },
  distrito:         { type: DataTypes.STRING(100), allowNull: true },
  ciudad:           { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Trujillo' },
  telefono:         { type: DataTypes.STRING(20), allowNull: true },
  email:            { type: DataTypes.STRING(100), allowNull: true },
  latitud:          { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  longitud:         { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  activo:           { type: DataTypes.BOOLEAN, defaultValue: true },
  horario_apertura: { type: DataTypes.TIME, allowNull: true },
  horario_cierre:   { type: DataTypes.TIME, allowNull: true },
}, {
  sequelize,
  modelName: 'Sucursal',
  tableName:  'sucursales',
  timestamps: true,
  paranoid:   true, // soft delete → deletedAt
});

module.exports = Sucursal;
