import { NextRequest, NextResponse } from "next/server";
import { humanParserError } from "@/lib/import/parserErrors";
import { buildProjectDataFromMpp } from "@/lib/import/mpp-project";
import { createSharedProject } from "@/lib/share/createSharedProject";
import { checkUploadAllowance } from "@/lib/share/uploadThrottle";
import { cleanExpiredShares } from "@/lib/share/cleanExpiredShares";
import type { ProjectData as ParsedMppProject } from "@/lib/parser/mpp-parser";

const DEFAULT_PARSER_URL = "http://mpp-parser:8000";
const MAX_FILE_SIZE_MB = 50;

function parserEndpoint(): string {
  const baseUrl = (process.env.MPP_PARSER_URL || DEFAULT_PARSER_URL).replace(
    /\/+$/,
    "",
  );
  return baseUrl.endsWith("/api/parse-mpp")
    ? baseUrl
    : `${baseUrl}/api/parse-mpp`;
}

/** De qué conexión viene, para el freno. Detrás de un proxy llega en la cabecera. */
function conexionDe(request: NextRequest): string {
  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconocida";
}

/**
 * Subir un `.mpp` **sin cuenta** y recibir el enlace para verlo.
 *
 * Hermana pública de `/api/import-mpp`, que exige sesión y no se toca: aquel
 * guard es correcto para lo que hace. Esta abre el analizador a internet, y por
 * eso lleva freno por conexión.
 */
export async function POST(request: NextRequest) {
  // El freno va lo PRIMERO, antes de leer el cuerpo y antes de analizar. El
  // analizador es un microservicio aparte que tarda hasta tres minutos con
  // archivos grandes: comprobar después de analizar no protegería nada.
  const verdict = checkUploadAllowance(conexionDe(request), new Date());
  if (!verdict.allowed) {
    return NextResponse.json(
      {
        error:
          "Has subido varios cronogramas seguidos. Espera un poco y vuelve a intentarlo.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(verdict.retryAfterSeconds) },
      },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se proporcionó un archivo .mpp válido" },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith(".mpp")) {
    return NextResponse.json(
      { error: "Selecciona un archivo de Microsoft Project con extensión .mpp" },
      { status: 400 },
    );
  }
  // `file.size` se declara, no se materializa: leer 50 MB en memoria solo para
  // medirlos fue una fuente real de inestabilidad en esta app.
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `El archivo supera el máximo de ${MAX_FILE_SIZE_MB} MB` },
      { status: 413 },
    );
  }

  const parserData = new FormData();
  parserData.set("file", file, file.name);

  const parserResponse = await fetch(parserEndpoint(), {
    method: "POST",
    body: parserData,
  });

  if (!parserResponse.ok) {
    const errorText = await parserResponse.text().catch(() => "Sin detalles");
    // El detalle técnico se queda en el registro: al usuario le llega la causa
    // probable y qué hacer con ella.
    console.error("[ver-mpp] error del analizador", {
      status: parserResponse.status,
      detail: errorText,
    });
    return NextResponse.json(
      { error: humanParserError(errorText, parserResponse.status) },
      { status: parserResponse.status },
    );
  }

  const parsedProject = (await parserResponse.json()) as ParsedMppProject;
  const projectData = buildProjectDataFromMpp(parsedProject, file.name, {
    calculateFields: false,
  });

  // El disparador de la limpieza, que la spec dejó exigido: un script sin
  // llamador no borra nada. Va aquí porque quien crea temporales es exactamente
  // quien los acumula, y porque el caso que más acumula —alguien prueba la app,
  // cierra la pestaña y no vuelve— nunca dispararía un borrado «al abrir».
  //
  // No se espera su resultado ni se deja que tumbe la subida: limpiar es
  // higiene, no la tarea del usuario que pasaba por aquí.
  // El .catch() no es adorno: sin él, un fallo de la limpieza queda como
  // promesa rechazada sin capturar, y eso puede tumbar el proceso entero. La
  // higiene no puede llevarse por delante al servidor.
  void cleanExpiredShares().catch((error) => {
    console.error("[ver-mpp] la limpieza de caducados falló", error);
  });

  const guardado = await createSharedProject(projectData);
  if (!guardado.ok) {
    return NextResponse.json({ error: guardado.error }, { status: 500 });
  }

  return NextResponse.json({ token: guardado.token }, { status: 200 });
}
