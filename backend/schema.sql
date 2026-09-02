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
