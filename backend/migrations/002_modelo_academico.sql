-- Modelo académico: carreras, semestres y materias.
-- Hasta ahora reservas.materia era texto libre. Con esto una reserva puede
-- apuntar a una materia real, habilitada para el semestre vigente.

create table carreras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table semestres (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                    -- ej. '2026-1'
  fecha_inicio date not null,
  fecha_fin date not null,
  estado text not null check (estado in ('PLANEACION', 'VIGENTE', 'CERRADO')) default 'PLANEACION',
  created_at timestamptz not null default now(),

  constraint fechas_validas check (fecha_inicio < fecha_fin)
);

-- Solo puede haber un semestre VIGENTE a la vez.
create unique index uniq_semestre_vigente on semestres (estado) where estado = 'VIGENTE';

create table materias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  carrera_id uuid not null references carreras(id),
  -- Si la materia exige un tipo de espacio concreto, la reserva se valida contra él.
  tipo_espacio_requerido text check (tipo_espacio_requerido in ('SALON', 'SALA_COMPUTO', 'LABORATORIO_ELECTRONICA')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_materias_carrera on materias(carrera_id);

-- Qué materias se ofrecen en cada semestre.
create table materias_habilitadas (
  id uuid primary key default gen_random_uuid(),
  semestre_id uuid not null references semestres(id),
  materia_id uuid not null references materias(id),
  created_at timestamptz not null default now(),

  unique (semestre_id, materia_id)
);

-- La reserva puede referenciar una materia real. Se deja también la columna
-- de texto (materia) para no romper las reservas ya creadas ni el asistente.
alter table reservas add column materia_id uuid references materias(id);
