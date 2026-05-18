const sequelize = require('../config/database');

const Rol             = require('./Rol');
const Sucursal        = require('./Sucursal');
const Usuario         = require('./Usuario');
const CategoriaServicio = require('./CategoriaServicio');
const Servicio        = require('./Servicio');
const Pedido          = require('./Pedido');
const DetallePedido   = require('./DetallePedido');
const HistorialPedido = require('./HistorialPedido');
const Pago            = require('./Pago');
const CategoriaEgreso = require('./CategoriaEgreso');
const Egreso          = require('./Egreso');
const Insumo          = require('./Insumo');
const Review          = require('./Review');
const Archivo         = require('./Archivo');

// ─── Rol ↔ Usuario ───────────────────────────────────────────────────────────
Rol.hasMany(Usuario, { foreignKey: 'rol_id', as: 'usuarios' });
Usuario.belongsTo(Rol, { foreignKey: 'rol_id', as: 'rol' });

// ─── Sucursal ↔ Usuario ───────────────────────────────────────────────────────
Sucursal.hasMany(Usuario, { foreignKey: 'sucursal_id', as: 'empleados' });
Usuario.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });

// ─── Sucursal ↔ Pedido ───────────────────────────────────────────────────────
Sucursal.hasMany(Pedido, { foreignKey: 'sucursal_id', as: 'pedidos' });
Pedido.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });

// ─── Usuario (cliente) ↔ Pedido ──────────────────────────────────────────────
Usuario.hasMany(Pedido, { foreignKey: 'usuario_id', as: 'pedidos' });
Pedido.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'cliente' });

// ─── Usuario (empleado recepción) ↔ Pedido ───────────────────────────────────
Usuario.hasMany(Pedido, { foreignKey: 'empleado_recepcion_id', as: 'pedidos_recibidos' });
Pedido.belongsTo(Usuario, { foreignKey: 'empleado_recepcion_id', as: 'empleado_recepcion' });

// ─── Usuario (repartidor) ↔ Pedido ───────────────────────────────────────────
Usuario.hasMany(Pedido, { foreignKey: 'repartidor_id', as: 'repartos' });
Pedido.belongsTo(Usuario, { foreignKey: 'repartidor_id', as: 'repartidor' });

// ─── Pedido ↔ DetallePedido ──────────────────────────────────────────────────
Pedido.hasMany(DetallePedido, { foreignKey: 'pedido_id', as: 'detalles' });
DetallePedido.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });

// ─── Servicio ↔ DetallePedido ────────────────────────────────────────────────
Servicio.hasMany(DetallePedido, { foreignKey: 'servicio_id', as: 'detalles' });
DetallePedido.belongsTo(Servicio, { foreignKey: 'servicio_id', as: 'servicio' });

// ─── CategoriaServicio ↔ Servicio ────────────────────────────────────────────
CategoriaServicio.hasMany(Servicio, { foreignKey: 'categoria_id', as: 'servicios' });
Servicio.belongsTo(CategoriaServicio, { foreignKey: 'categoria_id', as: 'categoria' });

// ─── Pedido ↔ HistorialPedido ────────────────────────────────────────────────
Pedido.hasMany(HistorialPedido, { foreignKey: 'pedido_id', as: 'historial' });
HistorialPedido.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
Usuario.hasMany(HistorialPedido, { foreignKey: 'usuario_id', as: 'cambios_estado' });
HistorialPedido.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'responsable' });

// ─── Pedido ↔ Pago ───────────────────────────────────────────────────────────
Pedido.hasMany(Pago, { foreignKey: 'pedido_id', as: 'pagos' });
Pago.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
Usuario.hasMany(Pago, { foreignKey: 'empleado_id', as: 'pagos_registrados' });
Pago.belongsTo(Usuario, { foreignKey: 'empleado_id', as: 'empleado' });

// ─── CategoriaEgreso ↔ Egreso ────────────────────────────────────────────────
CategoriaEgreso.hasMany(Egreso, { foreignKey: 'categoria_egreso_id', as: 'egresos' });
Egreso.belongsTo(CategoriaEgreso, { foreignKey: 'categoria_egreso_id', as: 'categoria' });

// ─── Sucursal ↔ Egreso ───────────────────────────────────────────────────────
Sucursal.hasMany(Egreso, { foreignKey: 'sucursal_id', as: 'egresos' });
Egreso.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });
Usuario.hasMany(Egreso, { foreignKey: 'registrado_por_id', as: 'egresos_registrados' });
Egreso.belongsTo(Usuario, { foreignKey: 'registrado_por_id', as: 'registrado_por' });

// ─── Sucursal ↔ Insumo ───────────────────────────────────────────────────────
Sucursal.hasMany(Insumo, { foreignKey: 'sucursal_id', as: 'insumos' });
Insumo.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });

// ─── Pedido ↔ Review ─────────────────────────────────────────────────────────
Pedido.hasOne(Review, { foreignKey: 'pedido_id', as: 'review' });
Review.belongsTo(Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
Usuario.hasMany(Review, { foreignKey: 'usuario_id', as: 'reviews' });
Review.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'cliente' });
Sucursal.hasMany(Review, { foreignKey: 'sucursal_id', as: 'reviews' });
Review.belongsTo(Sucursal, { foreignKey: 'sucursal_id', as: 'sucursal' });

module.exports = {
  sequelize,
  Rol,
  Sucursal,
  Usuario,
  CategoriaServicio,
  Servicio,
  Pedido,
  DetallePedido,
  HistorialPedido,
  Pago,
  CategoriaEgreso,
  Egreso,
  Insumo,
  Review,
  Archivo,
};
