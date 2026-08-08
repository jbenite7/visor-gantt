import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function archivosDeUI(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDeUI(ruta, acc);
    else if (/\.tsx?$/.test(entrada) && !/\.test\./.test(entrada)) acc.push(ruta);
  }
  return acc;
}

describe("barrido de tildes (E21)", () => {
  // Palabras que en español llevan tilde y aparecen dentro de cadenas de UI.
  const SIN_TILDE = [
    /"[^"\n]*\bimportacion\b[^"\n]*"/i,
    /"[^"\n]*\bextension\b[^"\n]*"/i,
    /"[^"\n]*\bmaximo\b[^"\n]*"/i,
    /"[^"\n]*\bsesion\b[^"\n]*"/i,
    /"[^"\n]*\bnumero\b[^"\n]*"/i,
    /"[^"\n]*\bobservacion\b[^"\n]*"/i,
    /"[^"\n]*\bconfiguracion\b[^"\n]*"/i,
    /"[^"\n]*\bduracion\b[^"\n]*"/i,
    /"[^"\n]*\bproporciono\b[^"\n]*"/i,
    /"[^"\n]*\bvalido\b[^"\n]*"/i,
  ];

  /**
   * No todo lo que parece copy lo es: los códigos que viajan por la URL, las
   * listas de palabras clave de la paleta y los tokens con los que se
   * reconocen columnas pegadas van sin tilde a propósito, porque se comparan.
   */
  function esCopyDeUsuario(cadena: string): boolean {
    if (/[?&=/-]/.test(cadena.replace(/^"|"$/g, ""))) return false;
    const palabras = cadena.replace(/^"|"$/g, "").trim().split(/\s+/);
    if (palabras.length < 3) return false;
    // Una lista de palabras clave no lleva ni puntuación ni mayúscula inicial.
    return /[.:,¿?¡!]/.test(cadena) || /^"[A-ZÁÉÍÓÚÑ]/.test(cadena);
  }

  test("ninguna cadena de interfaz se quedó sin tildes", () => {
    const culpables: string[] = [];

    for (const archivo of archivosDeUI("src")) {
      const contenido = readFileSync(archivo, "utf8");
      for (const patron of SIN_TILDE) {
        for (const hallazgo of contenido.match(new RegExp(patron, "gi")) ?? []) {
          if (esCopyDeUsuario(hallazgo)) {
            culpables.push(`${archivo} → ${hallazgo}`);
          }
        }
      }
    }

    expect(culpables).toEqual([]);
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
