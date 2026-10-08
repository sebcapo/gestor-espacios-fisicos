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

export function isoAInputs(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { fecha, hora };
}
