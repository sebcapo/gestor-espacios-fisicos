# Cómo probar el proyecto

Guía paso a paso para levantar el aplicativo y recorrer sus funciones
principales, incluido el asistente de IA. Para la arquitectura y la
referencia de la API, ver [README.md](./README.md).

## 1. Requisitos

- **Node.js 24 o superior** (`node --version`). El backend usa el módulo
  nativo `node:sqlite`; con una versión más vieja no arranca.
- Una **API key de [Groq](https://console.groq.com)** (gratuita) — solo
  hace falta para el paso 6 (probar el asistente de IA). El resto del
  aplicativo funciona sin ella.

## 2. Levantar el backend

```bash
cd backend
npm install
cp .env.example .env
```

Abre `backend/.env` y pon tu `GROQ_API_KEY` (si vas a probar el asistente).
Los demás valores por defecto sirven tal cual para probar en local.

```bash
npm run dev
```

La primera vez que arranca, crea `backend/data/gestor.db` y aplica el
esquema solo. Deja esta terminal corriendo — el backend queda en
`http://localhost:3001`.

En **otra terminal**, carga los datos de ejemplo (salones, usuarios,
horario institucional, carreras y materias):

```bash
cd backend
npm run seed
```

Esto también crea la contraseña de prueba **`fumc2026`** para todos los
usuarios sembrados.

## 3. Levantar el frontend

En una tercera terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## 4. Iniciar sesión

No hay registro: los usuarios ya existen desde el seed. Todos usan la
contraseña **`fumc2026`**.

| Correo | Nombre | Rol |
|---|---|---|
| `juandiego@fumcvirtual.edu.co` | Juan Diego | ADMIN |
| `camilo@fumcvirtual.edu.co` | Camilo | ADMIN |
| `sebastian@fumcvirtual.edu.co` | Sebastián | ADMIN |
| `rangel@fumcvirtual.edu.co` | Rangel | DOCENTE |
| `kirby@fumcvirtual.edu.co` | Kirby | DOCENTE |
| `eli@fumcvirtual.edu.co` | Eli | DOCENTE |
| `santander@fumcvirtual.edu.co` | Santander | DOCENTE |

Inicia sesión como **Rangel** para el recorrido de los pasos 5 y 6.

## 5. Recorrido por el mapa de salones

### 5.1. Ver el mapa

La pestaña **Mapa de salones** muestra los espacios agrupados por
bloque/piso, con un punto verde (libre ahora) o naranja (ocupado ahora).
Haz clic en cualquiera para ver sus próximas reservas.

### 5.2. Crear una reserva válida

Haz clic en **Salón 200** → **+ Reservar este salón** y llena:

- Materia: elige una del semestre vigente (p. ej. *Arquitectura de
  Software*), o escribe una si no aparece el selector.
- Fecha: cualquier día entre semana (lunes a viernes) de 2026-09 en
  adelante.
- Inicio/Fin: por ejemplo `14:00` a `16:00`.

Debe crearse sin problema — aparece "¡Reserva creada con éxito!" y la
reserva queda en la lista de "Próximas reservas" de ese salón.

### 5.3. Provocar un choque de horario (409)

Repite el paso anterior **en el mismo salón, mismo día, mismo horario**
(o uno que se cruce, p. ej. `15:00` a `17:00`). La API responde con el
choque y el formulario muestra chips con **otros salones libres** en ese
horario y **otros horarios libres** en ese mismo salón — haz clic en
cualquiera para usarlo automáticamente.

### 5.4. Provocar un rechazo por horario institucional (422)

Intenta reservar un **domingo**, o entre semana antes de las `06:00` o
después de las `22:00` (sábado: fuera de `07:00`–`13:00`). Debe rechazar
la reserva explicando que la universidad no abre en ese horario.

### 5.5. Provocar un rechazo por tipo de espacio (422)

Elige la materia **Programación I** (requiere `SALA_COMPUTO`) pero
resérvala en un **Salón** normal (no una Sala de Cómputo). Debe rechazar
explicando que esa materia necesita otro tipo de espacio.

### 5.6. Provocar un rechazo por capacidad (422)

Reserva el **Laboratorio Bioquímica** (capacidad 20) y pon **40** en
"Nº de asistentes". Debe rechazar explicando que el salón no tiene
capacidad para esa cantidad de personas. Con un número menor o igual a
20, la reserva se crea normalmente.

### 5.7. Cancelar una reserva propia

En cualquier reserva que hayas creado (menos la de clase fija), haz clic
en **Cancelar**, escribe un motivo opcional y confirma. Desaparece de la
lista de próximas reservas.

### 5.8. Intentar cancelar una reserva ajena (403) y una clase fija

- El seed crea una **clase fija** en el **Salón 101** el `2026-09-15`
  de `08:00` a `10:00` a nombre de Rangel: no tiene botón "Cancelar" en
  el mapa (está marcada como "clase fija"), y si se intentara por API,
  el backend la bloquea.
- Para ver el bloqueo por dueño: abre una **ventana de incógnito**,
  inicia sesión con otro usuario (p. ej. Kirby) y trata de cancelar una
  reserva creada por Rangel. El backend responde `403 — Solo puedes
  cancelar tus propias reservas`. Si en cambio inicias sesión con un
  **ADMIN** (Juan Diego, Camilo o Sebastián), sí puede cancelarla.

### 5.9. Cerrar sesión

Botón **Cerrar sesión** en el header. Vuelve a pedir login, y las
peticiones a la API dejan de funcionar hasta iniciar sesión de nuevo.

## 6. Probar el asistente de IA

Con `GROQ_API_KEY` configurada, ve a la pestaña **Asistente IA** y prueba,
por ejemplo:

```
necesito un salón de cómputo para 25 personas el miércoles de 2 a 4pm
```

El asistente debe buscar disponibilidad, proponer un salón (p. ej. Sala
Cómputo 901 o 902) y pedir confirmación antes de reservar. Si aceptas,
crea la reserva a tu nombre (el del usuario con el que iniciaste sesión,
nunca el que el asistente "decida"). Si pides un horario ya ocupado, debe
explicar el choque y ofrecer alternativas, igual que el formulario manual.

## 7. Problemas comunes

| Síntoma | Causa probable |
|---|---|
| El backend no arranca / error con `node:sqlite` | Node menor a 24. Verifica con `node --version`. |
| El mapa dice "No se pudo conectar con el backend" | El backend no está corriendo, o `frontend/.env` no apunta a `http://localhost:3001`. |
| Login da "Correo o contraseña incorrectos" | Falta correr `npm run seed`, o la base ya existía de antes sin contraseñas — corre `npm run db:reset -- --seed` en `backend/`. |
| El asistente responde con un error de API key | Falta `GROQ_API_KEY` en `backend/.env` (reinicia `npm run dev` después de ponerla). |
| Quiero empezar de cero | `cd backend && npm run db:reset -- --seed` (borra y vuelve a sembrar la base local). |
