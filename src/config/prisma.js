// src/config/prisma.js
// Clever Cloud MySQL free tier: máximo 5 conexiones simultáneas.
// Reservamos 1 para consultas manuales → pool de 2 para evitar hitting the limit.
const { PrismaClient } = require('@prisma/client');

console.log('[Prisma Config] Initializing Prisma...');
let dbUrl = process.env.DATABASE_URL || '';
console.log('[Prisma Config] Original DATABASE_URL (partial):', dbUrl ? dbUrl.split('@')[0] + '@...' : 'NOT FOUND');

// Ensure connection limit is set to 2
if (dbUrl) {
  // If there's already a connection_limit, replace it
  if (dbUrl.includes('connection_limit')) {
    console.log('[Prisma Config] Existing connection_limit found, replacing...');
    dbUrl = dbUrl.replace(/connection_limit=\d+/, 'connection_limit=1');
  } else {
    // If there's a query string, add &connection_limit=2; else add ?connection_limit=2
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl = `${dbUrl}${separator}connection_limit=1`;
    console.log('[Prisma Config] Added connection_limit=1');
  }
}

// For safety, also add pool_timeout and connect_timeout
if (dbUrl && !dbUrl.includes('pool_timeout')) {
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${separator}pool_timeout=10`;
}

console.log('[Prisma Config] Modified DATABASE_URL (partial):', dbUrl ? dbUrl.split('@')[0] + '@...' : 'NOT FOUND');

let prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
};

if (dbUrl) {
  prismaConfig.datasources = { db: { url: dbUrl } };
} else {
  console.warn('[Prisma Config] No DATABASE_URL provided; using default datasource configuration');
}

// Reuse client in serverless environments to avoid exhausting connections
let prisma;

if (!global._prismaClient) {
  global._prismaClient = new PrismaClient(prismaConfig);
}

prisma = global._prismaClient;

module.exports = prisma;