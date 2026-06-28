// src/routes/upload.routes.js
// Endpoints de subida de imágenes a Cloudinary.
//
//  POST /api/upload/foto-perfil   — foto de avatar del usuario
//  POST /api/upload/foto-entrega  — foto de confirmación de entrega del repartidor
//
// Ambos aceptan multipart/form-data con el campo "imagen".
// Devuelven { url, publicId }.

const { Router }      = require('express');
const multer          = require('multer');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { subirImagen } = require('../config/cloudinary');
const prisma          = require('../config/prisma');
const { v4: uuidv4 }  = require('uuid');

const router = Router();

// Multer en memoria (sin guardar en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'));
    }
    cb(null, true);
  },
});

// ─── Foto de perfil ───────────────────────────────────────────
// POST /api/upload/foto-perfil
// Sube la imagen a Cloudinary y actualiza fotoPerfil del usuario en la DB.
router.post(
  '/foto-perfil',
  authenticate,
  upload.single('imagen'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen' });
      }

      const { url, publicId } = await subirImagen(req.file.buffer, {
        folder:    'lavaya/perfiles',
        public_id: `perfil_${req.user.id}`,
        overwrite: true,      // reemplaza si ya existe
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        ],
      });

      // Guardar la URL en el usuario
      await prisma.usuario.update({
        where: { id: req.user.id },
        data:  { fotoPerfil: url },
      });

      res.json({ url, publicId });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Foto de entrega ──────────────────────────────────────────
// POST /api/upload/foto-entrega/:pedidoId
// Solo repartidores. Sube la foto, la guarda en notasInternas del pedido
// y crea una entrada en el historial.
router.post(
  '/foto-entrega/:pedidoId',
  authenticate,
  authorize('REPARTIDOR', 'ADMIN'),
  upload.single('imagen'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ninguna imagen' });
      }

      const { pedidoId } = req.params;

      // Verificar que el repartidor está asignado al pedido
      const repartidor = await prisma.repartidor.findUnique({
        where: { usuarioId: req.user.id },
      });
      if (!repartidor) {
        return res.status(404).json({ error: 'Perfil de repartidor no encontrado' });
      }

      const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
      if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

      const esAsignado =
        pedido.repartidorRecoleccionId === repartidor.id ||
        pedido.repartidorEntregaId     === repartidor.id;
      if (!esAsignado) {
        return res.status(403).json({ error: 'No estás asignado a este pedido' });
      }

      // Subir a Cloudinary
      const { url, publicId } = await subirImagen(req.file.buffer, {
        folder:    'lavaya/entregas',
        public_id: `entrega_${pedidoId}`,
        overwrite: true,
        transformation: [
          { width: 1200, crop: 'limit' },  // máximo 1200px de ancho, sin recortar
          { quality: 'auto:good' },
        ],
      });

      // Guardar URL en notasInternas (JSON) del pedido
      const notasActuales = pedido.notasInternas
        ? (() => { try { return JSON.parse(pedido.notasInternas); } catch { return {}; } })()
        : {};

      await prisma.pedido.update({
        where: { id: pedidoId },
        data:  {
          notasInternas: JSON.stringify({
            ...notasActuales,
            fotoEntrega:          url,
            fotoEntregaPublicId:  publicId,
            fotoEntregaTimestamp: new Date().toISOString(),
          }),
          historial: {
            create: {
              id:        uuidv4(),
              estado:    pedido.estado,
              nota:      `Foto de entrega registrada`,
              creadoPor: req.user.id,
            },
          },
        },
      });

      res.json({ url, publicId });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
