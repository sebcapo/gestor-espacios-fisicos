-- Esquema SQLite del gestor de espacios físicos.
-- Se ejecuta una sola vez, automáticamente, la primera vez que arranca el
-- backend (ver src/db.js). El archivo de base de datos vive en backend/data/.
--
-- Los identificadores son texto (hex de 16 bytes aleatorios) generados por
-- SQLite al insertar, para no depender de una extensión de UUID.

-- Tabla de usuarios (docentes y administradores)
create table usuarios (
  id text primary key default (lower(hex(randomblob(16)))),
  nombre text not null,
  email text not null unique,
  password_hash text not null default '',
  rol text not null check (rol in ('DOCENTE', 'ADMIN')),
  activo integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Sesiones de login. El token es el propio valor de la cookie httpOnly que
-- recibe el navegador; no se guarda nada más sensible que la referencia al
-- usuario y la fecha de expiración.
create table sesiones (
  token text primary key,
  usuario_id text not null references usuarios(id),
  creado_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_at text not null
);

create index idx_sesiones_usuario on sesiones(usuario_id);

-- Tabla de salones
create table salones (
  id text primary key default (lower(hex(randomblob(16)))),
  nombre text not null,
  tipo text not null check (tipo in ('SALON', 'SALA_COMPUTO', 'LABORATORIO_ELECTRONICA')),
  capacidad integer not null check (capacidad > 0),
  ubicacion text,
  activo integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Horario institucional: franjas en que la universidad está abierta, por día.
-- dia_semana en estándar ISO: 1 = lunes ... 7 = domingo. Puede haber varias
-- filas por día. Si un día no tiene fila activa, la U está cerrada ese día.
-- Toda reserva debe caer completa dentro de una de estas franjas.
create table horario_institucional (
  id text primary key default (lower(hex(randomblob(16)))),
  dia_semana integer not null check (dia_semana between 1 and 7),
  hora_apertura text not null,
  hora_cierre text not null,
  activo integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  constraint franja_valida check (hora_apertura < hora_cierre)
);

create index idx_horario_dia on horario_institucional(dia_semana) where activo = 1;

-- Modelo académico: carreras, semestres y materias.
create table carreras (
  id text primary key default (lower(hex(randomblob(16)))),
  nombre text not null,
  codigo text not null unique,
  activo integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table semestres (
  id text primary key default (lower(hex(randomblob(16)))),
  codigo text not null unique,                    -- ej. '2026-1'
  fecha_inicio text not null,
  fecha_fin text not null,
  estado text not null check (estado in ('PLANEACION', 'VIGENTE', 'CERRADO')) default 'PLANEACION',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  constraint fechas_validas check (fecha_inicio < fecha_fin)
);

-- Solo puede haber un semestre VIGENTE a la vez.
create unique index uniq_semestre_vigente on semestres (estado) where estado = 'VIGENTE';

create table materias (
  id text primary key default (lower(hex(randomblob(16)))),
  nombre text not null,
  codigo text not null unique,
  carrera_id text not null references carreras(id),
  tipo_espacio_requerido text check (tipo_espacio_requerido in ('SALON', 'SALA_COMPUTO', 'LABORATORIO_ELECTRONICA')),
  activo integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index idx_materias_carrera on materias(carrera_id);

-- Qué materias se ofrecen en cada semestre.
create table materias_habilitadas (
  id text primary key default (lower(hex(randomblob(16)))),
  semestre_id text not null references semestres(id),
  materia_id text not null references materias(id),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  unique (semestre_id, materia_id)
);

-- Tabla de reservas.
-- `inicio`/`fin` son fechas-hora ISO 8601 con offset, ej. "2026-09-10T14:00:00-05:00"
-- (equivalente al tstzrange de la versión Postgres, partido en dos columnas
-- porque SQLite no tiene un tipo de rango nativo).
create table reservas (
  id text primary key default (lower(hex(randomblob(16)))),
  salon_id text not null references salones(id),
  docente_id text not null references usuarios(id),
  materia text not null,
  materia_id text references materias(id),
  inicio text not null,
  fin text not null,
  asistentes_estimados integer,
  estado text not null check (estado in ('PROGRAMADA', 'CANCELADA')) default 'PROGRAMADA',
  es_fija integer not null default 0,
  motivo_cancelacion text,
  cancelada_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- Evita que el rango de horario esté vacío o invertido
  constraint periodo_valido check (inicio < fin),
  constraint asistentes_validos check (asistentes_estimados is null or asistentes_estimados > 0)
);

create index idx_reservas_salon on reservas(salon_id);
create index idx_reservas_docente on reservas(docente_id);

-- La restricción clave: no permite dos reservas PROGRAMADAS que se solapen
-- en el mismo salón. Es el equivalente en SQLite del EXCLUDE USING gist de
-- Postgres: SQLite no tiene restricciones de exclusión, así que se hace con
-- disparadores que abortan el INSERT/UPDATE si detectan un cruce.
create trigger trg_no_solape_insert
before insert on reservas
when new.estado = 'PROGRAMADA'
begin
  select raise(abort, 'reserva_solapada')
  where exists (
    select 1 from reservas
    where salon_id = new.salon_id
      and estado = 'PROGRAMADA'
      and inicio < new.fin
      and fin > new.inicio
  );
end;

create trigger trg_no_solape_update
before update on reservas
when new.estado = 'PROGRAMADA'
begin
  select raise(abort, 'reserva_solapada')
  where exists (
    select 1 from reservas
    where salon_id = new.salon_id
      and estado = 'PROGRAMADA'
      and id != new.id
      and inicio < new.fin
      and fin > new.inicio
  );
end;

-- Bloquea la cancelación de reservas marcadas como clase fija.
create trigger trg_bloquear_cancelacion_fija
before update on reservas
when old.es_fija = 1 and new.estado = 'CANCELADA' and old.estado != 'CANCELADA'
begin
  select raise(abort, 'No se puede cancelar una reserva marcada como clase fija (es_fija = true)');
end;
