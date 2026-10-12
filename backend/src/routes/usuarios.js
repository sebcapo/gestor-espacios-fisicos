const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const { hashPassword } = require('../lib/auth');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

const ROLES = ['DOCENTE', 'ADMIN'];

// GET /api/usuarios - lista todos los usuarios activos
router.get('/', (req, res) => {
  try {
    const data = db
      .prepare('select id, nombre, email, rol, activo, created_at from usuarios where activo = 1 order by nombre')
      .all();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/usuarios - crear usuario (solo ADMIN)
router.post('/', requireRol('ADMIN'), (req, res) => {
  const { nombre, email, rol, password } = req.body;
  if (!nombre || !email || !rol || !password) {
    return res.status(400).json({ error: 'Faltan campos: nombre, email, rol, password' });
  }
  if (!ROLES.includes(rol)) return res.status(400).json({ error: `rol debe ser uno de: ${ROLES.join(', ')}` });
  if (password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });

  const existe = db.prepare('select id from usuarios where email = ?').get(email);
  if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });

  try {
    const id = randomUUID();
    db.prepare('insert into usuarios (id, nombre, email, rol, password_hash) values (?, ?, ?, ?, ?)').run(
      id,
      nombre,
      email,
      rol,
      hashPassword(password),
    );
    res.status(201).json(db.prepare('select id, nombre, email, rol, activo, created_at from usuarios where id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/usuarios/:id - editar usuario (solo ADMIN).
// password es opcional; si viene, se re-hashea.
router.patch('/:id', requireRol('ADMIN'), (req, res) => {
  const { id } = req.params;
  const actual = db.prepare('select * from usuarios where id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' });

  const nombre = req.body.nombre ?? actual.nombre;
  const rol = req.body.rol ?? actual.rol;
  const activo = req.body.activo != null ? (req.body.activo ? 1 : 0) : actual.activo;
  if (!ROLES.includes(rol)) return res.status(400).json({ error: `rol debe ser uno de: ${ROLES.join(', ')}` });

  try {
    db.prepare('update usuarios set nombre = ?, rol = ?, activo = ? where id = ?').run(nombre, rol, activo, id);
    if (req.body.password) {
      if (req.body.password.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
      db.prepare('update usuarios set password_hash = ? where id = ?').run(hashPassword(req.body.password), id);
    }
    res.json(db.prepare('select id, nombre, email, rol, activo, created_at from usuarios where id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/usuarios/:id - desactivar usuario (soft delete, solo ADMIN).
router.delete('/:id', requireRol('ADMIN'), (req, res) => {
  const { id } = req.params;
  if (id === req.usuario.id) return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });

  const actual = db.prepare('select id from usuarios where id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Usuario no encontrado' });

  try {
    db.prepare('update usuarios set activo = 0 where id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
