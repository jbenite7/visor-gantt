import { humanParserError } from "./parserErrors";

describe("errores del analizador en lenguaje de obra (E5)", () => {
  test("traduce el archivo demasiado grande", () => {
    expect(
      humanParserError("File too large: 84.2MB. Maximum allowed is 50MB.", 422),
    ).toBe(
      "El archivo pesa más de 50 MB. Guárdalo de nuevo desde MS Project sin las líneas base ni los archivos incrustados.",
    );
  });

  test("traduce el archivo que no es un .mpp de verdad", () => {
    expect(
      humanParserError("File is too small to be a valid .mpp file", 422),
    ).toBe(
      "Ese archivo no parece un cronograma de MS Project. Comprueba que sea el .mpp y no un acceso directo.",
    );
  });

  test("traduce el fallo de conversión", () => {
    expect(humanParserError("Could not parse project file", 500)).toBe(
      "No pudimos leer el cronograma. Ábrelo en MS Project y vuelve a guardarlo como .mpp.",
    );
  });

  test("nunca deja escapar el detalle técnico", () => {
    const mensaje = humanParserError(
      "Conversion failed: java.lang.NullPointerException at net.sf.mpxj",
      500,
    );

    expect(mensaje).not.toMatch(/java|Exception|mpxj/i);
    expect(mensaje).toBe(
      "No pudimos leer el cronograma. Ábrelo en MS Project y vuelve a guardarlo como .mpp.",
    );
  });

  test("un error desconocido cae en un mensaje útil, no en el vacío", () => {
    const mensaje = humanParserError("kaboom", 503);

    expect(mensaje).toBe(
      "El servicio que lee los cronogramas no respondió. Inténtalo de nuevo en un minuto.",
    );
  });

  test("todos los mensajes están en español y sin jerga de infraestructura", () => {
    const casos: [string, number][] = [
      ["File too large: 84.2MB. Maximum allowed is 50MB.", 422],
      ["File is too small to be a valid .mpp file", 422],
      ["Could not parse project file", 500],
      ["kaboom", 503],
    ];

    for (const [raw, status] of casos) {
      const mensaje = humanParserError(raw, status);
      expect(mensaje).not.toMatch(/error \d|status|endpoint|null|undefined/i);
      expect(mensaje.length).toBeGreaterThan(30);
    }
  });
});
