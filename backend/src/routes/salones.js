const express = require('express');
const supabase = require('../supabaseClient');

const router = express.Router();

// GET /api/salones - lista todos los salones activos
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('salones')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/salones/:id/reservas - próximas reservas programadas de un salón
router.get('/:id/reservas', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('salon_id', id)
    .eq('estado', 'PROGRAMADA');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
