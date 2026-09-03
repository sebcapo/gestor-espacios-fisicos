# Roadmap — Gestor de Espacios Físicos

Estado del proyecto y trabajo pendiente, por fases. Cada fase deja el sistema
usable. Leyenda: ✅ hecho · 🚧 en curso · 🔲 pendiente

---

## ✅ Fase 0 — MVP (hecho)

- ✅ Esquema en Postgres: `usuarios`, `salones`, `reservas`.
- ✅ Anti-solape de reservas por constraint `EXCLUDE USING gist`.
- ✅ Trigger que protege las clases fijas contra cancelación.
- ✅ API REST: salones, usuarios, reservas (crear / listar / cancelar).
- ✅ Al chocar una reserva, la API sugiere otros salones y otros horarios libres.
- ✅ Asistente IA (Groq + tool calling): busca disponibilidad y crea reservas.
- ✅ Frontend: mapa de salones por bloque/piso, modal de reserva, chat del asistente.
- ✅ Seeds con los salones reales de la sede y el equipo.

---

## 🔲 Fase 1 — Base para operar de verdad

**Objetivo:** que el sistema deje de asumir cosas y sea seguro para varios usuarios.

- 🔲 **Autenticación real.** Hoy el usuario se elige en un `<select>`; cualquiera
  actúa como cualquiera. Login (Supabase Auth) + sesión + rol (`DOCENTE` / `ADMIN`).
- 🔲 **Horario institucional configurable.** Hoy la jornada está fija en el código
  (7am–9pm). Tabla de apertura/cierre por día de la semana y validación de que toda
  reserva caiga dentro de la U abierta. → *ver rama `feat/horario-institucional`*
- 🔲 **Modelo académico.** Hoy `reservas.materia` es texto libre. Añadir `carreras`,
  `materias` y `semestres`, con las **materias habilitadas** por semestre vigente.
  La reserva referencia una materia real. → *ver rama `feat/modelo-academico`*
- 🔲 **Capacidad vs. asistentes.** Validar que la capacidad del salón alcance para el
  grupo al crear la reserva.
- 🔲 **CRUD de administración.** Pantallas para que un `ADMIN` gestione salones y
  usuarios (hoy solo existen como seeds).

---

## 🔲 Fase 2 — Programación del semestre

**Objetivo:** cargar la parrilla completa de un semestre, no reservas sueltas.

- 🔲 **Reservas recurrentes.** Una clase semanal genera todas sus sesiones dentro del
  periodo del semestre (hoy `es_fija` es solo un booleano sobre una reserva única).
- 🔲 **Grupos** por materia habilitada: docente asignado, cupo esperado, nº de
  sesiones por semana y duración.
- 🔲 **Disponibilidad de docentes**: franjas en que cada docente puede dictar, y
  validación al asignar.
- 🔲 Vista de resumen del semestre: materias habilitadas, grupos por carrera, carga
  docente.

---

## 🔲 Fase 3 — Distribución asistida

**Objetivo:** que el sistema proponga la ubicación de los grupos, no solo la valide.

- 🔲 Motor de asignación automática: para los grupos sin salón, buscar
  `(salón, día, hora)` factible respetando todas las restricciones duras
  (solape, horario institucional, capacidad, tipo de espacio, disponibilidad docente).
- 🔲 Reporte de **no asignables** con la causa concreta.
- 🔲 Respetar asignaciones fijadas a mano (no moverlas).

---

## 🔲 Fase 4 — Visualización y reportes

- 🔲 Horario semanal (día × hora) con filtros por salón, bloque, carrera, docente.
- 🔲 Ocupación por salón: % de uso sobre el horario institucional, huecos libres.
- 🔲 Exportar a CSV y PDF (por salón, por carrera, por docente).
- 🔲 Indicadores: salones subutilizados, franjas saturadas.

---

## 🔲 Fase 5 — Calidad y despliegue

- 🔲 Tests del servicio de reservas y del motor de restricciones (casos límite).
- 🔲 CI en GitHub Actions (lint + tests).
- 🔲 Optimizar la búsqueda de disponibilidad (hoy hace N+1 consultas a Supabase).
- 🔲 Deduplicar helpers repetidos entre backend y frontend (`parseRango`).
- 🔲 Despliegue: frontend (Vercel/Netlify), backend (Render/Railway), variables de entorno.

---

## Fuera de alcance (por ahora)

- Inscripción / matrícula de estudiantes.
- Integración con el sistema académico oficial de la FUMC.
- App móvil para estudiantes / notificaciones push.
- Optimización global demostrablemente óptima (basta con factible y buena).
