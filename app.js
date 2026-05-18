require('dotenv').config();

const express = require('express');
const cors = require('cors');

const routes = require('./routes');

const errorMiddleware = require('./middlewares/error.middleware');

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

// Middleware Global de Manejo de Errores
app.use(errorMiddleware);

module.exports = app;