const express = require('express');
const db = require('../db');
const { semestreVigente } = require('../lib/academico');

const router = express.Router();

function conCarrera(fila) {
  const { carrera_nombre, carrera_codigo, ...resto } = fila;
  return { ...resto, carreras: { nombre: carrera_nombre, codigo: carrera_codigo } };
}

// GET /api/materias - materias activas, con su carrera
router.get('/', (req, res) => {
  try {
    const filas = db
      .prepare(
        `select m.id, m.nombre, m.codigo, m.tipo_espacio_requerido,
                c.nombre as carrera_nombre, c.codigo as carrera_codigo
         from materias m
         join carreras c on c.id = m.carrera_id
         where m.activo = 1
         order by m.nombre`,
      )
      .all();
    res.json(filas.map(conCarrera));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/materias/habilitadas - materias ofrecidas en el semestre vigente
router.get('/habilitadas', async (req, res) => {
  try {
    const semestre = await semestreVigente();
    if (!semestre) return res.json([]);

    const filas = db
      .prepare(
        `select m.id, m.nombre, m.codigo, m.tipo_espacio_requerido, m.activo,
                c.nombre as carrera_nombre, c.codigo as carrera_codigo
         from materias_habilitadas mh
         join materias m on m.id = mh.materia_id
         join carreras c on c.id = m.carrera_id
         where mh.semestre_id = ?
         order by m.nombre`,
      )
      .all(semestre.id);

    const materias = filas.filter((m) => m.activo).map(conCarrera);
    res.json(materias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
