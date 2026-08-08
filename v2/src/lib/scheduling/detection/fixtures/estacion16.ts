/**
 * Nombres de tarea del archivo de obra real
 * `test_data/20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp` (300 tareas),
 * una estación de metro.
 *
 * Está aquí por lo mismo que el fixture de DA PORTO: para que nadie pueda
 * «mejorar la cobertura» aflojando un patrón. La lista incluye tanto los que
 * deben resolverse como las trampas del archivo — «torregrúa», que parece una
 * torre; «nivel superior», que parece un nivel; y «EDIFICIO DESCENDENTE», que
 * lleva la palabra sin número.
 */
export interface Estacion16Case {
  name: string;
  label: string | null;
  value: number | null;
  span?: { from: number; to: number };
}

export const ESTACION_16_NAMES: Estacion16Case[] = [
  // ── Módulos: la unidad de producción de esta obra ──
  { name: "Módulo 1.1 (Ejes A-D)", label: "Módulo", value: 1.1 },
  { name: "Módulo 1.2 (Ejes D-H)", label: "Módulo", value: 1.2 },
  { name: "Módulo 2.1 (Ejes H-J)", label: "Módulo", value: 2.1 },
  { name: "Módulo 2.2 (Ejes J-DB8)", label: "Módulo", value: 2.2 },
  { name: "Módulo 2.2 (Ejes J-DB08)", label: "Módulo", value: 2.2 },
  { name: "Modulo 1.1", label: "Módulo", value: 1.1 },
  { name: "Modulo 1.2", label: "Módulo", value: 1.2 },
  { name: "Modulo 2.1", label: "Módulo", value: 2.1 },
  { name: "Modulo 2.2", label: "Módulo", value: 2.2 },

  // ── Edificios ──
  { name: "Inicio de obra Edificio 1 (Sur)", label: "Edificio", value: 1 },
  { name: "Inicio de obra Edificio 2 (Norte)", label: "Edificio", value: 2 },
  { name: "EDIFICIO 1 (SUR)", label: "Edificio", value: 1 },
  { name: "EDIFICIO 2 (NORTE)", label: "Edificio", value: 2 },

  // ── Ejes como tramo ──
  {
    name: "Construccion Losa Aerea (Eje A-D)",
    label: "Eje",
    value: 1,
    span: { from: 1, to: 4 },
  },
  {
    name: "Construccion Losa Aerea (Eje D-H)",
    label: "Eje",
    value: 4,
    span: { from: 4, to: 8 },
  },
  {
    name: "Construccion Losa Aerea (Eje H-J)",
    label: "Eje",
    value: 8,
    span: { from: 8, to: 10 },
  },
  {
    name: "Lucarnas (Ejes A-D)",
    label: "Eje",
    value: 1,
    span: { from: 1, to: 4 },
  },
  {
    name: "Lucarnas (Ejes DB4-DB8)",
    label: "Eje",
    value: 4,
    span: { from: 4, to: 8 },
  },
  {
    name: "Lucarnas (Ejes H-DB4)",
    label: "Eje",
    value: 8,
    span: { from: 8, to: 4 },
  },
  {
    name: "Solucion apuntalamiento y liberacion zona aledaña predio BIC (Eje 3-H)",
    label: "Eje",
    value: 3,
    span: { from: 3, to: 8 },
  },

  // ── Pisos: los 15 que el motor de P3 ya resolvía ──
  { name: "Piso 1 (eje B a 2)", label: "Piso", value: 1 },
  { name: "Piso 2 (eje B a D)", label: "Piso", value: 2 },
  { name: "Piso 1 (eje E a F)", label: "Piso", value: 1 },
  { name: "Piso 2 (eje F a G)", label: "Piso", value: 2 },
  { name: "Piso 2 (eje I a K)", label: "Piso", value: 2 },
  { name: "Piso 1 (eje 03 a 05)", label: "Piso", value: 1 },
  { name: "Piso 2 (eje 05 a 06)", label: "Piso", value: 2 },

  // ── Pisos de transición: lo que antes se resolvía a medias ──
  {
    name: "Piso 1 a 2 (eje A)",
    label: "Piso",
    value: 1,
    span: { from: 1, to: 2 },
  },
  {
    name: "Piso 2 a 3 (eje A)",
    label: "Piso",
    value: 2,
    span: { from: 2, to: 3 },
  },
  {
    name: "Piso 1 a 2 (eje 07)",
    label: "Piso",
    value: 1,
    span: { from: 1, to: 2 },
  },
  {
    name: "Piso 2 a 3 (eje 07)",
    label: "Piso",
    value: 2,
    span: { from: 2, to: 3 },
  },

  // ── Las trampas: deben seguir sin resolver ──
  { name: "Montaje torregrúa", label: null, value: null },
  { name: "Dado para torregrua", label: null, value: null },
  { name: "Pilotaje para torregrua por ML1", label: null, value: null },
  { name: "Prealistamiento de torregrúas", label: null, value: null },
  { name: "Aprobacion de diseño cimentacion torregrua", label: null, value: null },
  {
    name: "Rellenos laterales y nivelacion hasta nivel superior Viga de Cimentacion",
    label: null,
    value: null,
  },
  { name: "EDIFICIO DESCENDENTE", label: null, value: null },
];
