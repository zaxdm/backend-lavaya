// src/config/firebase.js
// Inicializa Firebase Admin SDK una sola vez y expone la función
// para enviar notificaciones push a través de FCM.
//
// Variables de entorno requeridas:
//   FIREBASE_PROJECT_ID     — ID del proyecto Firebase (ej: lavaya-7b81f)
//   FIREBASE_CLIENT_EMAIL   — email de la Service Account
//   FIREBASE_PRIVATE_KEY    — clave privada RSA (incluye los \n literales)

const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '⚠️  Firebase Admin SDK: faltan variables de entorno ' +
      '(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). ' +
      'Las notificaciones push no funcionarán.'
    );
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      // Las \n literales del .env hay que convertirlas en saltos de línea reales
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });

  initialized = true;
  console.log('✅ Firebase Admin SDK inicializado correctamente');
}

// Inicializar en el momento de cargar el módulo
initFirebase();

/**
 * Envía una notificación push a uno o varios tokens FCM.
 *
 * @param {string[]} tokens  - Array de tokens FCM de dispositivos
 * @param {object}   payload - { title, body, data }
 * @returns {{ exitosos: number, fallidos: number }}
 */
async function enviarNotificacionPush(tokens, { title, body, data = {} }) {
  if (!initialized || !tokens?.length) {
    return { exitosos: 0, fallidos: tokens?.length ?? 0 };
  }

  const message = {
    notification: { title, body },
    data: Object.fromEntries(
      // FCM solo acepta strings en data
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      notification: {
        sound: 'default',
        priority: 'high',
        channelId: 'lavaya_pedidos',
      },
    },
    apns: {
      payload: {
        aps: { sound: 'default', badge: 1 },
      },
    },
  };

  let exitosos = 0;
  let fallidos  = 0;

  // Envío en lotes de 500 (límite de FCM)
  const BATCH = 500;
  for (let i = 0; i < tokens.length; i += BATCH) {
    const lote = tokens.slice(i, i + BATCH);
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: lote,
        ...message,
      });
      exitosos += response.successCount;
      fallidos  += response.failureCount;

      // Log de tokens inválidos para limpieza futura
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code;
          console.warn(`  ❌ Token FCM fallido [${lote[idx].slice(0, 20)}...]: ${code}`);
        }
      });
    } catch (err) {
      console.error('Error en envío FCM:', err.message);
      fallidos += lote.length;
    }
  }

  return { exitosos, fallidos };
}

module.exports = { enviarNotificacionPush };
