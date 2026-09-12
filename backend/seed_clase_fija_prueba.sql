insert into reservas (salon_id, docente_id, materia, inicio, fin, es_fija)
select
  s.id,
  u.id,
  'Clase Fija de Prueba',
  '2026-09-15T08:00:00-05:00',
  '2026-09-15T10:00:00-05:00',
  1
from salones s, usuarios u
where s.nombre = 'Salón 101' and u.nombre = 'Rangel';
