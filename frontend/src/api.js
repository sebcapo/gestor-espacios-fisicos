const API_URL = import.meta.env.VITE_API_URL;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // manda/recibe la cookie httpOnly de sesión
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || 'Error en la petición');
    error.status = res.status;
    error.body = data;
    throw error;
  }
  return data;
}

export const login = (email, password) =>
  apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const logout = () => apiFetch('/api/auth/logout', { method: 'POST' });

export const getUsuarioActual = () => apiFetch('/api/auth/me');

export const getSalones = () => apiFetch('/api/salones');
export const getUsuarios = () => apiFetch('/api/usuarios');
export const getReservas = () => apiFetch('/api/reservas');
export const getMateriasHabilitadas = () => apiFetch('/api/materias/habilitadas');
export const getHorarioInstitucional = () => apiFetch('/api/horario-institucional');

export const consultarAsistente = ({ mensaje, historial }) =>
  apiFetch('/api/asistente', {
    method: 'POST',
    body: JSON.stringify({ mensaje, historial }),
  });

export const crearReserva = (body) =>
  apiFetch('/api/reservas', { method: 'POST', body: JSON.stringify(body) });

export const cancelarReserva = (id, motivo) =>
  apiFetch(`/api/reservas/${id}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo }),
  });

export const TIPO_LABEL = {
  SALON: 'Salón',
  SALA_COMPUTO: 'Sala de cómputo',
  LABORATORIO_ELECTRONICA: 'Laboratorio de electrónica',
};

// Categoría visual para el mapa de salones. El campo `tipo` real (SALON,
// SALA_COMPUTO, LABORATORIO_ELECTRONICA) es el que usa la validación
// académica (materias.tipo_espacio_requerido) y no se toca; esta es una
// clasificación puramente de presentación, derivada del nombre, para
// distinguir auditorios y laboratorios especializados que en la base de
// datos están guardados como SALON.
export const CATEGORIAS = {
  AULA_CLASE: { label: 'Aula de Clase', sigla: 'AU' },
  LABORATORIO: { label: 'Laboratorio', sigla: 'LB' },
  SALA_COMPUTO: { label: 'Sala de Cómputo', sigla: 'SC' },
  AUDITORIO: { label: 'Auditorio', sigla: 'AD' },
};

// Degradado de fondo por categoría para la cabecera de cada tarjeta de salón.
// Todo es CSS puro: no depende de internet (la demo corre local, a veces sin
// red confiable), a diferencia de las fotos de stock que se usaban antes.
export const CATEGORIA_GRADIENTE = {
  AULA_CLASE: ['#1e3a5f', '#2c5aa0'],
  LABORATORIO: ['#1f4037', '#2d6a4f'],
  SALA_COMPUTO: ['#123a4d', '#1d7a8c'],
  AUDITORIO: ['#3a2b1f', '#8a5a2b'],
};

export function categoriaVisual(salon) {
  if (salon.tipo === 'SALA_COMPUTO') return 'SALA_COMPUTO';
  if (salon.tipo === 'LABORATORIO_ELECTRONICA') return 'LABORATORIO';
  if (/^auditorio/i.test(salon.nombre)) return 'AUDITORIO';
  if (/laboratorio/i.test(salon.nombre)) return 'LABORATORIO';
  return 'AULA_CLASE';
}

export const formatoHora = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function aISO(fecha, hora) {
  return new Date(`${fecha}T${hora}`).toISOString();
}

// 'YYYY-MM-DD' -> día ISO (1 lunes ... 7 domingo). Se construye en UTC porque
// es una fecha sin hora, así da igual la zona horaria del navegador.
export function diaSemanaISO(fechaStr) {
  if (!fechaStr) return null;
  const dia = new Date(`${fechaStr}T00:00:00Z`).getUTCDay(); // 0 domingo ... 6 sábado
  return dia === 0 ? 7 : dia;
}

export function hhmmAMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutosAHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function minutosALabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const periodo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${periodo}`;
}

// Minutos desde medianoche, cada 30 min, entre apertura y cierre (ambas
// incluidas como límites: la última parada es el cierre exacto).
export function generarSlots(horaApertura, horaCierre) {
  const inicioMin = hhmmAMinutos(horaApertura.slice(0, 5));
  const finMin = hhmmAMinutos(horaCierre.slice(0, 5));
  const slots = [];
  for (let t = inicioMin; t < finMin; t += 30) slots.push(t);
  slots.push(finMin);
  return slots;
}

export function isoAInputs(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { fecha, hora };
}

const DIA_ISO_BOGOTA = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// Un instante ISO -> su fecha, día de la semana y minutos del día en hora de
// Bogotá (no la del navegador). Se usa para ubicar reservas en la grilla del
// horario semanal sin que el huso del equipo del evento las corra de lugar.
export function partesBogota(iso) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const hora = p.hour === '24' ? 0 : Number(p.hour);
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    diaISO: DIA_ISO_BOGOTA[p.weekday],
    minutos: hora * 60 + Number(p.minute),
  };
}

// 'YYYY-MM-DD' de hoy en Bogotá.
export function hoyBogota() {
  return partesBogota(new Date().toISOString()).fecha;
}

// Lunes (YYYY-MM-DD) de la semana que contiene a fechaStr.
export function lunesDeLaSemana(fechaStr) {
  const d = new Date(`${fechaStr}T00:00:00Z`);
  const diaISO = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (diaISO - 1));
  return d.toISOString().slice(0, 10);
}

// Suma días a una fecha 'YYYY-MM-DD'.
export function sumarDias(fechaStr, n) {
  const d = new Date(`${fechaStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const FMT_FECHA_CORTA = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' });
export function fechaCorta(fechaStr) {
  return FMT_FECHA_CORTA.format(new Date(`${fechaStr}T12:00:00Z`));
}
