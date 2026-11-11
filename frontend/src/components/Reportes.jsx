import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { getReporteOcupacion, TIPO_LABEL, hoyBogota, lunesDeLaSemana, sumarDias, fechaCorta, minutosALabel } from '../api';

const NOMBRE_DIA = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

const num = (n) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });

function descargarCSV(reporte) {
  const filas = [
    ['Salón', 'Tipo', 'Ubicación', 'Capacidad', 'Reservas', 'Horas reservadas', 'Ocupación %', 'Llenado promedio %'],
    ...reporte.salones.map((s) => [
      s.nombre,
      TIPO_LABEL[s.tipo] || s.tipo,
      s.ubicacion || '',
      s.capacidad,
      s.reservas,
      s.horas_reservadas,
      s.ocupacion_pct,
      s.llenado_pct ?? '',
    ]),
  ];
  // Separador ';' y BOM: así Excel en español lo abre en columnas y con tildes.
  const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocupacion_${reporte.desde}_${reporte.hasta}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const [rango, setRango] = useState({ desde: '', hasta: '' }); // vacío = semestre vigente
  const [reporte, setReporte] = useState(null);
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    getReporteOcupacion(rango.desde, rango.hasta)
      .then((r) => {
        if (!vigente) return;
        setReporte(r);
        setEstado('listo');
      })
      .catch((err) => {
        if (!vigente) return;
        setError(err.message);
        setEstado('error');
      });
    return () => {
      vigente = false;
    };
  }, [rango]);

  function aplicarRango(nuevo) {
    setEstado('cargando');
    setRango(nuevo);
  }

  function cambiarFecha(campo, valor) {
    if (!valor) return;
    const base = { desde: reporte?.desde || valor, hasta: reporte?.hasta || valor, [campo]: valor };
    if (base.desde > base.hasta) base[campo === 'desde' ? 'hasta' : 'desde'] = valor;
    aplicarRango(base);
  }

  const hoy = hoyBogota();
  const lunes = lunesDeLaSemana(hoy);
  const atajos = [
    { label: 'Semestre vigente', desde: '', hasta: '' },
    { label: 'Últimos 30 días', desde: sumarDias(hoy, -29), hasta: hoy },
    { label: 'Esta semana', desde: lunes, hasta: sumarDias(lunes, 6) },
  ];

  if (!reporte) {
    return <p className={estado === 'error' ? 'estado-msg error' : 'estado-msg'}>{estado === 'error' ? `No se pudo cargar el reporte: ${error}` : 'Cargando reporte…'}</p>;
  }

  const { resumen, salones, mapa_calor: mapa } = reporte;
  const celda = new Map(mapa.celdas.map((c) => [`${c.dia}-${c.hora}`, c]));
  const maxCalor = Math.max(0, ...mapa.celdas.map((c) => c.ocupacion_pct || 0));
  const maxSalon = Math.max(0, ...salones.map((s) => s.ocupacion_pct));
  const pico = resumen.franja_pico;

  return (
    <section className={estado === 'cargando' ? 'reportes cargando' : 'reportes'}>
      <div className="reportes-filtros">
        <div className="filtros-bloque">
          {atajos.map((a) => (
            <button
              key={a.label}
              type="button"
              className={rango.desde === a.desde && rango.hasta === a.hasta ? 'chip-bloque activo' : 'chip-bloque'}
              onClick={() => aplicarRango({ desde: a.desde, hasta: a.hasta })}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="reportes-fechas">
          <label>
            Desde
            <input type="date" value={reporte.desde} onChange={(e) => cambiarFecha('desde', e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={reporte.hasta} onChange={(e) => cambiarFecha('hasta', e.target.value)} />
          </label>
        </div>
      </div>

      {estado === 'error' && <p className="estado-msg error">No se pudo actualizar el reporte: {error}</p>}

      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Ocupación general</p>
          <p className="stat-value">{num(resumen.ocupacion_pct)}%</p>
          <p className="stat-sub">
            {num(resumen.horas_reservadas)} de {num(resumen.horas_disponibles)} horas disponibles
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Franja más ocupada</p>
          <p className="stat-value">{pico ? `${NOMBRE_DIA[pico.dia]} ${minutosALabel(pico.hora * 60)}` : '—'}</p>
          <p className="stat-sub">{pico ? `${num(pico.ocupacion_pct)}% de los salones ocupados` : 'Sin reservas en el rango'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Salones sin uso</p>
          <p className="stat-value">
            {resumen.salones_sin_uso}/{resumen.salones}
          </p>
          <p className="stat-sub">Sin ninguna reserva en el rango</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Cancelaciones</p>
          <p className="stat-value">{num(resumen.cancelacion_pct)}%</p>
          <p className="stat-sub">
            {resumen.canceladas} canceladas · {resumen.reservas} vigentes
          </p>
        </div>
      </div>

      <div className="reporte-panel">
        <div className="admin-barra">
          <div>
            <h2 className="bloque-titulo">Ocupación por día y hora</h2>
            <p className="bloque-sub">
              Porcentaje de los salones reservados en cada franja, {fechaCorta(reporte.desde)} – {fechaCorta(reporte.hasta)}
            </p>
          </div>
          <div className="calor-leyenda" aria-hidden>
            0%
            <span className="calor-leyenda-barra" />
            {num(maxCalor)}%
          </div>
        </div>
        <div className="calor-wrap">
          <table className="calor">
            <thead>
              <tr>
                <th />
                {mapa.dias.map((d) => (
                  <th key={d} scope="col">
                    {NOMBRE_DIA[d].slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapa.horas.map((h) => (
                <tr key={h}>
                  <th scope="row">{minutosALabel(h * 60)}</th>
                  {mapa.dias.map((d) => {
                    const c = celda.get(`${d}-${h}`);
                    if (!c.abierto) {
                      return (
                        <td key={d}>
                          <span className="calor-celda cerrado" title={`${NOMBRE_DIA[d]} ${minutosALabel(h * 60)}: cerrado`} />
                        </td>
                      );
                    }
                    const intensidad = maxCalor > 0 && c.ocupacion_pct > 0 ? 15 + 85 * (c.ocupacion_pct / maxCalor) : 0;
                    return (
                      <td key={d}>
                        <span
                          className="calor-celda"
                          style={{ '--intensidad': `${intensidad}%` }}
                          title={`${NOMBRE_DIA[d]} ${minutosALabel(h * 60)}: ${num(c.ocupacion_pct)}% ocupado`}
                        >
                          <span className="solo-lectores">{num(c.ocupacion_pct)}%</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="reporte-panel">
        <div className="admin-barra">
          <div>
            <h2 className="bloque-titulo">Uso por salón</h2>
            <p className="bloque-sub">Horas reservadas sobre las horas en que la universidad abre, de mayor a menor</p>
          </div>
          <button type="button" className="chip-bloque boton-con-icono" onClick={() => descargarCSV(reporte)}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
        <div className="uso-tabla-wrap">
          <table className="uso-tabla">
            <thead>
              <tr>
                <th scope="col">Salón</th>
                <th scope="col" className="uso-num">Reservas</th>
                <th scope="col" className="uso-num">Horas</th>
                <th scope="col">Ocupación</th>
                <th scope="col" className="uso-num" title="Asistentes estimados sobre la capacidad del salón, en promedio">
                  Llenado
                </th>
              </tr>
            </thead>
            <tbody>
              {salones.map((s) => (
                <tr key={s.id} className={s.reservas === 0 ? 'sin-uso' : ''}>
                  <td>
                    <span className="admin-fila-nombre">{s.nombre}</span>
                    <span className="admin-fila-sub">
                      {TIPO_LABEL[s.tipo]} · cap. {s.capacidad}
                    </span>
                  </td>
                  <td className="uso-num">{s.reservas}</td>
                  <td className="uso-num">{num(s.horas_reservadas)}</td>
                  <td>
                    <div className="uso-barra-fila">
                      <span className="uso-barra">
                        <span style={{ width: `${maxSalon > 0 ? (s.ocupacion_pct / maxSalon) * 100 : 0}%` }} />
                      </span>
                      <span className="uso-pct">{num(s.ocupacion_pct)}%</span>
                    </div>
                  </td>
                  <td className="uso-num">{s.llenado_pct == null ? '—' : `${num(s.llenado_pct)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
