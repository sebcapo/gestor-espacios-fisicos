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

// Mismos colores que las categorías en App.css, para componer el degradado
// con foto difuminada de fondo de cada tarjeta (ver MapaSalones.jsx).
export const CATEGORIA_GRADIENTE = {
  AULA_CLASE: ['rgba(30,58,95,.78)', 'rgba(44,90,160,.78)'],
  LABORATORIO: ['rgba(31,64,55,.78)', 'rgba(45,106,79,.78)'],
  SALA_COMPUTO: ['rgba(18,58,77,.78)', 'rgba(29,122,140,.78)'],
  AUDITORIO: ['rgba(43,31,61,.78)', 'rgba(90,61,31,.78)'],
};

// Foto de stock difuminada y determinística (mismo seed = misma foto siempre),
// sin depender de fotos reales de la sede que no tenemos.
export function fotoDifuminada(seed, ancho = 400, alto = 240) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${ancho}/${alto}?blur=2`;
}

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
