"use client";

/** Anchos irregulares: un esqueleto uniforme no se parece a un cronograma. */
const FILAS = [
  { nombre: 88, barra: 45, desplazamiento: 4 },
  { nombre: 70, barra: 22, desplazamiento: 18 },
  { nombre: 92, barra: 34, desplazamiento: 26 },
  { nombre: 64, barra: 18, desplazamiento: 48 },
  { nombre: 80, barra: 28, desplazamiento: 40 },
  { nombre: 74, barra: 12, desplazamiento: 62 },
  { nombre: 86, barra: 20, desplazamiento: 55 },
];

/**
 * Mientras carga el cronograma, dibujar su forma en vez de la palabra
 * «Cargando»: la espera se siente más corta cuando ya se ve dónde va a estar
 * cada cosa (E16).
 */
export default function ScheduleSkeleton() {
  return (
    <div
      data-testid="schedule-skeleton"
      role="status"
      aria-live="polite"
      className="schedule-skeleton"
    >
      <span className="sr-only">Cargando el cronograma…</span>

      <div data-testid="skeleton-table" className="schedule-skeleton__table">
        {FILAS.map((fila, i) => (
          <div key={i} data-testid="skeleton-row" className="schedule-skeleton__row">
            <span
              className="schedule-skeleton__block"
              style={{ width: `${fila.nombre}%` }}
            />
          </div>
        ))}
      </div>

      <div data-testid="skeleton-chart" className="schedule-skeleton__chart">
        {FILAS.map((fila, i) => (
          <div key={i} className="schedule-skeleton__row">
            <span
              data-testid="skeleton-bar"
              className="schedule-skeleton__block"
              style={{
                width: `${fila.barra}%`,
                marginLeft: `${fila.desplazamiento}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
