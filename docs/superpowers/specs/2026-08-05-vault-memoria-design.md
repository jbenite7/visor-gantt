# Diseño — Vault de Obsidian y wiki `memoria/` para visor-gantt

Fecha: 2026-08-05
Estado: aprobado

## Problema

El conocimiento del proyecto existe pero no es navegable ni recuperable. Hoy está repartido
entre `goals/` (9 carpetas, 35 `.md`), `docs/`, los `.md` de la raíz (`README`, `ROADMAP`,
`CHANGELOG`, `AGENTS`, `SCAFFOLDING`) y el propio código. Cuatro dolores concretos:

1. **No se encuentra.** La información existe, pero no hay índice ni mapa.
2. **Se pierde el porqué.** Las decisiones (por qué X y no Y) no quedan escritas y se repiten.
3. **No se puede leer fuera del editor.** No hay forma de navegar el proyecto sin abrir código.
4. **El asistente no tiene memoria.** Cada sesión arranca sin el estado real del proyecto.

## Solución

Replicar el sistema ya validado en el proyecto `lps-aia`: una wiki `memoria/` dentro del repo,
con el vault de Obsidian montado en la raíz.

### Las tres capas

Sigue el patrón [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

| Capa | Dónde | Regla |
|---|---|---|
| **Fuentes** | `docs/`, `goals/`, los `.md` de la raíz, el código (`v2/src/`, `services/mpp-parser/`) | Se leen. Su contenido no se edita desde la wiki. |
| **Wiki** | `memoria/` | La escribe el asistente. Nunca se edita a mano. |
| **Esquema** | `memoria/wiki-operacion.md` | Explica la estructura y las cuatro operaciones. `AGENTS.md` lo resume. |

**Precedencia: Código > `AGENTS.md` > `memoria/`.** Nada de lo que hay en la wiki es contrato.
Si una nota contradice al repo, gana el repo: se corrige la nota y se marca `estado: derogada`
en vez de borrarla — saber que algo dejó de ser cierto también es memoria.

### Vault

El vault es **la raíz del repo**, no `memoria/`. Así los enlaces alcanzan `docs/`, `goals/` y
los `.md` de la raíz sin copiarlos.

`.obsidian/` se versiona en git. Configuración en `.obsidian/app.json`:

- `alwaysUpdateLinks: true`
- `newLinkFormat: "absolute"`
- `useMarkdownLinks: false` (wikilinks)
- `attachmentFolderPath: "memoria/adjuntos"`
- `showUnsupportedFiles: false`
- `userIgnoreFilters`: `node_modules/`, `v2/node_modules/`, `v2/.next/`, `v2/test-results/`,
  `v2/playwright-report/`, `v2/tmp/`, `v2/e2e/`, `test_data/`, `v2/test_data/`, `.omo/`,
  `.claude/`, `.superpowers/`, `.github/`, `.codex/`, `.vscode/`, `.playwright-mcp/`,
  `.pytest_cache/`, `__pycache__/`

Plugins nativos: `bases` activado. **Sin plugins de comunidad** — el catálogo se hace con
Bases, no con Dataview.

### Estructura de `memoria/`

```
memoria/
  index.md              puerta de entrada: qué es, cómo se opera, catálogo
  wiki-operacion.md     el esquema: estructura y las cuatro operaciones
  log.md                bitácora cronológica de ingest y verificación
  estado.md             estado de los 9 goals (abierto / cerrado / absorbido)
  mapas/                un mapa por área
  decisiones/           el porqué de cada decisión
  conceptos/            vocabulario y modelos mentales del dominio
  trampas/              lo que ya costó tiempo y no debe repetirse
  referencias/          punteros a fuentes externas y del repo
  arquitectura/         una página por módulo real
  flujos/               recorridos de extremo a extremo
  paginas.base          catálogo por tipo (Bases)
  adjuntos/             imágenes y adjuntos
```

### Frontmatter

Fijo en todas las páginas de `memoria/`:

```yaml
---
tipo: decision          # mapa | decision | concepto | trampa | referencia | modulo | flujo
estado: vigente         # vigente | derogada
fecha: 2026-08-05       # ISO
areas: [gantt]          # lista cerrada, ver abajo
fuente: sesion          # de dónde salió el conocimiento
resumen: "Una línea que explica de qué va la página"
---
```

Las notas de tipo `decision` y `trampa` llevan además, en el cuerpo, una línea **Why:** y una
línea **How to apply:**.

Regla de escritura: **una nota, un hecho.** Si no cabe en una pantalla, probablemente son dos.

### Áreas

Lista cerrada de doce, derivada de `v2/src/lib/` y `services/mpp-parser/`. El lint la comprueba;
añadir una nueva exige tocar el script y documentarla en `index.md`.

`gantt` · `importacion` · `scheduling` · `datos` · `ui` · `auth` · `reportes` · `qa` ·
`docker` · `deploy` · `proceso` · `arquitectura`

### Las cuatro operaciones

- **Ingest** — al cerrar una tarea o al aparecer una fuente nueva: se escribe o actualiza la
  página, se actualiza `index.md`, se revisan las páginas relacionadas y se anexa una línea a
  `log.md`.
- **Query** — preguntas contra la wiki, respondidas citando páginas. Si la respuesta era valiosa
  y no estaba escrita, se convierte en página.
- **Lint** — comprueba la **forma**: enlaces rotos, frontmatter completo, áreas válidas,
  orfandad. Comprueba y reporta; **nunca corrige**. Un verde no significa que la wiki sea
  correcta.
- **Veracidad** — verificar contra el código que lo escrito sigue siendo cierto, por rotación de
  áreas, verificando cada afirmación en vez de sospecharla. El lint cuenta los commits de código
  desde el último pase y sale en rojo por encima de 40.

### Lint

`scripts/wiki-lint.mjs` en la raíz del repo, ejecutable con `node scripts/wiki-lint.mjs`.
`v2/package.json` gana un `test:wiki` que lo invoca desde ahí.

Comprobaciones:

1. Todo `.md` bajo `memoria/` tiene frontmatter con las seis claves obligatorias.
2. `tipo` y `estado` pertenecen a sus listas cerradas.
3. Toda entrada de `areas` pertenece a la lista de doce.
4. Todo `[[wikilink]]` dentro de `memoria/` resuelve a un archivo existente del vault.
5. Ninguna página de `memoria/` queda huérfana (sin enlaces entrantes).
6. Contador de commits de código desde el último pase de veracidad registrado en `log.md`;
   rojo por encima de 40.

Salida: informe legible y código de salida distinto de cero si algo falla. No escribe archivos.

### Excepción a «no tocar las fuentes»

Cada `goals/<slug>/goal.md` (son 9) recibe al pie una sección «Archivos de este goal» que enlaza
a sus hermanos (`plan.md`, `facts.md`, `cierre.md`, …) y a `memoria/estado.md`. Es navegación
añadida al final, no contenido modificado. Es lo único que evita que los 35 archivos de `goals/`
aparezcan como islas en el grafo. **`docs/` queda intacto.**

### Semilla: pasada real de ingest

El andamiaje no se entrega vacío. Primera pasada de *ingest* leyendo `goals/` (los 9), `docs/`,
`ROADMAP.md`, `CHANGELOG.md`, `SCAFFOLDING.md` y `goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md`,
para escribir de entrada las decisiones, trampas y conceptos que hoy están enterrados ahí.

Un vault vacío no resuelve ninguno de los cuatro dolores; el valor está en desenterrar el porqué.

### Contrato del asistente

El `AGENTS.md` de la raíz gana una sección que resume el esquema: qué es `memoria/`, la regla de
precedencia, y cuándo disparar cada una de las cuatro operaciones. **No se crea `CLAUDE.md`** —
visor-gantt ya usa `AGENTS.md` como contrato autoritativo y `GEMINI.md` para Gemini.

## Fuera de alcance

- **Generador `wiki-arquitectura.mjs`.** En `lps-aia` extrae rutas, controladores, servicios y
  capacidades del front controller PHP hacia zonas generadas de las páginas de módulo. Acá el
  stack es Next.js + FastAPI y el extractor sería otro problema entero. Las páginas de
  `arquitectura/` arrancan escritas a mano; si duelen de mantener, se automatiza después.
- **Biblia de flujos (`docs/flujos/`).** El conjunto de escenarios con regla invertida (si biblia
  y código divergen, es un bug de uno de los dos) es un proyecto propio, no parte de montar el
  vault.
- **Reorganizar `goals/` o `docs/`.** No se mueve ni se renombra nada. La única escritura sobre
  fuentes es la sección al pie de los 9 `goal.md`.

## Condición de hecho

1. Obsidian abre la raíz del repo y el explorador muestra solo archivos relevantes.
2. `memoria/` existe con `index.md`, `wiki-operacion.md`, `log.md`, `estado.md`, `paginas.base`
   y las carpetas por tipo.
3. La pasada de ingest dejó escritas las decisiones, trampas y conceptos extraídos de las
   fuentes, y `log.md` la registra.
4. Los 9 `goals/<slug>/goal.md` tienen su sección «Archivos de este goal».
5. `node scripts/wiki-lint.mjs` sale en verde, con salida real pegada en el cierre.
6. `AGENTS.md` tiene la sección que resume el esquema.
7. El grafo de Obsidian no muestra `memoria/` como islas sueltas.
