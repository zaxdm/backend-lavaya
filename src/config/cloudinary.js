// src/config/cloudinary.js
// Inicializa el SDK de Cloudinary usando CLOUDINARY_URL del .env
// El formato es: cloudinary://API_KEY:API_SECRET@CLOUD_NAME

const { v2: cloudinary } = require('cloudinary');

// cloudinary.config() detecta CLOUDINARY_URL automáticamente si está definida
cloudinary.config({ secure: true });

/**
 * Sube un buffer o stream a Cloudinary.
 *
 * @param {Buffer} buffer       - Datos del archivo
 * @param {object} options      - Opciones de Cloudinary (folder, public_id, etc.)
 * @returns {Promise<{url: string, publicId: string}>}
 */
function subirImagen(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadOpts = {
      folder:         'lavaya',
      resource_type:  'image',
      quality:        'auto',
      fetch_format:   'auto',
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOpts, (error, result) => {
      if (error) return reject(error);
      resolve({ url: result.secure_url, publicId: result.public_id });
    });

    stream.end(buffer);
  });
}

module.exports = { cloudinary, subirImagen };
