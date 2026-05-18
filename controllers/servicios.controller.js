const { Servicio, CategoriaServicio } = require('../models');

const listar = async (req, res) => {
  try {
    const servicios = await Servicio.findAll({
      where: { activo: true },
      include: [{ model: CategoriaServicio, as: 'categoria' }],
      order: [['nombre', 'ASC']],
    });
    return res.json({ ok: true, servicios });
  } catch (e) {
    console.error('servicios.listar:', e);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener servicios' });
  }
};

const crear = async (req, res) => {
  try {
    const servicio = await Servicio.create(req.body);
    return res.status(201).json({ ok: true, servicio });
  } catch (e) {
    console.error('servicios.crear:', e);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear servicio' });
  }
};

const actualizar = async (req, res) => {
  try {
    const servicio = await Servicio.findByPk(req.params.id);
    if (!servicio) return res.status(404).json({ ok: false, mensaje: 'Servicio no encontrado' });
    await servicio.update(req.body);
    return res.json({ ok: true, servicio });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar servicio' });
  }
};

const eliminar = async (req, res) => {
  try {
    const servicio = await Servicio.findByPk(req.params.id);
    if (!servicio) return res.status(404).json({ ok: false, mensaje: 'Servicio no encontrado' });
    await servicio.update({ activo: false }); // soft disable
    return res.json({ ok: true, mensaje: 'Servicio desactivado' });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar servicio' });
  }
};

const listarCategorias = async (req, res) => {
  try {
    const categorias = await CategoriaServicio.findAll({ order: [['nombre', 'ASC']] });
    return res.json({ ok: true, categorias });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener categorías' });
  }
};

module.exports = { listar, crear, actualizar, eliminar, listarCategorias };