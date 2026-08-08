import { NextRequest, NextResponse } from "next/server";
import { saveProject } from "@/app/actions/project";
import { getCurrentUser } from "@/lib/auth/session";
import { humanParserError } from "@/lib/import/parserErrors";
import { buildProjectDataFromMpp } from "@/lib/import/mpp-project";
import type { ProjectData as ParsedMppProject } from "@/lib/parser/mpp-parser";

const DEFAULT_PARSER_URL = "http://mpp-parser:8000";
const MAX_FILE_SIZE_MB = 50;

function buildPublicUrl(request: NextRequest, pathname: string): URL {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  return new URL(`${protocol}://${host}${pathname}`);
}

function parserEndpoint(): string {
  const baseUrl = (process.env.MPP_PARSER_URL || DEFAULT_PARSER_URL).replace(
    /\/+$/,
    "",
  );
  return baseUrl.endsWith("/api/parse-mpp")
    ? baseUrl
    : `${baseUrl}/api/parse-mpp`;
}

export async function POST(request: NextRequest) {
  // Se comprueba antes de leer el cuerpo: si falta sesión, el usuario lo sabe de
  // inmediato en vez de esperar la subida y el parseo para recibir "No autenticado".
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      {
        error:
          "Tu sesión expiró. Vuelve a entrar y sube el archivo de nuevo.",
        loginUrl: "/login?next=/upload",
      },
      { status: 401 },
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
    // El detalle técnico se queda en el registro del servidor: al usuario le
    // llega la causa probable y qué hacer con ella (E5).
    console.error("[import-mpp] error del analizador", {
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
  const result = await saveProject(projectData);

  if (!result.success || !result.id) {
    return NextResponse.json(
      { error: result.error ?? "No se pudo guardar el proyecto importado" },
      { status: 500 },
    );
  }

  const dependencyCount = projectData.tasks.reduce(
    (total, task) => total + (task.dependencies?.length ?? 0),
    0,
  );

  // Los conteos viajan en la URL de destino porque `fetch` sigue los
  // redirects por defecto: el cliente nunca llega a ver las cabeceras de
  // esta respuesta 303, solo la URL final. Se dejan también como cabeceras
  // por si algún consumidor no sigue el redirect, pero lo que decide es
  // la URL.
  const destination = buildPublicUrl(request, `/project/${result.id}`);
  destination.searchParams.set("tareas", String(projectData.tasks.length));
  destination.searchParams.set("dependencias", String(dependencyCount));
  destination.searchParams.set("recursos", String(projectData.resources.length));

  // La importación ligera se queda en las primeras 120 columnas. Decir cuáles
  // quedaron fuera evita creer que entró todo el archivo (E33).
  const columnasDescartadas = (parsedProject.availableColumns ?? [])
    .filter(
      (nombre) =>
        !projectData.mppTaskColumns?.some(
          (columna) =>
            columna.labelEs === nombre ||
            columna.labelEn === nombre ||
            columna.key === nombre ||
            columna.sourceKey === nombre,
        ),
    )
    .slice(0, 40);
  if (columnasDescartadas.length > 0) {
    destination.searchParams.set("descartadas", columnasDescartadas.join(","));
  }

  const response = NextResponse.redirect(destination, { status: 303 });
  response.headers.set("X-Import-Tasks", String(projectData.tasks.length));
  response.headers.set("X-Import-Dependencies", String(dependencyCount));
  response.headers.set("X-Import-Resources", String(projectData.resources.length));
  return response;
}
