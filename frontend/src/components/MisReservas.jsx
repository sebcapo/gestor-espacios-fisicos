import { useEffect, useMemo, useState, useCallback } from 'react';
import { CalendarX2, MapPin, User } from 'lucide-react';
import { getReservas, cancelarReserva, categoriaVisual, CATEGORIAS, getSalones, formatoHora } from '../api';
import { useToast } from '../Toast';
import { SkeletonMapa } from './Skeleton';

export default function MisReservas({ usuarioActual }) {
  const toast = useToast();
  const [reservas, setReservas] = useState([]);
  const [salones, setSalones] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [cancelandoId, setCancelandoId] = useState(null);

  const recargar = useCallback(() => {
    return Promise.all([getReservas(), getSalones()])
      .then(([r, s]) => {
        setReservas(r);
        setSalones(s);
        setEstado('listo');
      })
      .catch(() => setEstado('error'));
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const salonPorId = useMemo(() => new Map(salones.map((s) => [s.id, s])), [salones]);

  const mias = useMemo(() => {
    const ahora = new Date();
    return reservas
      .filter((r) => r.docente_id === usuarioActual?.id)
      .map((r) => ({ ...r, inicioD: new Date(r.inicio), finD: new Date(r.fin) }))
      .filter((r) => r.finD > ahora)
      .sort((a, b) => a.inicioD - b.inicioD);
  }, [reservas, usuarioActual]);

  async function cancelar(id) {
    setCancelandoId(id);
    try {
      await cancelarReserva(id, 'Cancelada por el docente');
      toast('Reserva cancelada', 'exito');
      await recargar();
    } catch (err) {
      toast(err.message, 'error', 6000);
    } finally {
      setCancelandoId(null);
    }
  }

  if (estado === 'cargando') return <SkeletonMapa />;
  if (estado === 'error') return <p className="estado-msg error">No se pudieron cargar tus reservas.</p>;

  if (mias.length === 0) {
    return (
      <div className="vacio">
        <CalendarX2 size={40} strokeWidth={1.4} />
        <p className="vacio-titulo">No tienes reservas próximas</p>
        <p className="vacio-sub">Cuando reserves un salón, aparecerá aquí para que lo gestiones.</p>
      </div>
    );
  }

  return (
    <div className="mis-reservas">
      {mias.map((r) => {
        const salon = salonPorId.get(r.salon_id);
        const cat = salon ? categoriaVisual(salon) : 'AULA_CLASE';
        return (
          <article key={r.id} className={`reserva-card categoria-borde-${cat}`}>
            <div className="reserva-card-main">
              <h3 className="reserva-card-materia">{r.materia}</h3>
              <p className="reserva-card-cuando">{formatoHora.format(r.inicioD)} – {formatoHora.format(r.finD)}</p>
              <div className="reserva-card-meta">
                <span><MapPin size={13} /> {r.salones?.nombre}</span>
                {salon && <span className="badge">{CATEGORIAS[cat].label}</span>}
                {r.asistentes_estimados ? <span><User size={13} /> {r.asistentes_estimados} pers.</span> : null}
                {Boolean(r.es_fija) && <span className="badge-fija">clase fija</span>}
              </div>
            </div>
            {!r.es_fija && (
              <button
                type="button"
                className="link-btn peligro reserva-card-cancelar"
                disabled={cancelandoId === r.id}
                onClick={() => cancelar(r.id)}
              >
                {cancelandoId === r.id ? 'Cancelando…' : 'Cancelar'}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
