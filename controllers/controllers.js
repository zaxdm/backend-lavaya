// ════════════════════════════════════════════════════════════
//  usuarios.controller.js
// ════════════════════════════════════════════════════════════
const { Usuario, Rol, Sucursal } = require('../models');

const listarUsuarios = async (req, res) => {
  try {
    const { rol, sucursal_id, activo } = req.query;
    const where = {};
    if (rol)         where['$rol.nombre$']   = rol;
    if (activo !== undefined) where.activo   = activo === 'true';

    // Encargado solo ve su sucursal
    if (req.usuario.rol.nombre === 'encargado_sucursal') where.sucursal_id = req.usuario.sucursal_id;
    else if (sucursal_id) where.sucursal_id = sucursal_id;

    const usuarios = await Usuario.findAll({
      where,
      include: [
        { model: Rol, as: 'rol' },
        { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'], required: false },
      ],
      order: [['nombre', 'ASC']],
    });
    return res.json({ ok: true, usuarios });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al listar usuarios' });
  }
};

const listarRoles = async (req, res) => {
  try {
    const roles = await Rol.findAll({
      order: [['id', 'ASC']],
    });
    return res.json({ ok: true, roles });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al listar roles' });
  }
};

const crearUsuario = async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, dni, rol_id, sucursal_id } = req.body;
    
    // Validar campos obligatorios
    if (!nombre || !apellido || !email || !password || !rol_id) {
      return res.status(400).json({ ok: false, mensaje: 'Faltan campos obligatorios' });
    }

    const existe = await Usuario.findOne({ where: { email } });
    if (existe) return res.status(409).json({ ok: false, mensaje: 'Email ya registrado' });

    // Validar DNI si se proporciona
    if (dni) {
      const existeDni = await Usuario.findOne({ where: { dni } });
      if (existeDni) return res.status(409).json({ ok: false, mensaje: 'DNI ya registrado' });
    }

    const usuario = await Usuario.create({ 
      nombre, 
      apellido, 
      email, 
      password_hash: password, 
      telefono, 
      dni, 
      rol_id, 
      sucursal_id: sucursal_id || null // Asegurar que sea null si viene vacío
    });
    
    return res.status(201).json({ ok: true, usuario: usuario.toJSON() });
  } catch (e) {
    console.error('Error en crearUsuario:', e);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear usuario', error: e.message });
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });

    const { nombre, apellido, telefono, dni, activo, sucursal_id, foto_url } = req.body;
    await usuario.update({ nombre, apellido, telefono, dni, activo, sucursal_id, foto_url });
    return res.json({ ok: true, usuario: usuario.toJSON() });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar usuario' });
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    await usuario.destroy(); // soft delete
    return res.json({ ok: true, mensaje: 'Usuario eliminado' });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar usuario' });
  }
};

const cambiarPassword = async (req, res) => {
  try {
    const { password_actual, password_nueva } = req.body;
    const usuario = await Usuario.findByPk(req.usuario.id);
    const ok = await usuario.verificarPassword(password_actual);
    if (!ok) return res.status(401).json({ ok: false, mensaje: 'Contraseña actual incorrecta' });
    await usuario.update({ password_hash: password_nueva });
    return res.json({ ok: true, mensaje: 'Contraseña actualizada' });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al cambiar contraseña' });
  }
};

exports.usuarios = { listarUsuarios, listarRoles, crearUsuario, actualizarUsuario, eliminarUsuario, cambiarPassword };


// ════════════════════════════════════════════════════════════
//  sucursales.controller.js
// ════════════════════════════════════════════════════════════
const { Sucursal: S, Usuario: U, Review: R } = require('../models');
const { fn, col } = require('sequelize');

const listarSucursales = async (req, res) => {
  try {
    const sucursales = await S.findAll({ where: { activo: true }, order: [['nombre', 'ASC']] });
    return res.json({ ok: true, sucursales });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al listar sucursales' });
  }
};

const obtenerSucursal = async (req, res) => {
  try {
    const s = await S.findByPk(req.params.id, {
      include: [
        { model: U, as: 'empleados', attributes: ['id', 'nombre', 'apellido', '$rol.nombre$'], required: false },
      ],
    });
    if (!s) return res.status(404).json({ ok: false, mensaje: 'Sucursal no encontrada' });
    return res.json({ ok: true, sucursal: s });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener sucursal' });
  }
};

const crearSucursal = async (req, res) => {
  try {
    const s = await S.create(req.body);
    return res.status(201).json({ ok: true, sucursal: s });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al crear sucursal' });
  }
};

const actualizarSucursal = async (req, res) => {
  try {
    const s = await S.findByPk(req.params.id);
    if (!s) return res.status(404).json({ ok: false, mensaje: 'Sucursal no encontrada' });
    await s.update(req.body);
    return res.json({ ok: true, sucursal: s });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar sucursal' });
  }
};

exports.sucursales = { listarSucursales, obtenerSucursal, crearSucursal, actualizarSucursal };


// ════════════════════════════════════════════════════════════
//  pagos.controller.js
// ════════════════════════════════════════════════════════════
const { Pago, Pedido: Ped } = require('../models');

const registrarPago = async (req, res) => {
  try {
    const { pedido_id, metodo_pago, monto, referencia_externa, tipo_comprobante, numero_comprobante, notas } = req.body;
    const pedido = await Ped.findByPk(pedido_id);
    if (!pedido) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });

    const pago = await Pago.create({
      pedido_id, metodo_pago, monto,
      estado: 'pagado',
      empleado_id: req.usuario.id,
      referencia_externa, tipo_comprobante, numero_comprobante, notas,
      fecha_pago: new Date(),
    });

    return res.status(201).json({ ok: true, pago });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al registrar pago' });
  }
};

const listarPagos = async (req, res) => {
  try {
    const { pedido_id } = req.query;
    const where = pedido_id ? { pedido_id } : {};
    const pagos = await Pago.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.json({ ok: true, pagos });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al listar pagos' });
  }
};

exports.pagos = { registrarPago, listarPagos };


// ════════════════════════════════════════════════════════════
//  egresos.controller.js
// ════════════════════════════════════════════════════════════
const { Egreso, CategoriaEgreso } = require('../models');
const { Op: OPE } = require('sequelize');

const listarEgresos = async (req, res) => {
  try {
    const { desde, hasta, categoria_egreso_id } = req.query;
    const { usuario } = req;
    const where = {};

    if (usuario.rol.nombre !== 'admin_superior') where.sucursal_id = usuario.sucursal_id;
    if (desde && hasta) where.fecha = { [OPE.between]: [desde, hasta] };
    if (categoria_egreso_id) where.categoria_egreso_id = categoria_egreso_id;

    const egresos = await Egreso.findAll({
      where,
      include: [{ model: CategoriaEgreso, as: 'categoria' }],
      order: [['fecha', 'DESC']],
    });
    return res.json({ ok: true, egresos });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al listar egresos' });
  }
};

const crearEgreso = async (req, res) => {
  try {
    const { sucursal_id, categoria_egreso_id, concepto, monto, fecha, notas } = req.body;
    const egreso = await Egreso.create({
      sucursal_id: req.usuario.rol.nombre !== 'admin_superior' ? req.usuario.sucursal_id : sucursal_id,
      categoria_egreso_id, concepto, monto, fecha, notas,
      registrado_por_id: req.usuario.id,
    });
    return res.status(201).json({ ok: true, egreso });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al crear egreso' });
  }
};

const eliminarEgreso = async (req, res) => {
  try {
    const egreso = await Egreso.findByPk(req.params.id);
    if (!egreso) return res.status(404).json({ ok: false, mensaje: 'Egreso no encontrado' });
    await egreso.destroy();
    return res.json({ ok: true, mensaje: 'Egreso eliminado' });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar egreso' });
  }
};

const listarCategoriasEgreso = async (req, res) => {
  try {
    const categorias = await CategoriaEgreso.findAll({ order: [['nombre', 'ASC']] });
    return res.json({ ok: true, categorias });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener categorías de egreso' });
  }
};

exports.egresos = { listarEgresos, crearEgreso, eliminarEgreso, listarCategoriasEgreso };


// ════════════════════════════════════════════════════════════
//  reviews.controller.js
// ════════════════════════════════════════════════════════════
const { Review: Rev, Pedido: PD, Usuario: US } = require('../models');

const crearReview = async (req, res) => {
  try {
    const { pedido_id, calificacion, comentario } = req.body;
    const pedido = await PD.findByPk(pedido_id);
    if (!pedido) return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado' });
    if (pedido.usuario_id !== req.usuario.id) return res.status(403).json({ ok: false, mensaje: 'No autorizado' });
    if (pedido.estado !== 'entregado') return res.status(400).json({ ok: false, mensaje: 'Solo puedes calificar pedidos entregados' });

    const yaExiste = await Rev.findOne({ where: { pedido_id } });
    if (yaExiste) return res.status(409).json({ ok: false, mensaje: 'Ya calificaste este pedido' });

    const review = await Rev.create({ pedido_id, usuario_id: req.usuario.id, sucursal_id: pedido.sucursal_id, calificacion, comentario });
    return res.status(201).json({ ok: true, review });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al crear review' });
  }
};

const listarReviews = async (req, res) => {
  try {
    const { sucursal_id } = req.query;
    const where = { visible: true };
    if (sucursal_id) where.sucursal_id = sucursal_id;
    const reviews = await Rev.findAll({ where, include: [{ model: US, as: 'cliente', attributes: ['id', 'nombre', 'apellido'] }], order: [['createdAt', 'DESC']] });
    return res.json({ ok: true, reviews });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al listar reviews' });
  }
};

const responderReview = async (req, res) => {
  try {
    const review = await Rev.findByPk(req.params.id);
    if (!review) return res.status(404).json({ ok: false, mensaje: 'Review no encontrada' });
    await review.update({ respuesta_empresa: req.body.respuesta });
    return res.json({ ok: true, review });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al responder review' });
  }
};

exports.reviews = { crearReview, listarReviews, responderReview };
