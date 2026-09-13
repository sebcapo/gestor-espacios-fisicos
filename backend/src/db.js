const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

// Base de datos local en un solo archivo. Por defecto vive en backend/data/,
// fuera del control de versiones (ver .gitignore). Se puede apuntar a otro
// archivo con la variable de entorno DB_PATH (útil para tests: DB_PATH=:memory:).
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gestor.db');

if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const esNueva = DB_PATH === ':memory:' || !fs.existsSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec('pragma foreign_keys = on;');
db.exec('pragma journal_mode = wal;');

if (esNueva) {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log(`Base de datos creada en ${DB_PATH === ':memory:' ? '(memoria)' : DB_PATH}`);
}

module.exports = db;
