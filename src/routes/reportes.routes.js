const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

// GET /api/admin/reportes/pedidos-por-dia?dias=14
router.get('/pedidos-por-dia', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;

    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);

    const pedidos = await prisma.pedido.findMany({
      where: {
        createdAt: { gte: desde }
      },
      select: {
        createdAt: true,
        estado: true,
        pago: {
          select: { monto: true, estado: true }
        }
      }
    });

    const porDia = {};
    pedidos.forEach(pedido => {
      const dia = pedido.createdAt.toISOString().split('T')[0];
      if (!porDia[dia]) {
        porDia[dia] = { fecha: dia, total: 0, ingresos: 0, estados: {} };
      }
      porDia[dia].total++;

      if (pedido.pago?.estado === 'COMPLETADO') {
        porDia[dia].ingresos += pedido.pago.monto;
      }

      const estado = pedido.estado;
      porDia[dia].estados[estado] = (porDia[dia].estados[estado] || 0) + 1;
    });

    const resultado = [];
    for (let i = dias - 1; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const key = fecha.toISOString().split('T')[0];
      resultado.push(porDia[key] || { fecha: key, total: 0, ingresos: 0, estados: {} });
    }

    res.json({ ok: true, dias, data: resultado });

  } catch (error) {
    console.error('Error en pedidos-por-dia:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;