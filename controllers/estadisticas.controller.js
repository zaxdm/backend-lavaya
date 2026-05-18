const { Op, fn, col, literal } = require('sequelize');
const { Pedido, Pago, Egreso, Sucursal, Usuario, Review, Rol } = require('../models');

/**
 * GET /api/estadisticas/resumen
 */
const resumenGeneral = async (req, res) => {
  try {
    const { usuario } = req;
    const sucursalFiltro = usuario.rol.nombre !== 'admin_superior'
      ? { sucursal_id: usuario.sucursal_id }
      : {};

    const hoy        = new Date();
    const inicioMes  = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioAño  = new Date(hoy.getFullYear(), 0, 1);
    const inicioDia  = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const finDia     = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

    const inicioDiaStr = inicioDia.toISOString().split('T')[0];
    const inicioMesStr = inicioMes.toISOString().split('T')[0];
    const inicioAñoStr = inicioAño.toISOString().split('T')[0];

    // ── Queries secuenciales (evita max_user_connections en Clever Cloud) ──
    const ingresosMesRes = await Pago.findOne({
      attributes: [[fn('SUM', col('monto')), 'total']],
      where: { estado: 'pagado', createdAt: { [Op.gte]: inicioMes } },
      include: [{ model: Pedido, as: 'pedido', where: sucursalFiltro, required: true, attributes: [] }],
      raw: true,
    });

    const ingresosAñoRes = await Pago.findOne({
      attributes: [[fn('SUM', col('monto')), 'total']],
      where: { estado: 'pagado', createdAt: { [Op.gte]: inicioAño } },
      include: [{ model: Pedido, as: 'pedido', where: sucursalFiltro, required: true, attributes: [] }],
      raw: true,
    });

    const ingresosDiaRes = await Pago.findOne({
      attributes: [[fn('SUM', col('monto')), 'total']],
      where: { estado: 'pagado', createdAt: { [Op.between]: [inicioDia, finDia] } },
      include: [{ model: Pedido, as: 'pedido', where: sucursalFiltro, required: true, attributes: [] }],
      raw: true,
    });

    const egresosMes = await Egreso.sum('monto', {
      where: { ...sucursalFiltro, fecha: { [Op.gte]: inicioMesStr } },
    });

    const egresosAño = await Egreso.sum('monto', {
      where: { ...sucursalFiltro, fecha: { [Op.gte]: inicioAñoStr } },
    });

    const egresosDia = await Egreso.sum('monto', {
      where: { ...sucursalFiltro, fecha: inicioDiaStr },
    });

    const pedidosPorEstado = await Pedido.findAll({
      where: sucursalFiltro,
      attributes: ['estado', [fn('COUNT', col('id')), 'cantidad']],
      group: ['estado'],
      raw: true,
    });

    const pedidosMes = await Pedido.count({
      where: { ...sucursalFiltro, createdAt: { [Op.gte]: inicioMes } },
    });

    const pedidosDia = await Pedido.count({
      where: { ...sucursalFiltro, createdAt: { [Op.between]: [inicioDia, finDia] } },
    });

    const pedidosCompletados = await Pedido.count({
      where: { ...sucursalFiltro, estado: 'entregado' },
    });

    const ticketPromedioRes = await Pago.findOne({
      where: { estado: 'pagado' },
      attributes: [[fn('AVG', col('monto')), 'promedio']],
      include: [{ model: Pedido, as: 'pedido', where: sucursalFiltro, required: true, attributes: [] }],
      raw: true,
    });

    const rolUsuario = await Rol.findOne({ where: { nombre: 'usuario' } });

    const ratingRes = await Review.findOne({
      where: sucursalFiltro.sucursal_id ? { sucursal_id: sucursalFiltro.sucursal_id } : {},
      attributes: [
        [fn('AVG', col('calificacion')), 'promedio'],
        [fn('COUNT', col('id')), 'total'],
      ],
      raw: true,
    });

    const usuarioRolId   = rolUsuario ? rolUsuario.id : 0;
    const sucursalSubquery = sucursalFiltro.sucursal_id
      ? ` AND pedidos.sucursal_id = ${sucursalFiltro.sucursal_id}`
      : '';

    const clientesFrecuentes = await Usuario.findAll({
      where: { rol_id: usuarioRolId },
      attributes: [
        'id', 'nombre', 'apellido',
        [literal(`(SELECT COUNT(*) FROM pedidos WHERE pedidos.usuario_id = Usuario.id AND pedidos.deletedAt IS NULL${sucursalSubquery})`), 'totalPedidos'],
      ],
      having: literal('totalPedidos > 0'),
      order: [[literal('totalPedidos'), 'DESC']],
      limit: 5,
      raw: true,
    });

    // ── Procesar resultados ────────────────────────────────────────────────
    const iMes  = parseFloat(ingresosMesRes?.total  || 0);
    const iAño  = parseFloat(ingresosAñoRes?.total  || 0);
    const iDia  = parseFloat(ingresosDiaRes?.total  || 0);
    const eMes  = parseFloat(egresosMes  || 0);
    const eAño  = parseFloat(egresosAño  || 0);
    const eDia  = parseFloat(egresosDia  || 0);
    const tProm = parseFloat(ticketPromedioRes?.promedio || 0);

    return res.json({
      ok: true,
      resumen: {
        ingresos:  { dia: iDia, mes: iMes, año: iAño },
        egresos:   { dia: eDia, mes: eMes, año: eAño },
        utilidad:  { dia: iDia - eDia, mes: iMes - eMes, año: iAño - eAño },
        pedidos: {
          dia:         pedidosDia,
          mes:         pedidosMes,
          completados: pedidosCompletados,
          porEstado:   pedidosPorEstado,
        },
        ticketPromedio: tProm.toFixed(2),
        clientesFrecuentes: clientesFrecuentes
          .filter(c => parseInt(c.totalPedidos) > 0)
          .map(c => ({
            id:           c.id,
            nombre:       `${c.nombre} ${c.apellido}`,
            totalPedidos: parseInt(c.totalPedidos),
          })),
        rating: {
          promedio: parseFloat(ratingRes?.promedio || 0).toFixed(1),
          total:    ratingRes?.total || 0,
        },
      },
    });
  } catch (error) {
    console.error('estadisticas.resumenGeneral:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener estadísticas', error: error.message });
  }
};

/**
 * GET /api/estadisticas/ingresos-mensuales?año=2024
 */
const ingresosMensuales = async (req, res) => {
  try {
    const { usuario } = req;
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const sucursalFiltro = usuario.rol.nombre !== 'admin_superior'
      ? { sucursal_id: usuario.sucursal_id }
      : {};

    const datos = await Pago.findAll({
      where: {
        estado: 'pagado',
        createdAt: { [Op.between]: [new Date(`${año}-01-01`), new Date(`${año}-12-31 23:59:59`)] },
      },
      include: [{ model: Pedido, as: 'pedido', where: sucursalFiltro, required: true, attributes: [] }],
      attributes: [
        [fn('MONTH', col('Pago.createdAt')), 'mes'],
        [fn('SUM',   col('monto')),          'total'],
        [fn('COUNT', col('Pago.id')),        'cantidad_pagos'],
      ],
      group: [literal('mes')],
      order: [[literal('mes'), 'ASC']],
      raw: true,
    });

    const meses = Array.from({ length: 12 }, (_, i) => {
      const encontrado = datos.find(d => parseInt(d.mes) === i + 1);
      return {
        mes:           i + 1,
        total:         parseFloat(encontrado?.total         || 0),
        cantidad_pagos: parseInt(encontrado?.cantidad_pagos || 0),
      };
    });

    return res.json({ ok: true, año, meses });
  } catch (error) {
    console.error('estadisticas.ingresosMensuales:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener ingresos mensuales' });
  }
};

/**
 * GET /api/estadisticas/ingresos-diarios?fecha=2024-01-15
 */
const ingresosDiarios = async (req, res) => {
  try {
    const { usuario } = req;
    const fecha = req.query.fecha ? new Date(req.query.fecha) : new Date();

    if (isNaN(fecha.getTime())) {
      return res.status(400).json({ ok: false, mensaje: 'Fecha inválida. Use formato YYYY-MM-DD' });
    }

    const inicioDia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const finDia    = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
    const sucursalFiltro = usuario.rol.nombre !== 'admin_superior'
      ? { sucursal_id: usuario.sucursal_id }
      : {};

    const ingresos = await Pago.sum('monto', {
      where: { estado: 'pagado', createdAt: { [Op.between]: [inicioDia, finDia] } },
      include: [{ model: Pedido, as: 'pedido', where: sucursalFiltro, required: true }],
    });

    const pedidosCount = await Pedido.count({
      where: { ...sucursalFiltro, createdAt: { [Op.between]: [inicioDia, finDia] } },
    });

    return res.json({
      ok:       true,
      fecha:    fecha.toISOString().split('T')[0],
      ingresos: ingresos || 0,
      pedidos:  pedidosCount,
    });
  } catch (error) {
    console.error('estadisticas.ingresosDiarios:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener ingresos diarios' });
  }
};

/**
 * GET /api/estadisticas/ranking-sucursales
 */
const rankingSucursales = async (req, res) => {
  try {
    const sucursales = await Sucursal.findAll({
      where: { activo: true },
      attributes: ['id', 'nombre', 'distrito'],
      include: [{
        model: Pedido,
        as: 'pedidos',
        attributes: [[fn('COUNT', col('pedidos.id')), 'total_pedidos']],
        required: false,
      }],
      group: ['Sucursal.id'],
    });

    return res.json({ ok: true, sucursales });
  } catch (error) {
    console.error('estadisticas.rankingSucursales:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener ranking' });
  }
};

module.exports = { resumenGeneral, ingresosMensuales, ingresosDiarios, rankingSucursales };