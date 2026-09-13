-- Datos de ejemplo del modelo académico. Ajusta a la oferta real.

insert into carreras (nombre, codigo) values
  ('Ingeniería de Software', 'ISW'),
  ('Ingeniería Industrial', 'IIND');

insert into semestres (codigo, fecha_inicio, fecha_fin, estado) values
  ('2026-1', '2026-01-26', '2026-05-30', 'CERRADO'),
  ('2026-2', '2026-07-20', '2026-11-28', 'VIGENTE');

insert into materias (nombre, codigo, carrera_id, tipo_espacio_requerido)
with m(nombre, codigo, carrera_codigo, tipo) as (
  values
    ('Programación I',              'ISW-101',  'ISW',  'SALA_COMPUTO'),
    ('Bases de Datos',               'ISW-204',  'ISW',  'SALA_COMPUTO'),
    ('Arquitectura de Software',     'ISW-305',  'ISW',  'SALON'),
    ('Cálculo Diferencial',          'ISW-102',  'ISW',  'SALON'),
    ('Investigación de Operaciones', 'IIND-210', 'IIND', 'SALON'),
    ('Procesos Industriales',        'IIND-220', 'IIND', 'SALON')
)
select m.nombre, m.codigo, c.id, m.tipo
from m join carreras c on c.codigo = m.carrera_codigo;

-- Habilita todas las materias activas en el semestre vigente.
insert into materias_habilitadas (semestre_id, materia_id)
select s.id, m.id
from semestres s
cross join materias m
where s.estado = 'VIGENTE' and m.activo = 1;
