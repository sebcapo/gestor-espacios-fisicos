import { useState } from 'react';
import { login } from '../api';

export default function LoginForm({ onLogin }) {
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
      <form className="login-card" onSubmit={enviar}>
        <h1>Gestor de Espacios Físicos</h1>
        <p className="login-subtitulo">Fundación Universitaria María Cano — Sede Medellín</p>

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
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="mensaje-error">{error}</p>}

        <button type="submit" className="boton-primario" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
