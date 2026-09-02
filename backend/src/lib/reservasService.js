const supabase = require('../supabaseClient');
const { salonesAlternativos, horariosAlternativos } = require('./disponibilidad');

// Crea una reserva. Si hay choque de horario (23P01), devuelve sugerencias
// en vez de solo un error. Usado tanto por POST /api/reservas como por el
// asistente de IA.
async function crearReserva({ salon_id, docente_id, materia, inicio, fin }) {
  const periodo = `[${inicio},${fin})`;

  const { data, error } = await supabase
    .from('reservas')
    .insert({ salon_id, docente_id, materia, periodo })
    .select('*, salones(nombre), usuarios(nombre)')
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
