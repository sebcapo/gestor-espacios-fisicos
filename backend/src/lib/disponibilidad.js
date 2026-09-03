const supabase = require('../supabaseClient');
const { franjasDelDia, diaSemanaDeFecha, OFFSET } = require('./horarioInstitucional');

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
// solicitada, dentro del horario institucional de ese día.
async function horariosAlternativos({ salonId, fecha, duracionMinutos, limite = 3 }) {
  const franjas = await franjasDelDia(diaSemanaDeFecha(fecha));
  if (franjas.length === 0) return [];

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
  const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  for (const franja of franjas) {
    const inicioFranja = new Date(`${fecha}T${aHora(franja.aperturaMin)}:00${OFFSET}`);
    const finFranja = new Date(`${fecha}T${aHora(franja.cierreMin)}:00${OFFSET}`);

    for (let t = inicioFranja.getTime(); t + duracionMs <= finFranja.getTime(); t += pasoMs) {
      if (sugerencias.length >= limite) return sugerencias;
      const candidatoInicio = new Date(t);
      const candidatoFin = new Date(t + duracionMs);
      const seSolapa = ocupados.some((o) => candidatoInicio < o.fin && candidatoFin > o.inicio);
      if (!seSolapa) {
        sugerencias.push({ inicio: candidatoInicio.toISOString(), fin: candidatoFin.toISOString() });
      }
    }
  }
  return sugerencias;
}

module.exports = { haySolape, salonesAlternativos, horariosAlternativos };
