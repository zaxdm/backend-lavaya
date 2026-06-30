// src/controllers/pedido.controller.js
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { otorgarPuntosPorPedido } = require('../services/puntos.service');
const { TRANSICIONES } = require('../middlewares/validators/pedido.validators');

// ─── Helpers ─────────────────────────────────────────────────

const INCLUDE_PEDIDO_COMPLETO = {
  prendas: true,
  pago: true,
  direccion: true,
  historial: { orderBy: { createdAt: 'asc' } },
  cliente: {
    select: {
      id: true, nombre: true, apellido: true,
      telefono: true, email: true,
    },
  },
  repartidorRecoleccion: {
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, telefono: true } },
    },
  },
  repartidorEntrega: {
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, telefono: true } },
    },
  },
};

/**
 * Calcula el monto total de un pedido a partir de sus prendas.
 */
const calcularMontoPedido = (prendas) =>
  prendas.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

// ─── Crear pedido ─────────────────────────────────────────────
// POST /api/pedidos
// Rol: CLIENTE
const crearPedido = async (req, res, next) => {
  try {
    const { direccionId, prendas, fechaRecoleccion, notasCliente, metodoPago } = req.body;

    // Validar fecha de recolección (segunda línea de defensa)
    if (fechaRecoleccion) {
      const fecha = new Date(fechaRecoleccion);
      if (isNaN(fecha.getTime())) {
        return res.status(400).json({ error: 'La fecha de recolección no es válida' });
      }
      const ahora = new Date();
      const minFutura = new Date(ahora.getTime() + 60 * 60 * 1000); // mín. 1 hora en el futuro
      if (fecha < minFutura) {
        return res.status(400).json({
          error: 'La fecha de recolección debe ser al menos 1 hora en el futuro. No puedes programar recogidas en el pasado.',
        });
      }
      const maxFutura = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (fecha > maxFutura) {
        return res.status(400).json({ error: 'La fecha de recolección no puede ser más de 30 días en el futuro' });
      }
    }

    // Verificar que la dirección pertenece al cliente
    const direccion = await prisma.direccion.findUnique({ where: { id: direccionId } });
    if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
    if (direccion.usuarioId !== req.user.id) {
      return res.status(403).json({ error: 'La dirección no pertenece a tu cuenta' });
    }

    // Cargar catálogo activo
    const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true } });
    const catalogoMap = Object.fromEntries(
      catalogo.map(c => [c.nombre.toLowerCase(), c])
    );

    // Calcular prendas + total
    let totalPrendas = 0;
    const prendasData = [];

    for (const p of prendas) {
      const item = catalogoMap[p.tipo.toLowerCase()];
      if (!item) {
        return res.status(400).json({ error: `Tipo de prenda no válido: "${p.tipo}"` });
      }
      if (!Number.isInteger(p.cantidad) || p.cantidad < 1) {
        return res.status(400).json({ error: `Cantidad inválida para: "${p.tipo}"` });
      }
      totalPrendas += p.cantidad;
      prendasData.push({
        id: uuidv4(),
        tipo: p.tipo,
        cantidad: p.cantidad,
        descripcion: p.descripcion || null,
        precio: item.precioUnitario,
      });
    }

    // Cargo extra si > 10 prendas
    const tienePrendasExtra = totalPrendas > 10;
    if (tienePrendasExtra) {
      for (const pd of prendasData) {
        const item = catalogoMap[pd.tipo.toLowerCase()];
        pd.precio = pd.precio + (item ? item.precioExtra : 0);
      }
    }

    // Aplicar descuento por membresía activa
    let descuentoMembresia = 0;
    const membresia = await prisma.membresia.findFirst({
      where: { usuarioId: req.user.id, estado: 'ACTIVA' },
    });
    if (membresia && membresia.descuento > 0) {
      descuentoMembresia = membresia.descuento; // porcentaje
    }

    if (descuentoMembresia > 0) {
      for (const pd of prendasData) {
        pd.precio = pd.precio * (1 - descuentoMembresia / 100);
      }
    }

    // Crear pedido con transacción
    const pedido = await prisma.$transaction(async (tx) => {
      const nuevoPedido = await tx.pedido.create({
        data: {
          id: uuidv4(),
          clienteId: req.user.id,
          direccionId,
          totalPrendas,
          tienePrendasExtra,
          fechaRecoleccion: fechaRecoleccion ? new Date(fechaRecoleccion) : null,
          notasCliente: notasCliente || null,
          prendas: { create: prendasData },
          historial: {
            create: {
              id: uuidv4(),
              estado: 'PENDIENTE',
              nota: 'Pedido creado por cliente',
              creadoPor: req.user.id,
            },
          },
        },
        include: { prendas: true, direccion: true },
      });

      // Crear registro de pago si se indica método
      if (metodoPago && ['PAYPAL', 'EFECTIVO'].includes(metodoPago)) {
        const monto = calcularMontoPedido(nuevoPedido.prendas);
        await tx.pago.create({
          data: {
            id: uuidv4(),
            pedidoId: nuevoPedido.id,
            monto,
            metodoPago,
            estado: 'PENDIENTE',
          },
        });
      }

      return nuevoPedido;
    });

    res.status(201).json({
      mensaje: 'Pedido creado exitosamente',
      pedido,
      totalPrendas,
      tienePrendasExtra,
      montoBruto: calcularMontoPedido(pedido.prendas),
      descuentoAplicado: descuentoMembresia > 0 ? `${descuentoMembresia}%` : null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Obtener detalle de pedido ────────────────────────────────
// GET /api/pedidos/:id
const obtenerPedido = async (req, res, next) => {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_PEDIDO_COMPLETO,
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Control de acceso
    const esAdminOEmpleado = ['ADMIN', 'EMPLEADO'].includes(req.user.rol);
    const esClienteDueno = pedido.clienteId === req.user.id;
    const repartidor = req.user.rol === 'REPARTIDOR'
      ? await prisma.repartidor.findUnique({ where: { usuarioId: req.user.id } })
      : null;
    const esRepartidorAsignado = repartidor && (
      pedido.repartidorRecoleccionId === repartidor.id ||
      pedido.repartidorEntregaId === repartidor.id
    );

    if (!esAdminOEmpleado && !esClienteDueno && !esRepartidorAsignado) {
      return res.status(403).json({ error: 'No tienes acceso a este pedido' });
    }

    // Adjuntar puntos ganados por este pedido (si fue entregado)
    let puntosGanados = null;
    if (pedido.estado === 'ENTREGADO') {
      const movimiento = await prisma.movimientoPuntos.findFirst({
        where: { pedidoId: pedido.id, cantidad: { gt: 0 } },
        select: { cantidad: true, concepto: true, createdAt: true },
      });
      if (movimiento) puntosGanados = movimiento;
    }

    res.json({ ...pedido, puntosGanados });
  } catch (err) {
    next(err);
  }
};

// ─── Cambiar estado del pedido ───────────────────────────────
// PATCH /api/pedidos/:id/estado
// Rol: REPARTIDOR (algunos estados), EMPLEADO, ADMIN
const cambiarEstado = async (req, res, next) => {
  try {
    const { estado: nuevoEstado, nota } = req.body;
    const pedidoId = req.params.id;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { prendas: true },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Validar transición
    const transicionesPermitidas = TRANSICIONES[pedido.estado] || [];
    if (!transicionesPermitidas.includes(nuevoEstado)) {
      return res.status(400).json({
        error: `Transición inválida: ${pedido.estado} → ${nuevoEstado}`,
        transicionesPermitidas,
      });
    }

    // El repartidor solo puede mover estados de su flujo
    // Recoge las prendas (CONFIRMADO → RECOLECTADO) y las entrega (EN_CAMINO → ENTREGADO)
    // El empleado es quien marca EN_CAMINO cuando el repartidor de entrega ya salió
    if (req.user.rol === 'REPARTIDOR') {
      const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.user.id } });
      const estadosRepartidor = ['RECOLECTADO', 'ENTREGADO'];
      if (!estadosRepartidor.includes(nuevoEstado)) {
        return res.status(403).json({ error: 'El repartidor no puede asignar este estado' });
      }
      const esAsignado =
        pedido.repartidorRecoleccionId === repartidor.id ||
        pedido.repartidorEntregaId === repartidor.id;
      if (!esAsignado) {
        return res.status(403).json({ error: 'No estás asignado a este pedido' });
      }
    }

    // El empleado maneja estados de lavandería y despacho
    if (req.user.rol === 'EMPLEADO') {
      const estadosEmpleado = ['EN_PROCESO', 'LISTO', 'EN_CAMINO'];
      if (!estadosEmpleado.includes(nuevoEstado)) {
        return res.status(403).json({ error: 'El empleado no puede asignar este estado' });
      }
    }

    // Datos extra según estado
    const dataExtra = {};
    if (nuevoEstado === 'ENTREGADO') {
      dataExtra.fechaEntregaReal = new Date();
    }

    const pedidoActualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: nuevoEstado,
          ...dataExtra,
          historial: {
            create: {
              id: uuidv4(),
              estado: nuevoEstado,
              nota: nota || null,
              creadoPor: req.user.id,
            },
          },
        },
        include: { prendas: true },
      });

      // Al entregar: otorgar puntos + marcar pago efectivo si aplica
      if (nuevoEstado === 'ENTREGADO') {
        await otorgarPuntosPorPedido(pedido.clienteId, actualizado);

        // Si el método es efectivo, marcar como completado automáticamente
        const pago = await tx.pago.findUnique({ where: { pedidoId } });
        if (pago && pago.metodoPago === 'EFECTIVO' && pago.estado === 'PENDIENTE') {
          await tx.pago.update({
            where: { pedidoId },
            data: {
              estado: 'COMPLETADO',
              recolectadoPor: req.user.id,
            },
          });
        }
      }

      return actualizado;
    });

    res.json({
      mensaje: `Estado actualizado a ${nuevoEstado}`,
      pedido: pedidoActualizado,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Cancelar pedido ──────────────────────────────────────────
// PATCH /api/pedidos/:id/cancelar
// Rol: CLIENTE (solo si PENDIENTE), ADMIN (cualquier estado cancelable)
const cancelarPedido = async (req, res, next) => {
  try {
    const { motivo } = req.body;
    const pedido = await prisma.pedido.findUnique({
      where: { id: req.params.id },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Estado que no permite cancelación
    if (['ENTREGADO', 'CANCELADO'].includes(pedido.estado)) {
      return res.status(400).json({
        error: `No se puede cancelar un pedido en estado ${pedido.estado}`,
      });
    }

    // Cliente solo puede cancelar en PENDIENTE
    if (req.user.rol === 'CLIENTE') {
      if (pedido.clienteId !== req.user.id) {
        return res.status(403).json({ error: 'No tienes acceso a este pedido' });
      }
      if (pedido.estado !== 'PENDIENTE') {
        return res.status(400).json({
          error: 'Solo puedes cancelar pedidos en estado PENDIENTE. Contacta soporte para otros estados.',
        });
      }
    }

    const cancelado = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        estado: 'CANCELADO',
        historial: {
          create: {
            id: uuidv4(),
            estado: 'CANCELADO',
            nota: motivo || 'Cancelado por el usuario',
            creadoPor: req.user.id,
          },
        },
      },
      include: INCLUDE_PEDIDO_COMPLETO,
    });

    // Si había pago pendiente, marcarlo como reembolsado/fallido
    const pago = await prisma.pago.findUnique({ where: { pedidoId: req.params.id } });
    if (pago && pago.estado === 'PENDIENTE') {
      await prisma.pago.update({
        where: { pedidoId: req.params.id },
        data: { estado: 'REEMBOLSADO' },
      });
    }

    res.json({ mensaje: 'Pedido cancelado', pedido: cancelado });
  } catch (err) {
    next(err);
  }
};

// ─── Listar pedidos del cliente autenticado ───────────────────
// GET /api/pedidos  (cliente ve los suyos; admin/empleado ven todos)
const listarPedidos = async (req, res, next) => {
  try {
    const { estado, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (req.user.rol === 'CLIENTE') {
      where.clienteId = req.user.id;
    }
    if (estado) where.estado = estado;

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: {
          prendas: true,
          pago: true,
          direccion: true,
          cliente: { select: { nombre: true, apellido: true } },
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

// ─── Asignar repartidor (Admin) ───────────────────────────────
// PATCH /api/pedidos/:id/asignar-repartidor
const asignarRepartidor = async (req, res, next) => {
  try {
    const { repartidorId, tipo = 'recoleccion' } = req.body;
    // tipo: 'recoleccion' | 'entrega'

    const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const repartidor = await prisma.repartidor.findUnique({ where: { id: repartidorId } });
    if (!repartidor) return res.status(404).json({ error: 'Repartidor no encontrado' });
    if (repartidor.estado === 'INACTIVO') {
      return res.status(400).json({ error: 'El repartidor está inactivo' });
    }

    const campo = tipo === 'entrega' ? 'repartidorEntregaId' : 'repartidorRecoleccionId';

    const pedidoActualizado = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        [campo]: repartidorId,
        estado: tipo === 'entrega' ? pedido.estado : 'CONFIRMADO',
        historial: {
          create: {
            id: uuidv4(),
            estado: tipo === 'entrega' ? pedido.estado : 'CONFIRMADO',
            nota: `Repartidor asignado para ${tipo} por admin`,
            creadoPor: req.user.id,
          },
        },
      },
      include: INCLUDE_PEDIDO_COMPLETO,
    });

    res.json({ mensaje: `Repartidor asignado para ${tipo}`, pedido: pedidoActualizado });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearPedido,
  obtenerPedido,
  cambiarEstado,
  cancelarPedido,
  listarPedidos,
  asignarRepartidor,
};
