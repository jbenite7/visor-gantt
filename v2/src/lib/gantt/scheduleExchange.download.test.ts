/**
 * @jest-environment jsdom
 */
import { downloadScheduleCsv } from "./scheduleExchange";

/**
 * La descarga vivía dentro de `GanttTable`, así que el comando ⌘K «Exportar el
 * cronograma — descarga en CSV» **no descargaba nada**: solo cambiaba de vista.
 * Un comando que no hace lo que anuncia es peor que no tenerlo.
 *
 * Se extrae aquí para que los dos caminos usen el mismo código, en vez de
 * duplicar la lógica del BOM y del nombre de archivo.
 */
describe("downloadScheduleCsv", () => {
  const tareas = [
    {
      id: 1,
      name: "Excavación",
      start: new Date("2026-08-01T00:00:00.000Z"),
      finish: new Date("2026-08-05T00:00:00.000Z"),
      duration: 4,
      progress: 50,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    },
  ] as unknown as Parameters<typeof downloadScheduleCsv>[0];

  let creado: string | null = null;
  let descargado: string | null = null;
  let contenido = "";

  beforeEach(() => {
    creado = null;
    descargado = null;
    contenido = "";
    global.URL.createObjectURL = jest.fn((blob: Blob) => {
      creado = "blob:x";
      // El texto del Blob se captura por su constructor, más abajo.
      void blob;
      return "blob:x";
    }) as unknown as typeof URL.createObjectURL;
    global.URL.revokeObjectURL = jest.fn();

    const BlobOriginal = global.Blob;
    global.Blob = class extends BlobOriginal {
      constructor(partes: BlobPart[], opciones?: BlobPropertyBag) {
        contenido = String(partes[0]);
        super(partes, opciones);
      }
    } as unknown as typeof Blob;

    jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        descargado = this.download;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("descarga de verdad: crea el enlace y lo dispara", () => {
    downloadScheduleCsv(tareas, []);

    expect(creado).toBe("blob:x");
    expect(descargado).toMatch(/\.csv$/);
  });

  test("lleva la marca de orden de bytes, o Excel destroza las tildes", () => {
    downloadScheduleCsv(tareas, []);

    expect(contenido.startsWith("﻿")).toBe(true);
  });

  test("suelta la URL del blob: si no, se queda en memoria", () => {
    downloadScheduleCsv(tareas, []);

    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
