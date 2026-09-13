const db = require('../db');
const { franjasDelDia, diaSemanaDeFecha, OFFSET } = require('./horarioInstitucional');

// ¿Ese salón ya tiene una reserva PROGRAMADA que se solape con [inicio, fin)?
async function haySolape(salonId, inicio, fin) {
  const fila = db
    .prepare(
      `select 1 from reservas
       where salon_id = ? and estado = 'PROGRAMADA' and inicio < ? and fin > ?
       limit 1`,
    )
    .get(salonId, fin, inicio);

  return Boolean(fila);
}

// Busca otros salones del mismo tipo (y con capacidad suficiente) que estén
// libres en ese horario.
async function salonesAlternativos({ tipo, capacidadMinima, inicio, fin, excluirSalonId, limite = 3 }) {
  const candidatos = db
    .prepare(
      `select * from salones
       where activo = 1 and tipo = ? and capacidad >= ? and id != ?
       order by capacidad asc`,
    )
    .all(tipo, capacidadMinima, excluirSalonId);

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

  const reservasDia = db
    .prepare("select inicio, fin from reservas where salon_id = ? and estado = 'PROGRAMADA'")
    .all(salonId);

  const ocupados = reservasDia.map((r) => ({ inicio: new Date(r.inicio), fin: new Date(r.fin) }));

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
