# Gestor de Espacios Físicos — FUMC Medellín

Sistema para gestionar la reserva y disponibilidad de los espacios físicos
(salones, salas de cómputo, laboratorios) de la Fundación Universitaria María Cano,
sede Medellín.

Permite ver qué espacios están libres u ocupados, crear y cancelar reservas sin
choques de horario, y consultar disponibilidad con un asistente conversacional.

## Arquitectura

| Componente | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 19 + Vite | [`frontend/`](./frontend) |
| Backend | Node.js + Express (API REST) | [`backend/`](./backend) |
| Base de datos | PostgreSQL gestionado por Supabase | [`backend/schema.sql`](./backend/schema.sql) |
| Asistente IA | Groq (tool calling) | [`backend/src/routes/asistente.js`](./backend/src/routes/asistente.js) |

El frontend habla solo con el backend (`/api/...`); el backend es el único que
accede a Supabase y a Groq.

```
frontend  ──HTTP──>  backend  ──>  Supabase (Postgres)
                             ──>  Groq (LLM)
```

### Reglas de negocio que ya viven en la base de datos

- **Sin doble reserva**: un `EXCLUDE USING gist` sobre `(salon_id, periodo)` impide
  dos reservas `PROGRAMADA` que se solapen en el mismo salón. Postgres lo valida en
  cada `INSERT`, sin condiciones de carrera.
- **Clase fija protegida**: un trigger bloquea la cancelación de reservas con
  `es_fija = true`.

## Requisitos previos

- Node.js 20 o superior
- Una cuenta de [Supabase](https://supabase.com) con un proyecto creado
- Una API key de [Groq](https://console.groq.com) (para el asistente)

## Puesta en marcha

### 1. Base de datos (Supabase)

En el **SQL Editor** del proyecto de Supabase, ejecuta en orden:

1. [`backend/schema.sql`](./backend/schema.sql) — crea las tablas, constraints y triggers.
2. [`backend/seed_salones.sql`](./backend/seed_salones.sql) — carga los salones de la sede.
3. [`backend/seed_usuarios.sql`](./backend/seed_usuarios.sql) — carga el equipo y docentes de prueba.
4. (Opcional) [`backend/seed_clase_fija_prueba.sql`](./backend/seed_clase_fija_prueba.sql) — una clase fija de ejemplo.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # y completa los valores (ver abajo)
npm run dev               # arranca en http://localhost:3001
```

Variables de entorno (`backend/.env`):

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Anon key del proyecto Supabase |
| `GROQ_API_KEY` | API key de Groq (asistente) |
| `PORT` | Puerto del backend (por defecto `3001`) |

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # define VITE_API_URL=http://localhost:3001
npm run dev               # arranca en http://localhost:5173
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/salones` | Salones activos |
| `GET` | `/api/salones/:id/reservas` | Reservas programadas de un salón |
| `GET` | `/api/usuarios` | Usuarios activos (docentes y admins) |
| `GET` | `/api/reservas` | Reservas programadas (con salón y docente) |
| `POST` | `/api/reservas` | Crea una reserva; ante choque devuelve sugerencias |
| `PATCH` | `/api/reservas/:id/cancelar` | Cancela una reserva (bloqueado si es fija) |
| `POST` | `/api/asistente` | Turno de conversación con el asistente de reservas |

## Estructura del repositorio

```
backend/
  schema.sql            Esquema completo de la base de datos
  seed_*.sql            Datos iniciales (salones, usuarios, ejemplos)
  src/
    index.js            Arranque de Express y montaje de rutas
    supabaseClient.js   Cliente de Supabase
    groqClient.js       Cliente de Groq
    routes/             Rutas HTTP (salones, reservas, usuarios, asistente)
    lib/                Lógica de negocio (disponibilidad, servicio de reservas, tools del asistente)
frontend/
  src/
    api.js              Cliente del backend
    App.jsx             Shell con pestañas (mapa / asistente)
    components/         MapaSalones, SalonModal, ChatAsistente
```

## Hoja de ruta

Ver [ROADMAP.md](./ROADMAP.md).

## Equipo

Proyecto de Ingeniería — FUMC Medellín. Juan Diego · Camilo · Sebastián.
