const express = require('express');
const supabase = require('../supabaseClient');

const router = express.Router();

// GET /api/horario-institucional - franjas activas de apertura/cierre por día
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('horario_institucional')
    .select('dia_semana, hora_apertura, hora_cierre')
    .eq('activo', true)
    .order('dia_semana')
    .order('hora_apertura');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
