const express = require('express');
const db = require('../db');

const router = express.Router();

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

module.exports = router;
