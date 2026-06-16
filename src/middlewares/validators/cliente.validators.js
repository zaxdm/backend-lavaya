// src/middlewares/validators/cliente.validators.js
const { body, param } = require('express-validator');

const actualizarPerfilRules = [
  body('nombre').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío'),
  body('apellido').optional().trim().notEmpty().withMessage('El apellido no puede estar vacío'),
  body('telefono').optional().matches(/^\+?[\d\s\-]{7,15}$/).withMessage('Teléfono inválido'),
];

const agregarDireccionRules = [
  body('calle').trim().notEmpty().withMessage('La calle es obligatoria'),
  body('numero').trim().notEmpty().withMessage('El número es obligatorio'),
  body('colonia').trim().notEmpty().withMessage('La colonia es obligatoria'),
  body('ciudad').trim().notEmpty().withMessage('La ciudad es obligatoria'),
  body('estado').trim().notEmpty().withMessage('El estado es obligatorio'),
  body('codigoPostal')
    .trim().notEmpty().withMessage('El código postal es obligatorio')
    .matches(/^\d{4,6}$/).withMessage('Código postal inválido'),
  body('latitud').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('longitud').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
];

const calificarRules = [
  param('id').notEmpty().withMessage('ID de pedido requerido'),
  body('estrellas').isInt({ min: 1, max: 5 }).withMessage('Las estrellas deben ser entre 1 y 5'),
  body('comentario').optional().trim().isLength({ max: 500 }).withMessage('Máximo 500 caracteres'),
];

module.exports = { actualizarPerfilRules, agregarDireccionRules, calificarRules };
