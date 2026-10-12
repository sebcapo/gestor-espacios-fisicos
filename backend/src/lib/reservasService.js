const { randomUUID } = require('node:crypto');
const db = require('../db');
const { salonesAlternativos, horariosAlternativos } = require('./disponibilidad');
const { validarHorario, fechaBogota, OFFSET } = require('./horarioInstitucional');
const { validarMateriaEspacio, semestreVigente } = require('./academico');

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
async function crearReserva({ salon_id, docente_id, materia, materia_id, inicio, fin, asistentes_estimados, es_fija = false }) {
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
      `insert into reservas (id, salon_id, docente_id, materia, materia_id, inicio, fin, asistentes_estimados, es_fija)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, salon_id, docente_id, materia, materia_id || null, inicio, fin, asistentes_estimados || null, es_fija ? 1 : 0);

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

// Todas las fechas 'YYYY-MM-DD' entre desde y hasta (inclusive) cuyo día de la
// semana ISO (1 lunes ... 7 domingo) coincide con diaSemana.
function fechasPorDiaSemana(desde, hasta, diaSemana) {
  const fechas = [];
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (d <= fin) {
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (iso === diaSemana) fechas.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return fechas;
}

// Crea una clase recurrente: una sesión por cada semana del semestre vigente
// que caiga en el día indicado. Las sesiones que choquen o caigan fuera del
// horario institucional se omiten (se reportan), no abortan todo el proceso.
// Por defecto se marcan es_fija = true (son clases regulares protegidas).
async function crearReservaRecurrente({
  salon_id,
  docente_id,
  materia,
  materia_id,
  dia_semana,
  hora_inicio,
  hora_fin,
  asistentes_estimados,
  es_fija = true,
}) {
  const semestre = await semestreVigente();
  if (!semestre) {
    return { ok: false, status: 422, error: 'No hay un semestre vigente configurado' };
  }

  const fechas = fechasPorDiaSemana(semestre.fecha_inicio, semestre.fecha_fin, dia_semana);
  if (fechas.length === 0) {
    return { ok: false, status: 422, error: 'El semestre vigente no tiene ninguna fecha en ese día de la semana' };
  }

  const creadas = [];
  const omitidas = [];
  for (const fecha of fechas) {
    const inicio = `${fecha}T${hora_inicio}:00${OFFSET}`;
    const fin = `${fecha}T${hora_fin}:00${OFFSET}`;
    const r = await crearReserva({ salon_id, docente_id, materia, materia_id, inicio, fin, asistentes_estimados, es_fija });
    if (r.ok) creadas.push(fecha);
    else omitidas.push({ fecha, motivo: r.error });
  }

  return {
    ok: true,
    status: 201,
    semestre: semestre.codigo,
    total: fechas.length,
    creadas: creadas.length,
    omitidas,
  };
}

module.exports = { crearReserva, crearReservaRecurrente, reservaConDetalle };
