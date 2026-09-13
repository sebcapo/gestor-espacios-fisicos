const express = require('express');
const db = require('../db');
const { crearReserva: crearReservaService, reservaConDetalle } = require('../lib/reservasService');

const router = express.Router();

// GET /api/reservas - lista todas las reservas programadas, con nombre del salón y del docente
router.get('/', (req, res) => {
  try {
    const filas = db
      .prepare(
        `select
           r.*,
           json_object('nombre', s.nombre) as salones,
           json_object('nombre', u.nombre) as usuarios,
           case when m.id is null then null else json_object('nombre', m.nombre, 'codigo', m.codigo) end as materias
         from reservas r
         join salones s on s.id = r.salon_id
         join usuarios u on u.id = r.docente_id
         left join materias m on m.id = r.materia_id
         where r.estado = 'PROGRAMADA'`,
      )
      .all()
      .map((fila) => ({
        ...fila,
        salones: JSON.parse(fila.salones),
        usuarios: JSON.parse(fila.usuarios),
        materias: fila.materias ? JSON.parse(fila.materias) : null,
      }));

    res.json(filas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reservas - crea una reserva a nombre del usuario autenticado.
// Body: { salon_id, materia, inicio, fin, materia_id? }
// El docente es siempre el de la sesión (requireAuth), nunca el que mande el cliente.
// materia_id es opcional; si viene, la materia se valida contra el tipo de salón.
// inicio/fin en formato ISO, ej: "2026-09-10T14:00:00-05:00"
router.post('/', async (req, res) => {
  const { salon_id, materia, materia_id, inicio, fin } = req.body;
  const docente_id = req.usuario.id;

  if (!salon_id || !materia || !inicio || !fin) {
    return res.status(400).json({ error: 'Faltan campos: salon_id, materia, inicio, fin' });
  }

  if (new Date(inicio) >= new Date(fin)) {
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });
  }

  const resultado = await crearReservaService({ salon_id, docente_id, materia, materia_id, inicio, fin });

  if (resultado.ok) return res.status(201).json(resultado.reserva);

  const { status, ok, ...body } = resultado;
  res.status(status).json(body);
});

// PATCH /api/reservas/:id/cancelar - cancela una reserva.
// Solo el docente dueño de la reserva o un ADMIN pueden cancelarla;
// bloqueado además si es_fija = true (lo aplica el trigger de la BD).
router.patch('/:id/cancelar', (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  const reserva = db.prepare('select docente_id from reservas where id = ?').get(id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

  const esDueño = reserva.docente_id === req.usuario.id;
  if (!esDueño && req.usuario.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo puedes cancelar tus propias reservas' });
  }

  try {
    const { changes } = db
      .prepare(
        `update reservas
         set estado = 'CANCELADA', motivo_cancelacion = ?, cancelada_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         where id = ?`,
      )
      .run(motivo || null, id);

    if (changes === 0) return res.status(404).json({ error: 'Reserva no encontrada' });

    res.json(reservaConDetalle(id));
  } catch (error) {
    if (error.message && error.message.includes('clase fija')) {
      return res.status(403).json({ error: 'No se puede cancelar: es una clase fija' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
