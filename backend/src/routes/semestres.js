const express = require('express');
const supabase = require('../supabaseClient');

const router = express.Router();

// GET /api/semestres - lista de semestres (?estado=VIGENTE para filtrar)
router.get('/', async (req, res) => {
  let query = supabase.from('semestres').select('*').order('fecha_inicio', { ascending: false });
  if (req.query.estado) query = query.eq('estado', req.query.estado);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
