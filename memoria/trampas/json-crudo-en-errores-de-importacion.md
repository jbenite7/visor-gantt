---
tipo: trampa
estado: vigente
fecha: 2026-08-04
areas: [importacion]
fuente: goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md
resumen: "Un form nativo sin preventDefault hace que el navegador muestre el JSON de error a pantalla completa"
---
Antes de la corrección del 2026-08-04, `HomeMppUploadAction.tsx` era un
`<form action="/api/import-mpp" method="post">` nativo enviado con `requestSubmit()`, sin
`onSubmit`, sin `fetch` ni `preventDefault`. Como la Route Handler responde a los cinco caminos de
error con `NextResponse.json({error}, {status})`, la navegación nativa del navegador abandonaba
la página React y renderizaba el JSON crudo como página completa. Ningún test cubría este camino
porque los tests de componente no ejercitan la navegación real del navegador.

**Why:** un formulario que parece manejado por React (tiene handlers, estado, componentes de
error) puede seguir teniendo el comportamiento nativo del navegador si falta `preventDefault` —
el bug es invisible en tests de componente y solo aparece al enviar el formulario en un navegador
real con un archivo que dispare un error del servidor.

**How to apply:** cuando un `<form>` habla con una API que puede fallar, verifica en un navegador
real (no solo con `fireEvent.submit` de Testing Library) que un error del servidor no navega
fuera de la página. Ver [[errores-de-importacion-visibles-en-la-app]] para la corrección.
