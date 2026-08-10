import type { ViewType } from "@/components/gantt/toolbar/viewTypes";

export interface ViewHelp {
  title: string;
  /** Qué responde esta vista. */
  purpose: string;
  /** Qué necesita el cronograma para que sirva. */
  needs: string;
}

const VIEW_HELP: Partial<Record<ViewType, ViewHelp>> = {
  gantt: {
    title: "Gantt",
    purpose:
      "El cronograma completo: cuándo va cada actividad, de qué depende y cuál no puede atrasarse.",
    needs: "Tareas con fechas. Es la vista base: siempre tiene algo que mostrar.",
  },
  executive: {
    title: "Ejecutivo",
    purpose:
      "Resumen para dirección: cómo van el plazo, el costo y el alcance en una sola pantalla.",
    needs: "Tareas con avance. Con presupuesto cargado además compara costo.",
  },
  resources: {
    title: "Recursos",
    purpose:
      "Quién y qué hace falta en cada actividad, y cuánto se está cargando cada cuadrilla.",
    needs:
      "Recursos asignados a las tareas. Si el .mpp no traía recursos, esta vista sale vacía.",
  },
  lob: {
    title: "Línea de Balance",
    purpose:
      "Compara el ritmo de una misma actividad piso por piso, para ver si la obra avanza parejo.",
    needs:
      "Actividades que se repitan en varios niveles, con el piso en el nombre o en el WBS.",
  },
  scurve: {
    title: "Curva S",
    purpose:
      "Cómo se acumula el avance en el tiempo, para comparar lo planeado con lo real.",
    needs: "Tareas con fechas y porcentaje de avance.",
  },
  bottlenecks: {
    title: "Problemas",
    purpose:
      "Todo lo que está mal en el plan: los cuellos que amarran la obra y las fechas que se contradicen.",
    needs:
      "Dependencias entre tareas. Sin conflictos, esta vista dice que el plan está limpio.",
  },
  unidadTipica: {
    title: "Unidad Típica",
    purpose:
      "La secuencia constructiva de un piso tipo, para ver si se repite igual en toda la torre.",
    needs:
      "La misma actividad repetida en tres o más pisos — por ejemplo «Mampostería piso 1, 2, 3».",
  },
  calendario: {
    title: "Calendario",
    purpose: "Los días que la obra trabaja y los que no, mes a mes.",
    needs: "El calendario del proyecto, que viene en el .mpp o se ajusta en Configuración.",
  },
  settings: {
    title: "Configuración",
    purpose:
      "La jornada, los días laborales y los festivos. Lo que aquí definas manda sobre todas las fechas.",
    needs: "Nada: siempre está disponible.",
  },
  tracking: {
    title: "Seguimiento",
    purpose:
      "Compara el plan contra la línea base: qué tareas se atrasaron, cuáles se adelantaron y cuánto.",
    needs:
      "Una línea base guardada. Sin ella, esta vista no tiene con qué comparar el avance real.",
  },
  taskSheet: {
    title: "Hoja de Tareas",
    purpose:
      "El listado completo de la obra en tabla: todas las tareas con sus fechas, duración y avance en una sola grilla editable.",
    needs: "Tareas cargadas. Es la vista base en formato tabla: siempre tiene algo que mostrar.",
  },
  network: {
    title: "Diagrama de Red",
    purpose:
      "Las dependencias entre tareas dibujadas como diagrama, para ver de un vistazo qué actividad depende de cuál.",
    needs:
      "Tareas con dependencias definidas. Sin enlaces entre tareas, el diagrama sale con nodos sueltos.",
  },
  matrix: {
    title: "Matriz",
    purpose:
      "Genera el cronograma cruzando alcances (qué se hace) con ubicaciones (dónde se hace), para armar la obra por celdas.",
    needs:
      "Alcances y ubicaciones definidos. Sin esa matriz base, no hay celdas que programar.",
  },
  observaciones: {
    title: "Observaciones",
    purpose:
      "Lo que se reporta en obra y el compromiso semanal: qué está frenando, quién responde y para cuándo.",
    needs:
      "Nada: se puede abrir una observación sobre cualquier tarea desde el primer día.",
  },
};

export function viewHelpFor(view: ViewType): ViewHelp | null {
  return VIEW_HELP[view] ?? null;
}
