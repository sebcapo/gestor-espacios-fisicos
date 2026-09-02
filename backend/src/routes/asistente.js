const express = require('express');
const groq = require('../groqClient');
const { buscarDisponibilidad, crearReservaTool, TOOLS } = require('../lib/asistenteTools');

const router = express.Router();
const MODEL = 'openai/gpt-oss-120b';
const MAX_PASOS = 5;

function systemPrompt(docenteNombre) {
  const ahora = new Date();
  const hoy = ahora.toISOString().split('T')[0];
  const diaSemana = new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'America/Bogota' }).format(ahora);

  return `Eres el asistente de reservas de salones de la Fundación Universitaria María Cano (sede Medellín).
Hoy es ${diaSemana} ${hoy} (zona horaria America/Bogota). Usa este dato para calcular cualquier fecha relativa
("mañana", "el jueves", "la próxima semana"); no calcules el día de la semana por tu cuenta, básate en el dato
de arriba. Hablas con el docente ${docenteNombre}.

Tu trabajo es ayudar a encontrar y reservar salones disponibles usando las herramientas que tienes.

Reglas:
- Usa buscar_disponibilidad para consultar salones libres antes de sugerir uno; no inventes disponibilidad.
- Antes de llamar a crear_reserva, confirma con el usuario el salón, la materia, la fecha y el horario exactos.
- Si crear_reserva devuelve un choque de horario, explícalo y ofrece las alternativas (otros salones u otros horarios) que te devuelva la herramienta.
- Sé breve, concreto y responde siempre en español.`;
}

// POST /api/asistente - Body: { mensaje, historial, docente_id, docente_nombre }
router.post('/', async (req, res) => {
  const { mensaje, historial = [], docente_id, docente_nombre } = req.body;

  if (!mensaje || !docente_id) {
    return res.status(400).json({ error: 'Faltan campos: mensaje, docente_id' });
  }

  const mensajes = [
    { role: 'system', content: systemPrompt(docente_nombre || 'el docente') },
    ...historial,
    { role: 'user', content: mensaje },
  ];

  try {
    for (let paso = 0; paso < MAX_PASOS; paso++) {
      const respuesta = await groq.chat.completions.create({
        model: MODEL,
        messages: mensajes,
        tools: TOOLS,
        tool_choice: 'auto',
      });

      const choice = respuesta.choices[0].message;
      mensajes.push(choice);

      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        return res.json({ respuesta: choice.content, historial: mensajes.slice(1) });
      }

      for (const toolCall of choice.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        let resultado;

        try {
          if (toolCall.function.name === 'buscar_disponibilidad') {
            resultado = await buscarDisponibilidad(args);
          } else if (toolCall.function.name === 'crear_reserva') {
            resultado = await crearReservaTool(args, docente_id);
          } else {
            resultado = { error: `Herramienta desconocida: ${toolCall.function.name}` };
          }
        } catch (err) {
          resultado = { error: err.message };
        }

        mensajes.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultado),
        });
      }
    }

    res.status(500).json({ error: 'El asistente no pudo completar la solicitud (demasiados pasos)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
