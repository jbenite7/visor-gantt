---
tipo: flujo
estado: vigente
fecha: 2026-08-05
areas: [importacion, docker]
fuente: v2/src/app/api/import-mpp/, v2/src/lib/import/mpp-project.ts, services/mpp-parser/main.py
resumen: "Del archivo .mpp subido al proyecto normalizado, calculado y persistido"
---
# Flujo: importación de un .mpp

- **Subida.** El usuario arrastra el archivo en la UI (`v2/src/components/upload/MPPUploader.tsx`
   o `HomeMppUploadAction.tsx`). El archivo viaja como multipart a un Route Handler — no a una
   Server Action, porque son archivos grandes (`v2/src/app/api/import-mpp/route.ts`).
- **Parseo.** El frontend nunca lee el binario: `v2/src/app/api/parse-mpp/route.ts` lo reenvía por
   HTTP al servicio [[mpp-parser]] (`MPP_PARSER_URL`), que con MPXJ devuelve JSON crudo (tareas,
   recursos, calendarios, campos custom).
- **Normalización.** `v2/src/lib/import/mpp-project.ts` (`buildProjectDataFromMpp`) transforma ese
   JSON al modelo de la app, **conservando fechas y datos originales**: lo derivado lleva
   procedencia explícita y nunca sobrescribe la fuente en silencio.
- **Campos calculados.** El módulo [[mpp-calculo]] replica los campos que MS Project calcula y
   MPXJ no expone, según las capas de [[capas-del-motor-de-calculo-mpp]].
- **Persistencia atómica.** El agregado completo se guarda vía [[persistencia]] en
   `projects.project_data`. Archivo inválido, parser caído o fallo de DB ⇒ **no** se crea un
   proyecto parcial.
- **Errores legibles.** Si algo falla, el cliente intercepta la respuesta y la muestra dentro de
   la página (`ErrorDisplay.tsx`, `WarningList.tsx`) — nunca JSON crudo en el navegador; ver
   [[errores-de-importacion-visibles-en-la-app]] y [[json-crudo-en-errores-de-importacion]].

Tras importar, el proyecto se abre y entra al flujo [[edicion-y-recalculo]].
