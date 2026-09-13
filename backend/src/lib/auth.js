// Autenticación local: contraseñas con scrypt (node:crypto, sin dependencias
// nativas que compilar) y sesiones guardadas en la propia base SQLite.
'use strict';

const crypto = require('node:crypto');
const db = require('../db');

const DURACION_SESION_MS = 1000 * 60 * 60 * 24 * 7; // 7 días
const KEYLEN = 64;

// Formato guardado: "salt_hex:hash_hex"
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verificarPassword(password, almacenado) {
  if (!almacenado || !almacenado.includes(':')) return false;
  const [salt, hashGuardado] = almacenado.split(':');
  const hashCalculado = crypto.scryptSync(password, salt, KEYLEN);
  const bufGuardado = Buffer.from(hashGuardado, 'hex');
  if (bufGuardado.length !== hashCalculado.length) return false;
  return crypto.timingSafeEqual(bufGuardado, hashCalculado);
}

function crearSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiraAt = new Date(Date.now() + DURACION_SESION_MS).toISOString();
  db.prepare('insert into sesiones (token, usuario_id, expira_at) values (?, ?, ?)').run(token, usuarioId, expiraAt);
  return token;
}

function obtenerUsuarioDeSesion(token) {
  if (!token) return null;
  const fila = db
    .prepare(
      `select u.id, u.nombre, u.email, u.rol, u.activo
       from sesiones s
       join usuarios u on u.id = s.usuario_id
       where s.token = ? and s.expira_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now') and u.activo = 1`,
    )
    .get(token);
  return fila || null;
}

function eliminarSesion(token) {
  if (!token) return;
  db.prepare('delete from sesiones where token = ?').run(token);
}

module.exports = { hashPassword, verificarPassword, crearSesion, obtenerUsuarioDeSesion, eliminarSesion, DURACION_SESION_MS };
