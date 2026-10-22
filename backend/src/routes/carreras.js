const express = require('express');
const db = require('../db');
const { falloServidor } = require('../lib/errores');

const router = express.Router();

// GET /api/carreras - carreras activas
router.get('/', (req, res) => {
  try {
    const data = db.prepare('select * from carreras where activo = 1 order by nombre').all();
    res.json(data);
  } catch (error) {
    falloServidor(res, error);
  }
});

module.exports = router;
