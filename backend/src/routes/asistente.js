const express = require('express');
const groq = require('../groqClient');
const { buscarDisponibilidad, crearReservaTool, TOOLS } = require('../lib/asistenteTools');
const { fechaBogota } = require('../lib/horarioInstitucional');
const { falloServidor } = require('../lib/errores');

const router = express.Router();
const MODEL = 'openai/gpt-oss-120b';
const MAX_PASOS = 5;
const MAX_MENSAJE = 2000; // caracteres por mensaje del usuario
const MAX_HISTORIAL = 30; // turnos recordados (los más recientes)
const ROLES_PERMITIDOS = new Set(['user', 'assistant', 'tool']);

// El `historial` lo manda el cliente, así que no se puede confiar en él. Se
// filtra a roles válidos y se recorta a los últimos MAX_HISTORIAL turnos. En
// particular se descarta cualquier mensaje con role 'system': el único system
// prompt es el que arma el backend; aceptar uno del cliente permitiría
// reescribir las reglas del asistente (prompt injection). Se conservan los
// campos que el tool-calling multivuelta necesita (tool_calls, tool_call_id).
function sanitizarHistorial(historial) {
  if (!Array.isArray(historial)) return [];
  return historial
    .filter((m) => m && typeof m === 'object' && ROLES_PERMITIDOS.has(m.role))
    .slice(-MAX_HISTORIAL)
    .map((m) => {
      const limpio = { role: m.role };
      limpio.content = typeof m.content === 'string' ? m.content : m.content == null ? null : String(m.content);
      if (Array.isArray(m.tool_calls)) limpio.tool_calls = m.tool_calls;
      if (typeof m.tool_call_id === 'string') limpio.tool_call_id = m.tool_call_id;
      if (typeof m.name === 'string') limpio.name = m.name;
      return limpio;
    });
}

function systemPrompt(docenteNombre) {
  const ahora = new Date();
  // Fecha de Bogotá, no UTC: cerca de medianoche (ej. 11pm en Bogotá = 4am UTC
  // del día siguiente) un simple toISOString().split('T')[0] le diría al
  // asistente la fecha equivocada.
  const hoy = fechaBogota(ahora);
  const diaSemana = new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'America/Bogota' }).format(ahora);

  return `Eres el asistente de reservas de salones de la Fundación Universitaria María Cano (sede Medellín).
Hoy es ${diaSemana} ${hoy} (zona horaria America/Bogota). Usa este dato para calcular cualquier fecha relativa
("mañana", "el jueves", "la próxima semana"); no calcules el día de la semana por tu cuenta, básate en el dato
de arriba. Hablas con el docente ${docenteNombre}.

Tu trabajo es ayudar a encontrar y reservar salones disponibles usando las herramientas que tienes.

Reglas:
- Usa buscar_disponibilidad para consultar salones libres antes de sugerir uno; no inventes disponibilidad.
- Si el usuario menciona cuántas personas asisten, pásalo como capacidad_minima en buscar_disponibilidad y como asistentes_estimados en crear_reserva.
- Antes de llamar a crear_reserva, confirma con el usuario el salón, la materia, la fecha y el horario exactos.
- Si crear_reserva devuelve un choque de horario, explícalo y ofrece las alternativas (otros salones u otros horarios) que te devuelva la herramienta.
- Si crear_reserva rechaza la reserva porque el salón no tiene capacidad suficiente, dilo claramente y ofrece buscar uno más grande.
- Sé breve, concreto y responde siempre en español.`;
}

// POST /api/asistente - Body: { mensaje, historial }
// El docente es siempre el de la sesión (requireAuth), no un dato del cliente.
router.post('/', async (req, res) => {
  const { mensaje, historial = [] } = req.body;
  const docente_id = req.usuario.id;
  const docente_nombre = req.usuario.nombre;

  if (typeof mensaje !== 'string' || mensaje.trim() === '') {
    return res.status(400).json({ error: 'Falta el campo: mensaje' });
  }
  if (mensaje.length > MAX_MENSAJE) {
    return res.status(400).json({ error: `El mensaje supera el máximo de ${MAX_MENSAJE} caracteres` });
  }

  const mensajes = [
    { role: 'system', content: systemPrompt(docente_nombre || 'el docente') },
    ...sanitizarHistorial(historial),
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
          // El detalle real va al log; al modelo (y de ahí al usuario) solo le
          // llega un mensaje genérico, nunca el stack ni el SQL.
          console.error('[asistente] fallo en herramienta', toolCall.function.name, err);
          resultado = { error: 'No se pudo completar la operación solicitada.' };
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
    falloServidor(res, err, 'asistente');
  }
});

module.exports = router;
