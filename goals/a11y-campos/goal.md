# Frente a11y-campos

**Objetivo.** Que todo control que se enfoca o se edita en la tabla Gantt, los paneles de
dependencias y el editor de matriz diga qué es, con un nombre que signifique algo. Y cerrar las
dos preguntas abiertas del `.mpp` que no dependen de nadie más.

**Condición de hecho.** Los campos reales sin nombre, arreglados y probados rompiéndolos; los
falsos positivos, probados por su nombre en vez de anotados; suite completa, tipos, lint y build
verdes; fusionado y publicado.

**Plan de referencia.** No hay plan de `writing-plans`: el encargo llegó como cola de trabajo de
la sesión coordinadora, sobre las preguntas abiertas de `docs/barridos-por-clase.md`.

## Cadena de herramientas

Del `frente-router`, quitando lo que no cambia lo que haría por defecto:

- `superpowers:test-driven-development` — cada nombre accesible entra con su prueba antes que el
  código, y la prueba se valida rompiéndola.
- `superpowers:verification-before-completion` — nada se declara hecho sin salida real de
  `jest`, `tsc`, `eslint` y `next build` de esta sesión.
- `superpowers:requesting-code-review` — antes de fusionar, por ser cambio ancho y de interfaz.
- `react/testing.md` (ECC) — consultar por roles y nombres accesibles, que es como lo encuentra
  quien usa un lector de pantalla, en vez de por clase CSS.
- Navegador integrado (`preview_start`) — comprobar en pantalla, que es de donde salieron los
  mejores hallazgos del día. **Con el aviso aprendido:** el servidor corre con `cwd` en el
  worktree; confirmar con `lsof -p <pid> -a -d cwd` antes de creerse lo que se ve.

Descartadas: `using-git-worktrees` (ya se trabaja en uno), `impeccable audit` (esto no cambia
nada visual), y los checklists genéricos de cobertura.
