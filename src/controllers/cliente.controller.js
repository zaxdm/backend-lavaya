// src/controllers/cliente.controller.js
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { canjearPuntos } = require('../services/puntos.service');

// ─── Obtener perfil ───────────────────────────────────────────
// GET /api/clientes/perfil
const obtenerPerfil = async (req, res, next) => {
  try {
    const cliente = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        fotoPerfil: true,
        emailVerificado: true,
        createdAt: true,
        direcciones: {
          orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'desc' }],
        },
        puntos: {
          select: {
            saldo: true,
            totalGanados: true,
            totalCanjeados: true,
          },
        },
        membresias: {
          where: { estado: 'ACTIVA' },
          select: {
            id: true,
            tipo: true,
            fechaInicio: true,
            fechaFin: true,
            descuento: true,
            pedidosGratis: true,
          },
        },
      },
    });

    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Resumen de pedidos
    const [totalPedidos, pedidosEntregados] = await Promise.all([
      prisma.pedido.count({ where: { clienteId: req.user.id } }),
      prisma.pedido.count({ where: { clienteId: req.user.id, estado: 'ENTREGADO' } }),
    ]);

    res.json({ ...cliente, totalPedidos, pedidosEntregados });
  } catch (err) {
    next(err);
  }
};

// ─── Actualizar perfil ────────────────────────────────────────
// PATCH /api/clientes/perfil
const actualizarPerfil = async (req, res, next) => {
  try {
    const { nombre, apellido, telefono, fotoPerfil } = req.body;
    const actualizado = await prisma.usuario.update({
      where: { id: req.user.id },
      data: {
        ...(nombre && { nombre: nombre.trim() }),
        ...(apellido && { apellido: apellido.trim() }),
        ...(telefono !== undefined && { telefono }),
        ...(fotoPerfil !== undefined && { fotoPerfil }),
      },
      select: {
        id: true, nombre: true, apellido: true,
        email: true, telefono: true, fotoPerfil: true,
      },
    });
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
};

// ─── Cambiar contraseña ───────────────────────────────────────
// PATCH /api/clientes/password
const cambiarPassword = async (req, res, next) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ error: 'Se requieren contraseña actual y nueva' });
    }
    if (passwordNueva.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    const valida = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!valida) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, 12);
    await prisma.usuario.update({
      where: { id: req.user.id },
      data: { passwordHash: nuevoHash },
    });

    // Invalidar todos los refresh tokens (cerrar sesión en otros dispositivos)
    await prisma.refreshToken.deleteMany({ where: { usuarioId: req.user.id } });

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
};

// ─── Direcciones ──────────────────────────────────────────────

// GET /api/clientes/direcciones
const listarDirecciones = async (req, res, next) => {
  try {
    const direcciones = await prisma.direccion.findMany({
      where: { usuarioId: req.user.id },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(direcciones);
  } catch (err) {
    next(err);
  }
};

// POST /api/clientes/direcciones
const agregarDireccion = async (req, res, next) => {
  try {
    const {
      calle, numero, colonia, ciudad, estado,
      codigoPostal, referencia, esPrincipal, latitud, longitud,
    } = req.body;

    // Si se marca como principal, quitar la anterior
    if (esPrincipal) {
      await prisma.direccion.updateMany({
        where: { usuarioId: req.user.id, esPrincipal: true },
        data: { esPrincipal: false },
      });
    }

    const direccion = await prisma.direccion.create({
      data: {
        id: uuidv4(),
        usuarioId: req.user.id,
        calle: calle.trim(),
        numero: numero.trim(),
        colonia: colonia.trim(),
        ciudad: ciudad.trim(),
        estado: estado.trim(),
        codigoPostal: codigoPostal.trim(),
        referencia: referencia?.trim() || null,
        esPrincipal: !!esPrincipal,
        latitud: latitud ?? null,
        longitud: longitud ?? null,
      },
    });
    res.status(201).json(direccion);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/clientes/direcciones/:id
const actualizarDireccion = async (req, res, next) => {
  try {
    const direccion = await prisma.direccion.findUnique({ where: { id: req.params.id } });
    if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
    if (direccion.usuarioId !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const {
      calle, numero, colonia, ciudad, estado,
      codigoPostal, referencia, esPrincipal, latitud, longitud,
    } = req.body;

    if (esPrincipal) {
      await prisma.direccion.updateMany({
        where: { usuarioId: req.user.id, esPrincipal: true },
        data: { esPrincipal: false },
      });
    }

    const actualizada = await prisma.direccion.update({
      where: { id: req.params.id },
      data: {
        ...(calle && { calle: calle.trim() }),
        ...(numero && { numero: numero.trim() }),
        ...(colonia && { colonia: colonia.trim() }),
        ...(ciudad && { ciudad: ciudad.trim() }),
        ...(estado && { estado: estado.trim() }),
        ...(codigoPostal && { codigoPostal: codigoPostal.trim() }),
        ...(referencia !== undefined && { referencia }),
        ...(esPrincipal !== undefined && { esPrincipal: !!esPrincipal }),
        ...(latitud !== undefined && { latitud }),
        ...(longitud !== undefined && { longitud }),
      },
    });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/clientes/direcciones/:id
const eliminarDireccion = async (req, res, next) => {
  try {
    const direccion = await prisma.direccion.findUnique({ where: { id: req.params.id } });
    if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
    if (direccion.usuarioId !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    // No eliminar si tiene pedidos activos
    const pedidoActivo = await prisma.pedido.findFirst({
      where: {
        direccionId: req.params.id,
        estado: { notIn: ['ENTREGADO', 'CANCELADO'] },
      },
    });
    if (pedidoActivo) {
      return res.status(400).json({ error: 'No puedes eliminar una dirección con pedidos activos' });
    }

    await prisma.direccion.delete({ where: { id: req.params.id } });
    res.json({ mensaje: 'Dirección eliminada' });
  } catch (err) {
    next(err);
  }
};

// ─── Historial de pedidos ─────────────────────────────────────
// GET /api/clientes/pedidos
const eliminarCuenta = async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { id: true, rol: true, activo: true },
    });

    if (!usuario) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (usuario.rol !== 'CLIENTE') {
      return res.status(403).json({ error: 'Solo los clientes pueden eliminar su cuenta desde este flujo' });
    }

    const pedidoPendiente = await prisma.pedido.findFirst({
      where: {
        clienteId: req.user.id,
        estado: { notIn: ['ENTREGADO', 'CANCELADO'] },
      },
      select: { id: true, estado: true },
      orderBy: { createdAt: 'desc' },
    });

    if (pedidoPendiente) {
      return res.status(409).json({
        error: 'No puedes eliminar tu cuenta mientras tengas pedidos pendientes o activos',
        pedidoId: pedidoPendiente.id,
        estado: pedidoPendiente.estado,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { usuarioId: req.user.id } });

      await tx.usuario.update({
        where: { id: req.user.id },
        data: {
          activo: false,
          nombre: 'Cuenta',
          apellido: 'eliminada',
          email: `deleted-${req.user.id}@lavaya.local`,
          telefono: null,
          passwordHash: null,
          fotoPerfil: null,
          googleId: null,
          googleToken: null,
          tokenVerificacion: null,
          tokenReset: null,
          tokenResetExpira: null,
        },
      });
    });

    res.json({ mensaje: 'Cuenta eliminada correctamente' });
  } catch (err) {
    next(err);
  }
};

const historialPedidos = async (req, res, next) => {
  try {
    const { estado, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { clienteId: req.user.id };
    if (estado) where.estado = estado;

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: {
          prendas: true,
          pago: true,
          direccion: true,
          repartidorEntrega: {
            include: { usuario: { select: { nombre: true, apellido: true } } },
          },
          calificacion: true,
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
        pagina: parseInt(page),
        porPagina: parseInt(limit),
        totalPaginas: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Puntos ───────────────────────────────────────────────────
// GET /api/clientes/puntos
const obtenerPuntos = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const puntos = await prisma.puntos.findUnique({
      where: { usuarioId: req.user.id },
      include: {
        movimientos: {
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        },
      },
    });

    if (!puntos) {
      return res.json({ saldo: 0, totalGanados: 0, totalCanjeados: 0, movimientos: [] });
    }

    const totalMovimientos = await prisma.movimientoPuntos.count({
      where: { puntosId: puntos.id },
    });

    res.json({
      ...puntos,
      paginacion: {
        total: totalMovimientos,
        pagina: parseInt(page),
        porPagina: parseInt(limit),
        totalPaginas: Math.ceil(totalMovimientos / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/clientes/puntos/canjear
const canjear = async (req, res, next) => {
  try {
    const { cantidad, pedidoId } = req.body;
    if (!cantidad || cantidad < 1) {
      return res.status(400).json({ error: 'Cantidad de puntos inválida' });
    }
    await canjearPuntos(req.user.id, cantidad, pedidoId);
    const puntos = await prisma.puntos.findUnique({ where: { usuarioId: req.user.id } });
    res.json({ mensaje: `${cantidad} puntos canjeados`, saldoActual: puntos.saldo });
  } catch (err) {
    if (err.message === 'Puntos insuficientes') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
};

// ─── Calificar repartidor ─────────────────────────────────────
// POST /api/clientes/pedidos/:id/calificar
const calificarPedido = async (req, res, next) => {
  try {
    const { estrellas, comentario } = req.body;
    const pedidoId = req.params.id;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { calificacion: true },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.clienteId !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    if (pedido.estado !== 'ENTREGADO') {
      return res.status(400).json({ error: 'Solo puedes calificar pedidos entregados' });
    }
    if (pedido.calificacion) {
      return res.status(400).json({ error: 'Este pedido ya fue calificado' });
    }

    const repartidorId = pedido.repartidorEntregaId || pedido.repartidorRecoleccionId;
    if (!repartidorId) {
      return res.status(400).json({ error: 'No hay repartidor asignado a este pedido' });
    }

    const calificacion = await prisma.$transaction(async (tx) => {
      const nueva = await tx.calificacion.create({
        data: {
          id: uuidv4(),
          pedidoId,
          repartidorId,
          estrellas,
          comentario: comentario?.trim() || null,
        },
      });

      // Recalcular promedio del repartidor
      const todas = await tx.calificacion.findMany({
        where: { repartidorId },
        select: { estrellas: true },
      });
      const promedio = todas.reduce((acc, c) => acc + c.estrellas, 0) / todas.length;

      await tx.repartidor.update({
        where: { id: repartidorId },
        data: { calificacionPromedio: Math.round(promedio * 10) / 10 },
      });

      return nueva;
    });

    res.status(201).json({ mensaje: 'Calificación registrada', calificacion });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  obtenerPerfil,
  actualizarPerfil,
  cambiarPassword,
  listarDirecciones,
  agregarDireccion,
  actualizarDireccion,
  eliminarDireccion,
  eliminarCuenta,
  historialPedidos,
  obtenerPuntos,
  canjear,
  calificarPedido,
};
