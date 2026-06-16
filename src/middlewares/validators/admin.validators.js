// src/middlewares/validators/admin.validators.js
const { body, query } = require('express-validator');

const crearUsuarioRules = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('apellido').trim().notEmpty().withMessage('El apellido es obligatorio'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe contener al menos una mayúscula')
    .matches(/[0-9]/).withMessage('Debe contener al menos un número'),
  body('rol').isIn(['ADMIN', 'EMPLEADO', 'REPARTIDOR']).withMessage('Rol debe ser ADMIN, EMPLEADO o REPARTIDOR'),
];

const asignarRepartidorRules = [
  body('repartidorId').notEmpty().withMessage('El repartidorId es obligatorio'),
];

const catalogoRules = [
  body('nombre').trim().notEmpty().withMessage('El nombre del tipo de prenda es obligatorio'),
  body('precioUnitario').isFloat({ min: 0.01 }).withMessage('El precio unitario debe ser mayor a 0'),
  body('precioExtra').optional().isFloat({ min: 0 }).withMessage('El precio extra debe ser >= 0'),
];

module.exports = { crearUsuarioRules, asignarRepartidorRules, catalogoRules };
