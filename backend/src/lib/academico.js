const supabase = require('../supabaseClient');

// El semestre marcado como VIGENTE (o null si no hay ninguno).
async function semestreVigente() {
  const { data, error } = await supabase
    .from('semestres')
    .select('id, codigo, fecha_inicio, fecha_fin')
    .eq('estado', 'VIGENTE')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Si la materia exige un tipo de espacio concreto, comprueba que el salón lo cumpla.
// Devuelve { ok: true } o { ok: false, motivo }.
async function validarMateriaEspacio(materiaId, salonId) {
  if (!materiaId) return { ok: true };

  const [{ data: materia, error: e1 }, { data: salon, error: e2 }] = await Promise.all([
    supabase.from('materias').select('nombre, tipo_espacio_requerido').eq('id', materiaId).single(),
    supabase.from('salones').select('nombre, tipo').eq('id', salonId).single(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  if (materia.tipo_espacio_requerido && materia.tipo_espacio_requerido !== salon.tipo) {
    return {
      ok: false,
      motivo: `${materia.nombre} requiere un espacio de tipo ${materia.tipo_espacio_requerido}; ${salon.nombre} es ${salon.tipo}.`,
    };
  }
  return { ok: true };
}

module.exports = { semestreVigente, validarMateriaEspacio };
