const express = require('express');
const db = require('../db');
const { verificarPassword, crearSesion, eliminarSesion, DURACION_SESION_MS } = require('../lib/auth');
const { requireAuth, COOKIE_NAME } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: DURACION_SESION_MS,
};

function usuarioPublico(usuario) {
  const { password_hash, ...resto } = usuario;
  return resto;
}

// POST /api/auth/login - Body: { email, password }
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos: email, password' });
  }

  const usuario = db.prepare('select * from usuarios where email = ? and activo = 1').get(email);

  if (!usuario || !verificarPassword(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  const token = crearSesion(usuario.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json(usuarioPublico(usuario));
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  eliminarSesion(req.cookies[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
  res.json({ ok: true });
});

// GET /api/auth/me - usuario de la sesión actual
router.get('/me', requireAuth, (req, res) => {
  res.json(req.usuario);
});

module.exports = router;
