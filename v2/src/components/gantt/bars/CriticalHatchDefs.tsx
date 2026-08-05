/**
 * Patrón de trama para las barras de ruta crítica.
 *
 * La criticidad no puede depender solo del color: en escala de grises, para
 * daltónicos o en una impresión B/N la barra roja es idéntica a una normal.
 * Este patrón se superpone a la barra crítica y sobrevive sin color.
 *
 * Debe incluirse una vez dentro de cada <svg> que pinte TaskBar.
 */
export const CRITICAL_HATCH_ID = "gantt-critical-hatch";

export default function CriticalHatchDefs() {
  return (
    <defs>
      <pattern
        id={CRITICAL_HATCH_ID}
        width={6}
        height={6}
        patternTransform="rotate(45)"
        patternUnits="userSpaceOnUse"
      >
        <line x1={0} y1={0} x2={0} y2={6} stroke="white" strokeWidth={1.5} strokeOpacity={0.45} />
      </pattern>
    </defs>
  );
}
