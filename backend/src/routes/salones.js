const express = require('express');
const { randomUUID } = require('node:crypto');
const db = require('../db');
const { requireRol } = require('../middleware/auth');

const router = express.Router();

const TIPOS = ['SALON', 'SALA_COMPUTO', 'LABORATORIO_ELECTRONICA'];

// GET /api/salones - lista todos los salones activos
router.get('/', (req, res) => {
  try {
    const data = db.prepare('select * from salones where activo = 1 order by nombre').all();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/salones/:id/reservas - próximas reservas programadas de un salón
router.get('/:id/reservas', (req, res) => {
  const { id } = req.params;
  try {
    const data = db
      .prepare("select * from reservas where salon_id = ? and estado = 'PROGRAMADA'")
      .all(id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function validarSalon({ nombre, tipo, capacidad, ubicacion }) {
  if (!nombre || !tipo || capacidad == null) return 'Faltan campos: nombre, tipo, capacidad';
  if (!TIPOS.includes(tipo)) return `tipo debe ser uno de: ${TIPOS.join(', ')}`;
  if (!Number.isInteger(capacidad) || capacidad <= 0) return 'capacidad debe ser un entero positivo';
  if (ubicacion != null && typeof ubicacion !== 'string') return 'ubicacion inválida';
  return null;
}

// POST /api/salones - crear salón (solo ADMIN)
router.post('/', requireRol('ADMIN'), (req, res) => {
  const { nombre, tipo, capacidad, ubicacion } = req.body;
  const error = validarSalon({ nombre, tipo, capacidad, ubicacion });
  if (error) return res.status(400).json({ error });

  try {
    const id = randomUUID();
    db.prepare('insert into salones (id, nombre, tipo, capacidad, ubicacion) values (?, ?, ?, ?, ?)').run(
      id,
      nombre,
      tipo,
      capacidad,
      ubicacion || null,
    );
    res.status(201).json(db.prepare('select * from salones where id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/salones/:id - editar salón (solo ADMIN)
router.patch('/:id', requireRol('ADMIN'), (req, res) => {
  const { id } = req.params;
  const actual = db.prepare('select * from salones where id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Salón no encontrado' });

  const nombre = req.body.nombre ?? actual.nombre;
  const tipo = req.body.tipo ?? actual.tipo;
  const capacidad = req.body.capacidad ?? actual.capacidad;
  const ubicacion = req.body.ubicacion ?? actual.ubicacion;
  const activo = req.body.activo != null ? (req.body.activo ? 1 : 0) : actual.activo;

  const error = validarSalon({ nombre, tipo, capacidad, ubicacion });
  if (error) return res.status(400).json({ error });

  try {
    db.prepare('update salones set nombre = ?, tipo = ?, capacidad = ?, ubicacion = ?, activo = ? where id = ?').run(
      nombre,
      tipo,
      capacidad,
      ubicacion || null,
      activo,
      id,
    );
    res.json(db.prepare('select * from salones where id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/salones/:id - desactivar salón (soft delete, solo ADMIN).
// No se borra físicamente para no romper las reservas históricas que lo referencian.
router.delete('/:id', requireRol('ADMIN'), (req, res) => {
  const { id } = req.params;
  const actual = db.prepare('select id from salones where id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Salón no encontrado' });

  try {
    db.prepare('update salones set activo = 0 where id = ?').run(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
