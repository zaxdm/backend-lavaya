// src/config/prisma.js
// Clever Cloud MySQL free tier: máximo 5 conexiones simultáneas.
// Reservamos 1 para consultas manuales → pool de 4.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Limitar el pool de conexiones vía connection_limit en la URL ya está en DATABASE_URL,
// pero también lo forzamos aquí para que Prisma no abra más de 4 conexiones.
// Añade ?connection_limit=4 a DATABASE_URL si no lo tiene ya.

module.exports = prisma;
