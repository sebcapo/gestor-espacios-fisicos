import { useEffect, useMemo, useState } from 'react';
import { X, CalendarPlus } from 'lucide-react';
import { useToast } from '../Toast';
import {
  crearReserva,
  cancelarReserva,
  getMateriasHabilitadas,
  getHorarioInstitucional,
  aISO,
  isoAInputs,
  formatoHora,
  categoriaVisual,
  CATEGORIAS,
  diaSemanaISO,
  hhmmAMinutos,
  minutosAHHMM,
  minutosALabel,
  generarSlots,
} from '../api';

export default function SalonModal({ salon, salones, reservas, usuarioActual, onClose, onCambiarSalon, onCambiado }) {
  const toast = useToast();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [materias, setMaterias] = useState([]);
  const [horarioInstitucional, setHorarioInstitucional] = useState([]);
  const [form, setForm] = useState({
    materia: '',
    materia_id: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    asistentes: '',
  });

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [sugerencias, setSugerencias] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');

  useEffect(() => {
    getMateriasHabilitadas()
      .then(setMaterias)
      .catch(() => setMaterias([]));
    getHorarioInstitucional()
      .then(setHorarioInstitucional)
      .catch(() => setHorarioInstitucional([]));
  }, []);

  // Franjas de apertura/cierre del día elegido, para ofrecer solo horas
  // válidas (en vez del selector de hora nativo del navegador, confuso).
  const franjasDelDia = useMemo(() => {
    const dia = diaSemanaISO(form.fecha);
    if (dia == null) return [];
    return horarioInstitucional.filter((f) => f.dia_semana === dia);
  }, [horarioInstitucional, form.fecha]);

  const opcionesInicio = useMemo(() => {
    const out = [];
    franjasDelDia.forEach((f, franjaIdx) => {
      generarSlots(f.hora_apertura, f.hora_cierre)
        .slice(0, -1)
        .forEach((min) => out.push({ min, franjaIdx }));
    });
    return out;
  }, [franjasDelDia]);

  const franjaDeInicioElegido = useMemo(() => {
    if (!form.horaInicio) return null;
    const minElegido = hhmmAMinutos(form.horaInicio);
    return franjasDelDia.find((f) => {
      const slots = generarSlots(f.hora_apertura, f.hora_cierre);
      return minElegido >= slots[0] && minElegido < slots[slots.length - 1];
    });
  }, [franjasDelDia, form.horaInicio]);

  const opcionesFin = useMemo(() => {
    if (!franjaDeInicioElegido) return [];
    const minInicio = hhmmAMinutos(form.horaInicio);
    return generarSlots(franjaDeInicioElegido.hora_apertura, franjaDeInicioElegido.hora_cierre).filter(
      (min) => min > minInicio,
    );
  }, [franjaDeInicioElegido, form.horaInicio]);

  const ahora = new Date();
  const proximas = reservas.filter((r) => r.fin > ahora);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setError('');
    setSugerencias(null);
  }

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    setSugerencias(null);

    try {
      const inicio = aISO(form.fecha, form.horaInicio);
      const fin = aISO(form.fecha, form.horaFin);

      if (new Date(inicio) >= new Date(fin)) {
        setError('La hora de inicio debe ser anterior a la hora de fin');
        setEnviando(false);
        return;
      }

      const creada = await crearReserva({
        salon_id: salon.id,
        materia: form.materia,
        materia_id: form.materia_id || undefined,
        inicio,
        fin,
        asistentes_estimados: form.asistentes ? Number(form.asistentes) : undefined,
      });

      toast(`Reserva creada en ${salon.nombre}`, 'exito');
      if (creada.advertencia) toast(creada.advertencia, 'advertencia', 7000);
      setForm({ materia: '', materia_id: '', fecha: '', horaInicio: '', horaFin: '', asistentes: '' });
      setMostrarForm(false);
      await onCambiado();
    } catch (err) {
      if (err.status === 409) {
        setError(err.message);
        setSugerencias(err.body?.sugerencias || null);
      } else {
        setError(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  function usarHorarioSugerido(inicioIso, finIso) {
    const { fecha, hora: horaInicio } = isoAInputs(inicioIso);
    const { hora: horaFin } = isoAInputs(finIso);
    setForm((f) => ({ ...f, fecha, horaInicio, horaFin }));
    setError('');
    setSugerencias(null);
  }

  async function confirmarCancelacion(id) {
    try {
      await cancelarReserva(id, motivoCancelacion || 'Cancelada desde el mapa de salones');
      setCancelandoId(null);
      setMotivoCancelacion('');
      toast('Reserva cancelada', 'exito');
      await onCambiado();
    } catch (err) {
      toast(err.message, 'error', 6000);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-cerrar" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>

        <header className="modal-header">
          <h2>{salon.nombre}</h2>
          <span className="badge">{CATEGORIAS[categoriaVisual(salon)].label}</span>
        </header>
        <p className="salon-meta">
          {salon.ubicacion} · Capacidad: {salon.capacidad}
        </p>

        <div className="modal-reservas">
          <h3>Próximas reservas</h3>
          {proximas.length === 0 && <p className="sin-reservas">Sin reservas próximas — disponible</p>}
          <ul>
            {proximas.map((r) => (
              <li key={r.id} className="reserva-item">
                <div>
                  <strong>{formatoHora.format(r.inicio)}</strong> — {r.materia} ({r.usuarios?.nombre})
                  {r.asistentes_estimados ? ` · ${r.asistentes_estimados} pers.` : ''}
                  {Boolean(r.es_fija) && <span className="badge-fija">clase fija</span>}
                </div>

                {!r.es_fija &&
                  (cancelandoId === r.id ? (
                    <div className="cancelar-inline">
                      <input
                        type="text"
                        placeholder="Motivo (opcional)"
                        value={motivoCancelacion}
                        onChange={(e) => setMotivoCancelacion(e.target.value)}
                      />
                      <button type="button" className="link-btn peligro" onClick={() => confirmarCancelacion(r.id)}>
                        Confirmar
                      </button>
                      <button type="button" className="link-btn" onClick={() => setCancelandoId(null)}>
                        Volver
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="link-btn peligro" onClick={() => setCancelandoId(r.id)}>
                      Cancelar
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </div>

        {!mostrarForm ? (
          <button type="button" className="boton-primario boton-con-icono" onClick={() => setMostrarForm(true)}>
            <CalendarPlus size={16} /> Reservar este salón
          </button>
        ) : (
          <form className="form-reserva" onSubmit={enviar}>
            <p className="reservando-como">
              Reservando como <strong>{usuarioActual?.nombre}</strong>
            </p>

            <div className="campo">
              <label htmlFor="materia">Materia</label>
              {materias.length > 0 ? (
                <select
                  id="materia"
                  required
                  value={form.materia_id}
                  onChange={(e) => {
                    const m = materias.find((x) => x.id === e.target.value);
                    setForm((f) => ({ ...f, materia_id: e.target.value, materia: m ? m.nombre : '' }));
                    setError('');
                    setSugerencias(null);
                  }}
                >
                  <option value="" disabled>
                    Selecciona una materia
                  </option>
                  {materias.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                      {m.carreras?.codigo ? ` (${m.carreras.codigo})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="materia"
                  type="text"
                  required
                  value={form.materia}
                  onChange={(e) => actualizar('materia', e.target.value)}
                  placeholder="Ej. Programación I"
                />
              )}
            </div>

            <div className="campo-fila">
              <div className="campo">
                <label htmlFor="fecha">Fecha</label>
                <input
                  id="fecha"
                  type="date"
                  required
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value, horaInicio: '', horaFin: '' }))}
                />
              </div>
              <div className="campo">
                <label htmlFor="horaInicio">Inicio</label>
                <select
                  id="horaInicio"
                  required
                  disabled={!form.fecha || opcionesInicio.length === 0}
                  value={form.horaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value, horaFin: '' }))}
                >
                  <option value="" disabled>
                    {!form.fecha ? 'Elige fecha' : opcionesInicio.length === 0 ? 'Cerrado ese día' : 'Elige hora'}
                  </option>
                  {opcionesInicio.map(({ min }) => (
                    <option key={min} value={minutosAHHMM(min)}>
                      {minutosALabel(min)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="horaFin">Fin</label>
                <select
                  id="horaFin"
                  required
                  disabled={!form.horaInicio}
                  value={form.horaFin}
                  onChange={(e) => actualizar('horaFin', e.target.value)}
                >
                  <option value="" disabled>
                    {!form.horaInicio ? 'Elige inicio primero' : 'Elige hora'}
                  </option>
                  {opcionesFin.map((min) => (
                    <option key={min} value={minutosAHHMM(min)}>
                      {minutosALabel(min)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {form.fecha && franjasDelDia.length === 0 && (
              <p className="mensaje-error">La universidad no abre ese día.</p>
            )}

            <div className="campo">
              <label htmlFor="asistentes">Nº de asistentes (opcional)</label>
              <input
                id="asistentes"
                type="number"
                min="1"
                max={salon.capacidad}
                placeholder={`Máx. ${salon.capacidad}`}
                value={form.asistentes}
                onChange={(e) => actualizar('asistentes', e.target.value)}
              />
            </div>

            <div className="modal-acciones">
              <button type="submit" className="boton-primario" disabled={enviando}>
                {enviando ? 'Creando...' : 'Confirmar reserva'}
              </button>
              <button type="button" className="link-btn" onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {error && <p className="mensaje-error">{error}</p>}

        {sugerencias && (
          <div className="sugerencias">
            {sugerencias.otros_salones?.length > 0 && (
              <div>
                <p>Salones libres en ese mismo horario:</p>
                <div className="chips">
                  {sugerencias.otros_salones.map((s) => (
                    <button type="button" key={s.id} className="chip" onClick={() => onCambiarSalon(s.id)}>
                      {s.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sugerencias.otros_horarios?.length > 0 && (
              <div>
                <p>Horarios libres en este mismo salón, el mismo día:</p>
                <div className="chips">
                  {sugerencias.otros_horarios.map((h) => (
                    <button type="button" key={h.inicio} className="chip" onClick={() => usarHorarioSugerido(h.inicio, h.fin)}>
                      {formatoHora.format(new Date(h.inicio))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
