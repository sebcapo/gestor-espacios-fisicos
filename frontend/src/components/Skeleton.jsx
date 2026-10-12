// Placeholders animados mientras carga el mapa, en vez de un texto "Cargando...".

export function SkeletonMapa() {
  return (
    <div className="mapa" aria-busy="true" aria-label="Cargando salones">
      <div className="stats-row">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="stat-card">
            <span className="sk sk-line" style={{ width: '50%' }} />
            <span className="sk sk-line sk-lg" style={{ width: '30%' }} />
            <span className="sk sk-line" style={{ width: '70%' }} />
          </div>
        ))}
      </div>

      <div className="piso-salones">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="salon-card">
            <div className="salon-card-visual sk sk-block" />
            <div className="salon-card-info">
              <span className="sk sk-line" style={{ width: '70%' }} />
              <div className="salon-card-pie">
                <span className="sk sk-line" style={{ width: '40%' }} />
                <span className="sk sk-line" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
