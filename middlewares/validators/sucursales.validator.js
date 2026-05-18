const { body } = require('express-validator');

/**
 * Validaciones para la creación de sucursales
 */
const crearSucursalValidator = [
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('direccion').trim().notEmpty().withMessage('Dirección es requerida'),
  body('telefono').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
  body('distrito').optional().isString().withMessage('Distrito debe ser texto'),
  // Reglas adicionales que se podrían añadir para enterprise
  body('ciudad').optional().isString().withMessage('Ciudad debe ser texto'),
  body('email').optional().isEmail().withMessage('Email inválido'),
];

/**
 * Validaciones para la actualización de sucursales
 */
const actualizarSucursalValidator = [
  body('nombre').optional().trim().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('direccion').optional().trim().notEmpty().withMessage('Dirección no puede estar vacía'),
  body('telefono').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
  body('distrito').optional().isString().withMessage('Distrito debe ser texto'),
  body('activo').optional().isBoolean().withMessage('Activo debe ser booleano'),
  body('ciudad').optional().isString().withMessage('Ciudad debe ser texto'),
  body('email').optional().isEmail().withMessage('Email inválido'),
];

module.exports = {
  crearSucursalValidator,
  actualizarSucursalValidator
};
