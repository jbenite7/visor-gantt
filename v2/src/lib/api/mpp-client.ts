import { ProjectData } from "@/lib/parser/mpp-parser";

const DEFAULT_PARSER_URL = "http://mpp-parser:8000";

/**
 * Sends an .mpp file to the Python parsing microservice and returns
 * structured project data compatible with the Gantt chart components.
 *
 * The microservice uses MPXJ (Java) via subprocess to convert .mpp to JSON.
 *
 * @param file - The .mpp file from an upload input
 * @returns Structured ProjectData with tasks, resources, and metadata
 * @throws Error on network failure, server errors, or invalid response shape
 */
export async function parseMPP(file: File): Promise<ProjectData> {
  const baseUrl =
    process.env.NEXT_PUBLIC_MPP_PARSER_URL || DEFAULT_PARSER_URL;
  const url = `${baseUrl}/api/parse-mpp`;

  const formData = new FormData();
  formData.append("file", file);

  // 1. Network request
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    throw new Error(
      `Error de conexión con el servicio de parseo: ${
        err instanceof Error ? err.message : "Error de red"
      }`,
    );
  }

  // 2. HTTP error responses
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Sin detalles");
    throw new Error(
      `El servicio de parseo respondió con error ${response.status}: ${errorText}`,
    );
  }

  // 3. Parse JSON body
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Respuesta inválida del servicio de parseo: no se pudo decodificar JSON",
    );
  }

  // 4. Validate basic shape
  if (!data || typeof data !== "object" || !Array.isArray((data as Record<string, unknown>).tasks)) {
    throw new Error(
      "Respuesta inválida del servicio de parseo: falta la estructura esperada (tasks)",
    );
  }

  return data as ProjectData;
}
