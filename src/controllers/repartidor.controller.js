// src/controllers/repartidor.controller.js
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { TRANSICIONES } = require('../middlewares/validators/pedido.validators');

// ─── Helper: obtener perfil repartidor del usuario autenticado ─
const getRepartidor = async (usuarioId) => {
  const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId } });
  if (!repartidor) throw Object.assign(new Error('Perfil de repartidor no encontrado'), { status: 404 });
  return repartidor;
};

// ─── Dashboard del repartidor ─────────────────────────────────
// GET /api/repartidores/dashboard
const dashboard = async (req, res, next) => {
  try {
    const repartidor = await getRepartidor(req.user.id);

    const [pedidosActivos, pedidosHoy, pedidosDisponibles, calificaciones] = await Promise.all([
      // Pedidos activos asignados
      prisma.pedido.count({
        where: {
          OR: [
            { repartidorRecoleccionId: repartidor.id },
            { repartidorEntregaId: repartidor.id },
          ],
          estado: { notIn: ['ENTREGADO', 'CANCELADO'] },
        },
      }),
      // Pedidos entregados hoy
      prisma.pedido.count({
        where: {
          OR: [
            { repartidorRecoleccionId: repartidor.id },
            { repartidorEntregaId: repartidor.id },
          ],
          estado: 'ENTREGADO',
          fechaEntregaReal: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      // Pedidos disponibles para aceptar
      prisma.pedido.count({
        where: { estado: 'PENDIENTE', repartidorRecoleccionId: null },
      }),
      // Últimas 5 calificaciones
      prisma.calificacion.findMany({
        where: { repartidorId: repartidor.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { pedido: { select: { id: true, createdAt: true } } },
      }),
    ]);

    res.json({
      repartidor: {
        id: repartidor.id,
        estado: repartidor.estado,
        calificacionPromedio: repartidor.calificacionPromedio,
        totalServicios: repartidor.totalServicios,
        ubicacion: {
          latitud: repartidor.latitudActual,
          longitud: repartidor.longitudActual,
        },
      },
      estadisticas: {
        pedidosActivos,
        pedidosHoy,
        pedidosDisponibles,
      },
      calificaciones,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Pedidos disponibles para aceptar ────────────────────────
// GET /api/repartidores/pedidos/disponibles
const pedidosDisponibles = async (req, res, next) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: 'PENDIENTE',
        repartidorRecoleccionId: null,
      },
      include: {
        direccion: true,
        prendas: true,
        cliente: { select: { nombre: true, apellido: true, telefono: true } },
        pago: { select: { metodoPago: true, monto: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(pedidos);
  } catch (err) {
    next(err);
  }
};

// ─── Mis pedidos asignados ────────────────────────────────────
// GET /api/repartidores/pedidos/mis-pedidos
const misPedidos = async (req, res, next) => {
  try {
    const repartidor = await getRepartidor(req.user.id);
    const { estado } = req.query;

    const where = {
      OR: [
        { repartidorRecoleccionId: repartidor.id },
        { repartidorEntregaId: repartidor.id },
      ],
    };
    if (estado) {
      where.estado = estado;
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        direccion: true,
        prendas: true,
        pago: { select: { metodoPago: true, monto: true, estado: true } },
        cliente: { select: { nombre: true, apellido: true, telefono: true } },
        historial: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(pedidos);
  } catch (err) {
    next(err);
  }
};

// ─── Aceptar pedido ───────────────────────────────────────────
// PATCH /api/repartidores/pedidos/:id/aceptar
//
// ⚠️  PROTECCIÓN CONTRA RACE CONDITION
// El `update` usa un WHERE compuesto que incluye estado = 'PENDIENTE' y
// repartidorRecoleccionId = null. Si dos repartidores llaman al mismo
// tiempo, el primero actualiza 1 fila; el segundo actualiza 0 filas
// (porque ya no se cumple la condición). Prisma lanza P2025 cuando
// un update no encuentra ningún registro coincidente, lo que convierte
// la race condition en un error determinístico.
// Esto es equivalente a:
//   UPDATE pedidos
//   SET estado = 'CONFIRMADO', repartidor_id = ?
//   WHERE id = ? AND estado = 'PENDIENTE' AND repartidor_id IS NULL
//
const aceptarPedido = async (req, res, next) => {
  try {
    const repartidor = await getRepartidor(req.user.id);

    if (repartidor.estado === 'INACTIVO') {
      return res.status(400).json({ error: 'Tu cuenta de repartidor está inactiva' });
    }

    // Verificar que el pedido existe antes de intentar la actualización atómica
    const pedidoExiste = await prisma.pedido.findUnique({
      where: { id: req.params.id },
      select: { id: true, estado: true, repartidorRecoleccionId: true },
    });
    if (!pedidoExiste) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    // Pre-check para dar un error más descriptivo si ya está tomado
    // (el check atómico del UPDATE captura el caso concurrente real)
    if (pedidoExiste.estado !== 'PENDIENTE') {
      return res.status(409).json({ error: 'Este pedido ya no está disponible' });
    }
    if (pedidoExiste.repartidorRecoleccionId) {
      return res.status(409).json({ error: 'Este pedido ya fue tomado por otro repartidor' });
    }

    // ── UPDATE ATÓMICO: condición en el WHERE del update ──────────
    // Si entre el check anterior y este update otro repartidor se adelantó,
    // Prisma lanzará PrismaClientKnownRequestError con code P2025
    // (record not found), que capturamos abajo.
    let pedidoActualizado;
    try {
      pedidoActualizado = await prisma.pedido.update({
        where: {
          id: req.params.id,
          // Condición atómica: solo actualiza si TODAVÍA está en PENDIENTE
          // sin repartidor asignado
          estado: 'PENDIENTE',
          repartidorRecoleccionId: null,
        },
        data: {
          repartidorRecoleccionId: repartidor.id,
          estado: 'CONFIRMADO',
        },
        include: {
          prendas: true,
          pago: true,
          direccion: true,
          cliente: { select: { nombre: true, apellido: true, telefono: true } },
        },
      });
    } catch (updateErr) {
      // P2025 = "Record to update not found" — otro repartidor se adelantó
      if (updateErr?.code === 'P2025') {
        return res.status(409).json({
          error: 'Este pedido acaba de ser tomado por otro repartidor. Intenta con otro pedido.',
        });
      }
      throw updateErr; // cualquier otro error sube al handler global
    }

    // ── Historial + marcar OCUPADO (no críticos para la atomicidad) ──
    await prisma.historialPedido.create({
      data: {
        id: uuidv4(),
        pedidoId: req.params.id,
        estado: 'CONFIRMADO',
        nota: 'Aceptado por repartidor',
        creadoPor: req.user.id,
      },
    });

    await prisma.repartidor.update({
      where: { id: repartidor.id },
      data: { estado: 'OCUPADO' },
    });

    res.json({ mensaje: 'Pedido aceptado', pedido: pedidoActualizado });
  } catch (err) {
    next(err);
  }
};

// ─── Cambiar estado del pedido ────────────────────────────────
// PATCH /api/repartidores/pedidos/:id/estado
const cambiarEstadoPedido = async (req, res, next) => {
  try {
    const { estado: nuevoEstado, nota } = req.body;
    const repartidor = await getRepartidor(req.user.id);

    const pedido = await prisma.pedido.findUnique({
      where: { id: req.params.id },
      include: { prendas: true, pago: true },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // Verificar que el repartidor está asignado
    const esAsignado =
      pedido.repartidorRecoleccionId === repartidor.id ||
      pedido.repartidorEntregaId === repartidor.id;
    if (!esAsignado) {
      return res.status(403).json({ error: 'No estás asignado a este pedido' });
    }

    // Validar transición
    const transicionesPermitidas = TRANSICIONES[pedido.estado] || [];
    if (!transicionesPermitidas.includes(nuevoEstado)) {
      return res.status(400).json({
        error: `Transición inválida: ${pedido.estado} → ${nuevoEstado}`,
        transicionesPermitidas,
      });
    }

    // Repartidor solo mueve estados de su scope
    const estadosRepartidor = ['CONFIRMADO', 'RECOLECTADO', 'EN_CAMINO', 'ENTREGADO'];
    if (!estadosRepartidor.includes(nuevoEstado)) {
      return res.status(403).json({
        error: `El repartidor no puede asignar el estado ${nuevoEstado}`,
      });
    }

    // ── 1. Actualizar pedido + historial ──
    const pedidoActualizado = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        estado: nuevoEstado,
        ...(nuevoEstado === 'ENTREGADO' ? { fechaEntregaReal: new Date() } : {}),
      },
      include: {
        prendas: true,
        pago: true,
        cliente: { select: { nombre: true } },
      },
    });

    // ── 2. Crear entrada en historial ──
    await prisma.historialPedido.create({
      data: {
        id: uuidv4(),
        pedidoId: req.params.id,
        estado: nuevoEstado,
        nota: nota || null,
        creadoPor: req.user.id,
      },
    });

    // ── 3. Puntos al repartidor por acción ───────────────────────
    // RECOLECTADO (+5 puntos): recogió las prendas en casa del cliente
    // ENTREGADO   (+10 puntos): entregó las prendas en casa del cliente
    const puntosGanados = nuevoEstado === 'RECOLECTADO' ? 5
                        : nuevoEstado === 'ENTREGADO'   ? 10
                        : 0;

    if (puntosGanados > 0) {
      try {
        // Asegurar que el repartidor tiene registro de Puntos
        const puntosRecord = await prisma.puntos.upsert({
          where:  { usuarioId: repartidor.usuarioId },
          update: {
            saldo:        { increment: puntosGanados },
            totalGanados: { increment: puntosGanados },
          },
          create: {
            id:            uuidv4(),
            usuarioId:     repartidor.usuarioId,
            saldo:         puntosGanados,
            totalGanados:  puntosGanados,
            totalCanjeados: 0,
          },
        });

        await prisma.movimientoPuntos.create({
          data: {
            id:       uuidv4(),
            puntosId: puntosRecord.id,
            cantidad: puntosGanados,
            concepto: nuevoEstado === 'RECOLECTADO'
              ? `Recolección del pedido #${req.params.id.slice(0, 8)}`
              : `Entrega del pedido #${req.params.id.slice(0, 8)}`,
            pedidoId: req.params.id,
          },
        });
      } catch (pErr) {
        console.error('⚠️ Error otorgando puntos al repartidor:', pErr.message);
        // No bloquear la respuesta por un error en puntos
      }
    }

    // ── 4. Efectos al entregar ──
    if (nuevoEstado === 'ENTREGADO') {
      const pedidosActivos = await prisma.pedido.count({
        where: {
          OR: [
            { repartidorRecoleccionId: repartidor.id },
            { repartidorEntregaId: repartidor.id },
          ],
          estado: { notIn: ['ENTREGADO', 'CANCELADO'] },
          id: { not: req.params.id },
        },
      });

      await prisma.repartidor.update({
        where: { id: repartidor.id },
        data: {
          estado: pedidosActivos === 0 ? 'DISPONIBLE' : 'OCUPADO',
          totalServicios: { increment: 1 },
        },
      });

      if (pedido.pago?.metodoPago === 'EFECTIVO' && pedido.pago?.estado === 'PENDIENTE') {
        await prisma.pago.update({
          where: { pedidoId: req.params.id },
          data: { estado: 'COMPLETADO', recolectadoPor: req.user.id },
        });
      }
    }

    res.json({ mensaje: `Estado actualizado a ${nuevoEstado}`, pedido: pedidoActualizado });
  } catch (err) {
    next(err);
  }
};

// ─── Actualizar ubicación GPS ─────────────────────────────────
// PATCH /api/repartidores/ubicacion
const actualizarUbicacion = async (req, res, next) => {
  try {
    const { latitud, longitud } = req.body;
    const repartidor = await getRepartidor(req.user.id);

    await prisma.repartidor.update({
      where: { id: repartidor.id },
      data: { latitudActual: latitud, longitudActual: longitud },
    });

    res.json({ ok: true, latitud, longitud, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
};

// ─── Subir foto de entrega ────────────────────────────────────
// PATCH /api/repartidores/pedidos/:id/foto-entrega
// Espera { fotoUrl: string } (la URL ya subida al storage externo)
const subirFotoEntrega = async (req, res, next) => {
  try {
    const { fotoUrl } = req.body;
    const repartidor = await getRepartidor(req.user.id);

    const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    const esAsignado =
      pedido.repartidorRecoleccionId === repartidor.id ||
      pedido.repartidorEntregaId === repartidor.id;
    if (!esAsignado) {
      return res.status(403).json({ error: 'No estás asignado a este pedido' });
    }

    // Guardar URL en notasInternas del pedido (campo disponible sin migración)
    const pedidoActualizado = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        notasInternas: JSON.stringify({
          ...(pedido.notasInternas ? JSON.parse(pedido.notasInternas) : {}),
          fotoEntrega: fotoUrl,
          fotoEntregaTimestamp: new Date().toISOString(),
        }),
        historial: {
          create: {
            id: uuidv4(),
            estado: pedido.estado,
            nota: `Foto de entrega registrada: ${fotoUrl}`,
            creadoPor: req.user.id,
          },
        },
      },
    });

    res.json({ mensaje: 'Foto de entrega registrada', fotoUrl });
  } catch (err) {
    next(err);
  }
};

// ─── Cambiar disponibilidad ───────────────────────────────────
// PATCH /api/repartidores/disponibilidad
const cambiarDisponibilidad = async (req, res, next) => {
  try {
    const { estado } = req.body; // DISPONIBLE | OCUPADO | INACTIVO
    const estadosPermitidos = ['DISPONIBLE', 'INACTIVO'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ error: `Estado debe ser: ${estadosPermitidos.join(' o ')}` });
    }

    const repartidor = await getRepartidor(req.user.id);

    // No puede ponerse DISPONIBLE si tiene pedidos activos
    if (estado === 'INACTIVO') {
      const tieneActivos = await prisma.pedido.count({
        where: {
          OR: [
            { repartidorRecoleccionId: repartidor.id },
            { repartidorEntregaId: repartidor.id },
          ],
          estado: { notIn: ['ENTREGADO', 'CANCELADO'] },
        },
      });
      if (tieneActivos > 0) {
        return res.status(400).json({
          error: 'Tienes pedidos activos. Completa o transfiere los pedidos antes de inactivarte.',
        });
      }
    }

    await prisma.repartidor.update({
      where: { id: repartidor.id },
      data: { estado },
    });

    res.json({ mensaje: `Disponibilidad actualizada a ${estado}` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  dashboard,
  pedidosDisponibles,
  misPedidos,
  aceptarPedido,
  cambiarEstadoPedido,
  actualizarUbicacion,
  subirFotoEntrega,
  cambiarDisponibilidad,
};
