// src/controllers/admin.controller.js
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

// ─── USUARIOS ─────────────────────────────────────────────────

// GET /api/admin/usuarios
const listarUsuarios = async (req, res, next) => {
  try {
    const { rol, activo, buscar, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (rol) where.rol = rol;
    if (activo !== undefined) where.activo = activo === 'true';
    if (buscar) {
      where.OR = [
        { nombre:   { contains: buscar } },
        { apellido: { contains: buscar } },
        { email:    { contains: buscar } },
      ];
    }

    // FIX: 2 queries en 1 $transaction en lugar de 4 Promise.all separados
    const [usuariosBase, total] = await prisma.$transaction([
      prisma.usuario.findMany({
        where,
        select: {
          id: true, nombre: true, apellido: true, email: true,
          telefono: true, rol: true, activo: true, createdAt: true,
          puntos:      { select: { saldo: true } },
          repartidor:  { select: { estado: true, calificacionPromedio: true, totalServicios: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.usuario.count({ where }),
    ]);

    res.json({
      usuarios: usuariosBase,
      paginacion: {
        total,
        pagina:      parseInt(page),
        porPagina:   parseInt(limit),
        totalPaginas: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
};

// GET /api/admin/usuarios/:id
const obtenerUsuario = async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, nombre: true, apellido: true, email: true, telefono: true,
        rol: true, activo: true, fotoPerfil: true, emailVerificado: true, createdAt: true,
        direcciones: true,
        puntos: true,
        membresias: true,
        repartidor: true,
        pedidosComoCliente: {
          select: { id: true, estado: true, createdAt: true, totalPrendas: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario);
  } catch (err) { next(err); }
};

// POST /api/admin/usuarios
const crearUsuario = async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, telefono, rol } = req.body;
    const rolesPermitidos = ['ADMIN', 'EMPLEADO', 'REPARTIDOR'];
    const rolFinal = rolesPermitidos.includes(rol) ? rol : 'EMPLEADO';

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);

    const usuario = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuario.create({
        data: {
          id: uuidv4(), nombre, apellido, email, passwordHash,
          telefono: telefono || null,
          rol: rolFinal,
        },
        select: {
          id: true, nombre: true, apellido: true,
          email: true, rol: true, createdAt: true,
        },
      });

      if (rolFinal === 'REPARTIDOR') {
        await tx.repartidor.create({
          data: { id: uuidv4(), usuarioId: nuevoUsuario.id, estado: 'DISPONIBLE' },
        });
      }

      return nuevoUsuario;
    });

    res.status(201).json(usuario);
  } catch (err) { next(err); }
};

// PATCH /api/admin/usuarios/:id/estado
const toggleEstadoUsuario = async (req, res, next) => {
  try {
    const { activo } = req.body;
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo "activo" debe ser booleano' });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: req.params.id }, data: { activo } });
      if (!activo) {
        await tx.refreshToken.deleteMany({ where: { usuarioId: req.params.id } });
      }
    });

    res.json({ mensaje: `Usuario ${activo ? 'activado' : 'desactivado'}` });
  } catch (err) { next(err); }
};

// ─── PEDIDOS ──────────────────────────────────────────────────

// GET /api/admin/pedidos
const listarPedidos = async (req, res, next) => {
  try {
    const { estado, clienteId, repartidorId, desde, hasta, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }
    if (repartidorId) {
      where.OR = [
        { repartidorRecoleccionId: repartidorId },
        { repartidorEntregaId: repartidorId },
      ];
    }

    // FIX: $transaction en lugar de Promise.all
    const [pedidos, total] = await prisma.$transaction([
      prisma.pedido.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
          direccion: true,
          prendas: true,
          pago: true,
          repartidorRecoleccion: {
            include: { usuario: { select: { nombre: true, apellido: true } } },
          },
          repartidorEntrega: {
            include: { usuario: { select: { nombre: true, apellido: true } } },
          },
          historial: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.pedido.count({ where }),
    ]);

    res.json({
      pedidos,
      paginacion: {
        total,
        pagina:      parseInt(page),
        porPagina:   parseInt(limit),
        totalPaginas: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
};

// PATCH /api/admin/pedidos/:id/asignar-repartidor
const asignarRepartidor = async (req, res, next) => {
  try {
    const { repartidorId, tipo = 'recoleccion' } = req.body;

    const [pedido, repartidor] = await prisma.$transaction([
      prisma.pedido.findUnique({ where: { id: req.params.id } }),
      prisma.repartidor.findUnique({ where: { id: repartidorId } }),
    ]);

    if (!pedido)      return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!repartidor)  return res.status(404).json({ error: 'Repartidor no encontrado' });
    if (repartidor.estado === 'INACTIVO') {
      return res.status(400).json({ error: 'El repartidor está inactivo' });
    }

    const campo = tipo === 'entrega' ? 'repartidorEntregaId' : 'repartidorRecoleccionId';
    const nuevoEstado = tipo === 'entrega' ? pedido.estado : 'CONFIRMADO';

    const pedidoActualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: req.params.id },
        data: {
          [campo]: repartidorId,
          estado: nuevoEstado,
          historial: {
            create: {
              id: uuidv4(),
              estado: nuevoEstado,
              nota: `Repartidor asignado para ${tipo} por administrador`,
              creadoPor: req.user.id,
            },
          },
        },
        include: {
          prendas: true,
          cliente: { select: { nombre: true, apellido: true } },
          repartidorRecoleccion: { include: { usuario: { select: { nombre: true } } } },
          repartidorEntrega:     { include: { usuario: { select: { nombre: true } } } },
        },
      });

      await tx.repartidor.update({
        where: { id: repartidorId },
        data: { estado: 'OCUPADO' },
      });

      return actualizado;
    });

    res.json({ mensaje: `Repartidor asignado para ${tipo}`, pedido: pedidoActualizado });
  } catch (err) { next(err); }
};

// ─── CATÁLOGO DE PRENDAS ──────────────────────────────────────

const listarCatalogo = async (req, res, next) => {
  try {
    const catalogo = await prisma.catalogoPrenda.findMany({ orderBy: { nombre: 'asc' } });
    res.json(catalogo);
  } catch (err) { next(err); }
};

const crearItemCatalogo = async (req, res, next) => {
  try {
    const { nombre, descripcion, precioUnitario, precioExtra } = req.body;
    const existe = await prisma.catalogoPrenda.findUnique({ where: { nombre: nombre.toLowerCase() } });
    if (existe) return res.status(409).json({ error: 'Ya existe una prenda con ese nombre' });

    const item = await prisma.catalogoPrenda.create({
      data: {
        id: uuidv4(),
        nombre: nombre.toLowerCase().trim(),
        descripcion: descripcion?.trim() || null,
        precioUnitario: parseFloat(precioUnitario),
        precioExtra: parseFloat(precioExtra) || 0,
      },
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
};

const actualizarItemCatalogo = async (req, res, next) => {
  try {
    const { nombre, descripcion, precioUnitario, precioExtra, activo } = req.body;
    const item = await prisma.catalogoPrenda.update({
      where: { id: req.params.id },
      data: {
        ...(nombre        !== undefined && { nombre: nombre.toLowerCase().trim() }),
        ...(descripcion   !== undefined && { descripcion }),
        ...(precioUnitario !== undefined && { precioUnitario: parseFloat(precioUnitario) }),
        ...(precioExtra   !== undefined && { precioExtra: parseFloat(precioExtra) }),
        ...(activo        !== undefined && { activo }),
      },
    });
    res.json(item);
  } catch (err) { next(err); }
};

// ─── REPORTES ─────────────────────────────────────────────────

// GET /api/admin/reportes/stats
// FIX: 12 queries separadas → 1 $transaction con todas juntas
const statsGenerales = async (req, res, next) => {
  try {
    const hoy        = new Date();
    const inicioDia  = new Date(new Date().setHours(0, 0, 0, 0));
    const inicioMes  = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const [
      totalUsuarios,
      totalClientes,
      totalRepartidores,
      repartidoresDisponibles,
      totalPedidos,
      pedidosHoy,
      pedidosPendientes,
      pedidosEnProceso,
      pedidosMes,
      totalPagosCompletados,
      pagosHoy,
      pagosMes,
    ] = await prisma.$transaction([
      prisma.usuario.count({ where: { activo: true } }),
      prisma.usuario.count({ where: { rol: 'CLIENTE', activo: true } }),
      prisma.usuario.count({ where: { rol: 'REPARTIDOR', activo: true } }),
      prisma.repartidor.count({ where: { estado: 'DISPONIBLE' } }),
      prisma.pedido.count(),
      prisma.pedido.count({ where: { createdAt: { gte: inicioDia } } }),
      prisma.pedido.count({ where: { estado: 'PENDIENTE' } }),
      prisma.pedido.count({ where: { estado: { in: ['CONFIRMADO', 'RECOLECTADO', 'EN_PROCESO', 'LISTO', 'EN_CAMINO'] } } }),
      prisma.pedido.count({ where: { createdAt: { gte: inicioMes } } }),
      prisma.pago.aggregate({ where: { estado: 'COMPLETADO' },                              _sum: { monto: true } }),
      prisma.pago.aggregate({ where: { estado: 'COMPLETADO', createdAt: { gte: inicioDia } }, _sum: { monto: true } }),
      prisma.pago.aggregate({ where: { estado: 'COMPLETADO', createdAt: { gte: inicioMes } }, _sum: { monto: true } }),
    ]);

    res.json({
      usuarios: { total: totalUsuarios, clientes: totalClientes, repartidores: totalRepartidores },
      pedidos: {
        total:       totalPedidos,
        hoy:         pedidosHoy,
        esteMes:     pedidosMes,
        pendientes:  pedidosPendientes,
        enProceso:   pedidosEnProceso,
      },
      ingresos: {
        total:    Number(totalPagosCompletados._sum.monto) || 0,
        hoy:      Number(pagosHoy._sum.monto)              || 0,
        esteMes:  Number(pagosMes._sum.monto)              || 0,
      },
      repartidoresDisponibles,
    });
  } catch (err) {
    console.error('Error in /stats:', err);
    next(err);
  }
};

// GET /api/admin/reportes/pedidos-por-dia
const pedidosPorDia = async (req, res, next) => {
  try {
    const { dias = 30 } = req.query;
    const numDias = parseInt(dias, 10) || 30;
    const desde = new Date();
    desde.setDate(desde.getDate() - numDias);
    desde.setHours(0, 0, 0, 0);

    const pedidos = await prisma.pedido.findMany({
      where: { createdAt: { gte: desde } },
      select: { createdAt: true, estado: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = {};
    pedidos.forEach(pedido => {
      const fecha = pedido.createdAt.toISOString().split('T')[0];
      if (!grouped[fecha]) grouped[fecha] = { total: 0, entregados: 0, cancelados: 0 };
      grouped[fecha].total++;
      if (pedido.estado === 'ENTREGADO') grouped[fecha].entregados++;
      if (pedido.estado === 'CANCELADO') grouped[fecha].cancelados++;
    });

    const resultado = Object.entries(grouped).map(([fecha, data]) => ({
      fecha: new Date(fecha + 'T00:00:00.000Z'),
      ...data,
    }));

    res.json(resultado);
  } catch (err) {
    console.error('Error in /pedidos-por-dia:', err);
    next(err);
  }
};

// GET /api/admin/reportes/ingresos-por-dia
const ingresosPorDia = async (req, res, next) => {
  try {
    const { dias = 30 } = req.query;
    const numDias = parseInt(dias, 10) || 30;
    const desde = new Date();
    desde.setDate(desde.getDate() - numDias);
    desde.setHours(0, 0, 0, 0);

    const pagos = await prisma.pago.findMany({
      where: { estado: 'COMPLETADO', createdAt: { gte: desde } },
      select: { createdAt: true, monto: true, metodoPago: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = {};
    pagos.forEach(pago => {
      const fecha = pago.createdAt.toISOString().split('T')[0];
      if (!grouped[fecha]) {
        grouped[fecha] = { totalPagos: 0, ingresoTotal: 0, ingresoPaypal: 0, ingresoEfectivo: 0 };
      }
      const monto = Number(pago.monto);
      grouped[fecha].totalPagos++;
      grouped[fecha].ingresoTotal += monto;
      if (pago.metodoPago === 'PAYPAL')   grouped[fecha].ingresoPaypal   += monto;
      if (pago.metodoPago === 'EFECTIVO') grouped[fecha].ingresoEfectivo += monto;
    });

    const resultado = Object.entries(grouped).map(([fecha, data]) => ({
      fecha: new Date(fecha + 'T00:00:00.000Z'),
      ...data,
    }));

    res.json(resultado);
  } catch (err) {
    console.error('Error in /ingresos-por-dia:', err);
    next(err);
  }
};

// GET /api/admin/reportes/prendas-populares
const prendasPopulares = async (req, res, next) => {
  try {
    const prendas = await prisma.prenda.findMany({
      select: { tipo: true, cantidad: true, pedidoId: true },
    });

    const grouped = {};
    prendas.forEach(prenda => {
      if (!grouped[prenda.tipo]) {
        grouped[prenda.tipo] = { totalLavadas: 0, aparicionEnPedidos: new Set() };
      }
      grouped[prenda.tipo].totalLavadas += prenda.cantidad;
      grouped[prenda.tipo].aparicionEnPedidos.add(prenda.pedidoId);
    });

    const resultado = Object.entries(grouped)
      .map(([tipo, data]) => ({
        tipo,
        totalLavadas:      data.totalLavadas,
        aparicionEnPedidos: data.aparicionEnPedidos.size,
      }))
      .sort((a, b) => b.totalLavadas - a.totalLavadas);

    res.json(resultado);
  } catch (err) {
    console.error('Error in /prendas-populares:', err);
    next(err);
  }
};

// ─── REPARTIDORES ─────────────────────────────────────────────

const listarRepartidores = async (req, res, next) => {
  try {
    const { estado } = req.query;
    const repartidores = await prisma.repartidor.findMany({
      where: estado ? { estado } : undefined,
      include: {
        usuario: {
          select: {
            id: true, nombre: true, apellido: true,
            email: true, telefono: true, activo: true,
          },
        },
      },
      orderBy: { calificacionPromedio: 'desc' },
    });
    res.json(repartidores);
  } catch (err) { next(err); }
};

module.exports = {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  toggleEstadoUsuario,
  listarPedidos,
  asignarRepartidor,
  listarCatalogo,
  crearItemCatalogo,
  actualizarItemCatalogo,
  statsGenerales,
  pedidosPorDia,
  ingresosPorDia,
  prendasPopulares,
  listarRepartidores,
};