const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

// ─── CategoriaServicio ───────────────────────────────────────────────────────
class CategoriaServicio extends Model {}
CategoriaServicio.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nombre:      { type: DataTypes.STRING(100), allowNull: false, unique: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  icono_url:   { type: DataTypes.STRING(500), allowNull: true },
  activo:      { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'CategoriaServicio', tableName: 'categorias_servicio', timestamps: true });

// ─── Servicio ────────────────────────────────────────────────────────────────
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

// ─── Pedido ──────────────────────────────────────────────────────────────────
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

// ─── DetallePedido ───────────────────────────────────────────────────────────
class DetallePedido extends Model {}
DetallePedido.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  servicio_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  cantidad:            { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  precio_unitario:     { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  subtotal:            { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  descripcion_prenda:  { type: DataTypes.STRING(255), allowNull: true },
}, { sequelize, modelName: 'DetallePedido', tableName: 'detalle_pedidos', timestamps: true });

// ─── HistorialPedido ─────────────────────────────────────────────────────────
class HistorialPedido extends Model {}
HistorialPedido.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  usuario_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  estado_anterior:  { type: DataTypes.STRING(50), allowNull: true },
  estado_nuevo:     { type: DataTypes.STRING(50), allowNull: false },
  comentario:       { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, modelName: 'HistorialPedido', tableName: 'historial_pedidos', timestamps: true });

// ─── Pago ────────────────────────────────────────────────────────────────────
class Pago extends Model {}
Pago.init({
  id:                  { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  pedido_id:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  empleado_id:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  metodo_pago:         { type: DataTypes.ENUM('efectivo','tarjeta','yape','plin','transferencia'), allowNull: false },
  estado:              { type: DataTypes.ENUM('pendiente','pagado','parcial','reembolsado'), allowNull: false, defaultValue: 'pendiente' },
  monto:               { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  referencia_externa:  { type: DataTypes.STRING(200), allowNull: true },
  comprobante_url:     { type: DataTypes.STRING(500), allowNull: true },
  tipo_comprobante:    { type: DataTypes.ENUM('boleta','factura','ninguno'), allowNull: false, defaultValue: 'ninguno' },
  numero_comprobante:  { type: DataTypes.STRING(50), allowNull: true },
  notas:               { type: DataTypes.TEXT, allowNull: true },
  fecha_pago:          { type: DataTypes.DATE, allowNull: true },
}, { sequelize, modelName: 'Pago', tableName: 'pagos', timestamps: true });

// ─── CategoriaEgreso ─────────────────────────────────────────────────────────
class CategoriaEgreso extends Model {}
CategoriaEgreso.init({
  id:          { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nombre:      { type: DataTypes.STRING(100), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(255), allowNull: true },
}, { sequelize, modelName: 'CategoriaEgreso', tableName: 'categorias_egreso', timestamps: true });

// ─── Egreso ──────────────────────────────────────────────────────────────────
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

// ─── Insumo ──────────────────────────────────────────────────────────────────
class Insumo extends Model {}
Insumo.init({
  id:             { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  sucursal_id:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  nombre:         { type: DataTypes.STRING(150), allowNull: false },
  unidad:         { type: DataTypes.STRING(30), allowNull: false },
  stock_actual:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  stock_minimo:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  precio_unitario:{ type: DataTypes.DECIMAL(10, 2), allowNull: true },
}, { sequelize, modelName: 'Insumo', tableName: 'insumos', timestamps: true });

// ─── Review ──────────────────────────────────────────────────────────────────
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

// ─── Archivo ─────────────────────────────────────────────────────────────────
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

module.exports = { CategoriaServicio, Servicio, Pedido, DetallePedido, HistorialPedido, Pago, CategoriaEgreso, Egreso, Insumo, Review, Archivo };
