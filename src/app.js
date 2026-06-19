require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// MySQL raw queries devuelven BigInt para COUNT/SUM; esto permite serializarlos a JSON
BigInt.prototype.toJSON = function () { return Number(this); };

// Rutas
const authRoutes = require('./routes/auth.routes');
const clienteRoutes = require('./routes/cliente.routes');
const repartidorRoutes = require('./routes/repartidor.routes');
const adminRoutes = require('./routes/admin.routes');
const empleadoRoutes = require('./routes/empleado.routes');
const pedidoRoutes = require('./routes/pedido.routes');
const pagoRoutes = require('./routes/pago.routes');
const reportesRoutes = require('./routes/reportes.routes');

const app = express();

// ─── Seguridad ─────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Sin origin = petición desde el mismo servidor o Postman → permitir
    if (!origin) return callback(null, true);

    // En desarrollo: permitir cualquier puerto de localhost/127.0.0.1
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:');
      if (isLocalhost) return callback(null, true);
    }

    // En producción: solo orígenes explícitamente permitidos
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error(`CORS: origen no permitido → ${origin}`));
  },
  credentials: true,
}));

// ─── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Logger ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'LavaYa API', timestamp: new Date() });
});

// ─── Rutas API ─────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/clientes',    clienteRoutes);
app.use('/api/repartidores',repartidorRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/empleados',   empleadoRoutes);
app.use('/api/pedidos',     pedidoRoutes);
app.use('/api/pagos',       pagoRoutes);
app.use('/api/reportes',    reportesRoutes);
// ─── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Error handler global ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  console.error('[Error Stack]', err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
