const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    // Email service (free tier with Ethereal for development)
    this.emailTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER || '',
        pass: process.env.ETHEREAL_PASS || ''
      }
    });
    
    // WhatsApp service placeholder (using a free tier service like Twilio sandbox or similar)
    // For truly free WhatsApp, we'd need to use unofficial APIs or wait for official free tiers
    this.whatsappEnabled = false; // Set to true when credentials are available
    
    // Push notification service placeholder (using free tier of OneSignal or Firebase)
    this.pushEnabled = false; // Set to true when credentials are available
  }

  // EMAIL METHODS
  async enviarEmail(destinatario, asunto, contenidoHtml, contenidoTexto = '') {
    try {
      // If no Ethereal credentials, simulate sending
      if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASS) {
        console.log('[EMAIL SIMULADO]', {
          to: destinatario,
          subject: asunto,
          html: contenidoHtml,
          text: contenidoTexto
        });
        return { success: true, messageId: 'simulated-' + Date.now(), provider: 'ethereal' };
      }

      const info = await this.emailTransporter.sendMail({
        from: '"Lavandería App" <no-responder@lavanderia.app>',
        to: destinatario,
        subject: asunto,
        text: contenidoTexto,
        html: contenidoHtml
      });

      console.log('Email enviado: %s', info.messageId);
      return { success: true, messageId: info.messageId, provider: 'ethereal' };
    } catch (error) {
      console.error('Error enviando email:', error);
      throw error;
    }
  }

  async enviarEmailBienvenida(emailUsuario, nombreUsuario) {
    const asunto = 'Bienvenido a Lavandería App';
    const contenidoHtml = `
      <h1>¡Hola ${nombreUsuario}!</h1>
      <p>Gracias por registrarte en nuestra aplicación de lavandería.</p>
      <p>Puedes comenzar a usar nuestros servicios inmediatamente.</p>
      <hr>
      <p>Este es un mensaje automático, por favor no responder.</p>
    `;
    
    return this.enviarEmail(emailUsuario, asunto, contenidoHtml);
  }

  async enviarEmailRecordatorioPago(emailUsuario, nombreUsuario, monto, fechaVencimiento) {
    const asunto = 'Recordatorio de pago pendiente';
    const contenidoHtml = `
      <h1>Hola ${nombreUsuario}</h1>
      <p>Le recordamos que tiene un pago pendiente de <strong>S/${monto}</strong> que vence el ${fechaVencimiento}.</p>
      <p>Por favor realice el pago para evitar interrupciones en el servicio.</p>
      <hr>
      <p>Este es un mensaje automático, por favor no responder.</p>
    `;
    
    return this.enviarEmail(emailUsuario, asunto, contenidoHtml);
  }

  async enviarEmailConfirmacionPedido(emailUsuario, nombreUsuario, pedidoCodigo, total) {
    const asunto = 'Confirmación de pedido';
    const contenidoHtml = `
      <h1>¡Hola ${nombreUsuario}!</h1>
      <p>Su pedido <strong>${pedidoCodigo}</strong> ha sido recibido correctamente.</p>
      <p>Total: S/${total}</p>
      <p>Le notificaremos cuando su pedido esté listo para recogida o entrega.</p>
      <hr>
      <p>Este es un mensaje automático, por favor no responder.</p>
    `;
    
    return this.enviarEmail(emailUsuario, asunto, contenidoHtml);
  }

  async enviarEmailEstadoPedido(emailUsuario, nombreUsuario, pedidoCodigo, estado, fechaEstimada = null) {
    const estadosTexto = {
      recibido: 'Recibido y en proceso',
      lavando: 'En proceso de lavado',
      secando: 'En proceso de secado',
      planchando: 'En proceso de planchado',
      listo: 'Listo para recogida',
      en_reparto: 'En reparto',
      entregado: 'Entregado',
      cancelado: 'Cancelado'
    };
    
    const asunto = `Actualización de pedido ${pedidoCodigo}`;
    const contenidoHtml = `
      <h1>¡Hola ${nombreUsuario}!</h1>
      <p>El estado de su pedido <strong>${pedidoCodigo}</strong> ha cambiado a:</p>
      <h2>${estadosTexto[estado] || estado}</h2>
      ${fechaEstimada ? `<p>Fecha estimada de ${estado === 'listo' ? 'disponibilidad' : 'entrega'}: ${new Date(fechaEstimada).toLocaleDateString()}</p>` : ''}
      <hr>
      <p>Este es un mensaje automático, por favor no responder.</p>
    `;
    
    return this.enviarEmail(emailUsuario, asunto, contenidoHtml);
  }

  // WHATSAPP METHODS (placeholders for free service)
  async enviarWhatsApp(numero, mensaje) {
    if (!this.whatsappEnabled) {
      console.log('[WHATSAPP SIMULADO]', {
        to: numero,
        message: mensaje
      });
      return { success: true, messageId: 'simulated-' + Date.now(), provider: 'whatsapp-sandbox' };
    }
    
    // Aquí iría la integración con un servicio gratuito de WhatsApp API
    // Por ejemplo, usando Twilio sandbox o similares en su tier gratuito
    throw new Error('WhatsApp service not configured');
  }

  async enviarWhatsAppBienvenida(numero, nombreUsuario) {
    const mensaje = `¡Hola ${nombreUsuario}! 👋\n\nGracias por registrarte en Lavandería App. Ya puedes comenzar a usar nuestros servicios.\n\nEste es un mensaje automático.`;
    return this.enviarWhatsApp(numero, mensaje);
  }

  async enviarWhatsAppRecordatorioPago(numero, nombreUsuario, monto, fechaVencimiento) {
    const mensaje = `Hola ${nombreUsuario} 💰\n\nLe recordamos que tiene un pago pendiente de S/${monto} que vence el ${fechaVencimiento}.\n\nPor favor realice el pago para evitar interrupciones.\n\nEste es un mensaje automático.`;
    return this.enviarWhatsApp(numero, mensaje);
  }

  async enviarWhatsAppConfirmacionPedido(numero, nombreUsuario, pedidoCodigo, total) {
    const mensaje = `¡Hola ${nombreUsuario}! 👕\n\nSu pedido ${pedidoCodigo} ha sido recibido correctamente.\nTotal: S/${total}\n\nLe notificaremos cuando esté listo para recogida o entrega.\n\nEste es un mensaje automático.`;
    return this.enviarWhatsApp(numero, mensaje);
  }

  // PUSH NOTIFICATION METHODS (placeholders for free service)
  async enviarPushNotification(usuarioId, titulo, cuerpo, datosAdicionales = {}) {
    if (!this.pushEnabled) {
      console.log('[PUSH SIMULADO]', {
        userId: usuarioId,
        title: titulo,
        body: cuerpo,
        data: datosAdicionales
      });
      return { success: true, messageId: 'simulated-' + Date.now(), provider: 'onesignal-free' };
    }
    
    // Aquí iría la integración con OneSignal free tier o Firebase Cloud Messaging free tier
    throw new Error('Push notification service not configured');
  }

  async enviarPushBienvenida(usuarioId, nombreUsuario) {
    return this.enviarPushNotification(
      usuarioId,
      '¡Bienvenido a Lavandería App!',
      `Hola ${nombreUsuario}, gracias por registrarte. Ya puedes usar nuestros servicios.`,
      { type: 'bienvenida' }
    );
  }

  async enviarPushRecordatorioPago(usuarioId, nombreUsuario, monto, fechaVencimiento) {
    return this.enviarPushNotification(
      usuarioId,
      'Recordatorio de pago',
      `Hola ${nombreUsuario}, tienes un pago pendiente de S/${monto} que vence el ${fechaVencimiento}.`,
      { type: 'recordatorio-pago', monto, fechaVencimiento }
    );
  }

  async enviarPushConfirmacionPedido(usuarioId, nombreUsuario, pedidoCodigo, total) {
    return this.enviarPushNotification(
      usuarioId,
      'Pedido confirmado',
      `¡Hola ${nombreUsuario}! Tu pedido ${pedidoCodigo} ha sido recibido. Total: S/${total}`,
      { type: 'confirmacion-pedido', pedidoCodigo, total }
    );
  }

  async enviarPushEstadoPedido(usuarioId, nombreUsuario, pedidoCodigo, estado) {
    const estadosTexto = {
      recibido: 'Recibido y en proceso',
      lavando: 'En proceso de lavado',
      secando: 'En proceso de secado',
      planchando: 'En proceso de planchado',
      listo: 'Listo para recogida',
      en_reparto: 'En reparto',
      entregado: 'Entregado',
      cancelado: 'Cancelado'
    };
    
    return this.enviarPushNotification(
      usuarioId,
      `Actualización de pedido ${pedidoCodigo}`,
      `El estado de su pedido ha cambiado a: ${estadosTexto[estado] || estado}`,
      { type: 'estado-pedido', pedidoCodigo, estado }
    );
  }
}

module.exports = new NotificationService();