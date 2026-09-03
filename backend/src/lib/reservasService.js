const supabase = require('../supabaseClient');
const { salonesAlternativos, horariosAlternativos } = require('./disponibilidad');
const { validarHorario } = require('./horarioInstitucional');
const { validarMateriaEspacio } = require('./academico');

// Crea una reserva. Si hay choque de horario (23P01), devuelve sugerencias
// en vez de solo un error. Usado tanto por POST /api/reservas como por el
// asistente de IA.
async function crearReserva({ salon_id, docente_id, materia, materia_id, inicio, fin }) {
  const periodo = `[${inicio},${fin})`;

  // La reserva debe caer dentro del horario en que la universidad está abierta.
  const horario = await validarHorario({ inicio, fin });
  if (!horario.ok) {
    return { ok: false, status: 422, error: horario.motivo };
  }

  // Si la materia exige un tipo de espacio concreto, el salón debe cumplirlo.
  const compat = await validarMateriaEspacio(materia_id, salon_id);
  if (!compat.ok) {
    return { ok: false, status: 422, error: compat.motivo };
  }

  const { data, error } = await supabase
    .from('reservas')
    .insert({ salon_id, docente_id, materia, materia_id: materia_id || null, periodo })
    .select('*, salones(nombre), usuarios(nombre), materias(nombre, codigo)')
    .single();

  if (!error) return { ok: true, reserva: data };

  if (error.code === '23P01') {
    const { data: salon } = await supabase.from('salones').select('*').eq('id', salon_id).single();
    const fecha = inicio.split('T')[0];
    const duracionMinutos = (new Date(fin) - new Date(inicio)) / 60000;

    const [otrosSalones, otrosHorarios] = await Promise.all([
      salonesAlternativos({
        tipo: salon.tipo,
        capacidadMinima: salon.capacidad,
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

module.exports = { crearReserva };
