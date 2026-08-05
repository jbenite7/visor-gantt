---
tipo: decision
estado: vigente
fecha: 2026-08-04
areas: [importacion]
fuente: goals/cierre-auditoria-goals/goal.md
resumen: "Los errores de /api/import-mpp se interceptan en cliente y se muestran dentro de la pagina"
---
Los cinco caminos de error de `/api/import-mpp` (archivo inválido, extensión incorrecta, tamaño
excedido, fallo del parser, fallo al guardar) se interceptan en el cliente en vez de dejar que el
navegador navegue de forma nativa al JSON de respuesta. `HomeMppUploadAction.tsx` usa
`onSubmit={(event) => event.preventDefault()}` y hace `fetch("/api/import-mpp", ...)` en su
lugar, mostrando el error dentro de la página.

**Why:** un `<form>` nativo enviado con `requestSubmit()` sin `preventDefault` hace que, en los
cinco caminos de error, el navegador abandone la página y renderice el JSON crudo de la API como
página completa — una experiencia rota que ningún test cubría antes de la auditoría del
2026-08-04.

**How to apply:** cualquier formulario que hable con una Route Handler de importación debe
interceptar el envío; verifica los cinco status (400 archivo, 400 extensión, 413 tamaño, status
del parser, 500 guardado) con test, no solo el camino feliz.
