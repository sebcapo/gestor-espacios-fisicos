// Carga los datos de ejemplo (salones, usuarios, horario institucional,
// carreras/materias) en la base de datos local. Requiere haber arrancado el
// backend al menos una vez (o correr `npm run db:reset`) para que exista el
// archivo con el esquema.
//
// Uso:  npm run seed
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/db'); // crea el esquema si el archivo no existe

const BACKEND_DIR = path.join(__dirname, '..');

// Orden importa: usuarios/salones antes de la clase fija de prueba;
// carreras/semestres/materias antes de habilitarlas.
const SEEDS = [
  'seed_usuarios.sql',
  'seed_salones.sql',
  'seed_horario_institucional.sql',
  'seed_academico.sql',
  'seed_clase_fija_prueba.sql', // opcional: una reserva de ejemplo marcada como clase fija
];

for (const archivo of SEEDS) {
  const ruta = path.join(BACKEND_DIR, archivo);
  const sql = fs.readFileSync(ruta, 'utf8');
  try {
    db.exec(sql);
    console.log(`✓ ${archivo}`);
  } catch (error) {
    console.error(`✗ ${archivo}: ${error.message}`);
    console.error('  (¿ya habías corrido el seed antes? usa "npm run db:reset" para empezar de cero)');
    process.exitCode = 1;
  }
}
