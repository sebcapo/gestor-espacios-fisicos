require('dotenv').config();
const express = require('express');
const cors = require('cors');

const salonesRouter = require('./routes/salones');
const reservasRouter = require('./routes/reservas');
const usuariosRouter = require('./routes/usuarios');
const asistenteRouter = require('./routes/asistente');
const horarioRouter = require('./routes/horario');
const carrerasRouter = require('./routes/carreras');
const semestresRouter = require('./routes/semestres');
const materiasRouter = require('./routes/materias');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok' }));

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
