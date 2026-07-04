# Goal: Importacion MPP en servidor

Corregir la importacion `.mpp` para que el archivo se procese y se guarde directamente en el servidor, evitando que el navegador reenvie un JSON gigante por Server Action. El flujo compartido debe servir para el home y `/upload`, guardar el proyecto completo y redirigir a `/project/<id>` sin errores `POST / 500` por limite de payload.

La comprension compartida esta en `goals/server-side-mpp-import/facts.md`.

El plan de ejecucion esta en `goals/server-side-mpp-import/plan.md`.

Done cuando local y produccion importen un `.mpp` real desde la UI, creen el proyecto en base de datos, abran `/project/<id>`, y los logs confirmen que no aparece `Body exceeded ... limit` ni `POST / 500`.
