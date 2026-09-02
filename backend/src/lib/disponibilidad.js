const supabase = require('../supabaseClient');

// Convierte el texto que devuelve Postgres para un tstzrange, ej:
// ["2026-09-10 14:00:00+00","2026-09-10 16:00:00+00")
// en { inicio: Date, fin: Date }
function parseRango(rangoTexto) {
  const match = rangoTexto.match(/^[[(]"?([^",)\]]+)"?,"?([^",)\]]+)"?[)\]]$/);
  return { inicio: new Date(match[1]), fin: new Date(match[2]) };
}

// ¿Ese salón ya tiene una reserva PROGRAMADA que se solape con [inicio, fin)?
async function haySolape(salonId, inicio, fin) {
  const { data, error } = await supabase
    .from('reservas')
    .select('id')
    .eq('salon_id', salonId)
    .eq('estado', 'PROGRAMADA')
    .filter('periodo', 'ov', `[${inicio},${fin})`);

  if (error) throw error;
  return data.length > 0;
}

// Busca otros salones del mismo tipo (y con capacidad suficiente) que estén
// libres en ese horario.
async function salonesAlternativos({ tipo, capacidadMinima, inicio, fin, excluirSalonId, limite = 3 }) {
  const { data: candidatos, error } = await supabase
    .from('salones')
    .select('*')
    .eq('activo', true)
    .eq('tipo', tipo)
    .gte('capacidad', capacidadMinima)
    .neq('id', excluirSalonId);

  if (error) throw error;

  const libres = [];
  for (const salon of candidatos) {
    if (libres.length >= limite) break;
    const ocupado = await haySolape(salon.id, inicio, fin);
    if (!ocupado) libres.push(salon);
  }
  return libres;
}

// Busca huecos libres del mismo salón, mismo día, con la misma duración
// solicitada, dentro de una jornada de 7am a 9pm.
async function horariosAlternativos({ salonId, fecha, duracionMinutos, limite = 3 }) {
  const inicioDia = new Date(`${fecha}T07:00:00`);
  const finDia = new Date(`${fecha}T21:00:00`);

  const { data: reservasDia, error } = await supabase
    .from('reservas')
    .select('periodo')
    .eq('salon_id', salonId)
    .eq('estado', 'PROGRAMADA');

  if (error) throw error;

  const ocupados = reservasDia.map((r) => parseRango(r.periodo));

  const sugerencias = [];
  const pasoMs = 30 * 60 * 1000;
  const duracionMs = duracionMinutos * 60 * 1000;

  for (let t = inicioDia.getTime(); t + duracionMs <= finDia.getTime(); t += pasoMs) {
    if (sugerencias.length >= limite) break;
    const candidatoInicio = new Date(t);
    const candidatoFin = new Date(t + duracionMs);
    const seSolapa = ocupados.some((o) => candidatoInicio < o.fin && candidatoFin > o.inicio);
    if (!seSolapa) {
      sugerencias.push({ inicio: candidatoInicio.toISOString(), fin: candidatoFin.toISOString() });
    }
  }
  return sugerencias;
}

module.exports = { haySolape, salonesAlternativos, horariosAlternativos };
