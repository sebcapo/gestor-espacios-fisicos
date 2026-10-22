'use strict';

// Responde un 500 genérico al cliente y deja el detalle real (SQL, stack, rutas)
// solo en los logs del servidor. Así el navegador nunca ve mensajes internos que
// faciliten un ataque o revelen la estructura de la base de datos.
function falloServidor(res, error, contexto = '') {
  console.error(`[500]${contexto ? ` ${contexto}` : ''}`, error);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { falloServidor };
