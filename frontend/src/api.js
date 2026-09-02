const API_URL = import.meta.env.VITE_API_URL;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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

export const getSalones = () => apiFetch('/api/salones');
export const getUsuarios = () => apiFetch('/api/usuarios');
export const getReservas = () => apiFetch('/api/reservas');

export const consultarAsistente = ({ mensaje, historial, docente_id, docente_nombre }) =>
  apiFetch('/api/asistente', {
    method: 'POST',
    body: JSON.stringify({ mensaje, historial, docente_id, docente_nombre }),
  });

export const crearReserva = (body) =>
  apiFetch('/api/reservas', { method: 'POST', body: JSON.stringify(body) });

export const cancelarReserva = (id, motivo) =>
  apiFetch(`/api/reservas/${id}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo }),
  });

// Convierte el texto que devuelve Postgres para un tstzrange, ej:
// ["2026-09-10 14:00:00+00","2026-09-10 16:00:00+00")
// en { inicio: Date, fin: Date }
export function parseRango(rangoTexto) {
  const match = rangoTexto.match(/^[[(]"?([^",)\]]+)"?,"?([^",)\]]+)"?[)\]]$/);
  return { inicio: new Date(match[1]), fin: new Date(match[2]) };
}

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
