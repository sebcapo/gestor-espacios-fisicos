const supabase = require('../supabaseClient');

// Colombia no tiene horario de verano: el offset -05:00 es fijo todo el año.
const OFFSET = '-05:00';
const TZ = 'America/Bogota';

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIA_ISO = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function nombreDia(diaSemana) {
  return DIAS[diaSemana] || `día ${diaSemana}`;
}

// 'HH:MM' o 'HH:MM:SS' -> minutos desde medianoche
function horaAMinutos(hora) {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

// Fecha (Date) -> partes en hora local de Bogotá
function partesBogota(fecha) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(dtf.formatToParts(fecha).map((x) => [x.type, x.value]));
  const hora = p.hour === '24' ? 0 : Number(p.hour);
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    diaSemana: DIA_ISO[p.weekday],
    minutosDelDia: hora * 60 + Number(p.minute),
  };
}

// 'YYYY-MM-DD' -> día de la semana ISO (1 lunes ... 7 domingo) en hora de Bogotá
function diaSemanaDeFecha(fecha) {
  return partesBogota(new Date(`${fecha}T12:00:00${OFFSET}`)).diaSemana;
}

// Franjas activas de un día: [{ aperturaMin, cierreMin, hora_apertura, hora_cierre }]
async function franjasDelDia(diaSemana) {
  const { data, error } = await supabase
    .from('horario_institucional')
    .select('hora_apertura, hora_cierre')
    .eq('dia_semana', diaSemana)
    .eq('activo', true)
    .order('hora_apertura');

  if (error) throw error;
  return data.map((f) => ({
    hora_apertura: f.hora_apertura,
    hora_cierre: f.hora_cierre,
    aperturaMin: horaAMinutos(f.hora_apertura),
    cierreMin: horaAMinutos(f.hora_cierre),
  }));
}

// ¿La reserva [inicio, fin) cae completa dentro de una franja en que la U está abierta?
// Devuelve { ok: true } o { ok: false, motivo }.
async function validarHorario({ inicio, fin }) {
  const ini = partesBogota(new Date(inicio));
  const f = partesBogota(new Date(fin));

  if (ini.fecha !== f.fecha) {
    return { ok: false, motivo: 'La reserva no puede cruzar la medianoche.' };
  }

  const franjas = await franjasDelDia(ini.diaSemana);
  if (franjas.length === 0) {
    return { ok: false, motivo: `La universidad no abre los ${nombreDia(ini.diaSemana)}.` };
  }

  const dentro = franjas.some(
    (fr) => fr.aperturaMin <= ini.minutosDelDia && f.minutosDelDia <= fr.cierreMin,
  );

  if (!dentro) {
    const texto = franjas.map((fr) => `${fr.hora_apertura.slice(0, 5)}–${fr.hora_cierre.slice(0, 5)}`).join(', ');
    return {
      ok: false,
      motivo: `Fuera del horario de atención de la universidad (${nombreDia(ini.diaSemana)}: ${texto}).`,
    };
  }

  return { ok: true };
}

module.exports = { validarHorario, franjasDelDia, diaSemanaDeFecha, nombreDia, OFFSET };
