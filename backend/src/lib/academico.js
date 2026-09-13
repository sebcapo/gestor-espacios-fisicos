const db = require('../db');

// El semestre marcado como VIGENTE (o null si no hay ninguno).
async function semestreVigente() {
  const fila = db
    .prepare("select id, codigo, fecha_inicio, fecha_fin from semestres where estado = 'VIGENTE'")
    .get();
  return fila || null;
}

// Si la materia exige un tipo de espacio concreto, comprueba que el salón lo cumpla.
// Devuelve { ok: true } o { ok: false, motivo }.
async function validarMateriaEspacio(materiaId, salonId) {
  if (!materiaId) return { ok: true };

  const materia = db.prepare('select nombre, tipo_espacio_requerido from materias where id = ?').get(materiaId);
  const salon = db.prepare('select nombre, tipo from salones where id = ?').get(salonId);

  if (!materia || !salon) {
    return { ok: false, motivo: 'Materia o salón no encontrado.' };
  }

  if (materia.tipo_espacio_requerido && materia.tipo_espacio_requerido !== salon.tipo) {
    return {
      ok: false,
      motivo: `${materia.nombre} requiere un espacio de tipo ${materia.tipo_espacio_requerido}; ${salon.nombre} es ${salon.tipo}.`,
    };
  }
  return { ok: true };
}

module.exports = { semestreVigente, validarMateriaEspacio };
