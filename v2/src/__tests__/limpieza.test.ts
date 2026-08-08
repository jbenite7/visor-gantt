import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * `src/lib/matrix` y el motor de detección son territorio del carril B: se
 * excluyen para no pisarnos con la otra rama. Sus tildes las barre ese carril.
 */
const FUERA_DEL_CARRIL = ["src/lib/matrix", "src/lib/scheduling/activityFamily"];

function archivosDeUI(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (FUERA_DEL_CARRIL.some((excluido) => ruta.startsWith(excluido))) continue;
    if (statSync(ruta).isDirectory()) archivosDeUI(ruta, acc);
    else if (/\.tsx?$/.test(entrada) && !/\.test\./.test(entrada)) acc.push(ruta);
  }
  return acc;
}

describe("barrido de tildes (E21)", () => {
  /**
   * Palabras que en español llevan tilde. Se buscan como palabra suelta dentro
   * de cualquier literal, no solo en frases: «Crear capitulo» —dos palabras, sin
   * puntuación— es exactamente el caso que hay que cazar.
   */
  const SIN_TILDE = [
    "importacion",
    "extension",
    "maximo",
    "minimo",
    "numero",
    "observacion",
    "configuracion",
    "duracion",
    "capitulo",
    "jerarquia",
    "sesion",
    "valido",
    "invalido",
    "proporciono",
    "seleccion",
    "restriccion",
    "categoria",
    "critico",
    "critica",
    "analisis",
    "calculo",
    "ubicacion",
  ];

  /**
   * No todo literal es copy: los códigos que viajan por la URL, las listas de
   * palabras clave con las que se busca y los tokens con los que se reconocen
   * columnas pegadas van sin tilde a propósito, porque se comparan.
   */
  function esCopyDeUsuario(literal: string): boolean {
    const texto = literal.replace(/^["'`]|["'`]$/g, "");
    // Códigos, rutas y claves: nunca son copy.
    if (/[?&=/_]/.test(texto)) return false;
    if (/^[a-z-]+$/.test(texto.trim())) return false;
    const palabras = texto.split(/\s+/);
    // Una lista de palabras clave repite la misma palabra con y sin tilde.
    const sinTildes = palabras.map((palabra) =>
      palabra
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    );
    if (new Set(sinTildes).size < sinTildes.length) return false;
    // Y va toda en minúsculas y sin puntuación: nadie escribe así una frase.
    const pareceListaDeClaves =
      palabras.length >= 4 &&
      !/[.:,;¿?¡!]/.test(texto) &&
      texto === texto.toLowerCase();
    if (pareceListaDeClaves) return false;
    return true;
  }

  test("ninguna cadena de interfaz se quedó sin tildes", () => {
    const culpables: string[] = [];

    for (const archivo of archivosDeUI("src")) {
      const contenido = readFileSync(archivo, "utf8");
      const literales = contenido.match(/"[^"\n]{3,200}"/g) ?? [];

      for (const literal of literales) {
        if (!esCopyDeUsuario(literal)) continue;
        for (const palabra of SIN_TILDE) {
          if (new RegExp(`\\b${palabra}\\b`, "i").test(literal)) {
            culpables.push(`${archivo} → ${literal}`);
          }
        }
      }
    }

    expect(culpables).toEqual([]);
  });

  test("el propio detector caza el caso que motivó el barrido", () => {
    // «Crear capitulo» es literalmente lo que estaba en la cinta de la tabla.
    expect(esCopyDeUsuario('"Crear capitulo"')).toBe(true);
    expect(esCopyDeUsuario('"Máximo 10 niveles de jerarquia."')).toBe(true);
  });

  test("y no se ceba con lo que no es copy", () => {
    expect(esCopyDeUsuario('"sesion-expirada"')).toBe(false);
    expect(esCopyDeUsuario('"/login?motivo=sesion-expirada"')).toBe(false);
    expect(
      esCopyDeUsuario('"settings configuracion configuración ajustes"'),
    ).toBe(false);
    expect(
      esCopyDeUsuario('"executive ejecutivo dashboard pmi triple restriccion"'),
    ).toBe(false);
  });
});

describe("no queda código muerto de subida (E17)", () => {
  test("MPPUploader ya no existe: la subida real vive en HomeMppUploadAction", () => {
    expect(existsSync("src/components/upload/MPPUploader.tsx")).toBe(false);
  });

  test("y la subida que sí usa la app sigue en su sitio", () => {
    expect(existsSync("src/components/upload/HomeMppUploadAction.tsx")).toBe(
      true,
    );
  });

  test("nadie lo importa: no queda una referencia colgando", () => {
    const referencias = archivosDeUI("src").filter((archivo) =>
      readFileSync(archivo, "utf8").includes("upload/MPPUploader"),
    );

    expect(referencias).toEqual([]);
  });
});
