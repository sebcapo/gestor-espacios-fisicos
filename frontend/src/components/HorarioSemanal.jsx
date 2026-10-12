import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  getSalones,
  getReservas,
  getHorarioInstitucional,
  categoriaVisual,
  partesBogota,
  hoyBogota,
  lunesDeLaSemana,
  sumarDias,
  fechaCorta,
  minutosALabel,
  hhmmAMinutos,
} from '../api';
import { SkeletonMapa } from './Skeleton';

const NOMBRE_DIA = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom' };
const HOUR_PX = 56;

// Asigna "carriles" a reservas que se solapan en una misma columna (puede pasar
// cuando se ven todos los salones a la vez), para dibujarlas lado a lado.
function asignarCarriles(bloques) {
  const ordenados = [...bloques].sort((a, b) => a.min0 - b.min0);
  const finCarril = []; // minuto de fin del último bloque de cada carril
  for (const b of ordenados) {
    let carril = finCarril.findIndex((fin) => fin <= b.min0);
    if (carril === -1) {
      carril = finCarril.length;
      finCarril.push(b.min1);
    } else {
      finCarril[carril] = b.min1;
    }
    b.carril = carril;
  }
  return { bloques: ordenados, carriles: Math.max(1, finCarril.length) };
}

export default function HorarioSemanal({ onAbrirSalon }) {
  const [salones, setSalones] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [horario, setHorario] = useState([]);
  const [estado, setEstado] = useState('cargando');
  const [salonFiltro, setSalonFiltro] = useState('TODOS');
  const [lunes, setLunes] = useState(() => lunesDeLaSemana(hoyBogota()));

  useEffect(() => {
    Promise.all([getSalones(), getReservas(), getHorarioInstitucional()])
      .then(([s, r, h]) => {
        setSalones(s);
        setReservas(r);
        setHorario(h);
        setEstado('listo');
      })
      .catch(() => setEstado('error'));
  }, []);

  const salonPorId = useMemo(() => new Map(salones.map((s) => [s.id, s])), [salones]);

  // Días visibles = días que la universidad abre, con su fecha de esta semana.
  const dias = useMemo(() => {
    const activos = [...new Set(horario.map((h) => h.dia_semana))].sort((a, b) => a - b);
    return activos.map((d) => ({ diaISO: d, fecha: sumarDias(lunes, d - 1) }));
  }, [horario, lunes]);

  // Rango horario de la grilla (hora en punto más temprana y más tardía).
  const [minHora, maxHora] = useMemo(() => {
    if (horario.length === 0) return [6, 22];
    let min = 24 * 60;
    let max = 0;
    for (const h of horario) {
      min = Math.min(min, hhmmAMinutos(h.hora_apertura.slice(0, 5)));
      max = Math.max(max, hhmmAMinutos(h.hora_cierre.slice(0, 5)));
    }
    return [Math.floor(min / 60), Math.ceil(max / 60)];
  }, [horario]);

  const diaInicioMin = minHora * 60;
  const alturaCol = (maxHora - minHora) * HOUR_PX;
  const horasEje = Array.from({ length: maxHora - minHora + 1 }, (_, i) => minHora + i);

  // Reservas de la semana visible, agrupadas por fecha.
  const porFecha = useMemo(() => {
    const mapa = new Map();
    for (const r of reservas) {
      if (salonFiltro !== 'TODOS' && r.salon_id !== salonFiltro) continue;
      const ini = partesBogota(r.inicio);
      const fin = partesBogota(r.fin);
      const bloque = {
        id: r.id,
        salon_id: r.salon_id,
        materia: r.materia,
        docente: r.usuarios?.nombre,
        nombreSalon: r.salones?.nombre,
        esFija: Boolean(r.es_fija),
        min0: ini.minutos,
        min1: fin.minutos > ini.minutos ? fin.minutos : ini.minutos + 60,
      };
      const lista = mapa.get(ini.fecha) || [];
      lista.push(bloque);
      mapa.set(ini.fecha, lista);
    }
    const conCarriles = new Map();
    for (const [fecha, lista] of mapa) conCarriles.set(fecha, asignarCarriles(lista));
    return conCarriles;
  }, [reservas, salonFiltro]);

  if (estado === 'cargando') return <SkeletonMapa />;
  if (estado === 'error') return <p className="estado-msg error">No se pudo cargar el horario.</p>;

  const hoy = hoyBogota();
  const finSemana = sumarDias(lunes, 6);

  return (
    <div className="horario">
      <div className="horario-toolbar">
        <div className="horario-nav">
          <button type="button" className="icon-btn" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="chip-bloque" onClick={() => setLunes(lunesDeLaSemana(hoyBogota()))}>
            Hoy
          </button>
          <button type="button" className="icon-btn" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">
            <ChevronRight size={18} />
          </button>
          <span className="horario-rango">
            <CalendarDays size={15} /> {fechaCorta(lunes)} – {fechaCorta(finSemana)}
          </span>
        </div>

        <select className="horario-select" value={salonFiltro} onChange={(e) => setSalonFiltro(e.target.value)}>
          <option value="TODOS">Todos los salones</option>
          {salones.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="horario-grid-wrap">
        <div className="horario-grid" style={{ '--alto-col': `${alturaCol}px`, '--hora-px': `${HOUR_PX}px` }}>
          <div className="horario-eje">
            <div className="horario-esquina" />
            {horasEje.map((h) => (
              <div key={h} className="horario-hora">
                {minutosALabel(h * 60)}
              </div>
            ))}
          </div>

          {dias.map(({ diaISO, fecha }) => {
            const { bloques = [], carriles = 1 } = porFecha.get(fecha) || {};
            const esHoy = fecha === hoy;
            return (
              <div key={diaISO} className={`horario-dia ${esHoy ? 'es-hoy' : ''}`}>
                <div className="horario-dia-cabecera">
                  <span className="horario-dia-nombre">{NOMBRE_DIA[diaISO]}</span>
                  <span className="horario-dia-fecha">{fechaCorta(fecha)}</span>
                </div>
                <div className="horario-dia-col" style={{ height: alturaCol }}>
                  {bloques.map((b) => {
                    const cat = salonPorId.get(b.salon_id) ? categoriaVisual(salonPorId.get(b.salon_id)) : 'AULA_CLASE';
                    const top = ((b.min0 - diaInicioMin) / 60) * HOUR_PX;
                    const alto = Math.max(22, ((b.min1 - b.min0) / 60) * HOUR_PX - 2);
                    const ancho = 100 / carriles;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className={`horario-bloque categoria-${cat}`}
                        style={{ top, height: alto, left: `${b.carril * ancho}%`, width: `calc(${ancho}% - 3px)` }}
                        onClick={() => onAbrirSalon?.(b.salon_id)}
                        title={`${b.materia} · ${b.nombreSalon} · ${b.docente || ''}`}
                      >
                        <span className="horario-bloque-hora">{minutosALabel(b.min0)}</span>
                        <span className="horario-bloque-materia">{b.materia}</span>
                        {salonFiltro === 'TODOS' && <span className="horario-bloque-salon">{b.nombreSalon}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
