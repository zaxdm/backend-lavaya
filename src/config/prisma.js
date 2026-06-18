// src/config/prisma.js
// Clever Cloud MySQL free tier: máximo 5 conexiones simultáneas.
// Reservamos 1 para consultas manuales → pool de 2 para evitar hitting the limit.
const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.DATABASE_URL || '';
// Ensure connection_limit is set to 2
if (dbUrl) {
  // If there's already a connection_limit, replace it
  if (dbUrl.includes('connection_limit')) {
    dbUrl = dbUrl.replace(/connection_limit=\d+/, 'connection_limit=2');
  } else {
    // If there's a query string, add &connection_limit=2; else add ?connection_limit=2
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl = `${dbUrl}${separator}connection_limit=2`;
  }
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

module.exports = prisma;
