---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [importacion]
fuente: v2/src/lib/import/, v2/src/app/api/import-mpp/, v2/src/app/api/parse-mpp/
resumen: "Orquesta la subida de un .mpp: lo envía a mpp-parser, lo normaliza y lo persiste"
---
# importacion

**Qué hace.** Recibe el archivo `.mpp` subido desde la UI, lo reenvía al servicio
[[mpp-parser]] para obtener JSON crudo, lo transforma a la forma que usa el resto de la app
(proyecto, tareas, calendarios) y devuelve errores de forma legible cuando el parseo falla.

**Dónde vive.** `v2/src/lib/import/mpp-project.ts` (normalización del JSON de MPXJ a `Project`),
`v2/src/lib/parser/mpp-parser.ts` (cliente HTTP hacia `mpp-parser`), `v2/src/lib/api/mpp-client.ts`
e `v2/src/lib/api/index.ts`, `v2/src/app/api/parse-mpp/route.ts` (proxy hacia el microservicio),
`v2/src/app/api/import-mpp/route.ts` (recibe el archivo desde el cliente), `v2/src/app/actions/upload.ts`
(Server Action de subida), `v2/src/components/upload/`.

**Qué consume.** El servicio [[mpp-parser]] (HTTP), las variables de entorno
`MPP_PARSER_URL`/`NEXT_PUBLIC_MPP_PARSER_URL`.

**Quién lo consume.** La UI de subida (`v2/src/components/upload/`) y `ProjectView` disparan la
Server Action `upload.ts`; el proyecto normalizado resultante se persiste vía el módulo
[[persistencia]].

**Invariantes.** Los errores de `/api/import-mpp` se interceptan en el cliente y se muestran
dentro de la página en vez de dejar que el navegador pinte el JSON crudo — ver
[[errores-de-importacion-visibles-en-la-app]] y la trampa [[json-crudo-en-errores-de-importacion]].
