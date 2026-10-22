const express = require('express');
const db = require('../db');
const { falloServidor } = require('../lib/errores');

const router = express.Router();

// GET /api/horario-institucional - franjas activas de apertura/cierre por día
router.get('/', (req, res) => {
  try {
    const data = db
      .prepare(
        'select dia_semana, hora_apertura, hora_cierre from horario_institucional where activo = 1 order by dia_semana, hora_apertura',
      )
      .all();
    res.json(data);
  } catch (error) {
    falloServidor(res, error);
  }
});

module.exports = router;
