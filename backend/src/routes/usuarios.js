const express = require('express');
const supabase = require('../supabaseClient');

const router = express.Router();

// GET /api/usuarios - lista todos los usuarios activos
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
