require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[LavaYa API] Servidor corriendo en http://localhost:${PORT}`);
  console.log(`[LavaYa API] Entorno: ${process.env.NODE_ENV}`);
});
