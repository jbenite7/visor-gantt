# Plan: Importacion MPP en servidor

## Enfoque

Completar la ruta servidor-servidor de importacion `.mpp` para que el navegador solo envie el archivo original. El servidor llamara al parser interno, transformara el resultado al formato persistido por la app, guardara en PostgreSQL y devolvera el `projectId` para redirigir a `/project/<id>`.

Hay trabajo parcial en el arbol actual que debe revisarse y consolidarse: `v2/src/app/api/import-mpp/route.ts`, `v2/src/lib/import/mpp-project.ts` y `v2/src/components/upload/HomeMppUploadAction.tsx`.

## Pasos

1. Consolidar la transformacion MPP a ProjectData.
   - Archivos: `v2/src/lib/import/mpp-project.ts`, `v2/src/components/upload/mpp-to-gantt.ts`, `v2/src/lib/mpp/taskColumns.ts`, `v2/src/lib/mpp/mppCalculationEngine.ts`.
   - Mantener en servidor la logica que hoy estaba en `HomeMppUploadAction`: nombre fallback, calendario, tareas, recursos, asignaciones, columnas MPP, campos personalizados y campos calculados.
   - Verificacion: test unitario del helper con un proyecto parseado que incluya tareas, recursos, asignaciones y columnas custom.

2. Completar la API compartida de importacion.
   - Archivos: `v2/src/app/api/import-mpp/route.ts`, `v2/src/app/actions/project.ts`, `v2/src/lib/db.ts`.
   - Validar usuario autenticado por el mismo camino de permisos que `saveProject`.
   - Validar extension `.mpp`, archivo presente y limite de tamano.
   - Llamar al parser interno usando `MPP_PARSER_URL`, tolerando valores con o sin `/api/parse-mpp`.
   - Guardar el proyecto completo en una sola transaccion logica y devolver `{ id }`.
   - No crear proyectos parciales si falla parseo, transformacion o guardado.
   - Verificacion: tests de ruta para archivo faltante, extension invalida, parser fallido y guardado exitoso.

3. Cambiar el home para usar solo la API compartida.
   - Archivo: `v2/src/components/upload/HomeMppUploadAction.tsx`.
   - El componente debe enviar `FormData` con el `.mpp` original a `/api/import-mpp`.
   - Debe eliminar cualquier dependencia de `parseMPP`, `saveProject`, calculos de MPP y conversiones pesadas en cliente.
   - En exito debe ejecutar `router.push('/project/<id>')`; en error debe mostrar mensaje inline.
   - Verificacion: actualizar `v2/src/components/upload/__tests__/HomeMppUploadAction.test.tsx` para comprobar `fetch('/api/import-mpp')`, redireccion y errores.

4. Conectar `/upload` a la misma ruta compartida.
   - Archivos: `v2/src/app/upload/page.tsx`, `v2/src/components/upload/MPPUploader.tsx` o un componente nuevo de importacion guardada.
   - Definir el flujo `.mpp` de `/upload` para usar `/api/import-mpp` y redirigir al proyecto guardado, manteniendo el flujo XML heredado separado.
   - Evitar que `/upload` dependa de un JSON parseado gigante en el navegador cuando el objetivo sea importar y guardar.
   - Verificacion: test de componente o e2e que suba `.mpp` desde `/upload` y llegue a `/project/<id>`.

5. Revisar `bodySizeLimit`.
   - Archivo: `v2/next.config.ts`.
   - Revertir el aumento temporal a un valor conservador si el nuevo flujo ya no necesita payloads grandes.
   - Si algun Server Action legitimo todavia necesita mas de `16mb`, documentar por que y cubrirlo con una prueba/manual check.
   - Verificacion: build de Next y e2e sin `Body exceeded ... limit` en logs.

6. Verificar local.
   - Comandos:
     - `npm test -- --runInBand src/lib/import src/components/upload/__tests__/HomeMppUploadAction.test.tsx`
     - `npm run lint`
     - `npm run build`
   - Runtime:
     - Rebuild/recreate del frontend Docker local.
     - E2E con un `.mpp` real desde home: login, seleccionar archivo, confirmar ausencia de `POST / 500`, confirmar proyecto creado en DB y abrir `/project/<id>`.
     - E2E equivalente desde `/upload` si queda conectado a importacion guardada.

7. Desplegar y verificar produccion.
   - Sistemas: VPS `hetzner-vps-openclaw`, Docker Compose, servicios `frontend`, `mpp-parser`, `db`.
   - Rebuild/recreate del frontend en produccion.
   - E2E en `http://62.238.11.226:3000` con el mismo `.mpp` real.
   - Revisar logs del frontend para confirmar que no aparece `Body exceeded ... limit` ni `POST / 500`.
   - Confirmar en PostgreSQL que se creo el proyecto y que `/project/<id>` renderiza.

## Riesgos

- Importar `saveProject` directamente desde una route handler puede funcionar, pero si causa problemas con el boundary de `"use server"`, extraer la persistencia comun a un helper server-only y dejar `saveProject` como wrapper.
- El payload parseado puede seguir siendo grande dentro del servidor. Eso es aceptable si no cruza el navegador, pero hay que cuidar memoria y tiempo de respuesta en el VPS.
- `/upload` hoy funciona como previsualizacion Gantt. Si se cambia a importacion guardada, validar que no se rompe una expectativa existente; si se conserva la previsualizacion, agregar una accion clara para "Guardar proyecto" que use la API compartida.
- Los tests e2e contra produccion deben limpiar o aislar proyectos de prueba para no ensuciar la base.
