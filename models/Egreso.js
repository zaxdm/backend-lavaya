const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Egreso extends Model {}
Egreso.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  sucursal_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  categoria_egreso_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  registrado_por_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  concepto:            { type: DataTypes.STRING(255), allowNull: false },
  monto:               { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  fecha:               { type: DataTypes.DATEONLY, allowNull: false },
  comprobante_url:     { type: DataTypes.STRING(500), allowNull: true },
  notas:               { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, modelName: 'Egreso', tableName: 'egresos', timestamps: true, paranoid: true });

module.exports = Egreso;