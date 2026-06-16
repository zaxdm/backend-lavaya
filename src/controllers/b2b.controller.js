// src/controllers/b2b.controller.js
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

// GET /api/admin/b2b
const listarEmpresas = async (req, res, next) => {
  try {
    const empresas = await prisma.empresaB2B.findMany({
      include: {
        dueno: { select: { nombre: true, apellido: true, email: true } },
        contrato: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(empresas);
  } catch (err) { next(err); }
};

// GET /api/admin/b2b/:id
const obtenerEmpresa = async (req, res, next) => {
  try {
    const empresa = await prisma.empresaB2B.findUnique({
      where: { id: req.params.id },
      include: {
        dueno: { select: { nombre: true, apellido: true, email: true } },
        contrato: true,
        empleados: { select: { id: true, nombre: true, apellido: true, email: true } },
      },
    });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(empresa);
  } catch (err) { next(err); }
};

// POST /api/admin/b2b
const crearEmpresa = async (req, res, next) => {
  try {
    const { nombre, rfc, email, telefono, direccion, descuentoFijo, limiteCredito } = req.body;

    const existe = await prisma.empresaB2B.findUnique({ where: { email } });
    if (existe) return res.status(409).json({ error: 'Ya existe una empresa con ese email' });

    const empresa = await prisma.empresaB2B.create({
      data: {
        id: uuidv4(),
        nombre,
        rfc: rfc || null,
        email,
        telefono: telefono || null,
        direccion: direccion || null,
        duenoId: req.user.id,
        descuentoFijo: parseFloat(descuentoFijo) || 0,
        limiteCredito: parseFloat(limiteCredito) || 0,
      },
    });
    res.status(201).json(empresa);
  } catch (err) { next(err); }
};

// PATCH /api/admin/b2b/:id
const actualizarEmpresa = async (req, res, next) => {
  try {
    const { nombre, rfc, email, telefono, direccion, descuentoFijo, limiteCredito } = req.body;
    const empresa = await prisma.empresaB2B.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(rfc !== undefined && { rfc }),
        ...(email !== undefined && { email }),
        ...(telefono !== undefined && { telefono }),
        ...(direccion !== undefined && { direccion }),
        ...(descuentoFijo !== undefined && { descuentoFijo: parseFloat(descuentoFijo) }),
        ...(limiteCredito !== undefined && { limiteCredito: parseFloat(limiteCredito) }),
      },
    });
    res.json(empresa);
  } catch (err) { next(err); }
};

// PATCH /api/admin/b2b/:id/estado
const toggleActiva = async (req, res, next) => {
  try {
    const { activa } = req.body;
    await prisma.empresaB2B.update({ where: { id: req.params.id }, data: { activa } });
    res.json({ mensaje: `Empresa ${activa ? 'activada' : 'desactivada'}` });
  } catch (err) { next(err); }
};

// GET /api/admin/b2b/:id/contrato
const obtenerContrato = async (req, res, next) => {
  try {
    const contrato = await prisma.contratoB2B.findUnique({
      where: { empresaId: req.params.id },
    });
    if (!contrato) return res.status(404).json({ error: 'No hay contrato para esta empresa' });
    res.json(contrato);
  } catch (err) { next(err); }
};

// POST /api/admin/b2b/:id/contrato
const crearContrato = async (req, res, next) => {
  try {
    const { fechaInicio, fechaFin, pedidosMensuales, condiciones } = req.body;

    const contrato = await prisma.contratoB2B.upsert({
      where: { empresaId: req.params.id },
      create: {
        id: uuidv4(),
        empresaId: req.params.id,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        pedidosMensuales: parseInt(pedidosMensuales) || 0,
        condiciones: condiciones || null,
        activo: true,
      },
      update: {
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        pedidosMensuales: parseInt(pedidosMensuales) || 0,
        condiciones: condiciones || null,
        activo: true,
      },
    });
    res.status(201).json(contrato);
  } catch (err) { next(err); }
};

module.exports = {
  listarEmpresas,
  obtenerEmpresa,
  crearEmpresa,
  actualizarEmpresa,
  toggleActiva,
  obtenerContrato,
  crearContrato,
};
