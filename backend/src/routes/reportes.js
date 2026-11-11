const express = require('express');
const { requireRol } = require('../middleware/auth');
const { falloServidor } = require('../lib/errores');
const { reporteOcupacion } = require('../lib/reportes');
const { semestreVigente } = require('../lib/academico');

const router = express.Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

const esFecha = (s) => typeof s === 'string' && FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

// GET /api/reportes/ocupacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (solo ADMIN)
// Sin parámetros usa el semestre vigente.
router.get('/ocupacion', requireRol('ADMIN'), async (req, res) => {
  let { desde, hasta } = req.query;

  if (!desde && !hasta) {
    const semestre = await semestreVigente();
    if (!semestre) return res.status(400).json({ error: 'Indica el rango: desde y hasta (YYYY-MM-DD)' });
    desde = semestre.fecha_inicio;
    hasta = semestre.fecha_fin;
  }

  if (!esFecha(desde) || !esFecha(hasta)) {
    return res.status(400).json({ error: 'desde y hasta deben tener formato YYYY-MM-DD' });
  }
  if (desde > hasta) {
    return res.status(400).json({ error: 'La fecha inicial debe ser anterior o igual a la final' });
  }
  if ((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000 >= MAX_DIAS) {
    return res.status(400).json({ error: `El rango no puede superar ${MAX_DIAS} días` });
  }

  try {
    res.json(reporteOcupacion({ desde, hasta }));
  } catch (error) {
    falloServidor(res, error, 'reportes');
  }
});

module.exports = router;
