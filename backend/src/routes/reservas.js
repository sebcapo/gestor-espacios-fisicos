const express = require('express');
const supabase = require('../supabaseClient');
const { crearReserva: crearReservaService } = require('../lib/reservasService');

const router = express.Router();

// GET /api/reservas - lista todas las reservas programadas, con nombre del salón y del docente
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, salones(nombre), usuarios(nombre)')
    .eq('estado', 'PROGRAMADA');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/reservas - crea una reserva. Body: { salon_id, docente_id, materia, inicio, fin }
// inicio/fin en formato ISO, ej: "2026-09-10T14:00:00-05:00"
router.post('/', async (req, res) => {
  const { salon_id, docente_id, materia, inicio, fin } = req.body;

  if (!salon_id || !docente_id || !materia || !inicio || !fin) {
    return res.status(400).json({ error: 'Faltan campos: salon_id, docente_id, materia, inicio, fin' });
  }

  if (new Date(inicio) >= new Date(fin)) {
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
  }

  const resultado = await crearReservaService({ salon_id, docente_id, materia, inicio, fin });

  if (resultado.ok) return res.status(201).json(resultado.reserva);

  const { status, ok, ...body } = resultado;
  res.status(status).json(body);
});

// PATCH /api/reservas/:id/cancelar - cancela una reserva (bloqueado si es_fija = true)
router.patch('/:id/cancelar', async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  const { data, error } = await supabase
    .from('reservas')
    .update({
      estado: 'CANCELADA',
      motivo_cancelacion: motivo || null,
      cancelada_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.message.includes('clase fija')) {
      return res.status(403).json({ error: 'No se puede cancelar: es una clase fija' });
    }
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

module.exports = router;
