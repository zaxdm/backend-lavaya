const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Pedido extends Model {}
Pedido.init({
  id:                      { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  codigo:                  { type: DataTypes.STRING(30), allowNull: false, unique: true },
  usuario_id:              { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  sucursal_id:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  empleado_recepcion_id:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  repartidor_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  tipo_servicio:           { type: DataTypes.ENUM('presencial', 'delivery', 'recojo_a_domicilio', 'recojo_y_entrega'), allowNull: false },
  estado:                  { type: DataTypes.ENUM('recibido','lavando','secando','planchando','listo','en_reparto','entregado','cancelado'), allowNull: false, defaultValue: 'recibido' },
  direccion_recojo:        { type: DataTypes.STRING(300), allowNull: true },
  latitud_recojo:          { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  longitud_recojo:         { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  direccion_entrega:       { type: DataTypes.STRING(300), allowNull: true },
  latitud_entrega:         { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  longitud_entrega:        { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  peso_kg:                 { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  subtotal:                { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  descuento:               { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  costo_delivery:          { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total:                   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  notas:                   { type: DataTypes.TEXT, allowNull: true },
  notas_internas:          { type: DataTypes.TEXT, allowNull: true },
  fecha_estimada_entrega:  { type: DataTypes.DATE, allowNull: true },
  fecha_entrega_real:      { type: DataTypes.DATE, allowNull: true },
}, { sequelize, modelName: 'Pedido', tableName: 'pedidos', timestamps: true, paranoid: true });

module.exports = Pedido;