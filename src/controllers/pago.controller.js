// src/controllers/pago.controller.js
// Métodos soportados: PayPal y Efectivo SOLAMENTE
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

// ─── Helper: calcular monto del pedido ───────────────────────
const calcularMonto = (prendas) =>
  prendas.reduce((acc, p) => acc + p.precio * p.cantidad, 0);

// ─── Helper: verificar que el pedido pertenece al cliente ────
const verificarAccesoPedido = (pedido, userId, rol) => {
  if (['ADMIN', 'EMPLEADO'].includes(rol)) return true;
  return pedido.clienteId === userId;
};

// ═══════════════════════════════════════════════════════════
//  PAYPAL
// ═══════════════════════════════════════════════════════════

/**
 * Crea la intención de pago con PayPal y almacena el registro.
 * La creación real de la orden en PayPal se hace en el cliente
 * (app móvil / frontend) usando el SDK de PayPal con el CLIENT_ID.
 * Este endpoint registra el intento y devuelve el monto y config.
 *
 * POST /api/pagos/paypal/crear-orden
 */
const crearOrdenPaypal = async (req, res, next) => {
  try {
    const { pedidoId } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { prendas: true, pago: true },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!verificarAccesoPedido(pedido, req.user.id, req.user.rol)) {
      return res.status(403).json({ error: 'No tienes acceso a este pedido' });
    }
    if (pedido.estado === 'CANCELADO') {
      return res.status(400).json({ error: 'El pedido está cancelado' });
    }
    if (pedido.pago?.estado === 'COMPLETADO') {
      return res.status(400).json({ error: 'Este pedido ya está pagado' });
    }

    const monto = calcularMonto(pedido.prendas);
    const montoRedondeado = Math.round(monto * 100) / 100;

    // Registrar / actualizar intento de pago
    const pago = await prisma.pago.upsert({
      where: { pedidoId },
      create: {
        id: uuidv4(),
        pedidoId,
        monto: montoRedondeado,
        metodoPago: 'PAYPAL',
        estado: 'PENDIENTE',
      },
      update: {
        monto: montoRedondeado,
        metodoPago: 'PAYPAL',
        estado: 'PENDIENTE',
        paypalOrderId: null,
        paypalCaptureId: null,
      },
    });

    // Devolver datos para que el cliente cree la orden en PayPal
    res.json({
      pagoId: pago.id,
      monto: montoRedondeado,
      moneda: 'MXN',
      paypalClientId: process.env.PAYPAL_CLIENT_ID,
      paypalMode: process.env.PAYPAL_MODE || 'sandbox',
      descripcion: `LavaYa - Pedido ${pedidoId.slice(0, 8)} - ${pedido.prendas.length} prendas`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Captura la orden PayPal ya aprobada por el usuario.
 * El cliente envía el orderID y captureID obtenidos del SDK de PayPal.
 *
 * POST /api/pagos/paypal/capturar
 */
const capturarPagoPaypal = async (req, res, next) => {
  try {
    const { pedidoId, paypalOrderId, paypalCaptureId } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pago: true },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!verificarAccesoPedido(pedido, req.user.id, req.user.rol)) {
      return res.status(403).json({ error: 'No tienes acceso a este pedido' });
    }
    if (!pedido.pago) {
      return res.status(400).json({ error: 'No hay registro de pago para este pedido. Crea la orden primero.' });
    }
    if (pedido.pago.estado === 'COMPLETADO') {
      return res.status(400).json({ error: 'El pago ya fue registrado como completado' });
    }

    const pagoActualizado = await prisma.$transaction(async (tx) => {
      const pago = await tx.pago.update({
        where: { pedidoId },
        data: {
          estado: 'COMPLETADO',
          paypalOrderId,
          paypalCaptureId,
          metodoPago: 'PAYPAL',
        },
      });

      // Avanzar el pedido si sigue en PENDIENTE o CONFIRMADO
      if (['PENDIENTE', 'CONFIRMADO'].includes(pedido.estado)) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: {
            historial: {
              create: {
                id: uuidv4(),
                estado: pedido.estado,
                nota: `Pago PayPal confirmado. Order: ${paypalOrderId}`,
                creadoPor: req.user.id,
              },
            },
          },
        });
      }

      return pago;
    });

    res.json({
      mensaje: 'Pago PayPal confirmado exitosamente',
      pago: pagoActualizado,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Registra el webhook de PayPal (para verificación server-to-server).
 * PayPal llama este endpoint automáticamente cuando el pago es completado.
 *
 * POST /api/pagos/paypal/webhook
 */
const webhookPaypal = async (req, res, next) => {
  try {
    const evento = req.body;
    const tipoEvento = evento?.event_type;

    if (tipoEvento === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = evento.resource?.id;
      const orderId = evento.resource?.supplementary_data?.related_ids?.order_id;

      if (captureId) {
        // Buscar pago por captureId o orderId
        const pago = await prisma.pago.findFirst({
          where: {
            OR: [
              { paypalCaptureId: captureId },
              { paypalOrderId: orderId },
            ],
          },
        });

        if (pago && pago.estado !== 'COMPLETADO') {
          await prisma.pago.update({
            where: { id: pago.id },
            data: {
              estado: 'COMPLETADO',
              paypalCaptureId: captureId,
              paypalOrderId: orderId || pago.paypalOrderId,
            },
          });
        }
      }
    }

    // PayPal espera siempre un 200
    res.status(200).json({ received: true });
  } catch (err) {
    // No romper la respuesta al webhook
    console.error('[PayPal Webhook] Error:', err.message);
    res.status(200).json({ received: true });
  }
};

// ═══════════════════════════════════════════════════════════
//  EFECTIVO
// ═══════════════════════════════════════════════════════════

/**
 * Registra la intención de pago en efectivo.
 * El repartidor cobrará al momento de la entrega.
 *
 * POST /api/pagos/efectivo/registrar
 */
const registrarPagoEfectivo = async (req, res, next) => {
  try {
    const { pedidoId } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { prendas: true, pago: true },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!verificarAccesoPedido(pedido, req.user.id, req.user.rol)) {
      return res.status(403).json({ error: 'No tienes acceso a este pedido' });
    }
    if (pedido.estado === 'CANCELADO') {
      return res.status(400).json({ error: 'El pedido está cancelado' });
    }
    if (pedido.pago?.estado === 'COMPLETADO') {
      return res.status(400).json({ error: 'Este pedido ya está pagado' });
    }

    const monto = calcularMonto(pedido.prendas);
    const montoRedondeado = Math.round(monto * 100) / 100;

    const pago = await prisma.pago.upsert({
      where: { pedidoId },
      create: {
        id: uuidv4(),
        pedidoId,
        monto: montoRedondeado,
        metodoPago: 'EFECTIVO',
        estado: 'PENDIENTE',
      },
      update: {
        monto: montoRedondeado,
        metodoPago: 'EFECTIVO',
        estado: 'PENDIENTE',
        paypalOrderId: null,
        paypalCaptureId: null,
        recolectadoPor: null,
      },
    });

    res.json({
      mensaje: 'Pago en efectivo registrado. El repartidor cobrará al entregar.',
      pago: {
        id: pago.id,
        monto: montoRedondeado,
        metodoPago: 'EFECTIVO',
        estado: 'PENDIENTE',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Confirma que el efectivo fue recibido.
 * Puede llamarlo el repartidor al entregar, o el admin/empleado.
 *
 * PATCH /api/pagos/efectivo/confirmar
 */
const confirmarPagoEfectivo = async (req, res, next) => {
  try {
    const { pedidoId } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pago: true },
    });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!pedido.pago) {
      return res.status(400).json({ error: 'No hay registro de pago para este pedido' });
    }
    if (pedido.pago.metodoPago !== 'EFECTIVO') {
      return res.status(400).json({ error: 'Este pedido no está registrado como pago en efectivo' });
    }
    if (pedido.pago.estado === 'COMPLETADO') {
      return res.status(400).json({ error: 'El pago ya fue confirmado' });
    }

    // Solo repartidor asignado, admin o empleado pueden confirmar
    if (req.user.rol === 'REPARTIDOR') {
      const repartidor = await prisma.repartidor.findUnique({ where: { usuarioId: req.user.id } });
      const esAsignado =
        pedido.repartidorRecoleccionId === repartidor?.id ||
        pedido.repartidorEntregaId === repartidor?.id;
      if (!esAsignado) {
        return res.status(403).json({ error: 'No estás asignado a este pedido' });
      }
    } else if (!['ADMIN', 'EMPLEADO'].includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para confirmar pagos en efectivo' });
    }

    const pagoActualizado = await prisma.pago.update({
      where: { pedidoId },
      data: {
        estado: 'COMPLETADO',
        recolectadoPor: req.user.id,
      },
    });

    res.json({
      mensaje: 'Pago en efectivo confirmado',
      pago: pagoActualizado,
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════
//  CONSULTAS
// ═══════════════════════════════════════════════════════════

/**
 * Obtiene el pago de un pedido específico.
 * GET /api/pagos/pedido/:pedidoId
 */
const obtenerPagoPorPedido = async (req, res, next) => {
  try {
    const { pedidoId } = req.params;

    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!verificarAccesoPedido(pedido, req.user.id, req.user.rol)) {
      return res.status(403).json({ error: 'No tienes acceso a este pedido' });
    }

    const pago = await prisma.pago.findUnique({ where: { pedidoId } });
    if (!pago) return res.status(404).json({ error: 'Aún no hay pago registrado para este pedido' });

    res.json(pago);
  } catch (err) {
    next(err);
  }
};

/**
 * Lista pagos con filtros (solo Admin/Empleado).
 * GET /api/pagos
 */
const listarPagos = async (req, res, next) => {
  try {
    const { metodoPago, estado, desde, hasta, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (metodoPago) where.metodoPago = metodoPago;
    if (estado) where.estado = estado;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(desde);
      if (hasta) where.createdAt.lte = new Date(hasta);
    }

    const [pagos, total, suma] = await Promise.all([
      prisma.pago.findMany({
        where,
        include: {
          pedido: {
            select: {
              id: true,
              estado: true,
              totalPrendas: true,
              cliente: { select: { nombre: true, apellido: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.pago.count({ where }),
      prisma.pago.aggregate({
        where: { ...where, estado: 'COMPLETADO' },
        _sum: { monto: true },
      }),
    ]);

    res.json({
      pagos,
      resumen: {
        totalRegistros: total,
        montoTotal: suma._sum.monto || 0,
      },
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

/**
 * Emitir reembolso manual (Admin).
 * PATCH /api/pagos/:id/reembolsar
 */
const reembolsar = async (req, res, next) => {
  try {
    const pago = await prisma.pago.findUnique({ where: { id: req.params.id } });
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.estado !== 'COMPLETADO') {
      return res.status(400).json({ error: 'Solo se pueden reembolsar pagos completados' });
    }

    // Si era PayPal, el reembolso real se hace via dashboard de PayPal o API
    // Aquí solo marcamos el estado en nuestra BD
    const pagoActualizado = await prisma.pago.update({
      where: { id: req.params.id },
      data: { estado: 'REEMBOLSADO' },
    });

    res.json({
      mensaje: 'Pago marcado como reembolsado',
      nota: pago.metodoPago === 'PAYPAL'
        ? 'Recuerda emitir el reembolso también desde el dashboard de PayPal'
        : null,
      pago: pagoActualizado,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearOrdenPaypal,
  capturarPagoPaypal,
  webhookPaypal,
  registrarPagoEfectivo,
  confirmarPagoEfectivo,
  obtenerPagoPorPedido,
  listarPagos,
  reembolsar,
};
