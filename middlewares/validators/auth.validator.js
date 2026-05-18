const { body } = require('express-validator');

const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
];

const refreshValidator = [
  body('refreshToken').notEmpty().withMessage('refreshToken es requerido'),
];

const registroUsuarioValidator = [
  body('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido es requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('telefono').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
];

module.exports = {
  loginValidator,
  refreshValidator,
  registroUsuarioValidator
};
