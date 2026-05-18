const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Configurar transporte para email gratuito (usando Ethereal para desarrollo)
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER || '',
        pass: process.env.ETHEREAL_PASS || ''
      }
    });
  }

  async enviarCorreo(destinatario, asunto, contenidoHtml, contenidoTexto = '') {
    try {
      // Si no hay credenciales de Ethereal, simulamos el envío
      if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASS) {
        console.log('[EMAIL SIMULADO]', {
          to: destinatario,
          subject: asunto,
          html: contenidoHtml,
          text: contenidoTexto
        });
        return { success: true, messageId: 'simulated-' + Date.now() };
      }

      const info = await this.transporter.sendMail({
        from: '"Lavandería App" <no-responder@lavanderia.app>',
        to: destinatario,
        subject: asunto,
        text: contenidoTexto,
        html: contenidoHtml
      });

      console.log('Email enviado: %s', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error enviando email:', error);
      throw error;
    }
  }

  async enviarCorreoBienvenida(emailUsuario, nombreUsuario) {
    const asunto = 'Bienvenido a Lavandería App';
    const contenidoHtml = `
      <h1>¡Hola ${nombreUsuario}!</h1>
      <p>Gracias por registrarte en nuestra aplicación de lavandería.</p>
      <p>Puedes comenzar a usar nuestros servicios inmediatamente.</p>
      <hr>
      <p>Este es un mensaje automático, por favor no responder.</p>
    `;
    
    return this.enviarCorreo(emailUsuario, asunto, contenidoHtml);
  }

  async enviarRecordatorioPago(emailUsuario, nombreUsuario, monto, fechaVencimiento) {
    const asunto = 'Recordatorio de pago pendiente';
    const contenidoHtml = `
      <h1>Hola ${nombreUsuario}</h1>
      <p>Le recordamos que tiene un pago pendiente de <strong>S/${monto}</strong> que vence el ${fechaVencimiento}.</p>
      <p>Por favor realice el pago para evitar interrupciones en el servicio.</p>
      <hr>
      <p>Este es un mensaje automático, por favor no responder.</p>
    `;
    
    return this.enviarCorreo(emailUsuario, asunto, contenidoHtml);
  }

  async enviarConfirmacionPedido(emailUsuario, nombreUsuario, pedidoCodigo, total) {
    const asunto = 'Confirmación de pedido';
    const contenidoHtml = `
      <h1>¡Hola ${nombreUsuario}!</h1>
      <p>Su pedido <strong>${pedidoCodigo}</strong> ha sido recibido correctamente.</p>
      <p>Total: S/${total}</p>
      <p>Le notificaremos cuando su pedido esté listo para recogida o entrega.</p>
      <hr>
      <p>Este es un mensaje automático, por favor no responder.</p>
    `;
    
    return this.enviarCorreo(emailUsuario, asunto, contenidoHtml);
  }
}

module.exports = new EmailService();