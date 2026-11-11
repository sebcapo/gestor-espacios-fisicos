'use strict';

const db = require('../db');
const { diaSemanaDeFecha, OFFSET } = require('./horarioInstitucional');

// 'HH:MM' o 'HH:MM:SS' -> minutos desde medianoche
function horaAMinutos(hora) {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

// Todas las fechas 'YYYY-MM-DD' entre desde y hasta (inclusive).
function fechasEntre(desde, hasta) {
  const fechas = [];
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (d <= fin) {
    fechas.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return fechas;
}

// Minutos en que se cruzan los intervalos [a0, a1) y [b0, b1).
function cruce(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

// Reporte de ocupación de los salones activos entre dos fechas (inclusive, en
// hora de Bogotá). La ocupación siempre se mide contra el horario
// institucional: minutos reservados / minutos en que la universidad abre.
function reporteOcupacion({ desde, hasta }) {
  const salones = db.prepare('select id, nombre, tipo, capacidad, ubicacion from salones where activo = 1 order by nombre').all();
  const franjas = db
    .prepare('select dia_semana, hora_apertura, hora_cierre from horario_institucional where activo = 1')
    .all()
    .map((f) => ({ dia: f.dia_semana, ini: horaAMinutos(f.hora_apertura), fin: horaAMinutos(f.hora_cierre) }));

  // Cuántas veces cae cada día de la semana dentro del rango.
  const vecesPorDia = {};
  for (const fecha of fechasEntre(desde, hasta)) {
    const dia = diaSemanaDeFecha(fecha);
    vecesPorDia[dia] = (vecesPorDia[dia] || 0) + 1;
  }

  // Minutos que un salón está disponible en todo el rango.
  let minutosDisponibles = 0;
  for (const f of franjas) minutosDisponibles += (f.fin - f.ini) * (vecesPorDia[f.dia] || 0);

  // Las reservas se guardan en ISO UTC ("...Z"), así que comparar como texto
  // contra los límites del rango (también en ISO UTC) es correcto.
  const limiteInicio = new Date(`${desde}T00:00:00${OFFSET}`).toISOString();
  const limiteFin = new Date(new Date(`${hasta}T00:00:00${OFFSET}`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const reservas = db
    .prepare('select salon_id, inicio, fin, asistentes_estimados, estado from reservas where inicio >= ? and inicio < ?')
    .all(limiteInicio, limiteFin);

  const porSalon = new Map(salones.map((s) => [s.id, { minutos: 0, reservas: 0, sumaLlenado: 0, conAsistentes: 0 }]));
  const minutosPorCelda = new Map(); // 'dia-hora' -> minutos-salón reservados
  let programadas = 0;
  let canceladas = 0;

  const desplazamiento = Number(OFFSET.slice(0, 3)) * 60; // -300 min
  for (const r of reservas) {
    if (r.estado === 'CANCELADA') {
      canceladas++;
      continue;
    }
    const acum = porSalon.get(r.salon_id);
    if (!acum) continue; // salón desactivado
    programadas++;

    // Minutos del día en hora de Bogotá (offset fijo, sin horario de verano).
    const ini = new Date(r.inicio);
    const local = new Date(ini.getTime() + desplazamiento * 60000);
    const min0 = local.getUTCHours() * 60 + local.getUTCMinutes();
    const min1 = min0 + (new Date(r.fin) - ini) / 60000;
    const dia = local.getUTCDay() === 0 ? 7 : local.getUTCDay();

    acum.minutos += min1 - min0;
    acum.reservas++;
    if (r.asistentes_estimados != null) {
      const salon = salones.find((s) => s.id === r.salon_id);
      acum.sumaLlenado += r.asistentes_estimados / salon.capacidad;
      acum.conAsistentes++;
    }

    for (let h = Math.floor(min0 / 60); h * 60 < min1; h++) {
      const clave = `${dia}-${h}`;
      minutosPorCelda.set(clave, (minutosPorCelda.get(clave) || 0) + cruce(min0, min1, h * 60, h * 60 + 60));
    }
  }

  const filasSalon = salones
    .map((s) => {
      const a = porSalon.get(s.id);
      return {
        id: s.id,
        nombre: s.nombre,
        tipo: s.tipo,
        capacidad: s.capacidad,
        ubicacion: s.ubicacion,
        reservas: a.reservas,
        horas_reservadas: Math.round((a.minutos / 60) * 10) / 10,
        ocupacion_pct: pct(a.minutos, minutosDisponibles),
        // Qué tan lleno queda el salón en promedio (asistentes / capacidad);
        // null si ninguna reserva registró asistentes.
        llenado_pct: a.conAsistentes > 0 ? pct(a.sumaLlenado, a.conAsistentes) : null,
      };
    })
    .sort((a, b) => b.ocupacion_pct - a.ocupacion_pct || a.nombre.localeCompare(b.nombre));

  // Mapa de calor día × hora: de los minutos-salón que la universidad ofrece
  // en esa hora durante el rango, qué porcentaje estuvo reservado.
  const dias = [...new Set(franjas.map((f) => f.dia))].sort((a, b) => a - b);
  const horaMin = franjas.length ? Math.floor(Math.min(...franjas.map((f) => f.ini)) / 60) : 0;
  const horaMax = franjas.length ? Math.ceil(Math.max(...franjas.map((f) => f.fin)) / 60) : 0;
  const horas = Array.from({ length: horaMax - horaMin }, (_, i) => horaMin + i);

  const celdas = [];
  let pico = null;
  for (const dia of dias) {
    for (const hora of horas) {
      const abiertos = franjas
        .filter((f) => f.dia === dia)
        .reduce((suma, f) => suma + cruce(f.ini, f.fin, hora * 60, hora * 60 + 60), 0);
      const ofrecidos = abiertos * (vecesPorDia[dia] || 0) * salones.length;
      const celda = {
        dia,
        hora,
        abierto: abiertos > 0,
        ocupacion_pct: abiertos > 0 ? pct(minutosPorCelda.get(`${dia}-${hora}`) || 0, ofrecidos) : null,
      };
      celdas.push(celda);
      if (celda.ocupacion_pct > 0 && (!pico || celda.ocupacion_pct > pico.ocupacion_pct)) pico = celda;
    }
  }

  const minutosReservados = filasSalon.reduce((suma, s) => suma + s.horas_reservadas * 60, 0);

  return {
    desde,
    hasta,
    resumen: {
      salones: salones.length,
      reservas: programadas,
      canceladas,
      cancelacion_pct: pct(canceladas, programadas + canceladas),
      horas_reservadas: Math.round((minutosReservados / 60) * 10) / 10,
      horas_disponibles: Math.round(((minutosDisponibles * salones.length) / 60) * 10) / 10,
      ocupacion_pct: pct(minutosReservados, minutosDisponibles * salones.length),
      salones_sin_uso: filasSalon.filter((s) => s.reservas === 0).length,
      franja_pico: pico ? { dia: pico.dia, hora: pico.hora, ocupacion_pct: pico.ocupacion_pct } : null,
    },
    salones: filasSalon,
    mapa_calor: { dias, horas, celdas },
  };
}

module.exports = { reporteOcupacion };
