const express = require('express');
const supabase = require('../supabaseClient');
const { semestreVigente } = require('../lib/academico');

const router = express.Router();

// GET /api/materias - materias activas, con su carrera
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('materias')
    .select('id, nombre, codigo, tipo_espacio_requerido, carreras(nombre, codigo)')
    .eq('activo', true)
    .order('nombre');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/materias/habilitadas - materias ofrecidas en el semestre vigente
router.get('/habilitadas', async (req, res) => {
  try {
    const semestre = await semestreVigente();
    if (!semestre) return res.json([]);

    const { data, error } = await supabase
      .from('materias_habilitadas')
      .select('materias(id, nombre, codigo, tipo_espacio_requerido, carreras(nombre, codigo))')
      .eq('semestre_id', semestre.id);

    if (error) return res.status(500).json({ error: error.message });

    const materias = data
      .map((fila) => fila.materias)
      .filter((m) => m && m.activo !== false)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    res.json(materias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
