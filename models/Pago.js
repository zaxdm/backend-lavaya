const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Pago extends Model {}
Pago.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  empleado_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  metodo_pago:         { type: DataTypes.ENUM('efectivo','paypal'), allowNull: false },
  estado:              { type: DataTypes.ENUM('pendiente','pagado','parcial','reembolsado'), allowNull: false, defaultValue: 'pendiente' },
  monto:               { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  referencia_externa:  { type: DataTypes.STRING(200), allowNull: true },
  comprobante_url:     { type: DataTypes.STRING(500), allowNull: true },
  tipo_comprobante:    { type: DataTypes.ENUM('boleta','factura','ninguno'), allowNull: false, defaultValue: 'ninguno' },
  numero_comprobante:  { type: DataTypes.STRING(50), allowNull: true },
  notas:               { type: DataTypes.TEXT, allowNull: true },
  fecha_pago:          { type: DataTypes.DATE, allowNull: true },
}, { sequelize, modelName: 'Pago', tableName: 'pagos', timestamps: true });

module.exports = Pago;