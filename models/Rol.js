// ─── Rol.js ──────────────────────────────────────────────────────────────────
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Rol extends Model {}
Rol.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nombre:      { type: DataTypes.ENUM('admin_superior','encargado_sucursal','empleado','repartidor','usuario'), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(255), allowNull: true },
}, { sequelize, modelName: 'Rol', tableName: 'roles', timestamps: true });

module.exports = Rol;
