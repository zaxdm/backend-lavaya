// prisma/seed.js — Datos iniciales: admin + catálogo de prendas
// Ejecutar con: npm run db:seed
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Iniciando...');

  // ─── Admin ────────────────────────────────────────────────────
  const adminEmail = 'admin@lavaya.com';
  const adminExiste = await prisma.usuario.findUnique({
    where: { email: adminEmail },
    select: { id: true, passwordHash: true },
  });

  if (!adminExiste) {
    const passwordHash = await bcrypt.hash('12661266', 12);
    await prisma.usuario.create({
      data: {
        id: uuidv4(),
        nombre: 'Admin',
        apellido: 'LavaYa',
        email: adminEmail,
        passwordHash,
        rol: 'ADMIN',
        activo: true,
        emailVerificado: true,
      },
    });
    console.log(`[Seed] Admin creado: ${adminEmail} / 12661266`);
  } else {
    // Si existe pero con otra contraseña, actualizarla
    const passOk = await bcrypt.compare('12661266', adminExiste.passwordHash);
    if (!passOk) {
      const nuevoHash = await bcrypt.hash('12661266', 12);
      await prisma.usuario.update({
        where: { email: adminEmail },
        data: { passwordHash: nuevoHash },
      });
      console.log(`[Seed] Contraseña del admin actualizada a 12661266.`);
    } else {
      console.log(`[Seed] Admin ya existe con la contraseña correcta — omitiendo.`);
    }
  }

  // ─── Catálogo de prendas ──────────────────────────────────────
  const prendasBase = [
    { nombre: 'camisa',    descripcion: 'Camisa de vestir o casual',   precioUnitario: 25, precioExtra: 5  },
    { nombre: 'pantalon',  descripcion: 'Pantalón de vestir o casual', precioUnitario: 30, precioExtra: 5  },
    { nombre: 'vestido',   descripcion: 'Vestido',                     precioUnitario: 45, precioExtra: 10 },
    { nombre: 'traje',     descripcion: 'Traje completo',              precioUnitario: 80, precioExtra: 15 },
    { nombre: 'chompa',    descripcion: 'Suéter / chompa',             precioUnitario: 35, precioExtra: 8  },
    { nombre: 'ropa_cama', descripcion: 'Sábanas, edredones',          precioUnitario: 60, precioExtra: 10 },
    { nombre: 'toalla',    descripcion: 'Toalla de baño',              precioUnitario: 20, precioExtra: 5  },
    { nombre: 'abrigo',    descripcion: 'Abrigo o chamarra',           precioUnitario: 70, precioExtra: 12 },
    { nombre: 'falda',     descripcion: 'Falda',                       precioUnitario: 28, precioExtra: 5  },
    { nombre: 'blusa',     descripcion: 'Blusa',                       precioUnitario: 22, precioExtra: 5  },
  ];

  let creadas = 0;
  for (const p of prendasBase) {
    const existe = await prisma.catalogoPrenda.findUnique({ where: { nombre: p.nombre } });
    if (!existe) {
      await prisma.catalogoPrenda.create({
        data: { id: uuidv4(), ...p, activo: true },
      });
      creadas++;
    }
  }
  console.log(`[Seed] Catálogo: ${creadas} prendas nuevas, ${prendasBase.length - creadas} ya existían.`);
  console.log('[Seed] Completado.');
}

main()
  .catch((e) => { console.error('[Seed] Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
