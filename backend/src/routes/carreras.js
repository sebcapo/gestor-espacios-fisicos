const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/carreras - carreras activas
router.get('/', (req, res) => {
  try {
    const data = db.prepare('select * from carreras where activo = 1 order by nombre').all();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
