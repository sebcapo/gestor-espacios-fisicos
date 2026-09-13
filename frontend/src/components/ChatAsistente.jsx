import { useEffect, useRef, useState } from 'react';
import { consultarAsistente } from '../api';

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

  async function enviar(e) {
    e.preventDefault();
    const texto = entrada.trim();
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

  return (
    <div className="chat">
      <div className="chat-mensajes">
        {mensajes.map((m, i) => (
          <div key={i} className={`burbuja ${m.autor} ${m.error ? 'error' : ''}`}>
            {m.texto}
          </div>
        ))}
        {enviando && <div className="burbuja asistente pensando">Pensando...</div>}
        <div ref={finRef} />
      </div>

      <form className="chat-form" onSubmit={enviar}>
        <input
          type="text"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Ej: necesito un salón de cómputo para 30 personas el jueves de 2 a 4pm"
          disabled={enviando}
        />
        <button type="submit" disabled={enviando || !entrada.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
