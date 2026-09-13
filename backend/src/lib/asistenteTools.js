const db = require('../db');
const { haySolape } = require('./disponibilidad');
const { crearReserva } = require('./reservasService');

// Colombia no tiene horario de verano, así que el offset -05:00 es fijo.
const OFFSET = '-05:00';

async function buscarDisponibilidad({ tipo, capacidad_minima, fecha, hora_inicio, hora_fin }) {
  const inicio = `${fecha}T${hora_inicio}:00${OFFSET}`;
  const fin = `${fecha}T${hora_fin}:00${OFFSET}`;

  let sql = 'select * from salones where activo = 1';
  const params = [];
  if (tipo) {
    sql += ' and tipo = ?';
    params.push(tipo);
  }
  if (capacidad_minima) {
    sql += ' and capacidad >= ?';
    params.push(capacidad_minima);
  }
  const candidatos = db.prepare(sql).all(...params);

  const libres = [];
  for (const s of candidatos) {
    const ocupado = await haySolape(s.id, inicio, fin);
    if (!ocupado) {
      libres.push({ id: s.id, nombre: s.nombre, tipo: s.tipo, capacidad: s.capacidad, ubicacion: s.ubicacion });
    }
  }
  return libres;
}

async function crearReservaTool({ salon_id, materia, fecha, hora_inicio, hora_fin, asistentes_estimados }, docenteId) {
  const inicio = `${fecha}T${hora_inicio}:00${OFFSET}`;
  const fin = `${fecha}T${hora_fin}:00${OFFSET}`;
  return crearReserva({ salon_id, docente_id: docenteId, materia, inicio, fin, asistentes_estimados });
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_disponibilidad',
      description:
        'Busca salones libres en un horario dado, opcionalmente filtrando por tipo de espacio y capacidad mínima. Úsala antes de sugerir o reservar un salón.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: ['string', 'null'],
            enum: ['SALON', 'SALA_COMPUTO', 'LABORATORIO_ELECTRONICA', null],
            description: 'Tipo de espacio. Usa SALA_COMPUTO si piden un salón de cómputo/sistemas. Usa null si no aplica.',
          },
          capacidad_minima: {
            type: ['integer', 'null'],
            description: 'Cantidad mínima de personas que debe caber. Usa null si no aplica.',
          },
          fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
          hora_inicio: { type: 'string', description: 'Hora de inicio en formato HH:MM de 24 horas.' },
          hora_fin: { type: 'string', description: 'Hora de fin en formato HH:MM de 24 horas.' },
        },
        required: ['fecha', 'hora_inicio', 'hora_fin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_reserva',
      description:
        'Crea la reserva para el docente actual en un salón específico. Solo llámala después de confirmar con el usuario el salón, la materia, la fecha y el horario exactos.',
      parameters: {
        type: 'object',
        properties: {
          salon_id: { type: 'string', description: 'ID del salón, obtenido de buscar_disponibilidad.' },
          materia: { type: 'string', description: 'Nombre de la materia o actividad.' },
          fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
          hora_inicio: { type: 'string', description: 'Hora de inicio en formato HH:MM de 24 horas.' },
          hora_fin: { type: 'string', description: 'Hora de fin en formato HH:MM de 24 horas.' },
          asistentes_estimados: {
            type: ['integer', 'null'],
            description: 'Cantidad de personas que van a asistir, si el usuario la mencionó. Usa null si no aplica.',
          },
        },
        required: ['salon_id', 'materia', 'fecha', 'hora_inicio', 'hora_fin'],
      },
    },
  },
];

module.exports = { buscarDisponibilidad, crearReservaTool, TOOLS };
