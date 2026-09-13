const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/semestres - lista de semestres (?estado=VIGENTE para filtrar)
router.get('/', (req, res) => {
  try {
    let sql = 'select * from semestres';
    const params = [];
    if (req.query.estado) {
      sql += ' where estado = ?';
      params.push(req.query.estado);
    }
    sql += ' order by fecha_inicio desc';

    const data = db.prepare(sql).all(...params);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
