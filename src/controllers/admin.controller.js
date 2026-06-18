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
        { nombre: { contains: buscar } },
        { apellido: { contains: buscar } },
        { email: { contains: buscar } },
      ];
    }

    const [usuariosBase, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        select: {
          id: true, nombre: true, apellido: true, email: true,
          telefono: true, rol: true, activo: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.usuario.count({ where }),
    ]);

    const usuarioIds = usuariosBase.map((u) => u.id);
    const [puntos, repartidores] = await Promise.all([
      prisma.puntos.findMany({
        where: { usuarioId: { in: usuarioIds } },
        select: { usuarioId: true, saldo: true },
      }).catch((err) => {
        console.warn('[Admin:listarUsuarios] No se pudieron cargar puntos:', err.message);
        return [];
      }),
      prisma.repartidor.findMany({
        where: { usuarioId: { in: usuarioIds } },
        select: {
          usuarioId: true,
          estado: true,
          calificacionPromedio: true,
          totalServicios: true,
        },
      }).catch((err) => {
        console.warn('[Admin:listarUsuarios] No se pudieron cargar repartidores:', err.message);
        return [];
      }),
    ]);

    const puntosPorUsuario = new Map(puntos.map((p) => [p.usuarioId, { saldo: p.saldo }]));
    const repartidorPorUsuario = new Map(repartidores.map((r) => [
      r.usuarioId,
      {
        estado: r.estado,
        calificacionPromedio: r.calificacionPromedio,
        totalServicios: r.totalServicios,
      },
    ]));
    const usuarios = usuariosBase.map((u) => ({
      ...u,
      puntos: puntosPorUsuario.get(u.id) ?? null,
      repartidor: repartidorPorUsuario.get(u.id) ?? null,
    }));

    res.json({
      usuarios,
      paginacion: {
        total, pagina: parseInt(page),
        porPagina: parseInt(limit),
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

// POST /api/admin/usuarios  (crear empleado / admin / repartidor)
const crearUsuario = async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, telefono, rol } = req.body;
    const rolesPermitidos = ['ADMIN', 'EMPLEADO', 'REPARTIDOR'];
    const rolFinal = rolesPermitidos.includes(rol) ? rol : 'EMPLEADO';

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 12);

    // Si el rol es REPARTIDOR, crear el perfil de repartidor en la misma transacción
    const usuario = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuario.create({
        data: {
          id: uuidv4(),
          nombre, apellido, email, passwordHash,
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
          data: {
            id: uuidv4(),
            usuarioId: nuevoUsuario.id,
            estado: 'DISPONIBLE',
          },
        });
      }

      return nuevoUsuario;
    });

    res.status(201).json(usuario);
  } catch (err) { next(err); }
};

// PATCH /api/admin/usuarios/:id/estado  (activar/desactivar)
const toggleEstadoUsuario = async (req, res, next) => {
  try {
    const { activo } = req.body;
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo "activo" debe ser booleano' });
    }
    // No puede desactivarse a sí mismo
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }
    await prisma.usuario.update({ where: { id: req.params.id }, data: { activo } });

    // Revocar tokens si se desactiva
    if (!activo) {
      await prisma.refreshToken.deleteMany({ where: { usuarioId: req.params.id } });
    }
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

    const [pedidos, total] = await Promise.all([
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
        total, pagina: parseInt(page),
        porPagina: parseInt(limit),
        totalPaginas: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
};

// PATCH /api/admin/pedidos/:id/asignar-repartidor
const asignarRepartidor = async (req, res, next) => {
  try {
    const { repartidorId, tipo = 'recoleccion' } = req.body;

    const [pedido, repartidor] = await Promise.all([
      prisma.pedido.findUnique({ where: { id: req.params.id } }),
      prisma.repartidor.findUnique({ where: { id: repartidorId } }),
    ]);

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!repartidor) return res.status(404).json({ error: 'Repartidor no encontrado' });
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
          repartidorEntrega: { include: { usuario: { select: { nombre: true } } } },
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

// GET /api/admin/catalogo
const listarCatalogo = async (req, res, next) => {
  try {
    const catalogo = await prisma.catalogoPrenda.findMany({ orderBy: { nombre: 'asc' } });
    res.json(catalogo);
  } catch (err) { next(err); }
};

// POST /api/admin/catalogo
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

// PATCH /api/admin/catalogo/:id
const actualizarItemCatalogo = async (req, res, next) => {
  try {
    const { nombre, descripcion, precioUnitario, precioExtra, activo } = req.body;
    const item = await prisma.catalogoPrenda.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.toLowerCase().trim() }),
        ...(descripcion !== undefined && { descripcion }),
        ...(precioUnitario !== undefined && { precioUnitario: parseFloat(precioUnitario) }),
        ...(precioExtra !== undefined && { precioExtra: parseFloat(precioExtra) }),
        ...(activo !== undefined && { activo }),
      },
    });
    res.json(item);
  } catch (err) { next(err); }
};

// ─── REPORTES ─────────────────────────────────────────────────

// GET /api/admin/reportes/stats
const statsGenerales = async (req, res, next) => {
  try {
    console.log('Incoming request to /stats, user:', req.user);
    const hoy = new Date();
    const inicioDia = new Date(new Date().setHours(0, 0, 0, 0));
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Run all queries sequentially to avoid hitting connection limit
    const totalUsuarios = await prisma.usuario.count({ where: { activo: true } });
    const totalClientes = await prisma.usuario.count({ where: { rol: 'CLIENTE', activo: true } });
    const totalRepartidores = await prisma.usuario.count({ where: { rol: 'REPARTIDOR', activo: true } });
    const repartidoresDisponibles = await prisma.repartidor.count({ where: { estado: 'DISPONIBLE' } });
    const totalPedidos = await prisma.pedido.count();
    const pedidosHoy = await prisma.pedido.count({ where: { createdAt: { gte: inicioDia } } });
    const pedidosPendientes = await prisma.pedido.count({ where: { estado: 'PENDIENTE' } });
    const pedidosEnProceso = await prisma.pedido.count({ where: { estado: { in: ['CONFIRMADO', 'RECOLECTADO', 'EN_PROCESO', 'LISTO', 'EN_CAMINO'] } } });
    const pedidosMes = await prisma.pedido.count({ where: { createdAt: { gte: inicioMes } } });
    const totalPagosCompletados = await prisma.pago.aggregate({ where: { estado: 'COMPLETADO' }, _sum: { monto: true } });
    const pagosHoy = await prisma.pago.aggregate({ where: { estado: 'COMPLETADO', createdAt: { gte: inicioDia } }, _sum: { monto: true } });
    const pagosMes = await prisma.pago.aggregate({ where: { estado: 'COMPLETADO', createdAt: { gte: inicioMes } }, _sum: { monto: true } });

    res.json({
      usuarios: { total: totalUsuarios, clientes: totalClientes, repartidores: totalRepartidores },
      pedidos: {
        total: totalPedidos,
        hoy: pedidosHoy,
        esteMes: pedidosMes,
        pendientes: pedidosPendientes,
        enProceso: pedidosEnProceso,
      },
      ingresos: {
        total: totalPagosCompletados._sum.monto || 0,
        hoy: pagosHoy._sum.monto || 0,
        esteMes: pagosMes._sum.monto || 0,
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
      orderBy: { createdAt: 'asc' }
    });

    const grouped = {};
    pedidos.forEach(pedido => {
      const fecha = pedido.createdAt.toISOString().split('T')[0];
      if (!grouped[fecha]) {
        grouped[fecha] = { total: 0, entregados: 0, cancelados: 0 };
      }
      grouped[fecha].total++;
      if (pedido.estado === 'ENTREGADO') {
        grouped[fecha].entregados++;
      }
      if (pedido.estado === 'CANCELADO') {
        grouped[fecha].cancelados++;
      }
    });

    const resultado = Object.entries(grouped).map(([fecha, data]) => ({
      fecha: new Date(fecha),
      ...data
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
      where: { 
        estado: 'COMPLETADO',
        createdAt: { gte: desde }
      },
      orderBy: { createdAt: 'asc' }
    });

    const grouped = {};
    pagos.forEach(pago => {
      const fecha = pago.createdAt.toISOString().split('T')[0];
      if (!grouped[fecha]) {
        grouped[fecha] = { 
          totalPagos: 0, 
          ingresoTotal: 0, 
          ingresoPaypal: 0, 
          ingresoEfectivo: 0 
        };
      }
      grouped[fecha].totalPagos++;
      const monto = pago.monto.toNumber();
      grouped[fecha].ingresoTotal += monto;
      if (pago.metodoPago === 'PAYPAL') {
        grouped[fecha].ingresoPaypal += monto;
      }
      if (pago.metodoPago === 'EFECTIVO') {
        grouped[fecha].ingresoEfectivo += monto;
      }
    });

    const resultado = Object.entries(grouped).map(([fecha, data]) => ({
      fecha: new Date(fecha),
      ...data
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
    const prendas = await prisma.prenda.findMany();
    const grouped = {};

    prendas.forEach(prenda => {
      if (!grouped[prenda.tipo]) {
        grouped[prenda.tipo] = { totalLavadas: 0, aparicionEnPedidos: new Set() };
      }
      grouped[prenda.tipo].totalLavadas += prenda.cantidad;
      grouped[prenda.tipo].aparicionEnPedidos.add(prenda.pedidoId);
    });

    const resultado = Object.entries(grouped).map(([tipo, data]) => ({
      tipo,
      totalLavadas: data.totalLavadas,
      aparicionEnPedidos: data.aparicionEnPedidos.size
    })).sort((a, b) => b.totalLavadas - a.totalLavadas);

    res.json(resultado);
  } catch (err) { 
    console.error('Error in /prendas-populares:', err);
    next(err); 
  }
};

// ─── REPARTIDORES ─────────────────────────────────────────────

// GET /api/admin/repartidores
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
