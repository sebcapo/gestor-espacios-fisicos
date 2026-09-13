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
| Base de datos | SQLite local, un solo archivo (`node:sqlite`) | [`backend/schema.sql`](./backend/schema.sql) |
| Asistente IA | Groq (tool calling) | [`backend/src/routes/asistente.js`](./backend/src/routes/asistente.js) |

El frontend habla solo con el backend (`/api/...`); el backend es el único que
accede a la base de datos y a Groq. La base de datos es un archivo SQLite local
(`backend/data/gestor.db`, fuera de git) — no hay nada que crear en la nube ni
credenciales de base de datos que gestionar: es un proyecto académico, así que
se optó por lo más simple de levantar en cualquier máquina.

```
frontend  ──HTTP──>  backend  ──>  SQLite (backend/data/gestor.db)
                             ──>  Groq (LLM)
```

### Reglas de negocio que ya viven en la base de datos

- **Sin doble reserva**: un disparador (`trg_no_solape_insert` / `_update`) aborta
  el `INSERT`/`UPDATE` si ya existe una reserva `PROGRAMADA` que se cruza en el
  mismo salón. Es el equivalente en SQLite del `EXCLUDE USING gist` de Postgres:
  SQLite no tiene restricciones de exclusión nativas, así que se hace con un
  disparador que compara `inicio`/`fin` contra las reservas existentes.
- **Clase fija protegida**: otro disparador bloquea la cancelación de reservas
  con `es_fija = 1`.
- **Capacidad vs. asistentes**: si la reserva trae `asistentes_estimados`, se
  rechaza con `422` cuando supera la capacidad del salón.

### Autenticación

Login local con correo y contraseña — no depende de ningún proveedor externo:

- Las contraseñas se guardan con `scrypt` (`node:crypto`, sin dependencias
  nativas), nunca en texto plano.
- Al hacer login el backend crea una fila en `sesiones` y manda el token como
  cookie `httpOnly`; el navegador la reenvía sola en cada petición
  (`credentials: 'include'` en el frontend, `cors({ credentials: true })` en
  el backend).
- Todo `/api/*` exige sesión, excepto `/api/auth/login`. El backend saca el
  usuario de la cookie, nunca del body: `POST /api/reservas` y
  `PATCH /:id/cancelar` ya no reciben `docente_id` del cliente.
- Cancelar una reserva ajena da `403` salvo que quien cancela sea `ADMIN`.

## Requisitos previos

- **Node.js 24 o superior** (el backend usa el módulo nativo `node:sqlite`;
  con versiones más viejas de Node no arranca — no hace falta instalar nada
  aparte, no hay dependencias nativas que compilar).
- Una API key de [Groq](https://console.groq.com) (para el asistente).

## Puesta en marcha

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # y pon tu GROQ_API_KEY (ver abajo)
npm run dev                # arranca en http://localhost:3001
```

La primera vez que arranca, el backend crea `backend/data/gestor.db` y aplica
`schema.sql` automáticamente. Para cargar datos de ejemplo (salones, usuarios,
horario institucional, carreras/materias):

```bash
npm run seed
```

El seed también crea la contraseña de prueba `fumc2026` para todos los
usuarios sembrados (docentes y admins) — es solo para desarrollo local.

Variables de entorno (`backend/.env`):

| Variable | Descripción |
|---|---|
| `GROQ_API_KEY` | API key de Groq (asistente) |
| `PORT` | Puerto del backend (por defecto `3001`) |
| `FRONTEND_URL` | Origen del frontend, para CORS con cookies (por defecto `http://localhost:5173`) |
| `DB_PATH` | Opcional — ruta del archivo SQLite (por defecto `backend/data/gestor.db`) |

Otros comandos útiles:

| Comando | Qué hace |
|---|---|
| `npm run db:reset` | Borra la base de datos local para empezar de cero |
| `npm run db:reset -- --seed` | Borra y vuelve a cargar los datos de ejemplo en un solo paso |

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # define VITE_API_URL=http://localhost:3001
npm run dev               # arranca en http://localhost:5173
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Login con `{ email, password }`; deja la cookie de sesión |
| `POST` | `/api/auth/logout` | Cierra la sesión actual |
| `GET` | `/api/auth/me` | Usuario de la sesión actual |
| `GET` | `/api/salones` | Salones activos |
| `GET` | `/api/salones/:id/reservas` | Reservas programadas de un salón |
| `GET` | `/api/usuarios` | Usuarios activos (docentes y admins) |
| `GET` | `/api/reservas` | Reservas programadas (con salón y docente) |
| `POST` | `/api/reservas` | Crea una reserva; ante choque devuelve sugerencias |
| `PATCH` | `/api/reservas/:id/cancelar` | Cancela una reserva (bloqueado si es fija) |
| `POST` | `/api/asistente` | Turno de conversación con el asistente de reservas |
| `GET` | `/api/horario-institucional` | Franjas de apertura/cierre por día |
| `GET` | `/api/carreras` | Carreras activas |
| `GET` | `/api/semestres` | Semestres (`?estado=VIGENTE` para filtrar) |
| `GET` | `/api/materias` | Materias activas, con su carrera |
| `GET` | `/api/materias/habilitadas` | Materias del semestre vigente |

## Estructura del repositorio

```
backend/
  schema.sql            Esquema completo de la base de datos (SQLite)
  seed_*.sql            Datos iniciales (salones, usuarios, ejemplos)
  data/                 Base de datos local (gestor.db) — no va en git
  scripts/
    seed.js             Corre todos los seed_*.sql en orden
    reset-db.js          Borra la base de datos local
  src/
    index.js            Arranque de Express y montaje de rutas
    db.js               Abre/crea la base SQLite (backend/data/gestor.db)
    groqClient.js       Cliente de Groq
    routes/             Rutas HTTP (auth, salones, reservas, usuarios, asistente, ...)
    lib/                Lógica de negocio (auth, disponibilidad, servicio de reservas, tools del asistente)
    middleware/         requireAuth / requireRol
frontend/
  src/
    api.js              Cliente del backend
    App.jsx             Shell con login y pestañas (mapa / asistente)
    components/         LoginForm, MapaSalones, SalonModal, ChatAsistente
```

## Cómo probar

Guía paso a paso (levantar el aplicativo, iniciar sesión, crear/cancelar
reservas, probar el asistente de IA): ver [PROBAR.md](./PROBAR.md).

## Hoja de ruta

Ver [ROADMAP.md](./ROADMAP.md).

## Equipo

Proyecto de Ingeniería de Software — FUMC Medellín. Juan Diego Guayara · Camilo Arango · Sebastián Villafañe.
