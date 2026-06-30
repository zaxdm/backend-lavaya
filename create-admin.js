// create-admin.js — Crea un usuario admin específico
// Ejecutar con: node create-admin.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  const email = 'maycol.rodriguez@tecsup.edu.pe';
  const password = 'Rodriguez1234';
  const nombre = 'Maycol';
  const apellido = 'Rodriguez';

  const existe = await prisma.usuario.findUnique({ where: { email } });

  if (existe) {
    // Actualizar contraseña y asegurarse que sea ADMIN
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.usuario.update({
      where: { email },
      data: { passwordHash, rol: 'ADMIN', activo: true, emailVerificado: true },
    });
    console.log(`[OK] Usuario actualizado: ${email} con rol ADMIN`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.usuario.create({
      data: {
        id: uuidv4(),
        nombre,
        apellido,
        email,
        passwordHash,
        rol: 'ADMIN',
        activo: true,
        emailVerificado: true,
      },
    });
    console.log(`[OK] Usuario admin creado: ${email}`);
  }
}

main()
  .catch((e) => { console.error('[Error]', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
