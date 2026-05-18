const { body } = require('express-validator');

const crearUsuarioValidator = [
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido es requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('telefono').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
  body('dni').optional().isLength({ min: 8, max: 15 }).withMessage('DNI debe tener entre 8 y 15 caracteres'),
  body('rol_id').isInt({ gt: 0 }).withMessage('ID de rol inválido'),
  body('sucursal_id').optional().isInt({ gt: 0 }).withMessage('ID de sucursal inválido'),
];

const actualizarUsuarioValidator = [
  body('nombre').optional().trim().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('apellido').optional().trim().notEmpty().withMessage('Apellido no puede estar vacío'),
  body('telefono').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
  body('dni').optional().isLength({ min: 8, max: 15 }).withMessage('DNI debe tener entre 8 y 15 caracteres'),
  body('activo').optional().isBoolean().withMessage('Activo debe ser booleano'),
  body('sucursal_id').optional().isInt({ gt: 0 }).withMessage('ID de sucursal inválido'),
  body('foto_url').optional().isURL().withMessage('URL de foto inválida'),
];

const cambiarPasswordValidator = [
  body('password_actual').isLength({ min: 6 }).withMessage('La contraseña actual debe tener al menos 6 caracteres'),
  body('password_nueva').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
];

module.exports = {
  crearUsuarioValidator,
  actualizarUsuarioValidator,
  cambiarPasswordValidator
};
