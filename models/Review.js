const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Review extends Model {}
Review.init({
  id:                { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  usuario_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sucursal_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  calificacion:      { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { min: 1, max: 5 } },
  comentario:        { type: DataTypes.TEXT, allowNull: true },
  respuesta_empresa: { type: DataTypes.TEXT, allowNull: true },
  visible:           { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'Review', tableName: 'reviews', timestamps: true });

module.exports = Review;