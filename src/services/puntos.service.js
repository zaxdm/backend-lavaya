// src/services/puntos.service.js
// Reglas de negocio: 1 punto por cada prenda lavada
// Bonus x2 si tiene membresía PREMIUM o EMPRESARIAL
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

const PUNTOS_POR_PRENDA = 1;

/**
 * Otorga puntos al cliente cuando un pedido es ENTREGADO.
 * @param {string} clienteId
 * @param {object} pedido - pedido con prendas incluidas (debe tener totalPrendas e id)
 * @param {object} [tx] - cliente Prisma de transacción (opcional; si no se pasa usa prisma global)
 */
const otorgarPuntosPorPedido = async (clienteId, pedido, tx) => {
  const db = tx || prisma;
  try {
    const totalPrendas = pedido.totalPrendas ?? 0;
    if (totalPrendas <= 0) {
      console.warn(`[PuntosService] Pedido ${pedido.id} sin prendas — no se otorgan puntos`);
      return 0;
    }

    // Calcular puntos base
    let puntosGanados = totalPrendas * PUNTOS_POR_PRENDA;

    // Verificar membresía activa para bonus x2
    const membresia = await db.membresia.findFirst({
      where: {
        usuarioId: clienteId,
        estado: 'ACTIVA',
        tipo: { in: ['PREMIUM', 'EMPRESARIAL'] },
      },
    });
    if (membresia) {
      puntosGanados = puntosGanados * 2; // bonus x2
    }

    // Actualizar saldo de puntos (upsert: crea si no existe)
    const puntosRecord = await db.puntos.upsert({
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
    await db.movimientoPuntos.create({
      data: {
        id: uuidv4(),
        puntosId: puntosRecord.id,
        cantidad: puntosGanados,
        concepto: `Pedido entregado - ${totalPrendas} prenda${totalPrendas !== 1 ? 's' : ''}${membresia ? ' (bonus x2 membresía)' : ''}`,
        pedidoId: pedido.id,
      },
    });

    console.log(`[PuntosService] +${puntosGanados} pts → cliente ${clienteId} (pedido ${pedido.id})`);
    return puntosGanados;
  } catch (err) {
    // No romper el flujo principal si falla el registro de puntos,
    // pero sí registrar el error claramente para poder depurar.
    console.error(`[PuntosService] Error otorgando puntos para pedido ${pedido?.id}:`, err.message);
    return 0;
  }
};

/**
 * Canjea puntos del cliente para descuento.
 * @param {string} clienteId
 * @param {number} cantidad - puntos a canjear
 * @param {string} pedidoId
 * @param {object} [tx] - cliente Prisma de transacción (opcional)
 */
const canjearPuntos = async (clienteId, cantidad, pedidoId, tx) => {
  const db = tx || prisma;
  const puntos = await db.puntos.findUnique({ where: { usuarioId: clienteId } });
  if (!puntos || puntos.saldo < cantidad) {
    throw new Error('Puntos insuficientes');
  }

  await db.puntos.update({
    where: { usuarioId: clienteId },
    data: {
      saldo: { decrement: cantidad },
      totalCanjeados: { increment: cantidad },
    },
  });

  await db.movimientoPuntos.create({
    data: {
      id: uuidv4(),
      puntosId: puntos.id,
      cantidad: -cantidad,
      concepto: `Canje de ${cantidad} puntos por descuento en pedido`,
      pedidoId,
    },
  });
};

module.exports = { otorgarPuntosPorPedido, canjearPuntos };
