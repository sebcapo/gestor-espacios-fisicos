import { useState } from 'react';
import { login } from '../api';
import { useTema } from '../useTema';

export default function LoginForm({ onLogin }) {
  const { tema, alternar } = useTema();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const usuario = await login(email, password);
      onLogin(usuario);
    } catch (err) {
      setError(err.status === 401 ? 'Correo o contraseña incorrectos' : err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card-split">
        <button type="button" className="theme-switch login-theme-switch" onClick={alternar} aria-label="Cambiar tema">
          <span className={tema === 'oscuro' ? 'theme-switch-track activo' : 'theme-switch-track'}>
            <span className="theme-switch-thumb" />
          </span>
          Tema oscuro
        </button>

        <div className="login-visual">
          <div className="login-marca">
            <span className="logo-badge">MC</span>
            <div>
              <p className="login-marca-sub">Fundación Universitaria</p>
              <p className="login-marca-nombre">María Cano</p>
            </div>
          </div>

          <div className="login-copy">
            <p className="login-eyebrow">Gestión universitaria</p>
            <h1>
              Espacios que conectan
              <br />a nuestra comunidad.
            </h1>
            <p className="login-descripcion">
              Consulta disponibilidad y administra los espacios físicos de la sede Medellín desde un solo lugar.
            </p>
          </div>

          <p className="login-footer">Sede Medellín · Sistema institucional</p>
        </div>

        <div className="login-panel">
          <form className="login-form" onSubmit={enviar}>
          <p className="login-eyebrow">Bienvenido de nuevo</p>
          <h2>Inicia sesión</h2>
          <p className="login-subtitulo">Accede con tus credenciales institucionales para gestionar los espacios.</p>

          <div className="campo">
            <label htmlFor="email">Correo institucional</label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@fumcvirtual.edu.co"
            />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
            />
          </div>

          {error && <p className="mensaje-error">{error}</p>}

          <button type="submit" className="boton-primario boton-ancho" disabled={enviando}>
            {enviando ? 'Ingresando...' : 'Ingresar al sistema'}
          </button>

          <p className="login-demo">
            Acceso de demostración: usa un correo sembrado (ej. <code>rangel@fumcvirtual.edu.co</code>) y la
            contraseña <code>fumc2026</code>.
          </p>
          </form>
        </div>
      </div>
    </div>
  );
}
