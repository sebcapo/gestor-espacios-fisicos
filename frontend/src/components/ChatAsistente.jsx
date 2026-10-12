import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { consultarAsistente } from '../api';

const SUGERENCIAS = [
  'Necesito una sala de cómputo para 30 personas el jueves de 2 a 4pm',
  '¿Qué salones hay libres mañana de 10 a 12?',
  'Quiero reservar un auditorio el viernes en la tarde',
];

export default function ChatAsistente() {
  const [mensajes, setMensajes] = useState([
    { autor: 'asistente', texto: '¡Hola! Cuéntame qué necesitas: tipo de salón, para cuántas personas, y el día y horario.' },
  ]);
  const [historial, setHistorial] = useState([]);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function enviarTexto(texto) {
    if (!texto || enviando) return;

    setMensajes((m) => [...m, { autor: 'usuario', texto }]);
    setEntrada('');
    setEnviando(true);

    try {
      const resultado = await consultarAsistente({ mensaje: texto, historial });
      setMensajes((m) => [...m, { autor: 'asistente', texto: resultado.respuesta }]);
      setHistorial(resultado.historial);
    } catch (err) {
      setMensajes((m) => [...m, { autor: 'asistente', texto: `Ocurrió un error: ${err.message}`, error: true }]);
    } finally {
      setEnviando(false);
    }
  }

  function enviar(e) {
    e.preventDefault();
    enviarTexto(entrada.trim());
  }

  const soloBienvenida = mensajes.length === 1;

  return (
    <div className="chat">
      <div className="chat-mensajes">
        {mensajes.map((m, i) => (
          <div key={i} className={`burbuja-fila ${m.autor}`}>
            {m.autor === 'asistente' && (
              <span className="chat-avatar" aria-hidden>
                <Sparkles size={15} />
              </span>
            )}
            <div className={`burbuja ${m.autor} ${m.error ? 'error' : ''}`}>{m.texto}</div>
          </div>
        ))}

        {soloBienvenida && (
          <div className="chat-sugerencias">
            {SUGERENCIAS.map((s) => (
              <button key={s} type="button" className="chat-sugerencia" onClick={() => enviarTexto(s)} disabled={enviando}>
                {s}
              </button>
            ))}
          </div>
        )}

        {enviando && (
          <div className="burbuja-fila asistente">
            <span className="chat-avatar" aria-hidden>
              <Sparkles size={15} />
            </span>
            <div className="burbuja asistente pensando">Pensando…</div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form className="chat-form" onSubmit={enviar}>
        <input
          type="text"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Escribe lo que necesitas…"
          disabled={enviando}
        />
        <button type="submit" disabled={enviando || !entrada.trim()} aria-label="Enviar">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
