import { useEffect, useState } from 'react';
import { getUsuarioActual, logout } from './api';
import LoginForm from './components/LoginForm';
import MapaSalones from './components/MapaSalones';
import ChatAsistente from './components/ChatAsistente';
import './App.css';

const TABS = [
  { id: 'mapa', label: 'Mapa de salones' },
  { id: 'asistente', label: 'Asistente IA' },
];

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('mapa');

  useEffect(() => {
    getUsuarioActual()
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  async function cerrarSesion() {
    try {
      await logout();
    } finally {
      setUsuario(null);
    }
  }

  if (cargando) return null;

  if (!usuario) return <LoginForm onLogin={setUsuario} />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Gestor de Espacios Físicos</h1>
          <p>Fundación Universitaria María Cano — Sede Medellín</p>
        </div>

        <div className="usuario-sesion">
          <span>
            {usuario.nombre} <span className="badge">{usuario.rol}</span>
          </span>
          <button type="button" className="link-btn" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
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
        {tab === 'mapa' && <MapaSalones usuarioActual={usuario} />}
        {tab === 'asistente' && <ChatAsistente />}
      </main>
    </div>
  );
}

export default App;
