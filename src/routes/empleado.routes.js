// src/routes/empleado.routes.js
const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { cambiarEstadoRules } = require('../middlewares/validators/pedido.validators');
const prisma = require('../config/prisma');
const { v4: uuidv4 } = require('uuid');

const router = Router();
router.use(authenticate);
router.use(authorize('EMPLEADO', 'ADMIN'));

// ─── MEMBRESÍAS ───────────────────────────────────────────────
router.get('/membresias', async (req, res, next) => {
  try {
    const membresias = await prisma.membresia.findMany({
      include: { usuario: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(membresias);
  } catch (err) { next(err); }
});

router.get('/membresias/:usuarioId', async (req, res, next) => {
  try {
    const membresias = await prisma.membresia.findMany({
      where: { usuarioId: req.params.usuarioId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(membresias);
  } catch (err) { next(err); }
});

router.post('/membresias/:usuarioId/activar', async (req, res, next) => {
  try {
    const { tipo } = req.body;
    const tipoValidado = tipo || 'PREMIUM';
    
    // Calculate fechaFin (1 month from now)
    const fechaFin = new Date();
    fechaFin.setMonth(fechaFin.getMonth() + 1);
    
    // Set plan details
    const planes = {
      BASICO: { precio: 0, descuento: 0, pedidosGratis: 0 },
      PREMIUM: { precio: 149, descuento: 10, pedidosGratis: 3 },
      EMPRESARIAL: { precio: 499, descuento: 20, pedidosGratis: 9999 },
    };
    const plan = planes[tipoValidado] || planes.PREMIUM;

    // First, deactivate any existing active memberships for this user
    await prisma.membresia.updateMany({
      where: { usuarioId: req.params.usuarioId, estado: 'ACTIVA' },
      data: { estado: 'EXPIRADA' },
    });
    
    // Create new membership
    const nuevaMembresia = await prisma.membresia.create({
      data: {
        id: uuidv4(),
        usuarioId: req.params.usuarioId,
        tipo: tipoValidado,
        estado: 'ACTIVA',
        fechaInicio: new Date(),
        fechaFin,
        precio: plan.precio,
        descuento: plan.descuento,
        pedidosGratis: plan.pedidosGratis,
      },
    });
    
    res.status(201).json({ mensaje: 'Membresía activada correctamente', membresia: nuevaMembresia });
  } catch (err) { next(err); }
});

// ─── Ver pedidos en lavandería ────────────────────────────────
router.get('/pedidos/en-proceso', async (req, res, next) => {
  try {
    const { estado } = req.query;
    const estados = estado
      ? [estado]
      : ['PENDIENTE', 'CONFIRMADO', 'RECOLECTADO', 'EN_PROCESO', 'LISTO'];

    const pedidos = await prisma.pedido.findMany({
      where: { estado: { in: estados } },   
      include: {
        cliente: { select: { nombre: true, apellido: true, telefono: true } },
        prendas: true,
        direccion: true,
        pago: { select: { metodoPago: true, monto: true, estado: true } },
        repartidorRecoleccion: {
          include: { usuario: { select: { nombre: true, apellido: true } } },
        },
        historial: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ fechaRecoleccion: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(pedidos);
  } catch (err) { next(err); }
});

// ─── Pedidos que pueden recibir repartidor ─────────────────────
router.get('/pedidos/asignables', async (req, res, next) => {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        OR: [
          { estado: { in: ['PENDIENTE', 'CONFIRMADO'] }, repartidorRecoleccionId: null },
          { estado: 'LISTO', repartidorEntregaId: null },
        ],
      },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        direccion: true,
        pago: { select: { metodoPago: true, monto: true, estado: true } },
        repartidorRecoleccion: {
          include: { usuario: { select: { nombre: true, apellido: true, telefono: true } } },
        },
        repartidorEntrega: {
          include: { usuario: { select: { nombre: true, apellido: true, telefono: true } } },
        },
      },
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(pedidos);
  } catch (err) { next(err); }
});

// ─── Marcar pedido como EN_PROCESO (ingresó a lavandería) ────
router.patch('/pedidos/:id/en-proceso', async (req, res, next) => {
  try {
    const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado !== 'RECOLECTADO') {
      return res.status(400).json({ error: 'El pedido debe estar en estado RECOLECTADO' });
    }

    const actualizado = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        estado: 'EN_PROCESO',
        historial: {
          create: {
            id: uuidv4(),
            estado: 'EN_PROCESO',
            nota: 'Ingresado a lavandería',
            creadoPor: req.user.id,
          },
        },
      },
    });
    res.json({ mensaje: 'Pedido en proceso de lavado', pedido: actualizado });
  } catch (err) { next(err); }
});

// ─── Marcar pedido como LISTO ─────────────────────────────────
router.patch('/pedidos/:id/listo', async (req, res, next) => {
  try {
    const { nota } = req.body;
    const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.estado !== 'EN_PROCESO') {
      return res.status(400).json({ error: 'El pedido debe estar en estado EN_PROCESO' });
    }

    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);

    const actualizado = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        estado: 'LISTO',
        fechaEntregaEstimada: mañana,
        historial: {
          create: {
            id: uuidv4(),
            estado: 'LISTO',
            nota: nota || 'Prendas listas para entrega',
            creadoPor: req.user.id,
          },
        },
      },
      include: {
        prendas: true,
        cliente: { select: { nombre: true, telefono: true } },
        pago: { select: { metodoPago: true, monto: true } },
      },
    });
    res.json({ mensaje: 'Pedido listo para entrega', pedido: actualizado });
  } catch (err) { next(err); }
});

// ─── Confirmar pago en efectivo ──────────────────────────────
router.patch('/pedidos/:id/confirmar-pago', async (req, res, next) => {
  try {
    const pago = await prisma.pago.findUnique({ where: { pedidoId: req.params.id } });
    if (!pago) return res.status(404).json({ error: 'No hay pago registrado para este pedido' });
    if (pago.estado === 'COMPLETADO') {
      return res.status(400).json({ error: 'El pago ya fue confirmado' });
    }

    const pagoActualizado = await prisma.pago.update({
      where: { pedidoId: req.params.id },
      data: { estado: 'COMPLETADO', recolectadoPor: req.user.id },
    });
    res.json({ mensaje: 'Pago confirmado', pago: pagoActualizado });
  } catch (err) { next(err); }
});

// ─── Resumen de carga diaria ──────────────────────────────────
// FIX: Usar $transaction para ejecutar las 4 queries en 1 sola conexión
router.get('/resumen', async (req, res, next) => {
  try {
    const hoy = new Date();
    const inicioDia = new Date(hoy.setHours(0, 0, 0, 0));

    const [recolectados, enProceso, listos, entregadosHoy] = await prisma.$transaction([
      prisma.pedido.count({ where: { estado: 'RECOLECTADO' } }),
      prisma.pedido.count({ where: { estado: 'EN_PROCESO' } }),
      prisma.pedido.count({ where: { estado: 'LISTO' } }),
      prisma.pedido.count({
        where: { estado: 'ENTREGADO', fechaEntregaReal: { gte: inicioDia } },
      }),
    ]);

    res.json({ recolectados, enProceso, listos, entregadosHoy });
  } catch (err) {
    console.error('Error in /resumen:', err);
    next(err);
  }
});

// ─── Catálogo (lectura + edición para empleado) ───────────────
router.get('/catalogo', async (req, res, next) => {
  try {
    const { todos } = req.query;
    const catalogo = await prisma.catalogoPrenda.findMany({
      where: todos === 'true' ? undefined : { activo: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(catalogo);
  } catch (err) { next(err); }
});

router.post('/catalogo', async (req, res, next) => {
  try {
    const { nombre, descripcion, precioUnitario, precioExtra } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!precioUnitario || isNaN(precioUnitario) || Number(precioUnitario) <= 0) {
      return res.status(400).json({ error: 'El precio unitario debe ser mayor a 0' });
    }
    const existe = await prisma.catalogoPrenda.findUnique({
      where: { nombre: nombre.toLowerCase().trim() },
    });
    if (existe) return res.status(409).json({ error: 'Ya existe una prenda con ese nombre' });

    const item = await prisma.catalogoPrenda.create({
      data: {
        id: uuidv4(),
        nombre: nombre.toLowerCase().trim(),
        descripcion: descripcion?.trim() || null,
        precioUnitario: parseFloat(precioUnitario),
        precioExtra: parseFloat(precioExtra) || 0,
      },
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.patch('/catalogo/:id', async (req, res, next) => {
  try {
    const { nombre, descripcion, precioUnitario, precioExtra, activo } = req.body;
    const item = await prisma.catalogoPrenda.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.toLowerCase().trim() }),
        ...(descripcion !== undefined && { descripcion }),
        ...(precioUnitario !== undefined && { precioUnitario: parseFloat(precioUnitario) }),
        ...(precioExtra !== undefined && { precioExtra: parseFloat(precioExtra) }),
        ...(activo !== undefined && { activo }),
      },
    });
    res.json(item);
  } catch (err) { next(err); }
});

// ─── Repartidores disponibles ─────────────────────────────────
router.get('/repartidores', async (req, res, next) => {
  try {
    const { estado = 'DISPONIBLE' } = req.query;
    const repartidores = await prisma.repartidor.findMany({
      where: { estado },
      include: {
        usuario: {
          select: { id: true, nombre: true, apellido: true, telefono: true, activo: true },
        },
      },
      orderBy: { calificacionPromedio: 'desc' },
    });
    res.json(repartidores);
  } catch (err) { next(err); }
});

// ─── Asignar repartidor de entrega (pedidos LISTO) ────────────
// FIX: Usar $transaction para las 3 operaciones de escritura
router.patch('/pedidos/:id/asignar-entrega', async (req, res, next) => {
  try {
    const { repartidorId } = req.body;
    if (!repartidorId) {
      return res.status(400).json({ error: 'El repartidorId es obligatorio' });
    }

    // Validaciones previas con 1 sola conexión usando $transaction
    const [pedido, repartidor] = await prisma.$transaction([
      prisma.pedido.findUnique({ where: { id: req.params.id } }),
      prisma.repartidor.findUnique({ where: { id: repartidorId } }),
    ]);

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!repartidor) return res.status(404).json({ error: 'Repartidor no encontrado' });
    if (pedido.estado !== 'LISTO') {
      return res.status(400).json({ error: 'El pedido debe estar en estado LISTO para asignar entrega' });
    }
    if (repartidor.estado === 'INACTIVO') {
      return res.status(400).json({ error: 'El repartidor está inactivo' });
    }

    const pedidoActualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: req.params.id },
        data: { repartidorEntregaId: repartidorId },
      });

      await tx.historialPedido.create({
        data: {
          id: uuidv4(),
          pedidoId: req.params.id,
          estado: 'LISTO',
          nota: 'Repartidor de entrega asignado por empleado',
          creadoPor: req.user.id,
        },
      });

      await tx.repartidor.update({
        where: { id: repartidorId },
        data: { estado: 'OCUPADO' },
      });

      return actualizado;
    });

    res.json({ mensaje: 'Repartidor de entrega asignado', pedido: pedidoActualizado });
  } catch (err) { next(err); }
});

// ─── Asignar repartidor como empleado (recolección o entrega) ───
router.patch('/pedidos/:id/asignar-repartidor', async (req, res, next) => {
  try {
    const { repartidorId, tipo = 'recoleccion' } = req.body;
    if (!repartidorId) {
      return res.status(400).json({ error: 'El repartidorId es obligatorio' });
    }
    if (!['recoleccion', 'entrega'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de asignación inválido' });
    }

    const [pedido, repartidor] = await prisma.$transaction([
      prisma.pedido.findUnique({ where: { id: req.params.id } }),
      prisma.repartidor.findUnique({ where: { id: repartidorId } }),
    ]);

    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!repartidor) return res.status(404).json({ error: 'Repartidor no encontrado' });
    if (repartidor.estado === 'INACTIVO') {
      return res.status(400).json({ error: 'El repartidor está inactivo' });
    }

    if (tipo === 'recoleccion') {
      if (!['PENDIENTE', 'CONFIRMADO'].includes(pedido.estado)) {
        return res.status(400).json({ error: 'Solo puedes asignar recolección a pedidos pendientes o confirmados' });
      }
      if (pedido.repartidorRecoleccionId) {
        return res.status(400).json({ error: 'El pedido ya tiene repartidor de recolección' });
      }
    }

    if (tipo === 'entrega') {
      if (pedido.estado !== 'LISTO') {
        return res.status(400).json({ error: 'El pedido debe estar LISTO para asignar entrega' });
      }
      if (pedido.repartidorEntregaId) {
        return res.status(400).json({ error: 'El pedido ya tiene repartidor de entrega' });
      }
    }

    const campo = tipo === 'entrega' ? 'repartidorEntregaId' : 'repartidorRecoleccionId';
    const nuevoEstado = tipo === 'entrega' ? pedido.estado : 'CONFIRMADO';

    const pedidoActualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: req.params.id },
        data: {
          [campo]: repartidorId,
          estado: nuevoEstado,
          historial: {
            create: {
              id: uuidv4(),
              estado: nuevoEstado,
              nota: `Repartidor asignado para ${tipo} por empleado`,
              creadoPor: req.user.id,
            },
          },
        },
        include: {
          prendas: true,
          pago: true,
          cliente: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
          direccion: true,
          repartidorRecoleccion: { include: { usuario: { select: { nombre: true, apellido: true, telefono: true } } } },
          repartidorEntrega: { include: { usuario: { select: { nombre: true, apellido: true, telefono: true } } } },
        },
      });

      await tx.repartidor.update({
        where: { id: repartidorId },
        data: { estado: 'OCUPADO' },
      });

      return actualizado;
    });

    res.json({ mensaje: `Repartidor asignado para ${tipo}`, pedido: pedidoActualizado });
  } catch (err) { next(err); }
});

// ─── Ventas diarias (últimos N días) ──────────────────────────
router.get('/ventas-diarias', async (req, res, next) => {
  try {
    const { dias = 14 } = req.query;
    const numDias = parseInt(dias, 10) || 14;
    const desde = new Date();
    desde.setDate(desde.getDate() - numDias);
    desde.setHours(0, 0, 0, 0);

    const pedidos = await prisma.pedido.findMany({
      where: { createdAt: { gte: desde } },
      include: { pago: { select: { estado: true, monto: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const grouped = {};
    pedidos.forEach(pedido => {
      const fecha = pedido.createdAt.toISOString().split('T')[0];
      if (!grouped[fecha]) {
        grouped[fecha] = { totalPedidos: 0, entregados: 0, ingresos: 0 };
      }
      grouped[fecha].totalPedidos++;
      if (pedido.estado === 'ENTREGADO') {
        grouped[fecha].entregados++;
      }
      if (pedido.pago && pedido.pago.estado === 'COMPLETADO') {
        grouped[fecha].ingresos += Number(pedido.pago.monto);
      }
    });

    const resultado = Object.entries(grouped).map(([fecha, data]) => ({
      fecha: new Date(fecha + 'T00:00:00.000Z'),
      ...data,
    }));

    res.json(resultado);
  } catch (err) {
    console.error('Error in /ventas-diarias:', err);
    next(err);
  }
});

// ─── Crear pedido presencial ──────────────────────────────────
// FIX: Agrupar las 5 operaciones de escritura en 1 $transaction
router.post('/pedidos', async (req, res, next) => {
  try {
    const {
      clienteNombre,
      clienteApellido,
      clienteTelefono,
      prendas,
      metodoPago,
      notasInternas,
      clienteId,
      direccionEntregaId,
      direccionNueva,
    } = req.body;

    // Validaciones básicas
    if (!prendas || !Array.isArray(prendas) || prendas.length === 0) {
      return res.status(400).json({ error: 'Debes agregar al menos una prenda' });
    }
    if (!metodoPago || !['EFECTIVO', 'PAYPAL'].includes(metodoPago)) {
      return res.status(400).json({ error: 'Método de pago inválido. Usa EFECTIVO o PAYPAL' });
    }
    if (!clienteId && !clienteNombre) {
      return res.status(400).json({ error: 'Debes indicar el nombre del cliente o seleccionar un cliente registrado' });
    }

    // Cargar catálogo y validar cliente en paralelo (1 sola conexión)
    const [catalogo, clienteExiste] = await prisma.$transaction([
      prisma.catalogoPrenda.findMany({ where: { activo: true } }),
      clienteId
        ? prisma.usuario.findUnique({ where: { id: clienteId }, select: { id: true, rol: true } })
        : prisma.usuario.findUnique({ where: { id: req.user.id }, select: { id: true, rol: true } }),
    ]);

    if (clienteId && !clienteExiste) {
      return res.status(404).json({ error: 'Cliente no encontrado en el sistema' });
    }

    const catalogoMap = Object.fromEntries(catalogo.map(c => [c.nombre.toLowerCase(), c]));

    // Calcular prendas
    let totalPrendas = 0;
    const prendasData = [];
    for (const p of prendas) {
      const tipo = (p.tipo || '').toLowerCase().trim();
      const cantidad = parseInt(p.cantidad, 10);
      if (!tipo) return res.status(400).json({ error: 'Cada prenda debe tener un tipo' });
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        return res.status(400).json({ error: `Cantidad inválida para "${tipo}"` });
      }
      const item = catalogoMap[tipo];
      if (!item) return res.status(400).json({ error: `Tipo de prenda no encontrado en catálogo: "${tipo}"` });
      totalPrendas += cantidad;
      prendasData.push({ tipo, cantidad, precio: item.precioUnitario, precioExtra: item.precioExtra });
    }

    const tienePrendasExtra = totalPrendas > 10;
    if (tienePrendasExtra) {
      for (const p of prendasData) {
        p.precio = p.precio + p.precioExtra;
      }
    }

    // Aplicar descuento por membresía activa (si clienteId existe)
    let descuentoMembresia = 0;
    if (clienteId) {
      const membresia = await prisma.membresia.findFirst({
        where: { usuarioId: clienteId, estado: 'ACTIVA' },
      });
      if (membresia && membresia.descuento > 0) {
        descuentoMembresia = membresia.descuento;
        for (const p of prendasData) {
          p.precio = p.precio * (1 - descuentoMembresia / 100);
        }
      }
    }

    const montoTotal = prendasData.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
    const clienteFinalId = clienteId || req.user.id;

    let notasInternasCompletas = notasInternas || '';
    if (!clienteId && clienteNombre) {
      const datosCliente = [
        `Cliente presencial: ${clienteNombre} ${clienteApellido || ''}`.trim(),
        clienteTelefono ? `Tel: ${clienteTelefono}` : null,
      ].filter(Boolean).join(' | ');
      notasInternasCompletas = notasInternas
        ? `${datosCliente}\n${notasInternas}`
        : datosCliente;
    }

    const pedidoId = uuidv4();
    let direccionIdFinal = null;

    // FIX: Todas las escrituras en 1 sola $transaction → 1 sola conexión
    await prisma.$transaction(async (tx) => {
      // Si hay nueva dirección, crearla primero
      if (direccionNueva) {
        const newDireccion = await tx.direccion.create({
          data: {
            id: uuidv4(),
            usuarioId: clienteFinalId,
            calle: direccionNueva.calle,
            numero: direccionNueva.numero,
            colonia: direccionNueva.colonia,
            ciudad: direccionNueva.ciudad,
            estado: direccionNueva.estado || 'Desconocido',
            codigoPostal: direccionNueva.codigoPostal || '00000',
          },
        });
        direccionIdFinal = newDireccion.id;
      } else if (direccionEntregaId) {
        // Verificar que la dirección exista y pertenezca al cliente
        const direccionExiste = await tx.direccion.findFirst({
          where: { id: direccionEntregaId, usuarioId: clienteFinalId },
        });
        if (!direccionExiste) {
          throw new Error('Dirección no encontrada o no pertenece al cliente');
        }
        direccionIdFinal = direccionEntregaId;
      }

      await tx.pedido.create({
        data: {
          id: pedidoId,
          clienteId: clienteFinalId,
          direccionId: direccionIdFinal,
          estado: 'RECOLECTADO',
          totalPrendas,
          tienePrendasExtra,
          notasCliente: `Pedido presencial — ${clienteNombre || 'Cliente'} ${clienteApellido || ''}`.trim(),
          notasInternas: notasInternasCompletas || null,
        },
      });

      await tx.prenda.createMany({
        data: prendasData.map(p => ({
          id: uuidv4(),
          pedidoId,
          tipo: p.tipo,
          cantidad: p.cantidad,
          precio: p.precio,
        })),
      });

      await tx.pago.create({
        data: {
          id: uuidv4(),
          pedidoId,
          monto: montoTotal,
          metodoPago,
          estado: 'PENDIENTE',
          recolectadoPor: req.user.id,
        },
      });

      await tx.historialPedido.create({
        data: {
          id: uuidv4(),
          pedidoId,
          estado: 'RECOLECTADO',
          nota: `Pedido presencial creado por empleado. Cliente: ${clienteNombre || ''} ${clienteApellido || ''}`.trim(),
          creadoPor: req.user.id,
        },
      });
    });

    // 1 sola query al final para devolver el pedido completo
    const pedidoCompleto = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        prendas: true,
        pago: true,
        historial: { orderBy: { createdAt: 'asc' } },
        direccion: true,
      },
    });

    res.status(201).json({
      mensaje: 'Pedido presencial creado correctamente',
      pedido: pedidoCompleto,
    });
  } catch (err) { 
    console.error('Error creating in-person order:', err);
    next(err); 
  }
});

// ─── Buscar clientes registrados ──────────────────────────────
router.get('/clientes', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.json([]);
    }
    const buscar = String(q).trim();
    const clientes = await prisma.usuario.findMany({
      where: {
        rol: 'CLIENTE',
        activo: true,
        OR: [
          { nombre:   { contains: buscar } },
          { apellido: { contains: buscar } },
          { email:    { contains: buscar } },
          { telefono: { contains: buscar } },
        ],
      },
      select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
      take: 8,
    });
    res.json(clientes);
  } catch (err) { next(err); }
});

// ─── Historial de pedidos de un cliente ───────────────────────
router.get('/clientes/:clienteId/pedidos', async (req, res, next) => {
  try {
    const { clienteId } = req.params;
    const pedidos = await prisma.pedido.findMany({
      where: { clienteId },
      include: {
        direccion: true,
        pago: { select: { monto: true, metodoPago: true, estado: true } },
        historial: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
    });
    res.json(pedidos);
  } catch (err) { next(err); }
});

// ─── Obtener direcciones de un cliente ────────────────────────
router.get('/clientes/:clienteId/direcciones', async (req, res, next) => {
  try {
    const { clienteId } = req.params;
    const direcciones = await prisma.direccion.findMany({
      where: { usuarioId: clienteId },
      orderBy: { esPrincipal: 'desc' },
    });
    res.json(direcciones);
  } catch (err) { next(err); }
});

module.exports = router;