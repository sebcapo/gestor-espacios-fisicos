const { randomUUID } = require('node:crypto');
const db = require('../db');
const { salonesAlternativos, horariosAlternativos } = require('./disponibilidad');
const { validarHorario, fechaBogota } = require('./horarioInstitucional');
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
  // Normaliza a un único formato (ISO UTC con "Z") antes de validar o guardar
  // nada. El formulario manual manda `.toISOString()` (UTC/"Z") y el
  // asistente de IA arma el string con un offset "-05:00" literal: ambos
  // representan el instante correcto, pero como texto son distintos, y el
  // trigger anti-choque en SQLite compara `inicio`/`fin` como texto plano
  // (SQLite no tiene tipo datetime). Mezclar formatos hacía que dos reservas
  // en el mismo horario, guardadas por caminos distintos, no se detectaran
  // como choque. Guardar siempre en el mismo formato es lo que lo arregla.
  inicio = new Date(inicio).toISOString();
  fin = new Date(fin).toISOString();

  // La reserva debe caer dentro del horario en que la universidad está abierta.
  const horario = await validarHorario({ inicio, fin });
  if (!horario.ok) {
    return { ok: false, status: 422, error: horario.motivo };
  }

  const salon = db.prepare('select * from salones where id = ? and activo = 1').get(salon_id);
  if (!salon) {
    return { ok: false, status: 404, error: 'Salón no encontrado' };
  }

  // El tipo de espacio "ideal" de la materia es solo informativo: un docente
  // puede reservar cualquier salón disponible si lo necesita (ej. una clase
  // normal que excepcionalmente requiere una sala de cómputo). No bloquea la
  // reserva, pero se devuelve como advertencia para mostrarla si se quiere.
  const compat = await validarMateriaEspacio(materia_id, salon_id);

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

    return { ok: true, reserva: reservaConDetalle(id), advertencia: compat.ok ? undefined : compat.motivo };
  } catch (error) {
    // El disparador trg_no_solape_insert aborta el INSERT si ya hay una
    // reserva PROGRAMADA que se cruza en ese salón (ver schema.sql).
    if (error.message && error.message.includes('reserva_solapada')) {
      const fecha = fechaBogota(inicio);
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
