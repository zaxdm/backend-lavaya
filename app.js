require('dotenv').config();

const express = require('express');
const cors = require('cors');

const routes = require('./routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (_, res) => {
  res.json({
    ok: true,
    fecha: new Date()
  });
});

app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);

  res.status(500).json({
    ok: false,
    mensaje: 'Error interno del servidor'
  });
});

module.exports = app;