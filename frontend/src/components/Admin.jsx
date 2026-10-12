import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, DoorOpen, Users } from 'lucide-react';
import {
  getSalones,
  getUsuarios,
  crearSalon,
  editarSalon,
  eliminarSalon,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  TIPO_LABEL,
} from '../api';
import { useToast } from '../Toast';

const SALON_VACIO = { nombre: '', tipo: 'SALON', capacidad: 30, ubicacion: '' };
const USUARIO_VACIO = { nombre: '', email: '', rol: 'DOCENTE', password: '' };

export default function Admin({ usuarioActual }) {
  const toast = useToast();
  const [seccion, setSeccion] = useState('salones');
  const [salones, setSalones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [editSalon, setEditSalon] = useState(null); // {id?...} abierto en formulario
  const [editUsuario, setEditUsuario] = useState(null);

  const recargar = useCallback(() => {
    getSalones().then(setSalones).catch(() => {});
    getUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  async function guardarSalon(e) {
    e.preventDefault();
    try {
      const body = {
        nombre: editSalon.nombre,
        tipo: editSalon.tipo,
        capacidad: Number(editSalon.capacidad),
        ubicacion: editSalon.ubicacion,
      };
      if (editSalon.id) await editarSalon(editSalon.id, body);
      else await crearSalon(body);
      toast(editSalon.id ? 'Salón actualizado' : 'Salón creado', 'exito');
      setEditSalon(null);
      recargar();
    } catch (err) {
      toast(err.message, 'error', 6000);
    }
  }

  async function quitarSalon(s) {
    if (!window.confirm(`¿Desactivar "${s.nombre}"? Dejará de aparecer para reservar.`)) return;
    try {
      await eliminarSalon(s.id);
      toast('Salón desactivado', 'exito');
      recargar();
    } catch (err) {
      toast(err.message, 'error', 6000);
    }
  }

  async function guardarUsuario(e) {
    e.preventDefault();
    try {
      if (editUsuario.id) {
        const body = { nombre: editUsuario.nombre, rol: editUsuario.rol };
        if (editUsuario.password) body.password = editUsuario.password;
        await editarUsuario(editUsuario.id, body);
      } else {
        await crearUsuario(editUsuario);
      }
      toast(editUsuario.id ? 'Usuario actualizado' : 'Usuario creado', 'exito');
      setEditUsuario(null);
      recargar();
    } catch (err) {
      toast(err.message, 'error', 6000);
    }
  }

  async function quitarUsuario(u) {
    if (!window.confirm(`¿Desactivar a "${u.nombre}"? No podrá iniciar sesión.`)) return;
    try {
      await eliminarUsuario(u.id);
      toast('Usuario desactivado', 'exito');
      recargar();
    } catch (err) {
      toast(err.message, 'error', 6000);
    }
  }

  return (
    <div className="admin">
      <div className="filtros-bloque">
        <button
          type="button"
          className={seccion === 'salones' ? 'chip-bloque activo' : 'chip-bloque'}
          onClick={() => setSeccion('salones')}
        >
          <DoorOpen size={14} /> Salones
        </button>
        <button
          type="button"
          className={seccion === 'usuarios' ? 'chip-bloque activo' : 'chip-bloque'}
          onClick={() => setSeccion('usuarios')}
        >
          <Users size={14} /> Usuarios
        </button>
      </div>

      {seccion === 'salones' && (
        <section>
          <div className="admin-barra">
            <h2 className="bloque-titulo">Salones ({salones.length})</h2>
            <button type="button" className="boton-primario boton-con-icono" onClick={() => setEditSalon({ ...SALON_VACIO })}>
              <Plus size={16} /> Nuevo salón
            </button>
          </div>

          {editSalon && (
            <form className="admin-form" onSubmit={guardarSalon}>
              <div className="campo-fila">
                <div className="campo">
                  <label>Nombre</label>
                  <input required value={editSalon.nombre} onChange={(e) => setEditSalon({ ...editSalon, nombre: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Tipo</label>
                  <select value={editSalon.tipo} onChange={(e) => setEditSalon({ ...editSalon, tipo: e.target.value })}>
                    {Object.entries(TIPO_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="campo-fila">
                <div className="campo">
                  <label>Capacidad</label>
                  <input type="number" min="1" required value={editSalon.capacidad} onChange={(e) => setEditSalon({ ...editSalon, capacidad: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Ubicación</label>
                  <input value={editSalon.ubicacion || ''} placeholder="Bloque 1 - Piso 2" onChange={(e) => setEditSalon({ ...editSalon, ubicacion: e.target.value })} />
                </div>
              </div>
              <div className="modal-acciones">
                <button type="submit" className="boton-primario">{editSalon.id ? 'Guardar' : 'Crear'}</button>
                <button type="button" className="link-btn" onClick={() => setEditSalon(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-tabla">
            {salones.map((s) => (
              <div key={s.id} className="admin-fila">
                <div>
                  <span className="admin-fila-nombre">{s.nombre}</span>
                  <span className="admin-fila-sub">{TIPO_LABEL[s.tipo]} · cap. {s.capacidad} · {s.ubicacion || 'sin ubicación'}</span>
                </div>
                <div className="admin-fila-acciones">
                  <button type="button" className="icon-btn" onClick={() => setEditSalon({ ...s })} aria-label="Editar"><Pencil size={15} /></button>
                  <button type="button" className="icon-btn peligro" onClick={() => quitarSalon(s)} aria-label="Desactivar"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {seccion === 'usuarios' && (
        <section>
          <div className="admin-barra">
            <h2 className="bloque-titulo">Usuarios ({usuarios.length})</h2>
            <button type="button" className="boton-primario boton-con-icono" onClick={() => setEditUsuario({ ...USUARIO_VACIO })}>
              <Plus size={16} /> Nuevo usuario
            </button>
          </div>

          {editUsuario && (
            <form className="admin-form" onSubmit={guardarUsuario}>
              <div className="campo-fila">
                <div className="campo">
                  <label>Nombre</label>
                  <input required value={editUsuario.nombre} onChange={(e) => setEditUsuario({ ...editUsuario, nombre: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Rol</label>
                  <select value={editUsuario.rol} onChange={(e) => setEditUsuario({ ...editUsuario, rol: e.target.value })}>
                    <option value="DOCENTE">Docente</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
              </div>
              <div className="campo-fila">
                <div className="campo">
                  <label>Correo {editUsuario.id && <span className="admin-hint">(no editable)</span>}</label>
                  <input type="email" required disabled={Boolean(editUsuario.id)} value={editUsuario.email} onChange={(e) => setEditUsuario({ ...editUsuario, email: e.target.value })} />
                </div>
                <div className="campo">
                  <label>Contraseña {editUsuario.id && <span className="admin-hint">(dejar vacío = sin cambio)</span>}</label>
                  <input type="text" required={!editUsuario.id} value={editUsuario.password} onChange={(e) => setEditUsuario({ ...editUsuario, password: e.target.value })} />
                </div>
              </div>
              <div className="modal-acciones">
                <button type="submit" className="boton-primario">{editUsuario.id ? 'Guardar' : 'Crear'}</button>
                <button type="button" className="link-btn" onClick={() => setEditUsuario(null)}>Cancelar</button>
              </div>
            </form>
          )}

          <div className="admin-tabla">
            {usuarios.map((u) => (
              <div key={u.id} className="admin-fila">
                <div>
                  <span className="admin-fila-nombre">{u.nombre} <span className="badge">{u.rol}</span></span>
                  <span className="admin-fila-sub">{u.email}</span>
                </div>
                <div className="admin-fila-acciones">
                  <button type="button" className="icon-btn" onClick={() => setEditUsuario({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, password: '' })} aria-label="Editar"><Pencil size={15} /></button>
                  {u.id !== usuarioActual?.id && (
                    <button type="button" className="icon-btn peligro" onClick={() => quitarUsuario(u)} aria-label="Desactivar"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
