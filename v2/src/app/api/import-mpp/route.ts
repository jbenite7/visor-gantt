import { NextRequest, NextResponse } from "next/server";
import { saveProject } from "@/app/actions/project";
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
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se proporciono un archivo .mpp valido" },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith(".mpp")) {
    return NextResponse.json(
      { error: "Selecciona un archivo Microsoft Project con extension .mpp" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `El archivo supera el maximo de ${MAX_FILE_SIZE_MB} MB` },
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
    return NextResponse.json(
      { error: errorText },
      { status: parserResponse.status },
    );
  }

  const parsedProject = (await parserResponse.json()) as ParsedMppProject;
  const result = await saveProject(
    buildProjectDataFromMpp(parsedProject, file.name, {
      calculateFields: false,
    }),
  );

  if (!result.success || !result.id) {
    return NextResponse.json(
      { error: result.error ?? "No se pudo guardar el proyecto importado" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(buildPublicUrl(request, `/project/${result.id}`), {
    status: 303,
  });
}
