
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

// Plan prices (we can also add to Prisma later)
const PLAN_PRECIOS = {
  BASICO: 0,
  PREMIUM: 149,
  EMPRESARIAL: 499,
};

const PLAN_DESCUENTOS = {
  BASICO: 0,
  PREMIUM: 10,
  EMPRESARIAL: 20,
};

const PLAN_PEDIDOS_GRATIS = {
  BASICO: 0,
  PREMIUM: 3,
  EMPRESARIAL: 9999,
};

const crearOrdenPaypal = async (req, res, next) => {
  try {
    const { tipo } = req.body;
    const usuarioId = req.user.id;

    const precio = PLAN_PRECIOS[tipo];
    if (precio === undefined) {
      return res.status(400).json({ error: 'Tipo de membresía inválido' });
    }

    // Deactivate existing active membership
    await prisma.membresia.updateMany({
      where: { usuarioId, estado: 'ACTIVA' },
      data: { estado: 'EXPIRADA' },
    });

    // Calculate expiration
    const fechaFin = new Date();
    fechaFin.setMonth(fechaFin.getMonth() + 1);

    // Create membership record
    const membresia = await prisma.membresia.create({
      data: {
        id: uuidv4(),
        usuarioId,
        tipo,
        estado: precio === 0 ? 'ACTIVA' : 'EXPIRADA', // BASICO is free, activate immediately
        fechaInicio: new Date(),
        fechaFin,
        precio,
        descuento: PLAN_DESCUENTOS[tipo],
        pedidosGratis: PLAN_PEDIDOS_GRATIS[tipo],
      },
    });

    if (precio === 0) {
      return res.status(201).json({
        mensaje: 'Membresía básica activada',
        membresia,
      });
    }

    // Create payment record
    const pagoMembresia = await prisma.pagoMembresia.create({
      data: {
        id: uuidv4(),
        membresiaId: membresia.id,
        monto: precio,
        metodoPago: 'PAYPAL',
        estado: 'PENDIENTE',
      },
    });

    res.json({
      pagoMembresiaId: pagoMembresia.id,
      monto: precio,
      moneda: 'PEN',
      paypalClientId: process.env.PAYPAL_CLIENT_ID,
      paypalMode: process.env.PAYPAL_MODE || 'sandbox',
      descripcion: `LavaYa - Membresía ${tipo}`,
    });
  } catch (err) {
    next(err);
  }
};

const capturarPagoPaypal = async (req, res, next) => {
  try {
    const { pagoMembresiaId, paypalOrderId, paypalCaptureId } = req.body;

    const pagoMembresia = await prisma.pagoMembresia.findUnique({
      where: { id: pagoMembresiaId },
      include: { membresia: true },
    });

    if (!pagoMembresia) {
      return res.status(404).json({ error: 'Pago de membresía no encontrado' });
    }

    if (pagoMembresia.estado === 'COMPLETADO') {
      return res.status(400).json({ error: 'Pago ya completado' });
    }

    await prisma.$transaction(async (tx) => {
      // Update payment record
      await tx.pagoMembresia.update({
        where: { id: pagoMembresiaId },
        data: {
          estado: 'COMPLETADO',
          paypalOrderId,
        },
      });

      // Activate membership
      await tx.membresia.update({
        where: { id: pagoMembresia.membresiaId },
        data: { estado: 'ACTIVA' },
      });
    });

    const membresiaActualizada = await prisma.membresia.findUnique({
      where: { id: pagoMembresia.membresiaId },
    });

    res.json({
      mensaje: 'Pago completado, membresía activada',
      membresia: membresiaActualizada,
    });
  } catch (err) {
    next(err);
  }
};

const getMembresiasUsuario = async (req, res, next) => {
  try {
    const membresias = await prisma.membresia.findMany({
      where: { usuarioId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(membresias);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  crearOrdenPaypal,
  capturarPagoPaypal,
  getMembresiasUsuario,
};
