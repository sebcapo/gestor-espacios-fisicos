require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRouter = require('./routes/auth');
const salonesRouter = require('./routes/salones');
const reservasRouter = require('./routes/reservas');
const usuariosRouter = require('./routes/usuarios');
const asistenteRouter = require('./routes/asistente');
const horarioRouter = require('./routes/horario');
const carrerasRouter = require('./routes/carreras');
const semestresRouter = require('./routes/semestres');
const materiasRouter = require('./routes/materias');
const { requireAuth } = require('./middleware/auth');

const app = express();
// credentials: true + origin explícito (no '*') son obligatorios para que el
// navegador acepte enviar/recibir la cookie de sesión entre localhost:5173 y
// localhost:3001.
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok' }));

// Login es lo único público; todo lo demás bajo /api exige sesión.
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);

app.use('/api/salones', salonesRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/asistente', asistenteRouter);
app.use('/api/horario-institucional', horarioRouter);
app.use('/api/carreras', carrerasRouter);
app.use('/api/semestres', semestresRouter);
app.use('/api/materias', materiasRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
