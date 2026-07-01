// src/controllers/repartidor.controller.js
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { TRANSICIONES } = require('../middlewares/validators/pedido.validators');
const { otorgarPuntosPorPedido } = require('../services/puntos.service');

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
// Devuelve dos tipos de pedidos que un repartidor puede tomar:
//   1. PENDIENTE sin repartidor de recojo  → para recoger en casa del cliente
//   2. EN_CAMINO sin repartidor de entrega → para entregar al cliente (listos en lavandería)
const pedidosDisponibles = async (req, res, next) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        OR: [
          { estado: 'PENDIENTE',  repartidorRecoleccionId: null },
          { estado: 'EN_CAMINO',  repartidorEntregaId: null     },
        ],
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
// Por defecto devuelve solo los pedidos ACTIVOS (no terminados ni cancelados).
// Pasar ?todos=1 para incluir historial completo.
const misPedidos = async (req, res, next) => {
  try {
    const repartidor = await getRepartidor(req.user.id);
    const { estado, todos } = req.query;

    const where = {
      OR: [
        { repartidorRecoleccionId: repartidor.id },
        { repartidorEntregaId: repartidor.id },
      ],
    };

    if (estado) {
      where.estado = estado;
    } else if (!todos) {
      // Sin filtros explícitos: solo pedidos activos (excluir terminales)
      where.estado = { notIn: ['ENTREGADO', 'CANCELADO'] };
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
      select: { id: true, estado: true, repartidorRecoleccionId: true, repartidorEntregaId: true },
    });
    if (!pedidoExiste) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // ── Caso A: aceptar recojo (pedido PENDIENTE) ──────────────────
    if (pedidoExiste.estado === 'PENDIENTE') {
      if (pedidoExiste.repartidorRecoleccionId) {
        return res.status(409).json({ error: 'Este pedido ya fue tomado por otro repartidor' });
      }

      let pedidoActualizado;
      try {
        pedidoActualizado = await prisma.pedido.update({
          where: {
            id: req.params.id,
            estado: 'PENDIENTE',
            repartidorRecoleccionId: null,
          },
          data: {
            repartidorRecoleccionId: repartidor.id,
            estado: 'CONFIRMADO',
          },
          include: {
            prendas: true, pago: true, direccion: true,
            cliente: { select: { nombre: true, apellido: true, telefono: true } },
          },
        });
      } catch (updateErr) {
        if (updateErr?.code === 'P2025') {
          return res.status(409).json({
            error: 'Este pedido acaba de ser tomado por otro repartidor. Intenta con otro pedido.',
          });
        }
        throw updateErr;
      }

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

      return res.json({ mensaje: 'Pedido aceptado para recojo', pedido: pedidoActualizado });
    }

    // ── Caso B: aceptar entrega (pedido EN_CAMINO, sin repartidor de entrega) ─
    if (pedidoExiste.estado === 'EN_CAMINO') {
      if (pedidoExiste.repartidorEntregaId) {
        return res.status(409).json({ error: 'Este pedido ya tiene repartidor de entrega asignado' });
      }

      let pedidoActualizado;
      try {
        pedidoActualizado = await prisma.pedido.update({
          where: {
            id: req.params.id,
            estado: 'EN_CAMINO',
            repartidorEntregaId: null,
          },
          data: {
            repartidorEntregaId: repartidor.id,
          },
          include: {
            prendas: true, pago: true, direccion: true,
            cliente: { select: { nombre: true, apellido: true, telefono: true } },
          },
        });
      } catch (updateErr) {
        if (updateErr?.code === 'P2025') {
          return res.status(409).json({
            error: 'Este pedido acaba de ser tomado por otro repartidor. Intenta con otro pedido.',
          });
        }
        throw updateErr;
      }

      await prisma.historialPedido.create({
        data: {
          id: uuidv4(),
          pedidoId: req.params.id,
          estado: 'EN_CAMINO',
          nota: 'Repartidor de entrega asignado',
          creadoPor: req.user.id,
        },
      });

      await prisma.repartidor.update({
        where: { id: repartidor.id },
        data: { estado: 'OCUPADO' },
      });

      return res.json({ mensaje: 'Pedido aceptado para entrega', pedido: pedidoActualizado });
    }

    // ── Estado no aceptable ─────────────────────────────────────────
    return res.status(409).json({
      error: `Este pedido no está disponible para aceptar (estado: ${pedidoExiste.estado})`,
    });

  } catch (err) {
    next(err);
  }
};

// ─── Cambiar estado del pedido ────────────────────────────────
// PATCH /api/repartidores/pedidos/:id/estado
const cambiarEstadoPedido = async (req, res, next) => {
  try {
    const { estado: nuevoEstado, nota, fotoUrl } = req.body;
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

    // Repartidor solo mueve estados de su scope:
    // Recoge del cliente (CONFIRMADO → RECOLECTADO), entrega (EN_CAMINO → ENTREGADO)
    // y puede cancelar si no puede completar su tarea (CONFIRMADO|EN_CAMINO → CANCELADO)
    const estadosRepartidor = ['RECOLECTADO', 'ENTREGADO', 'CANCELADO'];
    if (!estadosRepartidor.includes(nuevoEstado)) {
      return res.status(403).json({
        error: `El repartidor no puede asignar el estado ${nuevoEstado}`,
      });
    }

    // ── 1. Actualizar pedido + historial ──
    // Si el repartidor envía fotoUrl al marcar ENTREGADO, se guarda en notasInternas
    const notasActuales = pedido.notasInternas
      ? (() => { try { return JSON.parse(pedido.notasInternas); } catch { return {}; } })()
      : {};

    const pedidoActualizado = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        estado: nuevoEstado,
        ...(nuevoEstado === 'ENTREGADO' ? { fechaEntregaReal: new Date() } : {}),
        // Guardar foto de entrega en notasInternas si se proporcionó
        ...(nuevoEstado === 'ENTREGADO' && fotoUrl ? {
          notasInternas: JSON.stringify({
            ...notasActuales,
            fotoEntrega:          fotoUrl,
            fotoEntregaTimestamp: new Date().toISOString(),
          }),
        } : {}),
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

    // ── 4. Efectos al RECOLECTAR — repartidor queda libre inmediatamente ──
    // El repartidor deja la ropa en la lavandería y ya no necesita esperar.
    // Queda DISPONIBLE para aceptar otro pedido.
    if (nuevoEstado === 'RECOLECTADO') {
      await prisma.repartidor.update({
        where: { id: repartidor.id },
        data: { estado: 'DISPONIBLE' },
      });
    }

    // ── 5. Efectos al entregar ──
    if (nuevoEstado === 'ENTREGADO') {
      // Otorgar puntos al CLIENTE por las prendas lavadas
      await otorgarPuntosPorPedido(pedido.clienteId, pedidoActualizado);

      await prisma.repartidor.update({
        where: { id: repartidor.id },
        data: {
          estado: 'DISPONIBLE',
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

    // ── 6. Efectos al cancelar ──
    if (nuevoEstado === 'CANCELADO') {
      // El repartidor queda disponible para tomar otro pedido
      await prisma.repartidor.update({
        where: { id: repartidor.id },
        data: { estado: 'DISPONIBLE' },
      });
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
