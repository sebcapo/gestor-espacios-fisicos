// Carga una parrilla de clases semanales de ejemplo para todo el semestre
// vigente, para que el horario semanal y los reportes de ocupación tengan
// datos que mostrar. Requiere haber corrido antes `npm run seed`.
//
// Usa el mismo servicio que la aplicación, así que respeta todas las reglas
// (horario institucional, capacidad, choques). Se puede correr más de una vez:
// las sesiones que ya existen chocan consigo mismas y simplemente se omiten.
//
// Uso:  npm run seed:demo
'use strict';

const db = require('../src/db');
const { crearReservaRecurrente } = require('../src/lib/reservasService');

// [código de materia, docente, salón, día (1 lunes ... 6 sábado), inicio, fin, asistentes]
const CLASES = [
  ['ISW-101', 'Rangel', 'Sala Cómputo 901', 1, '18:00', '20:00', 28],
  ['ISW-101', 'Rangel', 'Sala Cómputo 901', 3, '18:00', '20:00', 28],
  ['ISW-204', 'Rangel', 'Sala Cómputo 902', 2, '18:00', '20:00', 25],
  ['ISW-204', 'Rangel', 'Sala Cómputo 902', 4, '18:00', '20:00', 25],
  ['ISW-101', 'Rangel', 'Sala Cómputo 902', 5, '08:00', '10:00', 24],
  ['ISW-101', 'Rangel', 'Sala Cómputo 901', 6, '07:00', '10:00', 30],

  ['ISW-305', 'Kirby', 'Salón 201', 1, '20:00', '22:00', 30],
  ['ISW-305', 'Kirby', 'Salón 201', 3, '20:00', '22:00', 30],
  ['ISW-102', 'Kirby', 'Salón 101', 2, '06:00', '08:00', 35],
  ['ISW-102', 'Kirby', 'Salón 101', 4, '06:00', '08:00', 35],
  ['ISW-102', 'Kirby', 'Salón 202', 1, '18:00', '20:00', 32],
  ['ISW-305', 'Kirby', 'Auditorio Piso 4', 3, '10:00', '12:00', 40],

  ['IIND-210', 'Eli', 'Salón 303', 2, '18:00', '20:00', 22],
  ['IIND-210', 'Eli', 'Salón 303', 4, '18:00', '20:00', 22],
  ['IIND-220', 'Eli', 'Salón 304', 1, '18:00', '20:00', 18],
  ['IIND-220', 'Eli', 'Salón 304', 3, '18:00', '20:00', 18],
  ['IIND-220', 'Eli', 'Salón 305', 2, '10:00', '12:00', 30],
  ['IIND-220', 'Eli', 'Salón 304', 6, '08:00', '11:00', 20],

  ['ISW-204', 'Santander', 'Sala Cómputo 902', 1, '08:00', '10:00', 20],
  ['ISW-204', 'Santander', 'Sala Cómputo 902', 3, '08:00', '10:00', 20],
  ['ISW-305', 'Santander', 'Salón 401', 2, '20:00', '22:00', 12],
  ['ISW-305', 'Santander', 'Salón 401', 4, '20:00', '22:00', 12],
  ['ISW-102', 'Santander', 'Salón 403', 4, '14:00', '16:00', 33],
  ['ISW-102', 'Santander', 'Salón 402', 5, '10:00', '12:00', 15],
  ['IIND-210', 'Santander', 'Salón 500', 5, '18:00', '20:00', 10],
];

async function main() {
  const buscarMateria = db.prepare('select id, nombre from materias where codigo = ?');
  const buscarDocente = db.prepare('select id from usuarios where nombre = ? and activo = 1');
  const buscarSalon = db.prepare('select id from salones where nombre = ? and activo = 1');

  let creadas = 0;
  let omitidas = 0;

  for (const [codigo, nombreDocente, nombreSalon, dia, inicio, fin, asistentes] of CLASES) {
    const materia = buscarMateria.get(codigo);
    const docente = buscarDocente.get(nombreDocente);
    const salon = buscarSalon.get(nombreSalon);
    if (!materia || !docente || !salon) {
      console.error(`✗ ${codigo} / ${nombreDocente} / ${nombreSalon}: no existe en la base (¿corriste "npm run seed"?)`);
      process.exitCode = 1;
      continue;
    }

    const r = await crearReservaRecurrente({
      salon_id: salon.id,
      docente_id: docente.id,
      materia: materia.nombre,
      materia_id: materia.id,
      dia_semana: dia,
      hora_inicio: inicio,
      hora_fin: fin,
      asistentes_estimados: asistentes,
    });

    if (!r.ok) {
      console.error(`✗ ${materia.nombre} en ${nombreSalon}: ${r.error}`);
      process.exitCode = 1;
      continue;
    }
    creadas += r.creadas;
    omitidas += r.omitidas.length;
    console.log(`✓ ${materia.nombre} · ${nombreSalon} · ${nombreDocente}: ${r.creadas} sesiones`);
  }

  console.log(`\nListo: ${creadas} sesiones creadas, ${omitidas} omitidas (ya existían o chocaban).`);
}

main();
