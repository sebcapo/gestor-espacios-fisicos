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
