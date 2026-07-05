import { NextRequest, NextResponse } from "next/server";

const DEFAULT_PARSER_URL = "http://mpp-parser:8000";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No se proporcionó un archivo .mpp válido" },
      { status: 400 },
    );
  }

  const parserUrl = process.env.MPP_PARSER_URL || DEFAULT_PARSER_URL;
  const forwardData = new FormData();
  forwardData.set("file", file, file.name);

  const response = await fetch(`${parserUrl}/api/parse-mpp`, {
    method: "POST",
    body: forwardData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Sin detalles");
    return NextResponse.json(
      { error: errorText },
      { status: response.status },
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: contentType ? { "content-type": contentType } : undefined,
  });
}
