// src/services/pedido.scheduler.js
//
// Cron jobs para gestión automática del ciclo de vida del pedido:
//
//  JOB 1 — cada 5 min: marca RETRASADO si la franja terminó y no fue recolectado
//  JOB 2 — cada 5 min: cancela automáticamente si lleva 2h en RETRASADO sin repartidor
//
const cron    = require('node-cron');
const prisma  = require('../config/prisma');
const { v4: uuidv4 } = require('uuid');

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Dado "HH:MM-HH:MM" devuelve el Date del fin de la franja en la fecha indicada.
 * Ej: "12:00-14:00", fecha 2026-06-30 → Date del 2026-06-30T14:00:00 local
 */
/**
 * Dado un Date (ya en UTC desde la BD) y una franja "HH:MM-HH:MM",
 * devuelve el Date del FIN de la franja en UTC.
 *
 * La fechaRecoleccion almacenada es el INICIO de la franja en UTC.
 * Por ej: cliente en Perú eligió 08:00-10:00 → BD guarda 2026-06-30T13:00:00Z (08:00 UTC-5)
 * Fin de franja = inicio + duración de la franja.
 *
 * La duración se calcula desde el string "HH:MM-HH:MM" de la franja.
 * Para franjas que cruzan la medianoche (ej: 22:00-00:00, 00:00-03:00)
 * se suma 24h al horaFin si es menor que horaInicio.
 */
function duracionFranjaMs(franjaStr) {
  if (!franjaStr) return 2 * 60 * 60 * 1000; // fallback 2h
  const partes = franjaStr.split('-');
  if (partes.length < 2) return 2 * 60 * 60 * 1000;
  const [hIni, mIni] = partes[0].split(':').map(Number);
  const [hFin, mFin] = partes[1].split(':').map(Number);
  let minInicio = hIni * 60 + mIni;
  let minFin    = hFin * 60 + mFin;
  if (minFin <= minInicio) minFin += 24 * 60; // cruza medianoche
  return (minFin - minInicio) * 60 * 1000;
}

function finDeFranja(fechaUTC, franjaStr) {
  if (!fechaUTC) return null;
  return new Date(new Date(fechaUTC).getTime() + duracionFranjaMs(franjaStr));
}

async function crearHistorial(tx, pedidoId, estado, nota) {
  await tx.historialPedido.create({
    data: {
      id: uuidv4(),
      pedidoId,
      estado,
      nota,
      creadoPor: null, // sistema automático
    },
  });
}

// ─── JOB 1: Franja vencida → RETRASADO ───────────────────────
//
// Condiciones para marcar RETRASADO:
//   - estado IN (PENDIENTE, CONFIRMADO)
//   - tiene fechaRecoleccion Y franjaRecoleccion
//   - el fin de la franja ya pasó
//
async function marcarRetrasados() {
  const ahora = new Date();

  // Buscar candidatos: pedidos activos con franja definida
  const candidatos = await prisma.pedido.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'CONFIRMADO'] },
      fechaRecoleccion: { not: null },
      franjaRecoleccion: { not: null },
    },
    select: {
      id: true,
      clienteId: true,
      estado: true,
      fechaRecoleccion: true,
      franjaRecoleccion: true,
    },
  });

  let marcados = 0;

  for (const p of candidatos) {
    const fin = finDeFranja(p.fechaRecoleccion, p.franjaRecoleccion);
    if (!fin || fin > ahora) continue; // la franja aún no terminó

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id: p.id },
        data: { estado: 'RETRASADO' },
      });
      await crearHistorial(
        tx, p.id, 'RETRASADO',
        `Recolección no realizada en la franja ${p.franjaRecoleccion}. Pendiente de asignación.`
      );
    });

    console.log(`[Scheduler] Pedido ${p.id.slice(0,8)} → RETRASADO (franja ${p.franjaRecoleccion} terminó)`);
    marcados++;
  }

  if (marcados > 0) console.log(`[Scheduler] ${marcados} pedido(s) marcados como RETRASADO`);
}

// ─── JOB 2: RETRASADO + 2h sin repartidor → CANCELADO ────────
//
// Condiciones para cancelar automáticamente:
//   - estado = RETRASADO
//   - repartidorRecoleccionId = null (nadie lo aceptó)
//   - hace más de 2 horas que entró en RETRASADO
//     (se mide por el updatedAt del pedido, que se actualiza en cada cambio de estado)
//
const HORAS_HASTA_CANCELAR = 2;

async function cancelarRetrasadosSinRepartidor() {
  const corte = new Date(Date.now() - HORAS_HASTA_CANCELAR * 60 * 60 * 1000);

  const candidatos = await prisma.pedido.findMany({
    where: {
      estado: 'RETRASADO',
      repartidorRecoleccionId: null,
      updatedAt: { lte: corte },
    },
    select: { id: true },
  });

  let cancelados = 0;

  for (const p of candidatos) {
    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id: p.id },
        data: { estado: 'CANCELADO' },
      });
      await crearHistorial(
        tx, p.id, 'CANCELADO',
        `Cancelado automáticamente: sin repartidor asignado ${HORAS_HASTA_CANCELAR}h después del retraso.`
      );
    });

    console.log(`[Scheduler] Pedido ${p.id.slice(0,8)} → CANCELADO automáticamente (${HORAS_HASTA_CANCELAR}h sin repartidor)`);
    cancelados++;
  }

  if (cancelados > 0) console.log(`[Scheduler] ${cancelados} pedido(s) cancelados automáticamente`);
}

// ─── Registro de tareas ───────────────────────────────────────

function iniciarScheduler() {
  // Cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    try {
      await marcarRetrasados();
      await cancelarRetrasadosSinRepartidor();
    } catch (err) {
      console.error('[Scheduler] Error en ciclo de pedidos:', err.message);
    }
  });

  console.log('[Scheduler] Tareas de pedidos iniciadas (cada 5 min)');
}

module.exports = { iniciarScheduler };
