import { useEffect, useState } from 'react';
import { getUsuarioActual, logout } from './api';
import { useTema } from './useTema';
import LoginForm from './components/LoginForm';
import MapaSalones from './components/MapaSalones';
import ChatAsistente from './components/ChatAsistente';
import './App.css';

const TABS = [
  { id: 'mapa', label: 'Mapa de salones' },
  { id: 'asistente', label: 'Asistente IA' },
];

function App() {
  const { tema, alternar } = useTema();
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('mapa');
  const [stats, setStats] = useState(null);

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
        <div className="app-header-marca">
          <span className="logo-badge">MC</span>
          <div>
            <h1>Gestor de Espacios Físicos</h1>
            <p>Fundación Universitaria María Cano — Sede Medellín</p>
          </div>
        </div>

        <div className="app-header-acciones">
          {stats && (
            <span className="pill-libres">
              <span className="pill-dot" /> {stats.libres}/{stats.total} libres
            </span>
          )}

          <button type="button" className="theme-switch" onClick={alternar} aria-label="Cambiar tema">
            <span className={tema === 'oscuro' ? 'theme-switch-track activo' : 'theme-switch-track'}>
              <span className="theme-switch-thumb" />
            </span>
            Tema oscuro
          </button>

          <span className="usuario-pill">
            {usuario.nombre} <span className="badge">{usuario.rol}</span>
          </span>
          <button type="button" className="link-btn link-btn-claro" onClick={cerrarSesion}>
            Salir
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
        {tab === 'mapa' && <MapaSalones usuarioActual={usuario} onStats={setStats} />}
        {tab === 'asistente' && <ChatAsistente />}
      </main>
    </div>
  );
}

export default App;
