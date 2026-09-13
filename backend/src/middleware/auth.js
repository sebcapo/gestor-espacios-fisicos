'use strict';

const { obtenerUsuarioDeSesion } = require('../lib/auth');

const COOKIE_NAME = 'sesion';

// Exige una sesión válida (cookie httpOnly) y cuelga el usuario en req.usuario.
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const usuario = obtenerUsuarioDeSesion(token);

  if (!usuario) return res.status(401).json({ error: 'No autenticado' });

  req.usuario = usuario;
  next();
}

// Exige, además de sesión válida, que el rol del usuario esté en la lista dada.
function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.usuario.rol)) return res.status(403).json({ error: 'No autorizado para esta acción' });
    next();
  };
}

module.exports = { requireAuth, requireRol, COOKIE_NAME };
