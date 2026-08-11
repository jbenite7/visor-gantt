# Frente: modo-de-prueba

## Objetivo

Que una sesión de revisión pueda mirar en navegador las vistas que hoy exigen
cuenta —Gantt con cuenta, Matriz, Ejecutivo y Cortes— sin escribir credenciales
reales de nadie, y sin que eso deje una puerta abierta en producción.

## Condición de hecho

1. Las cuatro vistas recorridas en navegador sobre un cronograma real (240
   tareas, 213 asignaciones), con capturas.
2. `VISOR_TEST_MODE` ausente ⇒ `GET /api/modo-prueba` responde 404 y **no**
   emite `set-cookie`, medido contra un servidor real, no solo en pruebas.
3. Suite completa verde, y el candado entregado con una mutación que lo pone
   rojo, ejecutada.

## Archivos declarados

- `v2/src/lib/auth/testMode.ts` (+ test)
- `v2/src/app/api/modo-prueba/route.ts` (+ test)
- `v2/scripts/seed-modo-prueba.ts`
- `v2/package.json`, `.claude/launch.json`, `.env.example`
- `docs/modo-de-prueba.md`, `docs/barridos-por-clase.md`

## Contención

| archivo | commits hoy | quién más lo declara |
|---|---|---|
| `docs/barridos-por-clase.md` | 12 | nadie lo declara, pero es el más caliente del repo |
| `v2/package.json` | 0 | nadie |
| `.claude/launch.json` | 0 | nadie |
| el resto | archivos nuevos | nadie |

Ninguna de las dos sesiones vivas (2e650e16, 27081447) declaraba archivos al
abrir este frente. `docs/barridos-por-clase.md` se toca en un solo párrafo y se
integra justo antes de publicar.

## Cadena de herramientas

Frente pequeño y de un solo hilo: no se despachó `frente-router` ni subagentes
—habrían costado más contexto del que ahorraban—. Piezas usadas:

- `skill:coordinating-agent-sessions` — hay tres sesiones vivas; fija el canal y
  el gate de cierre.
- `mcp:Claude_Browser` — la condición de hecho es «mirarlo en navegador»; no hay
  forma de satisfacerla sin él.
- `jest` + `playwright.config` existentes — el candado se fija donde ya vive la
  suite, sin herramienta nueva.
