const { randomUUID } = require('node:crypto');
const db = require('../db');
const { salonesAlternativos, horariosAlternativos } = require('./disponibilidad');
const { validarHorario } = require('./horarioInstitucional');
const { validarMateriaEspacio } = require('./academico');

// Trae una reserva con el nombre del salón, del docente y de la materia
// (el equivalente al "select('*, salones(nombre), usuarios(nombre), materias(nombre, codigo)')"
// de Supabase, hecho a mano con un JOIN).
function reservaConDetalle(id) {
  const fila = db
    .prepare(
      `select
         r.*,
         json_object('nombre', s.nombre) as salones,
         json_object('nombre', u.nombre) as usuarios,
         case when m.id is null then null else json_object('nombre', m.nombre, 'codigo', m.codigo) end as materias
       from reservas r
       join salones s on s.id = r.salon_id
       join usuarios u on u.id = r.docente_id
       left join materias m on m.id = r.materia_id
       where r.id = ?`,
    )
    .get(id);

  if (!fila) return null;
  return {
    ...fila,
    salones: JSON.parse(fila.salones),
    usuarios: JSON.parse(fila.usuarios),
    materias: fila.materias ? JSON.parse(fila.materias) : null,
  };
}

// Crea una reserva. Si hay choque de horario, devuelve sugerencias en vez de
// solo un error. Usado tanto por POST /api/reservas como por el asistente de IA.
async function crearReserva({ salon_id, docente_id, materia, materia_id, inicio, fin, asistentes_estimados }) {
  // La reserva debe caer dentro del horario en que la universidad está abierta.
  const horario = await validarHorario({ inicio, fin });
  if (!horario.ok) {
    return { ok: false, status: 422, error: horario.motivo };
  }

  const salon = db.prepare('select * from salones where id = ? and activo = 1').get(salon_id);
  if (!salon) {
    return { ok: false, status: 404, error: 'Salón no encontrado' };
  }

  // Si la materia exige un tipo de espacio concreto, el salón debe cumplirlo.
  const compat = await validarMateriaEspacio(materia_id, salon_id);
  if (!compat.ok) {
    return { ok: false, status: 422, error: compat.motivo };
  }

  // El salón debe tener cupo para el número de asistentes estimado (mismo
  // criterio de "capacidad mínima" que ya usa buscar_disponibilidad).
  if (asistentes_estimados != null && salon.capacidad < asistentes_estimados) {
    return {
      ok: false,
      status: 422,
      error: `El salón "${salon.nombre}" tiene capacidad para ${salon.capacidad} personas; se estimaron ${asistentes_estimados}`,
    };
  }

  const id = randomUUID();
  try {
    db.prepare(
      `insert into reservas (id, salon_id, docente_id, materia, materia_id, inicio, fin, asistentes_estimados)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, salon_id, docente_id, materia, materia_id || null, inicio, fin, asistentes_estimados || null);

    return { ok: true, reserva: reservaConDetalle(id) };
  } catch (error) {
    // El disparador trg_no_solape_insert aborta el INSERT si ya hay una
    // reserva PROGRAMADA que se cruza en ese salón (ver schema.sql).
    if (error.message && error.message.includes('reserva_solapada')) {
      const fecha = inicio.split('T')[0];
      const duracionMinutos = (new Date(fin) - new Date(inicio)) / 60000;

      const [otrosSalones, otrosHorarios] = await Promise.all([
        salonesAlternativos({
          tipo: salon.tipo,
          capacidadMinima: asistentes_estimados || salon.capacidad,
          inicio,
          fin,
          excluirSalonId: salon_id,
        }),
        horariosAlternativos({ salonId: salon_id, fecha, duracionMinutos }),
      ]);

      return {
        ok: false,
        status: 409,
        error: 'El salón ya está reservado en ese horario',
        sugerencias: { otros_salones: otrosSalones, otros_horarios: otrosHorarios },
      };
    }

    return { ok: false, status: 500, error: error.message };
  }
}

module.exports = { crearReserva, reservaConDetalle };
