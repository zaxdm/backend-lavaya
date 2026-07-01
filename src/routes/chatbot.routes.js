// src/routes/chatbot.routes.js
// Chatbot conversacional de LavaYa — sin IA externa, lógica propia.
// Maneja: info del negocio, consulta de pedidos, creación de pedidos,
// puntos, membresías, catálogo, precios, horarios y más.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const prisma  = require('../config/prisma');
const { authenticate } = require('../middlewares/auth.middleware');

// ─── Sesiones en memoria (se limpian al reiniciar) ──────────────
// En producción se podría mover a Redis.
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

function getSession(sessionId, userId) {
  let s = sessions.get(sessionId);
  if (!s) {
    s = {
      id: sessionId,
      userId,
      step: 'menu',          // estado de la conversación
      pedidoEnCurso: null,   // datos del pedido que se está armando
      lastActivity: Date.now(),
    };
    sessions.set(sessionId, s);
  }
  s.lastActivity = Date.now();
  return s;
}

// Limpiar sesiones expiradas cada 10 min
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActivity > SESSION_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000);

// ─── Helpers de respuesta ────────────────────────────────────────
function resp(text, options = [], extra = {}) {
  return { text, options, ...extra };
}

function menuPrincipal() {
  return resp(
    '¿En qué te puedo ayudar hoy? 😊',
    [
      { label: '📦 Hacer un pedido',     value: 'hacer_pedido'    },
      { label: '🔍 Ver mis pedidos',      value: 'ver_pedidos'     },
      { label: '💰 Mis puntos',           value: 'ver_puntos'      },
      { label: '👑 Membresías',           value: 'ver_membresias'  },
      { label: '📋 Ver catálogo',         value: 'ver_catalogo'    },
      { label: '❓ Preguntas frecuentes', value: 'faq'             },
      { label: '🏪 Sobre LavaYa',         value: 'sobre_lavaya'    },
    ]
  );
}

// ─── Ruta principal ──────────────────────────────────────────────
// POST /api/chatbot/mensaje
// Body: { sessionId, mensaje, opcion? }
// Requiere autenticación del cliente.
router.post('/mensaje', authenticate, async (req, res, next) => {
  try {
    const { sessionId: clientSessionId, mensaje = '', opcion } = req.body;
    const userId = req.user.id;

    // Usar el sessionId del cliente o crear uno nuevo
    const sessionId = clientSessionId || uuidv4();
    const session   = getSession(sessionId, userId);
    const input     = (opcion || mensaje).toString().trim().toLowerCase();

    // ── Detectar intención desde cualquier paso ──────────────────
    // Palabras clave globales que reinician el flujo
    if (['menu', 'inicio', 'volver', 'cancelar', 'salir', 'reset'].includes(input)) {
      session.step = 'menu';
      session.pedidoEnCurso = null;
      return res.json({ sessionId, ...menuPrincipal() });
    }

    // ── Máquina de estados ───────────────────────────────────────
    const result = await handleStep(session, input, userId);
    return res.json({ sessionId, ...result });

  } catch (err) {
    next(err);
  }
});

// ─── Motor de conversación ───────────────────────────────────────
async function handleStep(session, input, userId) {

  // ════════════════════════════════════════════════════════════════
  // MENÚ PRINCIPAL
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'menu') {
    const saludos = ['hola', 'hi', 'buenas', 'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'ola'];
    if (saludos.some(s => input.includes(s))) {
      const usuario = await prisma.usuario.findUnique({ where: { id: userId }, select: { nombre: true } });
      return resp(
        `¡Hola, ${usuario?.nombre || 'cliente'}! 👋 Soy el asistente de LavaYa. ¿En qué te puedo ayudar?`,
        [
          { label: '📦 Hacer un pedido',     value: 'hacer_pedido'    },
          { label: '🔍 Ver mis pedidos',      value: 'ver_pedidos'     },
          { label: '💰 Mis puntos',           value: 'ver_puntos'      },
          { label: '👑 Membresías',           value: 'ver_membresias'  },
          { label: '📋 Ver catálogo',         value: 'ver_catalogo'    },
          { label: '❓ Preguntas frecuentes', value: 'faq'             },
        ]
      );
    }

    switch (input) {
      case 'hacer_pedido':
        return await iniciarFlujoHacerPedido(session, userId);

      case 'ver_pedidos':
        return await mostrarPedidos(userId);

      case 'ver_puntos':
        return await mostrarPuntos(userId);

      case 'ver_membresias':
        return await mostrarMembresias(userId);

      case 'ver_catalogo':
        return await mostrarCatalogo();

      case 'faq':
        session.step = 'faq';
        return resp(
          '¿Sobre qué tienes dudas? 🤔',
          [
            { label: '⏱ ¿Cuánto tarda el servicio?', value: 'faq_tiempo'     },
            { label: '💵 ¿Cuánto cuesta?',            value: 'faq_precio'     },
            { label: '👕 ¿Qué ropa lavan?',           value: 'faq_ropa'       },
            { label: '📍 ¿Tienen cobertura?',         value: 'faq_cobertura'  },
            { label: '💳 ¿Cómo pago?',                value: 'faq_pago'       },
            { label: '🎁 ¿Cómo funcionan los puntos?',value: 'faq_puntos'     },
            { label: '↩ Volver al inicio',            value: 'menu'           },
          ]
        );

      case 'sobre_lavaya':
        return resp(
          '🏪 *LavaYa* es tu servicio de lavandería a domicilio.\n\n' +
          '✅ Recogemos tu ropa en casa\n' +
          '✅ La lavamos y planchamos con cuidado\n' +
          '✅ Te la entregamos lista en 24-48 horas\n' +
          '✅ Seguimiento en tiempo real\n' +
          '✅ Pago con PayPal o efectivo\n\n' +
          '📞 ¿Necesitas más información?',
          [
            { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
            { label: '↩ Volver',           value: 'menu'         },
          ]
        );

      default:
        // Detectar intenciones por palabras clave en texto libre
        return detectarIntencionLibre(session, input);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // FAQ
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'faq') {
    switch (input) {
      case 'faq_tiempo':
        return resp(
          '⏱ *Tiempo de servicio:*\n\n' +
          '• Recojo: en la franja que elijas (mañana, tarde o noche)\n' +
          '• Lavado: 12 a 24 horas\n' +
          '• Entrega: en las siguientes 24 horas\n\n' +
          'En total: *24 a 48 horas* desde que retiramos tu ropa. 🚀',
          [
            { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
            { label: '↩ Volver al FAQ',    value: 'faq'          },
            { label: '🏠 Inicio',          value: 'menu'         },
          ]
        );

      case 'faq_precio':
        const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true }, orderBy: { precioUnitario: 'asc' }, take: 5 });
        const precios  = catalogo.map(p => `• ${p.nombre}: S/${p.precioUnitario.toFixed(2)}`).join('\n');
        return resp(
          `💵 *Precios de muestra:*\n\n${precios}\n\n` +
          '💡 Si tienes más de 10 prendas se aplica un pequeño cargo adicional por prenda.\n' +
          '🎁 Con membresía Premium o Empresarial obtienes descuentos automáticos.',
          [
            { label: '📋 Ver catálogo completo', value: 'ver_catalogo'  },
            { label: '📦 Hacer un pedido',       value: 'hacer_pedido'  },
            { label: '↩ Volver al FAQ',          value: 'faq'           },
          ]
        );

      case 'faq_ropa':
        return resp(
          '👕 *Tipos de ropa que lavamos:*\n\n' +
          '• Camisas, camisetas, blusas\n' +
          '• Pantalones, jeans, shorts\n' +
          '• Vestidos y faldas\n' +
          '• Ropa de cama (sábanas, fundas, mantas)\n' +
          '• Toallas\n' +
          '• Trajes, vestidos de gala (con cuidado especial)\n' +
          '• Y mucho más 😊\n\n' +
          '⚠️ No aceptamos: ropa con daños severos, alfombras, edredones muy gruesos.',
          [
            { label: '📋 Ver catálogo completo', value: 'ver_catalogo' },
            { label: '↩ Volver al FAQ',          value: 'faq'          },
          ]
        );

      case 'faq_cobertura':
        return resp(
          '📍 *Cobertura:*\n\n' +
          'Actualmente operamos en Lima Metropolitana.\n\n' +
          '🗺 Distritos principales:\n' +
          'Miraflores, San Isidro, Surco, La Molina, San Borja, Barranco, Chorrillos, Lince, Jesús María, Pueblo Libre y más.\n\n' +
          '¿Estás en un distrito que no aparece? ¡Escríbenos, estamos expandiendo! 🚀',
          [
            { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
            { label: '↩ Volver al FAQ',    value: 'faq'          },
          ]
        );

      case 'faq_pago':
        return resp(
          '💳 *Métodos de pago:*\n\n' +
          '• 💙 *PayPal* — pago online seguro (tarjeta de crédito/débito, saldo PayPal)\n' +
          '• 💵 *Efectivo* — le pagas al repartidor al momento del recojo\n\n' +
          '🎁 También puedes usar tus *puntos de fidelidad* para obtener descuentos.',
          [
            { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
            { label: '💰 Ver mis puntos',  value: 'ver_puntos'   },
            { label: '↩ Volver al FAQ',    value: 'faq'          },
          ]
        );

      case 'faq_puntos':
        return resp(
          '🎁 *Sistema de puntos LavaYa:*\n\n' +
          '• Ganas puntos por cada pedido completado\n' +
          '• *50 puntos = S/5.00 de descuento*\n' +
          '• Los puedes canjear al crear tu próximo pedido\n' +
          '• Se acumulan automáticamente, ¡nunca los pierdes!\n\n' +
          '¿Cuántos puntos tienes ahora?',
          [
            { label: '💰 Ver mis puntos',  value: 'ver_puntos'   },
            { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
            { label: '↩ Volver al FAQ',    value: 'faq'          },
          ]
        );

      default:
        session.step = 'menu';
        return menuPrincipal();
    }
  }

  // ════════════════════════════════════════════════════════════════
  // FLUJO DE PEDIDO — Paso 1: elegir dirección
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'pedido_direccion') {
    // El input es el ID de la dirección seleccionada
    const direccion = await prisma.direccion.findFirst({
      where: { id: input, usuarioId: userId },
    });
    if (!direccion) {
      const dirs = await prisma.direccion.findMany({ where: { usuarioId: userId } });
      return resp(
        'No encontré esa dirección. Elige una de tus direcciones guardadas:',
        dirs.map(d => ({ label: `${d.calle} ${d.numero}, ${d.colonia}`, value: d.id }))
      );
    }
    session.pedidoEnCurso.direccionId   = direccion.id;
    session.pedidoEnCurso.direccionText = `${direccion.calle} ${direccion.numero}, ${direccion.colonia}`;
    session.step = 'pedido_prendas';

    const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
    const opciones  = catalogo.map(p => ({
      label: `${p.nombre} — S/${p.precioUnitario.toFixed(2)}`,
      value: p.nombre,
    }));
    opciones.push({ label: '✅ Listo, siguiente paso', value: 'prendas_listo' });

    return resp(
      `📍 Dirección seleccionada: *${session.pedidoEnCurso.direccionText}*\n\n` +
      '👕 Ahora dime, ¿qué prendas quieres lavar?\n' +
      'Selecciona una prenda para agregar 1 unidad (puedes seleccionar varias veces la misma):',
      opciones
    );
  }

  // ════════════════════════════════════════════════════════════════
  // FLUJO DE PEDIDO — Paso 2: agregar prendas
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'pedido_prendas') {
    if (input === 'prendas_listo') {
      if (!session.pedidoEnCurso.prendas || session.pedidoEnCurso.prendas.length === 0) {
        return resp(
          '⚠️ Todavía no has agregado ninguna prenda. Selecciona al menos una.',
          (await getPrendasOpciones())
        );
      }

      // Mostrar resumen de prendas y pedir fecha
      session.step = 'pedido_fecha';
      const resumen = formatearPrendas(session.pedidoEnCurso.prendas);
      return resp(
        `✅ *Prendas seleccionadas:*\n${resumen}\n\n` +
        '📅 ¿Para cuándo quieres el recojo?\n' +
        'Elige una opción o escribe una fecha (DD/MM/YYYY):',
        [
          { label: '🌅 Mañana por la mañana',   value: 'manana_manana'  },
          { label: '☀️ Mañana por la tarde',    value: 'manana_tarde'   },
          { label: '🌙 Mañana por la noche',    value: 'manana_noche'   },
          { label: '📅 En 2 días (mañana)',      value: 'dos_dias'       },
          { label: '📅 En 3 días',               value: 'tres_dias'      },
          { label: '📝 Escribir fecha',          value: 'fecha_manual'   },
        ]
      );
    }

    if (input === 'quitar_ultima') {
      if (session.pedidoEnCurso.prendas?.length > 0) {
        session.pedidoEnCurso.prendas.pop();
      }
      return await mostrarEstadoPrendas(session);
    }

    // El input es el nombre de una prenda del catálogo
    const prenda = await prisma.catalogoPrenda.findFirst({
      where: { nombre: { equals: input, mode: 'insensitive' }, activo: true },
    });

    if (!prenda) {
      return resp(
        '❌ No reconocí esa prenda. Elige una del catálogo:',
        await getPrendasOpciones()
      );
    }

    // Agregar prenda (acumular cantidad si ya existe)
    if (!session.pedidoEnCurso.prendas) session.pedidoEnCurso.prendas = [];
    const existente = session.pedidoEnCurso.prendas.find(p => p.tipo.toLowerCase() === prenda.nombre.toLowerCase());
    if (existente) {
      existente.cantidad += 1;
    } else {
      session.pedidoEnCurso.prendas.push({ tipo: prenda.nombre, cantidad: 1, precio: prenda.precioUnitario, precioExtra: prenda.precioExtra });
    }

    return await mostrarEstadoPrendas(session);
  }

  // ════════════════════════════════════════════════════════════════
  // FLUJO DE PEDIDO — Paso 3: fecha y franja
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'pedido_fecha') {
    const fecha = parsearFecha(input);
    if (!fecha) {
      return resp(
        '❌ No entendí esa fecha. Por favor elige una opción o escribe con formato DD/MM/YYYY:',
        [
          { label: '🌅 Mañana por la mañana',  value: 'manana_manana' },
          { label: '☀️ Mañana por la tarde',   value: 'manana_tarde'  },
          { label: '🌙 Mañana por la noche',   value: 'manana_noche'  },
          { label: '📅 En 2 días',              value: 'dos_dias'      },
          { label: '📅 En 3 días',              value: 'tres_dias'     },
        ]
      );
    }
    session.pedidoEnCurso.fechaRecoleccion = fecha.iso;
    session.pedidoEnCurso.franjaRecoleccion = fecha.franja;
    session.step = 'pedido_pago';

    return resp(
      `📅 Recojo programado para: *${fecha.texto}*\n\n` +
      '💳 ¿Cómo quieres pagar?',
      [
        { label: '💙 PayPal (en línea)',  value: 'PAYPAL'   },
        { label: '💵 Efectivo al repartidor', value: 'EFECTIVO' },
      ]
    );
  }

  // ════════════════════════════════════════════════════════════════
  // FLUJO DE PEDIDO — Paso 4: método de pago
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'pedido_pago') {
    if (!['paypal', 'efectivo'].includes(input)) {
      return resp(
        '❌ Por favor elige un método de pago:',
        [
          { label: '💙 PayPal',   value: 'PAYPAL'   },
          { label: '💵 Efectivo', value: 'EFECTIVO' },
        ]
      );
    }

    session.pedidoEnCurso.metodoPago = input.toUpperCase();
    session.step = 'pedido_notas';

    return resp(
      '📝 ¿Tienes alguna nota o instrucción especial para el repartidor?\n' +
      '(Por ejemplo: "Tocar el timbre 2 veces", "No usar suavizante", etc.)\n\n' +
      'O puedes saltar este paso:',
      [
        { label: '⏭ Sin notas, continuar', value: 'sin_notas' },
      ]
    );
  }

  // ════════════════════════════════════════════════════════════════
  // FLUJO DE PEDIDO — Paso 5: notas opcionales
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'pedido_notas') {
    if (input !== 'sin_notas' && input.length > 0) {
      session.pedidoEnCurso.notas = input;
    }
    session.step = 'pedido_confirmar';
    return await mostrarResumenPedido(session, userId);
  }

  // ════════════════════════════════════════════════════════════════
  // FLUJO DE PEDIDO — Paso 6: confirmación final
  // ════════════════════════════════════════════════════════════════
  if (session.step === 'pedido_confirmar') {
    if (input === 'confirmar_pedido') {
      return await crearPedidoDesdeChat(session, userId);
    }
    if (input === 'editar_pedido') {
      session.step = 'pedido_prendas';
      session.pedidoEnCurso.prendas = [];
      const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
      return resp(
        '✏️ De acuerdo, volvemos a las prendas. ¿Qué quieres lavar?',
        [
          ...catalogo.map(p => ({ label: `${p.nombre} — S/${p.precioUnitario.toFixed(2)}`, value: p.nombre })),
          { label: '✅ Listo, siguiente paso', value: 'prendas_listo' },
        ]
      );
    }
    session.step = 'menu';
    session.pedidoEnCurso = null;
    return resp('❌ Pedido cancelado. ¿En qué más te puedo ayudar?', [], menuPrincipal());
  }

  // Si no se reconoció nada, detectar intención libre o volver al menú
  session.step = 'menu';
  return detectarIntencionLibre(session, input);
}

// ─── Funciones auxiliares ────────────────────────────────────────

async function iniciarFlujoHacerPedido(session, userId) {
  const dirs = await prisma.direccion.findMany({
    where: { usuarioId: userId },
    orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
  });

  if (dirs.length === 0) {
    session.step = 'menu';
    return resp(
      '⚠️ No tienes direcciones guardadas.\n\n' +
      'Para hacer un pedido necesitas al menos una dirección registrada. ' +
      'Ve a *Mi Perfil → Mis Direcciones* para agregar una. 📍',
      [{ label: '↩ Volver al inicio', value: 'menu' }]
    );
  }

  session.pedidoEnCurso = { prendas: [], direccionId: null, metodoPago: null, notas: null, fechaRecoleccion: null, franjaRecoleccion: null };
  session.step = 'pedido_direccion';

  return resp(
    '📍 ¿A qué dirección enviamos al repartidor a recoger tu ropa?',
    dirs.map(d => ({
      label: `${d.esPrincipal ? '⭐ ' : ''}${d.calle} ${d.numero}, ${d.colonia} — ${d.ciudad}`,
      value: d.id,
    }))
  );
}

async function getPrendasOpciones() {
  const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  return [
    ...catalogo.map(p => ({ label: `${p.nombre} — S/${p.precioUnitario.toFixed(2)}`, value: p.nombre })),
    { label: '✅ Listo, siguiente paso', value: 'prendas_listo' },
  ];
}

async function mostrarEstadoPrendas(session) {
  const resumen = formatearPrendas(session.pedidoEnCurso.prendas);
  const totalPrendas = session.pedidoEnCurso.prendas.reduce((a, b) => a + b.cantidad, 0);
  const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  const extra = totalPrendas > 10 ? '\n\n💡 *Nota:* Más de 10 prendas — se aplica un pequeño cargo extra por prenda.' : '';

  return resp(
    `✅ Prenda agregada!\n\n*Tu lista actual (${totalPrendas} prenda${totalPrendas !== 1 ? 's' : ''}):*\n${resumen}${extra}\n\n¿Agregas algo más?`,
    [
      ...catalogo.map(p => ({ label: `${p.nombre} — S/${p.precioUnitario.toFixed(2)}`, value: p.nombre })),
      { label: '🗑 Quitar última prenda',    value: 'quitar_ultima'  },
      { label: '✅ Listo, siguiente paso',   value: 'prendas_listo'  },
    ]
  );
}

function formatearPrendas(prendas) {
  if (!prendas || prendas.length === 0) return '(ninguna)';
  return prendas.map(p => `• ${p.tipo} × ${p.cantidad}`).join('\n');
}

async function mostrarResumenPedido(session, userId) {
  const p = session.pedidoEnCurso;
  const totalPrendas = p.prendas.reduce((a, b) => a + b.cantidad, 0);
  const tienePrendasExtra = totalPrendas > 10;

  // Calcular monto estimado
  let monto = 0;
  for (const prenda of p.prendas) {
    const precio = tienePrendasExtra
      ? (prenda.precio + prenda.precioExtra) * prenda.cantidad
      : prenda.precio * prenda.cantidad;
    monto += precio;
  }

  // Verificar membresía activa
  const membresia = await prisma.membresia.findFirst({
    where: { usuarioId: userId, estado: 'ACTIVA' },
    orderBy: { createdAt: 'desc' },
  });
  let descMembresiaText = '';
  if (membresia && membresia.descuento > 0) {
    const descuento = monto * (membresia.descuento / 100);
    monto -= descuento;
    descMembresiaText = `\n💎 Descuento ${membresia.tipo}: -S/${descuento.toFixed(2)}`;
  }

  const metodo  = p.metodoPago === 'PAYPAL' ? '💙 PayPal' : '💵 Efectivo';
  const fechaTxt = p.fechaRecoleccion
    ? new Date(p.fechaRecoleccion).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Por coordinar';
  const franjaTxt = p.franjaRecoleccion ? ` (${p.franjaRecoleccion})` : '';

  return resp(
    `📋 *Resumen de tu pedido:*\n\n` +
    `📍 Dirección: ${p.direccionText}\n` +
    `👕 Prendas:\n${formatearPrendas(p.prendas)}\n` +
    `📦 Total prendas: ${totalPrendas}\n` +
    `📅 Recojo: ${fechaTxt}${franjaTxt}\n` +
    `💳 Pago: ${metodo}\n` +
    (p.notas ? `📝 Notas: ${p.notas}\n` : '') +
    `${descMembresiaText}\n` +
    `💰 *Monto estimado: S/${monto.toFixed(2)}*\n\n` +
    '¿Confirmamos el pedido?',
    [
      { label: '✅ Sí, confirmar pedido',   value: 'confirmar_pedido' },
      { label: '✏️ Editar prendas',         value: 'editar_pedido'    },
      { label: '❌ Cancelar',               value: 'cancelar'         },
    ]
  );
}

async function crearPedidoDesdeChat(session, userId) {
  const p = session.pedidoEnCurso;
  try {
    // Cargar catálogo para precios correctos
    const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true } });
    const catalogoMap = {};
    for (const item of catalogo) catalogoMap[item.nombre.toLowerCase()] = item;

    const totalPrendas = p.prendas.reduce((a, b) => a + b.cantidad, 0);
    const tienePrendasExtra = totalPrendas > 10;

    // Construir prendas con precios correctos
    const prendasData = p.prendas.map(prenda => {
      const cat  = catalogoMap[prenda.tipo.toLowerCase()];
      const precio = cat
        ? (tienePrendasExtra ? cat.precioUnitario + cat.precioExtra : cat.precioUnitario)
        : prenda.precio;
      return { id: uuidv4(), tipo: prenda.tipo, cantidad: prenda.cantidad, precio };
    });

    // Calcular monto total
    let montoTotal = prendasData.reduce((a, b) => a + b.precio * b.cantidad, 0);

    // Aplicar descuento de membresía
    const membresia = await prisma.membresia.findFirst({
      where: { usuarioId: userId, estado: 'ACTIVA' },
      orderBy: { createdAt: 'desc' },
    });
    if (membresia && membresia.descuento > 0) {
      montoTotal = montoTotal * (1 - membresia.descuento / 100);
    }

    // Crear pedido en DB
    const pedido = await prisma.pedido.create({
      data: {
        id: uuidv4(),
        clienteId: userId,
        direccionId: p.direccionId,
        estado: 'PENDIENTE',
        totalPrendas,
        tienePrendasExtra,
        fechaRecoleccion: p.fechaRecoleccion ? new Date(p.fechaRecoleccion) : null,
        franjaRecoleccion: p.franjaRecoleccion || null,
        notasCliente: p.notas || null,
        prendas: { create: prendasData },
        pago: {
          create: {
            id: uuidv4(),
            monto: Math.max(0.5, parseFloat(montoTotal.toFixed(2))),
            metodoPago: p.metodoPago,
            estado: 'PENDIENTE',
          },
        },
        historial: {
          create: {
            id: uuidv4(),
            estado: 'PENDIENTE',
            nota: 'Pedido creado desde el chatbot',
            creadoPor: userId,
          },
        },
      },
    });

    // Limpiar sesión
    session.step = 'menu';
    session.pedidoEnCurso = null;

    const metodoPagoText = p.metodoPago === 'PAYPAL'
      ? '💙 Ingresa a tu historial de pedidos para completar el pago con PayPal.'
      : '💵 El repartidor cobrará en efectivo al momento del recojo.';

    return resp(
      `🎉 *¡Pedido creado exitosamente!*\n\n` +
      `🔖 ID: #${pedido.id.substring(0, 8).toUpperCase()}\n` +
      `📦 ${totalPrendas} prendas\n` +
      `💰 Total: S/${Math.max(0.5, parseFloat(montoTotal.toFixed(2))).toFixed(2)}\n\n` +
      `${metodoPagoText}\n\n` +
      `Te avisaremos cuando un repartidor acepte tu pedido. 🚀`,
      [
        { label: '🔍 Ver mis pedidos', value: 'ver_pedidos' },
        { label: '🏠 Volver al inicio', value: 'menu'        },
      ],
      { pedidoId: pedido.id }  // incluir el ID para que el cliente pueda navegar
    );
  } catch (err) {
    console.error('[Chatbot] Error creando pedido:', err);
    session.step = 'menu';
    session.pedidoEnCurso = null;
    return resp(
      '❌ Hubo un error al crear tu pedido. Por favor intenta desde la aplicación o inténtalo de nuevo.',
      [{ label: '↩ Volver al inicio', value: 'menu' }]
    );
  }
}

async function mostrarPedidos(userId) {
  const pedidos = await prisma.pedido.findMany({
    where: { clienteId: userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, estado: true, totalPrendas: true, createdAt: true, pago: { select: { monto: true } } },
  });

  if (pedidos.length === 0) {
    return resp(
      '📭 Aún no tienes pedidos. ¿Te animas a hacer el primero?',
      [
        { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
        { label: '↩ Volver',           value: 'menu'         },
      ]
    );
  }

  const estadoEmoji = { PENDIENTE: '⏳', CONFIRMADO: '✅', RECOLECTADO: '🚚', EN_PROCESO: '🫧', LISTO: '✨', EN_CAMINO: '🏠', ENTREGADO: '🎉', CANCELADO: '❌', RETRASADO: '⚠️', REPROGRAMADO: '📅' };
  const lista = pedidos.map(p =>
    `${estadoEmoji[p.estado] || '📦'} *#${p.id.substring(0, 8).toUpperCase()}* — ${p.estado.replace('_', ' ')} — ${p.totalPrendas} prenda${p.totalPrendas !== 1 ? 's' : ''} — S/${p.pago?.monto?.toFixed(2) || '–'}`
  ).join('\n');

  return resp(
    `📋 *Tus últimos pedidos:*\n\n${lista}`,
    [
      { label: '📦 Hacer un nuevo pedido', value: 'hacer_pedido' },
      { label: '↩ Volver al inicio',       value: 'menu'         },
    ]
  );
}

async function mostrarPuntos(userId) {
  const puntos = await prisma.puntos.findUnique({ where: { usuarioId: userId } });
  if (!puntos || puntos.saldo === 0) {
    return resp(
      '💰 *Tus puntos:* 0 pts\n\n¡Haz tu primer pedido para empezar a acumular puntos! 🎁\n\n50 puntos = S/5.00 de descuento',
      [
        { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
        { label: '↩ Volver',           value: 'menu'         },
      ]
    );
  }
  const descuento = Math.floor(puntos.saldo / 50) * 5;
  return resp(
    `💰 *Tus puntos de fidelidad:*\n\n` +
    `⭐ Saldo actual: *${puntos.saldo} puntos*\n` +
    `🎁 Puedes canjear hasta: S/${descuento}.00 de descuento\n` +
    `📈 Total ganados: ${puntos.totalGanados} pts\n` +
    `🔄 Total canjeados: ${puntos.totalCanjeados} pts\n\n` +
    `💡 Canjea tus puntos al crear tu próximo pedido.`,
    [
      { label: '📦 Hacer un pedido con descuento', value: 'hacer_pedido' },
      { label: '↩ Volver',                          value: 'menu'         },
    ]
  );
}

async function mostrarMembresias(userId) {
  const membresia = await prisma.membresia.findFirst({
    where: { usuarioId: userId, estado: 'ACTIVA' },
    orderBy: { createdAt: 'desc' },
  });

  if (membresia) {
    const fin = new Date(membresia.fechaFin).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
    return resp(
      `👑 *Tu membresía activa:*\n\n` +
      `🏷 Plan: *${membresia.tipo}*\n` +
      `💰 Descuento: ${membresia.descuento}% en cada pedido\n` +
      `🎁 Pedidos gratis restantes: ${membresia.pedidosGratis}\n` +
      `📅 Vigente hasta: ${fin}`,
      [
        { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
        { label: '↩ Volver',           value: 'menu'         },
      ]
    );
  }

  return resp(
    '👑 *Planes de membresía LavaYa:*\n\n' +
    '🆓 *Básico* — Gratis\n' +
    '   • Sin descuentos adicionales\n\n' +
    '⭐ *Premium* — S/149/mes\n' +
    '   • 10% de descuento en todos los pedidos\n' +
    '   • 3 pedidos gratis por mes\n\n' +
    '🏢 *Empresarial* — S/499/mes\n' +
    '   • 20% de descuento\n' +
    '   • Pedidos ilimitados gratis\n\n' +
    'Para activar una membresía, ve a la sección *Fidelización* en la app.',
    [
      { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
      { label: '↩ Volver',           value: 'menu'         },
    ]
  );
}

async function mostrarCatalogo() {
  const catalogo = await prisma.catalogoPrenda.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  const lista = catalogo.map(p =>
    `👕 *${p.nombre}* — S/${p.precioUnitario.toFixed(2)}${p.precioExtra > 0 ? ` (+S/${p.precioExtra.toFixed(2)} si > 10 prendas)` : ''}`
  ).join('\n');

  return resp(
    `📋 *Catálogo de prendas:*\n\n${lista}\n\n💡 Los precios pueden variar con descuentos de membresía.`,
    [
      { label: '📦 Hacer un pedido', value: 'hacer_pedido' },
      { label: '↩ Volver',           value: 'menu'         },
    ]
  );
}

function parsearFecha(input) {
  const ahora = new Date();

  const opciones = {
    manana_manana: { dias: 1, franja: '08:00-12:00', texto: 'mañana en la mañana (8am–12pm)' },
    manana_tarde:  { dias: 1, franja: '12:00-18:00', texto: 'mañana en la tarde (12pm–6pm)'  },
    manana_noche:  { dias: 1, franja: '18:00-22:00', texto: 'mañana en la noche (6pm–10pm)'  },
    dos_dias:      { dias: 2, franja: '08:00-22:00', texto: 'pasado mañana'                  },
    tres_dias:     { dias: 3, franja: '08:00-22:00', texto: 'en 3 días'                      },
  };

  if (opciones[input]) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + opciones[input].dias);
    return { iso: fecha.toISOString(), franja: opciones[input].franja, texto: opciones[input].texto };
  }

  // Intentar parsear DD/MM/YYYY
  const match = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 10, 0, 0);
    if (!isNaN(fecha.getTime()) && fecha > ahora) {
      return {
        iso: fecha.toISOString(),
        franja: '08:00-22:00',
        texto: fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    }
  }

  return null;
}

function detectarIntencionLibre(session, input) {
  const kw = {
    pedido:     ['pedido', 'pedir', 'lavar', 'lavado', 'ropa', 'prenda', 'quiero', 'necesito'],
    puntos:     ['punto', 'puntos', 'descuento', 'canjear'],
    precio:     ['precio', 'costo', 'cuanto', 'cuánto', 'vale', 'cobran'],
    membresia:  ['membresía', 'membresia', 'premium', 'suscripcion', 'plan'],
    historial:  ['historial', 'mis pedidos', 'estado', 'donde esta', 'dónde está'],
    catalogo:   ['catalogo', 'catálogo', 'tipos', 'qué lavan', 'que lavan'],
    ayuda:      ['ayuda', 'help', 'asistencia', 'soporte'],
  };

  for (const [intencion, palabras] of Object.entries(kw)) {
    if (palabras.some(p => input.includes(p))) {
      switch (intencion) {
        case 'pedido':    return resp('Parece que quieres hacer un pedido 📦', [{ label: '📦 Hacer un pedido', value: 'hacer_pedido' }, { label: '🏠 Inicio', value: 'menu' }]);
        case 'puntos':    return resp('¿Quieres ver tus puntos?', [{ label: '💰 Ver mis puntos', value: 'ver_puntos' }, { label: '📦 Hacer pedido', value: 'hacer_pedido' }]);
        case 'precio':    return resp('¿Quieres ver los precios del catálogo?', [{ label: '📋 Ver catálogo y precios', value: 'ver_catalogo' }, { label: '❓ FAQ de precios', value: 'faq' }]);
        case 'membresia': return resp('¿Te interesa conocer las membresías?', [{ label: '👑 Ver membresías', value: 'ver_membresias' }, { label: '🏠 Inicio', value: 'menu' }]);
        case 'historial': return resp('¿Quieres ver tus pedidos?', [{ label: '🔍 Ver mis pedidos', value: 'ver_pedidos' }, { label: '🏠 Inicio', value: 'menu' }]);
        case 'catalogo':  return resp('¿Quieres ver el catálogo?', [{ label: '📋 Ver catálogo', value: 'ver_catalogo' }, { label: '🏠 Inicio', value: 'menu' }]);
        case 'ayuda':     return resp('¿En qué necesitas ayuda?', [{ label: '❓ Preguntas frecuentes', value: 'faq' }, { label: '🏠 Inicio', value: 'menu' }]);
      }
    }
  }

  session.step = 'menu';
  return resp(
    'No entendí muy bien tu mensaje 😅 ¿En qué te puedo ayudar?',
    [
      { label: '📦 Hacer un pedido',     value: 'hacer_pedido'   },
      { label: '🔍 Ver mis pedidos',      value: 'ver_pedidos'    },
      { label: '💰 Mis puntos',           value: 'ver_puntos'     },
      { label: '❓ Preguntas frecuentes', value: 'faq'            },
    ]
  );
}

module.exports = router;
