import { useEffect, useState } from 'react';
import { getUsuarios } from './api';
import MapaSalones from './components/MapaSalones';
import ChatAsistente from './components/ChatAsistente';
import './App.css';

const TABS = [
  { id: 'mapa', label: 'Mapa de salones' },
  { id: 'asistente', label: 'Asistente IA' },
];

function App() {
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioActualId, setUsuarioActualId] = useState('');
  const [tab, setTab] = useState('mapa');

  useEffect(() => {
    getUsuarios().then((data) => {
      setUsuarios(data);
      if (data.length > 0) setUsuarioActualId(data[0].id);
    });
  }, []);

  const usuarioActual = usuarios.find((u) => u.id === usuarioActualId) || null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Gestor de Espacios Físicos</h1>
          <p>Fundación Universitaria María Cano — Sede Medellín</p>
        </div>

        <div className="selector-usuario">
          <label htmlFor="usuario-actual">Estás usando el sistema como:</label>
          <select id="usuario-actual" value={usuarioActualId} onChange={(e) => setUsuarioActualId(e.target.value)}>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.rol})
              </option>
            ))}
          </select>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={t.id === tab ? 'tab activa' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'mapa' && <MapaSalones usuarioActual={usuarioActual} />}
        {tab === 'asistente' && usuarioActual && <ChatAsistente usuarioActual={usuarioActual} />}
      </main>
    </div>
  );
}

export default App;
