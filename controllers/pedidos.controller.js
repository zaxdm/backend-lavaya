const { Op } = require('sequelize');
const { Pedido, DetallePedido, HistorialPedido, Servicio, Usuario, Sucursal, Pago, Review } = require('../models');

// Genera código legible: LAV-2024-00123
const generarCodigo = async () => {
  const año = new Date().getFullYear();
  const total = await Pedido.count({ paranoid: false });
  const num = String(total + 1).padStart(5, '0');
  return `LAV-${año}-${num}`;
};

// GET /api/pedidos
const listar = async (req, res) => {
  try {
    const { sucursal_id, estado, tipo_servicio, page = 1, limit = 20 } = req.query;
    const { usuario } = req;

    const where = {};

    // Filtro por rol: el cliente solo ve sus pedidos
    if (usuario.rol.nombre === 'usuario') {
      where.usuario_id = usuario.id;
    }
    // El encargado / empleado solo ve su sucursal
    if (['encargado_sucursal', 'empleado'].includes(usuario.rol.nombre)) {
      where.sucursal_id = usuario.sucursal_id;
    }
    // El repartidor solo ve los pedidos asignados a él
    if (usuario.rol.nombre === 'repartidor') {
      where.repartidor_id = usuario.id;
    }

    // Filtros opcionales para admin/encargado
    if (sucursal_id && usuario.rol.nombre === 'admin_superior') where.sucursal_id = sucursal_id;
    if (estado) where.estado = estado;
    if (tipo_servicio) where.tipo_servicio = tipo_servicio;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Pedido.findAndCountAll({
      where,
      include: [
        { model: Usuario, as: 'cliente', attributes: ['id', 'nombre', 'apellido', 'telefono'] },
        { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
        { model: Usuario, as: 'repartidor', attributes: ['id', 'nombre', 'apellido'], required: false },
        { model: DetallePedido, as: 'detalles', include: [{ model: Servicio, as: 'servicio', attributes: ['id', 'nombre', 'tipo_precio'] }] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return res.json({ ok: true, total: count, pagina: parseInt(page), pedidos: rows });
  } catch (error) {
    console.error('pedidos.listar:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al listar pedidos' });
  }
};

// GET /api/pedidos/:id
const obtener = async (req, res) => {
  try {
    const pedido = await Pedido.findByPk(req.params.id, {
      include: [
        { model: Usuario, as: 'cliente', attributes: ['id', 'nombre', 'apellido', 'email', 'telefono'] },
        { model: Sucursal, as: 'sucursal' },
        { model: Usuario, as: 'empleado_recepcion', attributes: ['id', 'nombre', 'apellido'], required: false },
        { model: Usuario, as: 'repartidor', attributes: ['id', 'nombre', 'apellido'], required: false },
        { model: DetallePedido, as: 'detalles', include: [{ model: Servicio, as: 'servicio' }] },
        { model: HistorialPedido, as: 'historial', include: [{ model: Usuario, as: 'responsable', attributes: ['id', 'nombre', 'apellido'], required: false }], order: [['createdAt', 'ASC']] },
        { model: Pago, as: 'pagos' },
        { model: Review, as: 'review', required: false },
      ],
    });

    if (!pedido) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });

    // El cliente solo puede ver su propio pedido
    if (req.usuario.rol.nombre === 'usuario' && pedido.usuario_id !== req.usuario.id) {
      return res.status(403).json({ ok: false, mensaje: 'No autorizado' });
    }
    // Ocultar notas_internas al cliente
    if (req.usuario.rol.nombre === 'usuario') {
      pedido.notas_internas = undefined;
    }

    return res.json({ ok: true, pedido });
  } catch (error) {
    console.error('pedidos.obtener:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener pedido' });
  }
};

// POST /api/pedidos
const crear = async (req, res) => {
  const t = await Pedido.sequelize.transaction();
  try {
    const {
      usuario_id, sucursal_id, tipo_servicio,
      direccion_recojo, latitud_recojo, longitud_recojo,
      direccion_entrega, latitud_entrega, longitud_entrega,
      notas, detalles = [], pago = null, // pago: { metodo_pago, monto, referencia_externa, estado }
    } = req.body;

    // Si es cliente, el pedido es a su nombre
    const clienteId = req.usuario.rol.nombre === 'usuario' ? req.usuario.id : usuario_id;

    // Calcular totales con el precio actual del servicio
    let subtotal = 0;
    const detallesConPrecio = await Promise.all(
      detalles.map(async (d) => {
        const servicio = await Servicio.findByPk(d.servicio_id);
        if (!servicio || !servicio.activo) throw new Error(`Servicio ${d.servicio_id} no disponible`);
        const linea = parseFloat(servicio.precio_base) * parseFloat(d.cantidad);
        subtotal += linea;
        return {
          servicio_id:        d.servicio_id,
          cantidad:           d.cantidad,
          precio_unitario:    servicio.precio_base,
          subtotal:           linea.toFixed(2),
          descripcion_prenda: d.descripcion_prenda || null,
        };
      })
    );

    const costo_delivery = ['delivery', 'recojo_y_entrega'].includes(tipo_servicio) ? 5.00 : 0;
    const total = subtotal + costo_delivery;

    const pedido = await Pedido.create({
      codigo:               await generarCodigo(),
      usuario_id:           clienteId,
      sucursal_id,
      empleado_recepcion_id: ['encargado_sucursal', 'empleado'].includes(req.usuario.rol.nombre) ? req.usuario.id : null,
      tipo_servicio,
      estado:               'recibido',
      direccion_recojo, latitud_recojo, longitud_recojo,
      direccion_entrega, latitud_entrega, longitud_entrega,
      notas,
      subtotal:             subtotal.toFixed(2),
      costo_delivery:       costo_delivery.toFixed(2),
      total:                total.toFixed(2),
    }, { transaction: t });

    await DetallePedido.bulkCreate(
      detallesConPrecio.map((d) => ({ ...d, pedido_id: pedido.id })),
      { transaction: t }
    );

    await HistorialPedido.create({
      pedido_id:      pedido.id,
      usuario_id:     req.usuario.id,
      estado_anterior: null,
      estado_nuevo:   'recibido',
      comentario:     'Pedido creado',
    }, { transaction: t });

    // Si hay un pago adjunto (ej. PayPal)
    if (pago) {
      await Pago.create({
        pedido_id: pedido.id,
        empleado_id: null,
        metodo_pago: pago.metodo_pago,
        monto: pago.monto,
        estado: pago.estado || 'pagado',
        referencia_externa: pago.referencia_externa,
        fecha_pago: new Date()
      }, { transaction: t });
    }

    await t.commit();
    return res.status(201).json({ ok: true, pedido: { ...pedido.toJSON(), detalles: detallesConPrecio } });
  } catch (error) {
    await t.rollback();
    console.error('pedidos.crear:', error);
    return res.status(500).json({ ok: false, mensaje: error.message || 'Error al crear pedido' });
  }
};

// PATCH /api/pedidos/:id/estado
const cambiarEstado = async (req, res) => {
  const t = await Pedido.sequelize.transaction();
  try {
    const { estado, comentario } = req.body;
    const { usuario } = req;
    const pedido = await Pedido.findByPk(req.params.id, { transaction: t });
    
    if (!pedido) { 
      await t.rollback(); 
      return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' }); 
    }

    // Lógica de seguridad por rol
    if (usuario.rol.nombre === 'usuario') {
      // El cliente solo puede cancelar su propio pedido si está en 'recibido'
      if (pedido.usuario_id !== usuario.id) {
        await t.rollback();
        return res.status(403).json({ ok: false, mensaje: 'No autorizado para este pedido' });
      }
      if (estado !== 'cancelado') {
        await t.rollback();
        return res.status(403).json({ ok: false, mensaje: 'El cliente solo puede cancelar el pedido' });
      }
      if (pedido.estado !== 'recibido') {
        await t.rollback();
        return res.status(400).json({ ok: false, mensaje: 'Solo se pueden cancelar pedidos en estado recibido' });
      }
    }

    if (usuario.rol.nombre === 'repartidor') {
      // El repartidor solo puede cambiar estados de pedidos asignados a él
      if (pedido.repartidor_id !== usuario.id) {
        await t.rollback();
        return res.status(403).json({ ok: false, mensaje: 'Este pedido no está asignado a usted' });
      }
      // Solo puede cambiar a estados lógicos de reparto
      if (!['en_reparto', 'entregado'].includes(estado)) {
        await t.rollback();
        return res.status(403).json({ ok: false, mensaje: 'Estado no permitido para repartidor' });
      }
    }

    const estadoAnterior = pedido.estado;
    const extras = {};

    if (estado === 'entregado') extras.fecha_entrega_real = new Date();

    await pedido.update({ estado, ...extras }, { transaction: t });

    await HistorialPedido.create({
      pedido_id:      pedido.id,
      usuario_id:     req.usuario.id,
      estado_anterior: estadoAnterior,
      estado_nuevo:   estado,
      comentario:     comentario || null,
    }, { transaction: t });

    await t.commit();
    return res.json({ ok: true, pedido });
  } catch (error) {
    await t.rollback();
    console.error('pedidos.cambiarEstado:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cambiar estado' });
  }
};

// PATCH /api/pedidos/:id/asignar-repartidor
const asignarRepartidor = async (req, res) => {
  try {
    const { repartidor_id } = req.body;
    const pedido = await Pedido.findByPk(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });

    const repartidor = await Usuario.findByPk(repartidor_id, { include: [{ model: require('../models/Rol'), as: 'rol' }] });
    if (!repartidor || repartidor.rol.nombre !== 'repartidor') {
      return res.status(400).json({ ok: false, mensaje: 'Usuario no es repartidor' });
    }

    await pedido.update({ repartidor_id, estado: 'en_reparto' });
    return res.json({ ok: true, pedido });
  } catch (error) {
    console.error('pedidos.asignarRepartidor:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al asignar repartidor' });
  }
};

module.exports = { listar, obtener, crear, cambiarEstado, asignarRepartidor };
