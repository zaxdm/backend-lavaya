const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Archivo extends Model {}
Archivo.init({
  id:              { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  entidad_tipo:    { type: DataTypes.ENUM('pedido','pago','egreso','usuario','sucursal'), allowNull: false },
  entidad_id:      { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  subido_por_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  nombre_original: { type: DataTypes.STRING(255), allowNull: false },
  nombre_archivo:  { type: DataTypes.STRING(255), allowNull: false },
  url:             { type: DataTypes.STRING(1000), allowNull: false },
  tipo_mime:       { type: DataTypes.STRING(100), allowNull: true },
  tamaño_bytes:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, modelName: 'Archivo', tableName: 'archivos', timestamps: true });

module.exports = Archivo;