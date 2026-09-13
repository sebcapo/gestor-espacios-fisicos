// Borra la base de datos local (y sus archivos -wal/-shm) para volver a
// crearla desde cero la próxima vez que arranque el backend.
//
// Uso:  npm run db:reset [-- --seed]
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gestor.db');

for (const sufijo of ['', '-wal', '-shm']) {
  const ruta = DB_PATH + sufijo;
  if (fs.existsSync(ruta)) {
    fs.rmSync(ruta);
    console.log(`Eliminado: ${ruta}`);
  }
}

console.log('Base de datos reiniciada. Arranca el backend (npm run dev) para recrear el esquema.');

if (process.argv.includes('--seed')) {
  require('./seed');
}
