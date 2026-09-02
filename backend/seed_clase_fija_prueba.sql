insert into reservas (salon_id, docente_id, materia, periodo, es_fija)
select
  s.id,
  u.id,
  'Clase Fija de Prueba',
  '[2026-09-15 08:00:00+00, 2026-09-15 10:00:00+00)'::tstzrange,
  true
from salones s, usuarios u
where s.nombre = 'Salón 101' and u.nombre = 'Rangel'
returning id;
