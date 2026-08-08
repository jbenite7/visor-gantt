import type { MatrixPlan, MatrixTemplate } from "@/types/matrix";
import { DEFAULT_MATRIX_TEMPLATE } from "./templates";

/**
 * Plantillas de fábrica por tipo de obra.
 *
 * El vocabulario sale de los cronogramas reales del repositorio: la torre de
 * vivienda de Da Porto, el urbanismo con sus vías y redes externas, y la obra
 * lineal por tramos de la Estación 16.
 */
const URBANISMO: MatrixTemplate = {
  id: "template-urbanismo",
  name: "Urbanismo y obras exteriores",
  projectType: "Urbanismo",
  scopeTree: [
    {
      id: "exteriores",
      name: "Obras exteriores",
      type: "Capitulo",
      children: [
        { id: "vias", name: "Vías internas", type: "Disciplina", defaultRecipeId: "receta-vias" },
        {
          id: "redes-externas",
          name: "Redes externas",
          type: "Disciplina",
          defaultRecipeId: "receta-redes",
        },
        {
          id: "zonas-verdes",
          name: "Zonas verdes",
          type: "Disciplina",
          defaultRecipeId: "receta-zonas-verdes",
        },
      ],
    },
  ],
  areas: [
    { id: "zona-1", name: "Zona 1", type: "Zona" },
    { id: "zona-2", name: "Zona 2", type: "Zona" },
  ],
  recipes: [
    {
      id: "receta-vias",
      name: "Vías",
      activities: [
        { id: "perfilacion", name: "Perfilación y nivelación", productivityPerDay: 120, unit: "m2" },
        { id: "cordones", name: "Instalación de cordones", productivityPerDay: 60, unit: "ml" },
        { id: "pavimento", name: "Instalación de pavimento", productivityPerDay: 80, unit: "m2" },
      ],
      dependencies: [
        { predecessorActivityId: "perfilacion", successorActivityId: "cordones", type: "FS" },
        { predecessorActivityId: "cordones", successorActivityId: "pavimento", type: "FS" },
      ],
      locationChaining: { mode: "encadenado" },
    },
    {
      id: "receta-redes",
      name: "Redes externas",
      activities: [
        { id: "excavacion", name: "Excavación de zanjas", productivityPerDay: 40, unit: "ml" },
        { id: "tendido", name: "Tendido de redes", productivityPerDay: 50, unit: "ml" },
        { id: "relleno", name: "Relleno y compactación", productivityPerDay: 60, unit: "ml" },
      ],
      dependencies: [
        { predecessorActivityId: "excavacion", successorActivityId: "tendido", type: "FS" },
        { predecessorActivityId: "tendido", successorActivityId: "relleno", type: "FS" },
      ],
    },
    {
      id: "receta-zonas-verdes",
      name: "Zonas verdes",
      activities: [
        { id: "adecuacion", name: "Adecuación de terreno", productivityPerDay: 150, unit: "m2" },
        { id: "engramado", name: "Engramado", productivityPerDay: 200, unit: "m2" },
      ],
      dependencies: [
        { predecessorActivityId: "adecuacion", successorActivityId: "engramado", type: "FS" },
      ],
    },
  ],
};

const OBRA_LINEAL: MatrixTemplate = {
  id: "template-obra-lineal",
  name: "Obra lineal por tramos",
  projectType: "Infraestructura",
  scopeTree: [
    {
      id: "obra-lineal",
      name: "Obra lineal",
      type: "Capitulo",
      children: [
        {
          id: "cimentacion",
          name: "Cimentación",
          type: "Disciplina",
          defaultRecipeId: "receta-cimentacion",
        },
        {
          id: "superestructura",
          name: "Superestructura",
          type: "Disciplina",
          defaultRecipeId: "receta-superestructura",
        },
      ],
    },
  ],
  areas: [
    { id: "tramo-1", name: "Tramo 1", type: "Tramo" },
    { id: "tramo-2", name: "Tramo 2", type: "Tramo" },
    { id: "tramo-3", name: "Tramo 3", type: "Tramo" },
  ],
  recipes: [
    {
      id: "receta-cimentacion",
      name: "Cimentación",
      activities: [
        { id: "pilotes", name: "Pilotes", productivityPerDay: 2, unit: "un" },
        { id: "descabece", name: "Descabece de pilotes", productivityPerDay: 4, unit: "un" },
        { id: "dados", name: "Dados de cimentación", productivityPerDay: 1, unit: "un" },
      ],
      dependencies: [
        { predecessorActivityId: "pilotes", successorActivityId: "descabece", type: "FS" },
        { predecessorActivityId: "descabece", successorActivityId: "dados", type: "FS" },
      ],
      locationChaining: { mode: "encadenado" },
    },
    {
      id: "receta-superestructura",
      name: "Superestructura",
      activities: [
        { id: "columnas", name: "Columnas", productivityPerDay: 2, unit: "un" },
        { id: "vigas", name: "Vigas", productivityPerDay: 2, unit: "un" },
      ],
      dependencies: [
        { predecessorActivityId: "columnas", successorActivityId: "vigas", type: "FS" },
      ],
      locationChaining: { mode: "encadenado" },
    },
  ],
};

export const FACTORY_TEMPLATES: MatrixTemplate[] = [
  DEFAULT_MATRIX_TEMPLATE,
  URBANISMO,
  OBRA_LINEAL,
];

export function listFactoryTemplates(): MatrixTemplate[] {
  return [...FACTORY_TEMPLATES];
}

/**
 * Guarda la matriz actual como plantilla propia.
 *
 * Se queda con la forma de la obra —alcances, ubicaciones y recetas— y deja
 * fuera las celdas y las fechas: una plantilla no es una obra concreta.
 */
export function templateFromPlan(plan: MatrixPlan, name: string): MatrixTemplate {
  return {
    id: `template-propia-${plan.id}`,
    name,
    projectType: "Propia",
    scopeTree: JSON.parse(JSON.stringify(plan.scopeTree)),
    areas: JSON.parse(JSON.stringify(plan.areas)),
    recipes: JSON.parse(JSON.stringify(plan.recipes)),
  };
}
