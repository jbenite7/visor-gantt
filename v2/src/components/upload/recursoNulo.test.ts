import {
  mppResourcesToResources,
  mppAssignmentsToAssignments,
} from "./mpp-to-gantt";

/**
 * El recurso sin nombre de Microsoft Project, y por qué se descarta.
 *
 * **Pregunta que esto cierra:** el cronograma de obra real llega con 240 tareas,
 * 0 recursos y 213 asignaciones con `resourceId: 0`, y 88 de 297 proyectos de la
 * base están igual. ¿El archivo traía cuadrillas **sin nombre** que el
 * importador tiraba, o no traía ninguna?
 *
 * **Medido contra los tres `.mpp` reales del repositorio, con el analizador de
 * verdad**, no razonando sobre el código:
 *
 * | Archivo | Recursos | Con nombre | Asignaciones | Al recurso nulo |
 * |---|---|---|---|---|
 * | DA PORTO TORRE 3 (obra) | 1 | 0 | 213 | 213 |
 * | Estación 16 | 18 | 17 | 449 | 18 |
 * | Plan de acción | 2 | 1 | 1.475 | — |
 *
 * Los tres traen **exactamente uno** con el nombre vacío y `UID 0`: es el
 * recurso nulo que Project incluye siempre, no una cuadrilla a la que se le
 * olvidó el nombre. El de obra no trae ninguna otra; el de Estación 16 trae
 * diecisiete con nombre de verdad —«Ayudante armado», «Oficial acero»— y el
 * importador las conserva todas.
 *
 * **Conclusión: no se pierde nada.** El importador está bien y no se toca. Lo
 * que el archivo de obra no tiene, no lo tiene.
 *
 * Lo que sí queda, y es fiel al archivo: asignaciones con trabajo real —96 horas
 * la primera— apuntando al recurso nulo. **No se descartan**: llevan horas de
 * obra dentro, y tirarlas sería inventarse que ese trabajo no existe. Quedan
 * huérfanas a propósito, y quien abre Recursos ve el aviso que lo explica.
 */
describe("el recurso sin nombre de Project", () => {
  /** Tal como los tres archivos reales lo entregan. */
  const RECURSO_NULO = { UID: 0, ID: 0, Name: "", Type: 0 };
  const CUADRILLA = { UID: 3, ID: 3, Name: "Oficial acero", Type: 1 };

  test("se descarta, porque una cuadrilla sin nombre no se puede listar", () => {
    const recursos = mppResourcesToResources([
      RECURSO_NULO,
      CUADRILLA,
    ] as never);

    expect(recursos.map((r) => r.name)).toEqual(["Oficial acero"]);
  });

  test("pero sus asignaciones se conservan: llevan horas de obra dentro", () => {
    // Es la decisión que explica los 213 huérfanos del cronograma real. La
    // alternativa —descartarlas con su recurso— borraría trabajo planificado
    // de una obra de verdad para que un número cuadre.
    const asignaciones = mppAssignmentsToAssignments([
      { UID: 5, TaskUID: 5, ResourceUID: 0, Units: 100, Cost: 0 },
    ] as never);

    expect(asignaciones).toHaveLength(1);
    expect(asignaciones[0].resourceId).toBe(0);
  });

  test("una cuadrilla con nombre llega entera, que es el control", () => {
    // Sin esto, la primera prueba pasaría igual si el importador descartara
    // *todos* los recursos.
    const recursos = mppResourcesToResources([CUADRILLA] as never);

    expect(recursos).toHaveLength(1);
    expect(recursos[0].uid).toBe(3);
  });
});
