-- Habilita la extensión necesaria para el EXCLUDE constraint sobre rangos (tstzrange)
create extension if not exists btree_gist;

-- Tabla de usuarios (docentes y administradores)
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  rol text not null check (rol in ('DOCENTE', 'ADMIN')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tabla de salones
create table salones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('SALON', 'SALA_COMPUTO', 'LABORATORIO_ELECTRONICA')),
  capacidad integer not null check (capacidad > 0),
  ubicacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tabla de reservas
create table reservas (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salones(id),
  docente_id uuid not null references usuarios(id),
  materia text not null,
  periodo tstzrange not null,
  estado text not null check (estado in ('PROGRAMADA', 'CANCELADA')) default 'PROGRAMADA',
  es_fija boolean not null default false,
  motivo_cancelacion text,
  cancelada_at timestamptz,
  created_at timestamptz not null default now(),

  -- Evita que el rango de horario esté vacío o invertido
  constraint periodo_valido check (lower(periodo) < upper(periodo)),

  -- La restricción clave: no permite dos reservas PROGRAMADAS que se
  -- solapen en el mismo salón. Postgres la revisa en cada INSERT/UPDATE,
  -- sin necesidad de validación manual ni riesgo de condiciones de carrera.
  exclude using gist (
    salon_id with =,
    periodo with &&
  ) where (estado = 'PROGRAMADA')
);

create index idx_reservas_salon on reservas(salon_id);
create index idx_reservas_docente on reservas(docente_id);

-- Trigger: bloquea la cancelación de reservas marcadas como clase fija
create or replace function bloquear_cancelacion_fija()
returns trigger as $$
begin
  if old.es_fija = true and new.estado = 'CANCELADA' and old.estado <> 'CANCELADA' then
    raise exception 'No se puede cancelar una reserva marcada como clase fija (es_fija = true)';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_bloquear_cancelacion_fija
before update on reservas
for each row
execute function bloquear_cancelacion_fija();

-- Horario institucional: franjas en que la universidad está abierta, por día.
-- dia_semana en estándar ISO: 1 = lunes ... 7 = domingo. Puede haber varias
-- filas por día. Si un día no tiene fila activa, la U está cerrada ese día.
-- Toda reserva debe caer completa dentro de una de estas franjas.
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

-- Modelo académico: carreras, semestres y materias.
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

-- La reserva puede referenciar una materia real (además del texto libre `materia`).
alter table reservas add column materia_id uuid references materias(id);
