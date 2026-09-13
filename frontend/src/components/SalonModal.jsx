import { useEffect, useState } from 'react';
import { crearReserva, cancelarReserva, getMateriasHabilitadas, aISO, isoAInputs, formatoHora, TIPO_LABEL } from '../api';

export default function SalonModal({ salon, salones, reservas, usuarioActual, onClose, onCambiarSalon, onCambiado }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [materias, setMaterias] = useState([]);
  const [form, setForm] = useState({
    materia: '',
    materia_id: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
  });

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [sugerencias, setSugerencias] = useState(null);
  const [exito, setExito] = useState('');
  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');

  useEffect(() => {
    getMateriasHabilitadas()
      .then(setMaterias)
      .catch(() => setMaterias([]));
  }, []);

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
    setExito('');

    try {
      const inicio = aISO(form.fecha, form.horaInicio);
      const fin = aISO(form.fecha, form.horaFin);

      if (new Date(inicio) >= new Date(fin)) {
        setError('La hora de inicio debe ser anterior a la hora de fin');
        setEnviando(false);
        return;
      }

      await crearReserva({
        salon_id: salon.id,
        materia: form.materia,
        materia_id: form.materia_id || undefined,
        inicio,
        fin,
      });

      setExito('¡Reserva creada con éxito!');
      setForm({ materia: '', materia_id: '', fecha: '', horaInicio: '', horaFin: '' });
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
      await onCambiado();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-cerrar" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <header className="modal-header">
          <h2>{salon.nombre}</h2>
          <span className="badge">{TIPO_LABEL[salon.tipo] || salon.tipo}</span>
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
                  {r.es_fija && <span className="badge-fija">clase fija</span>}
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
          <button type="button" className="boton-primario" onClick={() => setMostrarForm(true)}>
            + Reservar este salón
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
                <input id="fecha" type="date" required value={form.fecha} onChange={(e) => actualizar('fecha', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="horaInicio">Inicio</label>
                <input
                  id="horaInicio"
                  type="time"
                  required
                  value={form.horaInicio}
                  onChange={(e) => actualizar('horaInicio', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="horaFin">Fin</label>
                <input id="horaFin" type="time" required value={form.horaFin} onChange={(e) => actualizar('horaFin', e.target.value)} />
              </div>
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

        {exito && <p className="mensaje-exito">{exito}</p>}
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
