import { useEffect, useState } from 'react';
import { LayoutGrid, CalendarDays, CalendarCheck, Sparkles, LogOut, CircleDot } from 'lucide-react';
import { getUsuarioActual, logout } from './api';
import { useTema } from './useTema';
import LoginForm from './components/LoginForm';
import MapaSalones from './components/MapaSalones';
import HorarioSemanal from './components/HorarioSemanal';
import MisReservas from './components/MisReservas';
import ChatAsistente from './components/ChatAsistente';
import './App.css';

const TABS = [
  { id: 'mapa', label: 'Mapa de salones', icono: LayoutGrid },
  { id: 'horario', label: 'Horario semanal', icono: CalendarDays },
  { id: 'mis-reservas', label: 'Mis reservas', icono: CalendarCheck },
  { id: 'asistente', label: 'Asistente IA', icono: Sparkles },
];

function App() {
  const { tema, alternar } = useTema();
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('mapa');
  const [stats, setStats] = useState(null);
  const [salonParaAbrir, setSalonParaAbrir] = useState(null);

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

  function abrirSalonDesdeHorario(salonId) {
    setSalonParaAbrir(salonId);
    setTab('mapa');
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
              <CircleDot size={14} /> {stats.libres}/{stats.total} libres
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
          <button type="button" className="link-btn link-btn-claro boton-con-icono" onClick={cerrarSesion}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => {
          const Icono = t.icono;
          return (
            <button
              key={t.id}
              type="button"
              className={t.id === tab ? 'tab activa' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              <Icono size={15} /> {t.label}
            </button>
          );
        })}
      </nav>

      <main>
        {tab === 'mapa' && (
          <MapaSalones
            usuarioActual={usuario}
            onStats={setStats}
            abrirSalonId={salonParaAbrir}
            onAbrirConsumido={() => setSalonParaAbrir(null)}
          />
        )}
        {tab === 'horario' && <HorarioSemanal onAbrirSalon={abrirSalonDesdeHorario} />}
        {tab === 'mis-reservas' && <MisReservas usuarioActual={usuario} />}
        {tab === 'asistente' && <ChatAsistente />}
      </main>
    </div>
  );
}

export default App;
