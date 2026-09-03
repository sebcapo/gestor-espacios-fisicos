-- Horario institucional: franjas en que la universidad está abierta, por día.
-- Toda reserva debe caer completa dentro de una de estas franjas.
--
-- dia_semana sigue el estándar ISO: 1 = lunes ... 7 = domingo.
-- Puede haber varias filas por día (ej. mañana y tarde con cierre al mediodía).
-- Si un día no tiene ninguna fila activa, la U está cerrada ese día.

create table horario_institucional (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora_apertura time not null,
  hora_cierre time not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),

  constraint franja_valida check (hora_apertura < hora_cierre)
);

create index idx_horario_dia on horario_institucional(dia_semana) where activo = true;

-- Horario por defecto de la sede: lunes a viernes 6am-10pm, sábado 7am-1pm.
insert into horario_institucional (dia_semana, hora_apertura, hora_cierre) values
  (1, '06:00', '22:00'),
  (2, '06:00', '22:00'),
  (3, '06:00', '22:00'),
  (4, '06:00', '22:00'),
  (5, '06:00', '22:00'),
  (6, '07:00', '13:00');
