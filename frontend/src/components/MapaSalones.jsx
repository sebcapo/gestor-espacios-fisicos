import { useEffect, useMemo, useState, useCallback } from 'react';
import { GraduationCap, FlaskConical, MonitorSmartphone, Theater } from 'lucide-react';
import { getSalones, getReservas, categoriaVisual, CATEGORIAS, CATEGORIA_GRADIENTE } from '../api';
import SalonModal from './SalonModal';
import { SkeletonMapa } from './Skeleton';

const ICONO_CATEGORIA = {
  AULA_CLASE: GraduationCap,
  LABORATORIO: FlaskConical,
  SALA_COMPUTO: MonitorSmartphone,
  AUDITORIO: Theater,
};

function claveOrden(ubicacion) {
  const [bloque, piso] = (ubicacion || '').split(' - ');
  const bloqueNum = parseInt(bloque?.match(/\d+/)?.[0] || '0', 10);
  const pisoNum = parseInt(piso?.match(/\d+/)?.[0] || '0', 10);
  return bloqueNum * 100 + pisoNum;
}

function bloqueDe(ubicacion) {
  return (ubicacion || '').split(' - ')[0] || 'Sin bloque';
}

export default function MapaSalones({ usuarioActual, onStats, abrirSalonId, onAbrirConsumido }) {
  const [salones, setSalones] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error
  const [errorMsg, setErrorMsg] = useState('');
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');
  const [filtroBloque, setFiltroBloque] = useState('TODOS');

  // Si llegamos aquí desde el horario semanal (clic en una reserva), abre
  // directo ese salón.
  useEffect(() => {
    if (abrirSalonId) {
      setSalonSeleccionadoId(abrirSalonId);
      onAbrirConsumido?.();
    }
  }, [abrirSalonId, onAbrirConsumido]);

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

  // Estado de cada salón ahora mismo: libre / reservado (tiene algo pendiente
  // hoy, pero no está en curso) / ocupado (hay una reserva en curso).
  const estadoSalones = useMemo(() => {
    const ahora = new Date();
    const mapa = new Map();
    for (const salon of salones) {
      const proximas = (reservasPorSalon.get(salon.id) || []).filter((r) => r.fin > ahora);
      const ocupadoAhora = proximas.some((r) => r.inicio <= ahora && ahora < r.fin);
      const condicion = ocupadoAhora ? 'ocupado' : proximas.length > 0 ? 'reservado' : 'libre';
      mapa.set(salon.id, { proximas, condicion });
    }
    return mapa;
  }, [salones, reservasPorSalon]);

  useEffect(() => {
    if (estado !== 'listo') return;
    const libres = salones.filter((s) => estadoSalones.get(s.id)?.condicion === 'libre').length;
    onStats?.({ total: salones.length, libres });
  }, [salones, estadoSalones, estado, onStats]);

  const bloques = useMemo(() => {
    const set = new Set(salones.map((s) => bloqueDe(s.ubicacion)));
    return [...set].sort((a, b) => claveOrden(`${a} - Piso 0`) - claveOrden(`${b} - Piso 0`));
  }, [salones]);

  const conteoPorCategoria = useMemo(() => {
    const conteo = { TODOS: salones.length };
    for (const s of salones) {
      const cat = categoriaVisual(s);
      conteo[cat] = (conteo[cat] || 0) + 1;
    }
    return conteo;
  }, [salones]);

  const salonesFiltrados = useMemo(() => {
    return salones.filter((s) => {
      if (filtroCategoria !== 'TODOS' && categoriaVisual(s) !== filtroCategoria) return false;
      if (filtroBloque !== 'TODOS' && bloqueDe(s.ubicacion) !== filtroBloque) return false;
      return true;
    });
  }, [salones, filtroCategoria, filtroBloque]);

  const secciones = useMemo(() => {
    const mapa = new Map();
    for (const s of salonesFiltrados) {
      const lista = mapa.get(s.ubicacion) || [];
      lista.push(s);
      mapa.set(s.ubicacion, lista);
    }
    return [...mapa.entries()]
      .map(([ubicacion, lista]) => ({ ubicacion, salones: lista.sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
      .sort((a, b) => claveOrden(a.ubicacion) - claveOrden(b.ubicacion));
  }, [salonesFiltrados]);

  const bloquesAgrupados = useMemo(() => {
    const mapa = new Map();
    for (const seccion of secciones) {
      const bloque = bloqueDe(seccion.ubicacion);
      const lista = mapa.get(bloque) || [];
      lista.push(seccion);
      mapa.set(bloque, lista);
    }
    return [...mapa.entries()];
  }, [secciones]);

  if (estado === 'cargando') return <SkeletonMapa />;
  if (estado === 'error')
    return (
      <p className="estado-msg error">
        No se pudo conectar con el backend: {errorMsg}. ¿Está corriendo <code>npm run dev</code> en la carpeta{' '}
        <code>backend</code>?
      </p>
    );

  const salonSeleccionado = salones.find((s) => s.id === salonSeleccionadoId) || null;
  const totalLibres = salones.filter((s) => estadoSalones.get(s.id)?.condicion === 'libre').length;
  const ocupacion = salones.length > 0 ? Math.round(((salones.length - totalLibres) / salones.length) * 100) : 0;

  return (
    <div className="mapa">
      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Espacios registrados</p>
          <p className="stat-value">{salones.length}</p>
          <p className="stat-sub">Distribuidos en {bloques.length} bloque{bloques.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Disponibles ahora</p>
          <p className="stat-value stat-value-verde">{totalLibres}</p>
          <p className="stat-sub">Listos para reservar</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Ocupación general</p>
          <p className="stat-value">{ocupacion}%</p>
          <p className="stat-sub">Incluye espacios reservados</p>
        </div>
      </div>

      <div className="filtros-categoria">
        <button
          type="button"
          className={filtroCategoria === 'TODOS' ? 'chip-filtro activo' : 'chip-filtro'}
          onClick={() => setFiltroCategoria('TODOS')}
        >
          Todos <span className="chip-filtro-count">{conteoPorCategoria.TODOS || 0}</span>
        </button>
        {Object.entries(CATEGORIAS).map(([clave, { label, sigla }]) => (
          <button
            key={clave}
            type="button"
            className={filtroCategoria === clave ? 'chip-filtro activo' : 'chip-filtro'}
            onClick={() => setFiltroCategoria(clave)}
          >
            <span className="chip-filtro-sigla">{sigla}</span> {label}
            {conteoPorCategoria[clave] ? <span className="chip-filtro-count">{conteoPorCategoria[clave]}</span> : null}
          </button>
        ))}
      </div>

      {bloques.length > 1 && (
        <div className="filtros-bloque">
          <button
            type="button"
            className={filtroBloque === 'TODOS' ? 'chip-bloque activo' : 'chip-bloque'}
            onClick={() => setFiltroBloque('TODOS')}
          >
            Todos los bloques
          </button>
          {bloques.map((b) => (
            <button
              key={b}
              type="button"
              className={filtroBloque === b ? 'chip-bloque activo' : 'chip-bloque'}
              onClick={() => setFiltroBloque(b)}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {bloquesAgrupados.map(([bloque, seccionesDelBloque]) => {
        const salonesDelBloque = seccionesDelBloque.flatMap((s) => s.salones);
        const pisos = new Set(seccionesDelBloque.map((s) => s.ubicacion));
        const libres = salonesDelBloque.filter((s) => estadoSalones.get(s.id)?.condicion === 'libre').length;
        const ocupados = salonesDelBloque.filter((s) => estadoSalones.get(s.id)?.condicion === 'ocupado').length;
        const reservados = salonesDelBloque.filter((s) => estadoSalones.get(s.id)?.condicion === 'reservado').length;

        return (
          <section key={bloque} className="bloque-seccion">
            <div className="bloque-header">
              <div>
                <h2 className="bloque-titulo">{bloque}</h2>
                <p className="bloque-sub">
                  {salonesDelBloque.length} espacios · {pisos.size} piso{pisos.size !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="leyenda">
                <span className="leyenda-item">
                  <span className="leyenda-dot libre" /> {libres} libre
                </span>
                <span className="leyenda-item">
                  <span className="leyenda-dot ocupado" /> {ocupados} ocupado
                </span>
                <span className="leyenda-item">
                  <span className="leyenda-dot reservado" /> {reservados} reservado
                </span>
              </div>
            </div>

            {seccionesDelBloque.map((seccion) => {
              const piso = seccion.ubicacion.split(' - ')[1] || seccion.ubicacion;
              return (
                <div key={seccion.ubicacion} className="piso-grupo">
                  <h3 className="piso-titulo">{piso}</h3>
                  <div className="piso-salones">
                    {seccion.salones.map((salon) => {
                      const { proximas, condicion } = estadoSalones.get(salon.id);
                      const categoria = categoriaVisual(salon);
                      const textoEstado =
                        condicion === 'ocupado'
                          ? 'Ocupado'
                          : condicion === 'reservado'
                            ? `Reservado · ${proximas.length} reserva${proximas.length !== 1 ? 's' : ''}`
                            : 'Libre';

                      const Icono = ICONO_CATEGORIA[categoria] || GraduationCap;
                      return (
                        <button
                          key={salon.id}
                          type="button"
                          className={`salon-card categoria-${categoria}`}
                          onClick={() => setSalonSeleccionadoId(salon.id)}
                        >
                          <div
                            className="salon-card-visual"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${CATEGORIA_GRADIENTE[categoria][0]}, ${CATEGORIA_GRADIENTE[categoria][1]})`,
                            }}
                          >
                            <Icono className="salon-card-marca" size={64} strokeWidth={1.5} aria-hidden />
                            <span className="card-badge">{CATEGORIAS[categoria].label}</span>
                            <span className={`card-dot ${condicion}`} />
                          </div>
                          <div className="salon-card-info">
                            <span className="salon-card-nombre">{salon.nombre}</span>
                            <div className="salon-card-pie">
                              <span className={`salon-card-estado ${condicion}`}>{textoEstado}</span>
                              <span className="salon-card-cap">{salon.capacidad} cap.</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

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
