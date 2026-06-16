// src/services/puntos.service.js
// Reglas de negocio: 1 punto por cada prenda lavada
// Bonus x2 si tiene membresía PREMIUM o EMPRESARIAL
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

const PUNTOS_POR_PRENDA = 1;

/**
 * Otorga puntos al cliente cuando un pedido es ENTREGADO.
 * @param {string} clienteId
 * @param {object} pedido - pedido con prendas incluidas
 */
const otorgarPuntosPorPedido = async (clienteId, pedido) => {
  try {
    // Calcular puntos base
    let puntosGanados = pedido.totalPrendas * PUNTOS_POR_PRENDA;

    // Verificar membresía activa para bonus
    const membresia = await prisma.membresia.findFirst({
      where: {
        usuarioId: clienteId,
        estado: 'ACTIVA',
        tipo: { in: ['PREMIUM', 'EMPRESARIAL'] },
      },
    });
    if (membresia) {
      puntosGanados = puntosGanados * 2; // bonus x2
    }

    // Actualizar saldo de puntos
    const puntosRecord = await prisma.puntos.upsert({
      where: { usuarioId: clienteId },
      create: {
        id: uuidv4(),
        usuarioId: clienteId,
        saldo: puntosGanados,
        totalGanados: puntosGanados,
        totalCanjeados: 0,
      },
      update: {
        saldo: { increment: puntosGanados },
        totalGanados: { increment: puntosGanados },
      },
    });

    // Registrar movimiento
    await prisma.movimientoPuntos.create({
      data: {
        id: uuidv4(),
        puntosId: puntosRecord.id,
        cantidad: puntosGanados,
        concepto: `Pedido entregado - ${pedido.totalPrendas} prendas${membresia ? ' (bonus x2 membresía)' : ''}`,
        pedidoId: pedido.id,
      },
    });

    return puntosGanados;
  } catch (err) {
    // No romper el flujo principal si falla el registro de puntos
    console.error('[PuntosService] Error otorgando puntos:', err.message);
    return 0;
  }
};

/**
 * Canjea puntos del cliente para descuento.
 * @param {string} clienteId
 * @param {number} cantidad - puntos a canjear
 * @param {string} pedidoId
 */
const canjearPuntos = async (clienteId, cantidad, pedidoId) => {
  const puntos = await prisma.puntos.findUnique({ where: { usuarioId: clienteId } });
  if (!puntos || puntos.saldo < cantidad) {
    throw new Error('Puntos insuficientes');
  }

  await prisma.puntos.update({
    where: { usuarioId: clienteId },
    data: {
      saldo: { decrement: cantidad },
      totalCanjeados: { increment: cantidad },
    },
  });

  await prisma.movimientoPuntos.create({
    data: {
      id: uuidv4(),
      puntosId: puntos.id,
      cantidad: -cantidad,
      concepto: `Canje de puntos por descuento en pedido`,
      pedidoId,
    },
  });
};

module.exports = { otorgarPuntosPorPedido, canjearPuntos };
