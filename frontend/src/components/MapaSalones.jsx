import { useEffect, useMemo, useState, useCallback } from 'react';
import { getSalones, getReservas, TIPO_LABEL } from '../api';
import SalonModal from './SalonModal';

function claveOrden(ubicacion) {
  const [bloque, piso] = (ubicacion || '').split(' - ');
  const bloqueNum = parseInt(bloque?.match(/\d+/)?.[0] || '0', 10);
  const pisoNum = parseInt(piso?.match(/\d+/)?.[0] || '0', 10);
  return bloqueNum * 100 + pisoNum;
}

export default function MapaSalones({ usuarioActual }) {
  const [salones, setSalones] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error
  const [errorMsg, setErrorMsg] = useState('');
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState(null);

  const recargar = useCallback(() => {
    return Promise.all([getSalones(), getReservas()])
      .then(([s, r]) => {
        setSalones(s);
        setReservas(r);
        setEstado('listo');
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setEstado('error');
      });
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const reservasPorSalon = useMemo(() => {
    const mapa = new Map();
    for (const r of reservas) {
      const inicio = new Date(r.inicio);
      const fin = new Date(r.fin);
      const lista = mapa.get(r.salon_id) || [];
      lista.push({ ...r, inicio, fin });
      mapa.set(r.salon_id, lista);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.inicio - b.inicio);
    return mapa;
  }, [reservas]);

  const secciones = useMemo(() => {
    const mapa = new Map();
    for (const s of salones) {
      const lista = mapa.get(s.ubicacion) || [];
      lista.push(s);
      mapa.set(s.ubicacion, lista);
    }
    return [...mapa.entries()]
      .map(([ubicacion, lista]) => ({ ubicacion, salones: lista.sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
      .sort((a, b) => claveOrden(a.ubicacion) - claveOrden(b.ubicacion));
  }, [salones]);

  if (estado === 'cargando') return <p className="estado-msg">Cargando mapa de salones...</p>;
  if (estado === 'error')
    return (
      <p className="estado-msg error">
        No se pudo conectar con el backend: {errorMsg}. ¿Está corriendo <code>npm run dev</code> en la carpeta{' '}
        <code>backend</code>?
      </p>
    );

  const salonSeleccionado = salones.find((s) => s.id === salonSeleccionadoId) || null;
  const ahora = new Date();

  return (
    <div className="mapa">
      {secciones.map((seccion) => (
        <section key={seccion.ubicacion} className="piso">
          <h2 className="piso-titulo">{seccion.ubicacion}</h2>
          <div className="piso-salones">
            {seccion.salones.map((salon) => {
              const proximas = (reservasPorSalon.get(salon.id) || []).filter((r) => r.fin > ahora);
              const ocupadoAhora = proximas.some((r) => r.inicio <= ahora && ahora < r.fin);
              return (
                <button
                  key={salon.id}
                  type="button"
                  className={`salon-tile ${ocupadoAhora ? 'ocupado' : 'libre'}`}
                  onClick={() => setSalonSeleccionadoId(salon.id)}
                >
                  <span className="salon-tile-estado" />
                  <span className="salon-tile-nombre">{salon.nombre}</span>
                  <span className="salon-tile-tipo">{TIPO_LABEL[salon.tipo] || salon.tipo}</span>
                  <span className="salon-tile-info">
                    {ocupadoAhora ? 'Ocupado ahora' : 'Libre ahora'} · {proximas.length} reserva
                    {proximas.length !== 1 ? 's' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {salonSeleccionado && (
        <SalonModal
          salon={salonSeleccionado}
          salones={salones}
          reservas={reservasPorSalon.get(salonSeleccionado.id) || []}
          usuarioActual={usuarioActual}
          onClose={() => setSalonSeleccionadoId(null)}
          onCambiarSalon={setSalonSeleccionadoId}
          onCambiado={recargar}
        />
      )}
    </div>
  );
}
