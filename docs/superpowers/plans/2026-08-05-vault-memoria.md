# Vault de Obsidian y wiki `memoria/` — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar en visor-gantt la wiki `memoria/` con vault de Obsidian en la raíz del repo, sembrada con una pasada real de ingest sobre `goals/`, `docs/` y los `.md` de la raíz, y con un lint que comprueba su forma.

**Architecture:** Patrón LLM Wiki de tres capas — las fuentes (`docs/`, `goals/`, los `.md` de la raíz, el código) se leen y no se editan; la wiki (`memoria/`) la escribe el asistente; el esquema (`memoria/wiki-operacion.md`, resumido en `AGENTS.md`) explica cómo se opera. El vault es la raíz del repo, con `userIgnoreFilters` sacando del índice todo lo que es ruido. Dos scripts sin dependencias en `scripts/` comprueban la forma de la wiki y la edad del último pase de veracidad.

**Tech Stack:** Markdown + YAML frontmatter · Obsidian (plugin nativo Bases, sin plugins de comunidad) · Node.js ESM puro (`node:fs`, `node:path`, `node:child_process`, `node --test`), cero dependencias nuevas.

## Global Constraints

- **Precedencia: Código > `AGENTS.md` > `memoria/`.** Ninguna nota de la wiki es contrato. Si una nota contradice al repo, gana el repo.
- **Las fuentes no se editan.** Única excepción autorizada: la sección «Archivos de este goal» al pie de los 9 `goals/<slug>/goal.md` (Task 8). `docs/` queda intacto.
- **Una nota, un hecho.** Si no cabe en una pantalla, son dos notas.
- **Nada se borra:** una nota que deja de ser cierta se marca `estado: derogada`.
- **Cero dependencias nuevas.** El repo no tiene parser de YAML; el frontmatter se parsea con expresiones regulares, igual que en `lps-aia`.
- **Todo en español**, incluidos nombres de archivo, `resumen` y mensajes del lint. Identificadores, rutas y comandos quedan en su idioma.
- **Lista cerrada de áreas** (doce, exactas): `gantt` · `importacion` · `scheduling` · `datos` · `ui` · `auth` · `reportes` · `qa` · `docker` · `deploy` · `proceso` · `arquitectura`
- **Lista cerrada de tipos** (siete, exactos): `mapa` · `decision` · `concepto` · `trampa` · `referencia` · `modulo` · `flujo`
- **Lista cerrada de estados** (dos, exactos): `vigente` · `derogada`
- **Frontmatter obligatorio** en toda página de `memoria/`: `tipo`, `estado`, `fecha` (ISO `YYYY-MM-DD`), `areas`, `fuente`, `resumen`.
- **Los commits no llevan tildes en el asunto** (convención del historial del repo).

---

### Task 1: Vault de Obsidian en la raíz

**Files:**
- Create: `.obsidian/app.json`
- Create: `.obsidian/core-plugins.json`
- Modify: `.gitignore` (añadir excepción para que `.obsidian/workspace.json` no se versione)

**Interfaces:**
- Consumes: nada.
- Produces: `.obsidian/app.json` con la clave `userIgnoreFilters` (array de strings). `scripts/wiki-lint.mjs` (Task 4) la lee para recorrer el vault con los mismos filtros que Obsidian.

- [ ] **Step 1: Crear `.obsidian/app.json`**

```json
{
  "alwaysUpdateLinks": true,
  "newLinkFormat": "absolute",
  "useMarkdownLinks": false,
  "attachmentFolderPath": "memoria/adjuntos",
  "showUnsupportedFiles": false,
  "userIgnoreFilters": [
    "node_modules/",
    "v2/node_modules/",
    "v2/.next/",
    "v2/test-results/",
    "v2/playwright-report/",
    "v2/tmp/",
    "v2/e2e/",
    "v2/public/",
    "test_data/",
    "v2/test_data/",
    ".omo/",
    ".claude/",
    ".superpowers/",
    ".github/",
    ".codex/",
    ".vscode/",
    ".playwright-mcp/",
    ".pytest_cache/",
    "services/mpp-parser/__pycache__/"
  ]
}
```

- [ ] **Step 2: Crear `.obsidian/core-plugins.json`**

```json
{
  "file-explorer": true,
  "global-search": true,
  "switcher": true,
  "graph": true,
  "backlink": true,
  "outgoing-link": true,
  "tag-pane": true,
  "properties": true,
  "page-preview": true,
  "note-composer": true,
  "command-palette": true,
  "editor-status": true,
  "bookmarks": true,
  "outline": true,
  "word-count": true,
  "file-recovery": true,
  "bases": true,
  "canvas": false,
  "daily-notes": false,
  "templates": false,
  "zk-prefixer": false,
  "random-note": false,
  "slides": false,
  "audio-recorder": false,
  "workspaces": false,
  "markdown-importer": false,
  "sync": false,
  "publish": false,
  "webviewer": false,
  "footnotes": false,
  "slash-command": false
}
```

- [ ] **Step 3: Añadir al final de `.gitignore`**

`workspace.json` guarda qué paneles tenías abiertos: es estado local de cada máquina, no configuración compartida. `app.json` y `core-plugins.json` **sí** se versionan.

```gitignore

# Obsidian: la configuracion del vault se versiona; el estado local de paneles no
.obsidian/workspace.json
.obsidian/workspace-mobile.json
```

- [ ] **Step 4: Verificar que el JSON es válido y los filtros cubren el ruido**

Run:
```bash
node -e "const f=require('./.obsidian/app.json').userIgnoreFilters; console.log(f.length+' filtros'); require('./.obsidian/core-plugins.json'); console.log('core-plugins OK')"
```
Expected: `19 filtros` y `core-plugins OK`, sin excepción de parseo.

- [ ] **Step 5: Contar cuántos `.md` quedan realmente en el vault**

Run:
```bash
find . -name "*.md" -not -path "./node_modules/*" -not -path "./v2/node_modules/*" -not -path "./.git/*" -not -path "./.omo/*" -not -path "./.claude/*" -not -path "./.superpowers/*" -not -path "./.github/*" -not -path "./.codex/*" | wc -l
```
Expected: un número de dos cifras (del orden de 50-60), no 1062. Si sale por encima de 200, falta un filtro: identifica la carpeta con `find ... | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head` y añádela a `userIgnoreFilters` antes de continuar.

- [ ] **Step 6: Commit**

```bash
git add .obsidian/app.json .obsidian/core-plugins.json .gitignore
git commit -m "chore(vault): configurar Obsidian con la raiz del repo como vault"
```

---

### Task 2: Esqueleto de `memoria/`

**Files:**
- Create: `memoria/index.md`
- Create: `memoria/wiki-operacion.md`
- Create: `memoria/log.md`
- Create: `memoria/paginas.base`
- Create: `memoria/adjuntos/.gitkeep`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `memoria/index.md` (el lint de Task 4 comprueba que toda página esté enlazada desde aquí o cubierta por una vista de `paginas.base`), `memoria/log.md` (el lint lee de aquí las líneas `- YYYY-MM-DD · veracidad · …`), y `memoria/paginas.base` con seis vistas filtradas por `note.tipo`, una por cada tipo salvo `mapa`.

Las carpetas `decisiones/`, `conceptos/`, `trampas/`, `referencias/`, `arquitectura/`, `flujos/` y `mapas/` se crean en las tareas que las llenan (5, 6 y 7). Git no versiona carpetas vacías, así que crearlas ahora no serviría de nada.

- [ ] **Step 1: Crear `memoria/paginas.base`**

Es el catálogo. Seis vistas seleccionables desde un solo embebido. Los `mapa` no llevan vista propia: se enlazan a mano desde `index.md`.

```yaml
filters:
  and:
    - file.inFolder("memoria")
properties:
  note.resumen:
    displayName: De qué va
  note.areas:
    displayName: Áreas
  note.fecha:
    displayName: Fecha
  note.estado:
    displayName: Estado
views:
  - type: table
    name: Decisiones
    filters:
      and:
        - note.tipo == "decision"
    order:
      - file.name
      - resumen
      - areas
      - estado
      - fecha
  - type: table
    name: Trampas
    filters:
      and:
        - note.tipo == "trampa"
    order:
      - file.name
      - resumen
      - areas
      - estado
      - fecha
  - type: table
    name: Conceptos
    filters:
      and:
        - note.tipo == "concepto"
    order:
      - file.name
      - resumen
      - areas
      - fecha
  - type: table
    name: Módulos
    filters:
      and:
        - note.tipo == "modulo"
    order:
      - file.name
      - resumen
      - areas
  - type: table
    name: Flujos
    filters:
      and:
        - note.tipo == "flujo"
    order:
      - file.name
      - resumen
      - areas
  - type: table
    name: Referencias
    filters:
      and:
        - note.tipo == "referencia"
    order:
      - file.name
      - resumen
      - fecha
```

- [ ] **Step 2: Crear `memoria/wiki-operacion.md`**

```markdown
---
tipo: referencia
estado: vigente
fecha: 2026-08-05
areas: [proceso]
fuente: sesion
resumen: "El esquema de la wiki: qué capa manda, qué forma tiene una página y cuáles son las cuatro operaciones"
---
# Cómo se opera la wiki

Esta página es el **esquema**: explica cómo funciona `memoria/`. [[AGENTS]] la resume para el
asistente. Si algo aquí contradice a `AGENTS.md`, gana `AGENTS.md`.

## Las tres capas

| Capa | Dónde | Regla |
|---|---|---|
| Fuentes | `docs/`, `goals/`, los `.md` de la raíz, el código | Se leen. **Su contenido no se edita desde aquí.** |
| Wiki | `memoria/` | La escribe el asistente. **Nunca se edita a mano.** |
| Esquema | esta página | Explica la estructura y las cuatro operaciones. |

**Precedencia: Código > [[AGENTS]] > `memoria/`.** Nada de lo que hay aquí es contrato. Si una
nota contradice al repo, gana el repo: corrige la nota y márcala `estado: derogada` en vez de
borrarla — saber que algo dejó de ser cierto también es memoria.

## Forma de una página

Frontmatter obligatorio, seis claves:

```yaml
---
tipo: decision          # mapa | decision | concepto | trampa | referencia | modulo | flujo
estado: vigente         # vigente | derogada
fecha: 2026-08-05       # ISO
areas: [scheduling]     # de la lista cerrada de doce
fuente: goals/predecessors-use-row-id/facts.md
resumen: "Una línea que dice de qué va la página"
---
```

Las notas `decision` y `trampa` llevan además, en el cuerpo, una línea **Why:** (por qué se
decidió o qué costó tiempo) y una línea **How to apply:** (qué hacer la próxima vez).

**Una nota, un hecho.** Si no cabe en una pantalla, probablemente son dos. El lint avisa cuando
una página acumula más de tres hechos numerados.

## Áreas válidas

Lista cerrada de doce; `scripts/wiki-lint.mjs` la comprueba:

`gantt` · `importacion` · `scheduling` · `datos` · `ui` · `auth` · `reportes` · `qa` · `docker` ·
`deploy` · `proceso` · `arquitectura`

Si hace falta una nueva, se añade **primero** al script y se explica en [[index]] qué cubre. Una
lista que crece sin control deja de servir para filtrar.

## Las cuatro operaciones

- **Ingest** — al cerrar una tarea o al aparecer una fuente nueva: se escribe o actualiza la
  página, se actualiza [[index]], se revisan las páginas relacionadas y se anexa una línea a
  [[log]].
- **Query** — preguntas contra la wiki, respondidas citando páginas. Si la respuesta era valiosa
  y no estaba escrita, se convierte en página.
- **Lint** — `node scripts/wiki-lint.mjs` (o `npm run test:wiki` desde `v2/`): comprueba la
  **forma** — frontmatter, áreas, enlaces, orfandad. Comprueba y reporta; **nunca corrige**. Un
  verde no significa que la wiki sea correcta.
- **Veracidad** — la otra mitad: verificar contra el código que lo escrito sigue siendo cierto,
  por rotación de áreas y verificando cada afirmación en vez de sospecharla. No depende de que
  alguien se acuerde: el lint cuenta los commits de código desde el último pase y sale en rojo
  por encima de 40.

Un pase de veracidad se cierra anexando a [[log]] una línea con esta forma exacta, que es la que
el lint reconoce:

    - 2026-08-05 · veracidad · areas: scheduling, importacion · sin correcciones
```

- [ ] **Step 3: Crear `memoria/log.md`**

La línea `veracidad` se siembra en Task 9, cuando la wiki ya tiene contenido que verificar.

```markdown
---
tipo: referencia
estado: vigente
fecha: 2026-08-05
areas: [proceso]
fuente: sesion
resumen: "Bitácora cronológica de lo que se ha ingerido y verificado en la wiki"
---
# Log

Una línea por operación. Las de `veracidad` llevan formato fijo porque
`scripts/wiki-veracidad.mjs` las lee para medir la edad del último pase:

    - YYYY-MM-DD · veracidad · areas: <lista> · <resultado>

- 2026-08-05 · ingest · se monta la wiki y el vault; ver [[docs/superpowers/plans/2026-08-05-vault-memoria|el plan]]
```

- [ ] **Step 4: Crear `memoria/index.md`**

Los enlaces a mapas y módulos apuntan a páginas que aún no existen — se crean en las Tasks 5 y 7. Es intencional: el índice se escribe una vez y las tareas siguientes lo llenan. El lint no se ejecuta hasta la Task 4, y esos enlaces ya resolverán entonces.

```markdown
---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: []
fuente: sesion
resumen: "Puerta de entrada a la wiki: qué es, cómo se opera y catálogo de todas sus páginas"
---
# Memoria del proyecto

Esta carpeta es la **memoria de visor-gantt**: el porqué de las decisiones, las trampas que ya
costaron tiempo, y un mapa por área que enlaza con la documentación que ya existe en el repo.

Sigue el patrón [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
tres capas, y el asistente mantiene la de en medio. El procedimiento completo está en
[[wiki-operacion|Cómo se opera la wiki]].

| Capa | Dónde | Regla |
|---|---|---|
| Fuentes | `docs/`, `goals/`, los `.md` de la raíz, el código | Se leen. **Su contenido no se edita desde aquí.** |
| Wiki | `memoria/` | La escribe el asistente. **Nunca se edita a mano.** |
| Esquema | [[wiki-operacion|Cómo se opera la wiki]] | Explica esta estructura y las cuatro operaciones. [[AGENTS]] lo resume. |

**Una excepción:** cada `goals/<slug>/goal.md` lleva al final una sección «Archivos de este
goal» que enlaza a sus hermanos y a [[estado|Estado de los goals]]. Es navegación añadida al
pie, no contenido modificado, y es lo único que hace que los 35 archivos de `goals/` aparezcan
tejidos en el grafo en vez de como islas. `docs/` sigue intacto.

El vault de Obsidian es la **raíz del repo**, no esta carpeta. Por eso los enlaces alcanzan a
`docs/`, `goals/` y a los `.md` de la raíz sin copiarlos aquí.

## Precedencia

**Código > [[AGENTS]] > `memoria/`.**

Nada de lo que hay aquí es contrato. Si una nota contradice al repo, gana el repo: corrige la
nota y márcala `estado: derogada` en vez de borrarla.

**Áreas válidas** (lista cerrada de doce; `scripts/wiki-lint.mjs` la comprueba): `gantt` ·
`importacion` · `scheduling` · `datos` · `ui` · `auth` · `reportes` · `qa` · `docker` · `deploy` ·
`proceso` · `arquitectura`.

## Mapas por área

| Mapa | Cubre |
|---|---|
| [[arquitectura]] | Stack dockerizado, `v2/src/`, `services/mpp-parser/`, límites entre servicios |
| [[importacion]] | `.mpp` y `.xml` → modelo de la aplicación; procedencia de los datos originales |
| [[scheduling]] | CPM, calendarios, dependencias FS/SS/FF/SF, holguras, identidad UID ↔ Row ID |
| [[gantt-y-ui]] | Vista Gantt, matriz, línea de balance, componentes y estado editable |
| [[datos-y-persistencia]] | PostgreSQL, `projects.project_data` (JSONB), guardar → recargar → reabrir |
| [[qa-y-entorno]] | Jest, Playwright, Docker Compose, despliegue |

Además: **[[estado|Estado de los goals]]** (qué goal está abierto, cerrado o absorbido) y
**[[log]]** (bitácora cronológica de lo que se ha ingerido y verificado).

## Arquitectura por módulo

Una página por módulo real en `memoria/arquitectura/`. Están escritas a mano: a diferencia de
otros proyectos, aquí **no** hay generador que las extraiga del código, así que el pase de
veracidad es lo único que las mantiene honestas.

## Catálogo

Decisiones, trampas, conceptos, módulos, flujos y referencias, generados desde el frontmatter de
cada página (`tipo`, `resumen`, `areas`, `estado`, `fecha`). La base trae las seis vistas
seleccionables — no hace falta un embebido por tabla.

![[paginas.base]]

## Contratos del repo (no viven aquí)

[[AGENTS]] es el contrato autoritativo · [[v2/AGENTS|v2/AGENTS]] es el override técnico dentro de
`v2/` · [[SCAFFOLDING]] describe el andamiaje · [[ROADMAP]] y [[CHANGELOG]] cuentan hacia dónde va
y por dónde pasó · [[README]] explica cómo levantarlo.
```

**Cuidado con los nombres duplicados.** El vault tiene dos `AGENTS.md` (raíz y `v2/`) y dos `README.md` (raíz y `v2/`). El lint resuelve `[[AGENTS]]` por ruta completa y da la de la raíz; Obsidian resuelve por camino más corto y también da la de la raíz. Coinciden, pero es coincidencia: cuando enlaces al de `v2/`, escribe siempre la ruta completa, `[[v2/AGENTS|v2/AGENTS]]`.

- [ ] **Step 5: Crear el marcador de la carpeta de adjuntos**

```bash
mkdir -p memoria/adjuntos && touch memoria/adjuntos/.gitkeep
```

- [ ] **Step 6: Verificar que el frontmatter de las tres páginas parsea**

Run:
```bash
node -e "
for (const f of ['memoria/index.md','memoria/wiki-operacion.md','memoria/log.md']) {
  const t = require('node:fs').readFileSync(f,'utf8');
  const fm = t.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { console.error('SIN FRONTMATTER: '+f); process.exit(1); }
  for (const k of ['tipo','estado','fecha','areas','fuente','resumen'])
    if (!new RegExp('^'+k+':','m').test(fm[1])) { console.error('FALTA '+k+' en '+f); process.exit(1); }
  console.log('OK '+f);
}"
```
Expected: tres líneas `OK`, sin errores.

- [ ] **Step 7: Commit**

```bash
git add memoria/
git commit -m "feat(memoria): esqueleto de la wiki con indice, esquema, log y catalogo"
```

---

### Task 3: `scripts/wiki-veracidad.mjs` (TDD)

Funciones puras que miden la edad del último pase de veracidad **en commits de código**, no en días. Se testean con el runner nativo de Node — cero dependencias.

**Files:**
- Create: `scripts/wiki-veracidad.test.mjs`
- Create: `scripts/wiki-veracidad.mjs`

**Interfaces:**
- Consumes: `memoria/log.md` (Task 2), del que lee las líneas `- YYYY-MM-DD · veracidad · …`.
- Produces, todos exportados desde `scripts/wiki-veracidad.mjs`:
  - `UMBRAL_COMMITS: number` — vale `40`.
  - `RUTAS_CONTADAS: string[]` — rutas cuyos commits cuentan.
  - `ultimoPase(logTexto: string): string | null` — la fecha ISO del último pase, o `null`.
  - `contarCommits(desde: string, ejecutor?: (args: string[]) => string): number`
  - `estadoVeracidad(logTexto: string, ejecutor?): { sembrado: boolean, desde: string|null, commits: number, excedido: boolean }`
  - `mensajeVeracidad(estado): { hallazgo: string|null, aviso: string|null }`

  `scripts/wiki-lint.mjs` (Task 4) consume `estadoVeracidad` y `mensajeVeracidad`.

- [ ] **Step 1: Escribir el test que falla**

Crear `scripts/wiki-veracidad.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UMBRAL_COMMITS, ultimoPase, contarCommits, estadoVeracidad, mensajeVeracidad,
} from './wiki-veracidad.mjs';

const LOG_SIN_PASE = '# Log\n\n- 2026-08-05 · ingest · se monta la wiki\n';
const LOG_CON_PASES = [
  '# Log',
  '',
  '- 2026-07-01 · veracidad · areas: gantt · sin correcciones',
  '- 2026-07-15 · ingest · cosas',
  '- 2026-08-02 · veracidad · areas: scheduling, datos · 2 notas derogadas',
  '',
].join('\n');

test('ultimoPase devuelve null si no hay ninguna linea de veracidad', () => {
  assert.equal(ultimoPase(LOG_SIN_PASE), null);
});

test('ultimoPase devuelve la fecha del ultimo pase, no la del primero', () => {
  assert.equal(ultimoPase(LOG_CON_PASES), '2026-08-02');
});

test('ultimoPase ignora las lineas de ingest', () => {
  assert.equal(ultimoPase('- 2026-08-05 · ingest · veracidad mencionada de pasada\n'), null);
});

test('contarCommits cuenta las lineas no vacias que devuelve el ejecutor', () => {
  const fake = () => 'aaa\nbbb\nccc\n';
  assert.equal(contarCommits('2026-08-01', fake), 3);
});

test('contarCommits devuelve 0 cuando el ejecutor no devuelve nada', () => {
  assert.equal(contarCommits('2026-08-01', () => ''), 0);
});

test('estadoVeracidad marca sembrado:false cuando no hay pase', () => {
  const e = estadoVeracidad(LOG_SIN_PASE, () => '');
  assert.deepEqual(e, { sembrado: false, desde: null, commits: 0, excedido: false });
});

test('estadoVeracidad no excede cuando los commits estan en el umbral', () => {
  const e = estadoVeracidad(LOG_CON_PASES, () => 'x\n'.repeat(UMBRAL_COMMITS));
  assert.equal(e.commits, UMBRAL_COMMITS);
  assert.equal(e.excedido, false);
});

test('estadoVeracidad excede en cuanto pasa el umbral por uno', () => {
  const e = estadoVeracidad(LOG_CON_PASES, () => 'x\n'.repeat(UMBRAL_COMMITS + 1));
  assert.equal(e.excedido, true);
  assert.equal(e.desde, '2026-08-02');
});

test('mensajeVeracidad sin pase avisa pero no es hallazgo', () => {
  const m = mensajeVeracidad({ sembrado: false, desde: null, commits: 0, excedido: false });
  assert.equal(m.hallazgo, null);
  assert.match(m.aviso, /sin pase registrado/);
});

test('mensajeVeracidad dentro del umbral avisa pero no es hallazgo', () => {
  const m = mensajeVeracidad({ sembrado: true, desde: '2026-08-02', commits: 5, excedido: false });
  assert.equal(m.hallazgo, null);
  assert.match(m.aviso, /5 commits/);
});

test('mensajeVeracidad excedido devuelve hallazgo y ningun aviso', () => {
  const m = mensajeVeracidad({ sembrado: true, desde: '2026-08-02', commits: 99, excedido: true });
  assert.equal(m.aviso, null);
  assert.match(m.hallazgo, /99 commits/);
  assert.match(m.hallazgo, /2026-08-02/);
});
```

- [ ] **Step 2: Ejecutar el test para confirmar que falla**

Run: `node --test scripts/wiki-veracidad.test.mjs`
Expected: FAIL — `Cannot find module .../scripts/wiki-veracidad.mjs`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `scripts/wiki-veracidad.mjs`:

```javascript
#!/usr/bin/env node
// Alarma de la operación `veracidad` de la wiki `memoria/`.
// Funciones puras: no imprimen ni salen con código. Las consume scripts/wiki-lint.mjs.
// Ver memoria/wiki-operacion.md.
import { execFileSync } from 'node:child_process';

// Más de este número de commits de código desde el último pase → hallazgo.
// Ajustable en una línea; si se cambia, deja constancia en memoria/log.md.
export const UMBRAL_COMMITS = 40;

// Código y contratos. `memoria/` queda fuera a propósito: la wiki no dispara su propia alarma.
export const RUTAS_CONTADAS = ['v2/src/', 'v2/scripts/', 'services/', 'scripts/', 'docs/', 'AGENTS.md'];

const LINEA_VERACIDAD = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+veracidad\s+·/;

export function ultimoPase(logTexto) {
  let ultima = null;
  for (const linea of logTexto.split('\n')) {
    const m = LINEA_VERACIDAD.exec(linea.trim());
    if (m) ultima = m[1];
  }
  return ultima;
}

function gitPorDefecto(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

export function contarCommits(desde, ejecutor = gitPorDefecto) {
  const args = ['log', `--since=${desde}`, '--pretty=%H', '--', ...RUTAS_CONTADAS];
  return ejecutor(args).split('\n').filter((l) => l.trim()).length;
}

export function estadoVeracidad(logTexto, ejecutor = gitPorDefecto) {
  const desde = ultimoPase(logTexto);
  if (!desde) return { sembrado: false, desde: null, commits: 0, excedido: false };
  const commits = contarCommits(desde, ejecutor);
  return { sembrado: true, desde, commits, excedido: commits > UMBRAL_COMMITS };
}

export function mensajeVeracidad(estado) {
  if (!estado.sembrado) {
    return {
      hallazgo: null,
      aviso: 'Veracidad: sin pase registrado todavía. El primer pase siembra la línea '
        + '`veracidad` en memoria/log.md; hasta entonces esta comprobación no falla.',
    };
  }
  if (!estado.excedido) {
    return {
      hallazgo: null,
      aviso: `Veracidad: ${estado.commits} commits de código desde el pase del ${estado.desde} `
        + `(umbral ${UMBRAL_COMMITS}).`,
    };
  }
  return {
    hallazgo: `${estado.commits} commits de código desde el último pase del ${estado.desde}, `
      + `por encima del umbral de ${UMBRAL_COMMITS}. Toca un pase de veracidad: `
      + 'verifica contra el repositorio las páginas de las áreas que cambiaron '
      + '(ver memoria/wiki-operacion.md).',
    aviso: null,
  };
}
```

- [ ] **Step 4: Ejecutar el test para confirmar que pasa**

Run: `node --test scripts/wiki-veracidad.test.mjs`
Expected: PASS — `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/wiki-veracidad.mjs scripts/wiki-veracidad.test.mjs
git commit -m "feat(wiki): alarma de veracidad medida en commits de codigo"
```

---

### Task 4: `scripts/wiki-lint.mjs` y `npm run test:wiki`

**Files:**
- Create: `scripts/wiki-lint.mjs`
- Modify: `v2/package.json` (añadir el script `test:wiki`)

**Interfaces:**
- Consumes: `.obsidian/app.json` → `userIgnoreFilters` (Task 1); `memoria/index.md`, `memoria/log.md`, `memoria/paginas.base` (Task 2); `estadoVeracidad` y `mensajeVeracidad` de `scripts/wiki-veracidad.mjs` (Task 3).
- Produces: ejecutable `node scripts/wiki-lint.mjs` desde la raíz. Sale `0` sin hallazgos, `1` con hallazgos, e imprime una línea `CATEGORIA ruta: detalle` por hallazgo. Las tareas 5 a 9 lo ejecutan como comprobación.

- [ ] **Step 1: Escribir `scripts/wiki-lint.mjs`**

```javascript
#!/usr/bin/env node
// Operación `lint` de la wiki `memoria/` (patrón LLM Wiki).
// Comprueba la FORMA y reporta; nunca corrige. Ver memoria/wiki-operacion.md.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadoVeracidad, mensajeVeracidad } from './wiki-veracidad.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIKI = join(RAIZ, 'memoria');

const AREAS = new Set(['gantt', 'importacion', 'scheduling', 'datos', 'ui', 'auth',
  'reportes', 'qa', 'docker', 'deploy', 'proceso', 'arquitectura']);
const TIPOS = new Set(['mapa', 'decision', 'concepto', 'trampa', 'referencia', 'modulo', 'flujo']);
const ESTADOS = new Set(['vigente', 'derogada']);

function listarMd(dir) {
  const salida = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) salida.push(...listarMd(p));
    else if (extname(e.name) === '.md') salida.push(p);
  }
  return salida;
}

// Índice del vault entero (la raíz del repo), aplicando los mismos filtros que Obsidian.
const filtros = JSON.parse(readFileSync(join(RAIZ, '.obsidian/app.json'), 'utf8')).userIgnoreFilters;
const ignorado = (rel) => filtros.some((f) => rel === f.replace(/\/$/, '') || rel.startsWith(f))
  || rel.startsWith('.git/');

const vault = [];
(function recorrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(RAIZ, p);
    if (ignorado(rel + (e.isDirectory() ? '/' : ''))) continue;
    if (e.isDirectory()) recorrer(p);
    else if (extname(e.name) === '.md' || extname(e.name) === '.base') vault.push(rel);
  }
})(RAIZ);

const porRuta = new Set(vault.map((f) => f.replace(/\.(md|base)$/, '')));
const porNombre = new Map();
for (const f of vault) {
  const corto = basename(f, extname(f));
  if (!porNombre.has(corto)) porNombre.set(corto, []);
  porNombre.get(corto).push(f);
}

const hallazgos = [];
const anota = (cat, archivo, detalle) => hallazgos.push(`${cat} ${archivo}: ${detalle}`);

const paginas = listarMd(WIKI);
const indice = readFileSync(join(WIKI, 'index.md'), 'utf8');

// Tipos cubiertos por alguna vista de paginas.base: esas páginas no necesitan enlace desde index.md.
const tiposCubiertos = new Set();
const rutaBase = join(WIKI, 'paginas.base');
if (existsSync(rutaBase)) {
  const base = readFileSync(rutaBase, 'utf8');
  for (const m of base.matchAll(/note\.tipo\s*==\s*"([^"]+)"/g)) tiposCubiertos.add(m[1]);
}

for (const p of paginas) {
  const rel = relative(RAIZ, p);
  const texto = readFileSync(p, 'utf8');
  const fm = texto.match(/^---\n([\s\S]*?)\n---/)?.[1];

  if (!fm) { anota('FRONTMATTER', rel, 'sin bloque de frontmatter'); continue; }

  const campo = (k) => fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1]?.trim();
  for (const k of ['tipo', 'estado', 'fecha', 'fuente', 'resumen']) {
    if (!campo(k)) anota('FRONTMATTER', rel, `falta o está vacío: ${k}`);
  }
  if (fm.match(/^areas:/m) === null) anota('FRONTMATTER', rel, 'falta: areas');
  if (campo('tipo') && !TIPOS.has(campo('tipo'))) anota('FRONTMATTER', rel, `tipo desconocido: ${campo('tipo')}`);
  if (campo('estado') && !ESTADOS.has(campo('estado'))) anota('FRONTMATTER', rel, `estado desconocido: ${campo('estado')}`);
  if (campo('fecha') && !/^\d{4}-\d{2}-\d{2}$/.test(campo('fecha'))) anota('FRONTMATTER', rel, `fecha no ISO: ${campo('fecha')}`);

  // `areas` admite forma inline (`[a, b]`) y forma de bloque (lista con guiones).
  let areas = [];
  const areasInline = fm.match(/^areas:\s*\[(.*)\]$/m)?.[1];
  if (areasInline !== undefined) {
    areas = areasInline.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    const areasBloque = fm.match(/^areas:\s*\n((?:^\s*-\s*.+\n?)+)/m)?.[1];
    if (areasBloque) {
      areas = [...areasBloque.matchAll(/^\s*-\s*(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
    }
  }
  for (const a of areas) if (!AREAS.has(a)) anota('AREA', rel, `fuera de la lista cerrada: ${a}`);

  // Una nota, un hecho: más de tres hechos numerados delata una nota que debería partirse.
  const numerados = (texto.match(/^(?:\d+\.|\*\*\d+\.)\s/gm) ?? []).length;
  if (numerados > 3) anota('MULTIHECHO', rel, `${numerados} hechos numerados; parte la nota`);

  // Enlaces. Se ignora lo que va dentro de bloques y spans de código.
  const limpio = texto.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of limpio.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    const destino = m[1].trim().replace(/\.(md|base)$/, '');
    if (porRuta.has(destino)) continue;
    const cand = porNombre.get(basename(destino));
    if (!cand) anota('ENLACE', rel, `roto: [[${destino}]]`);
    else if (cand.length > 1) anota('ENLACE', rel, `ambiguo: [[${destino}]] → ${cand.join(', ')}`);
  }

  // Toda página debe ser alcanzable desde el índice o desde una vista de la base.
  const nombre = basename(p, '.md');
  const enlazadaEnIndice = new RegExp(`\\[\\[${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\]\\]|[|#])`).test(indice);
  if (!['index', 'log'].includes(nombre)
      && !enlazadaEnIndice
      && !tiposCubiertos.has(campo('tipo'))) {
    anota('INDICE', rel, 'no aparece en index.md y ninguna vista de paginas.base la lista');
  }
}

// Edad del último pase de veracidad, medida en commits de código (no en días).
const veracidad = mensajeVeracidad(estadoVeracidad(readFileSync(join(WIKI, 'log.md'), 'utf8')));
if (veracidad.hallazgo) anota('VERACIDAD', 'memoria/log.md', veracidad.hallazgo);
if (veracidad.aviso) console.log(`${veracidad.aviso}\n`);

if (hallazgos.length) {
  console.log(hallazgos.join('\n'));
  console.log(`\n${hallazgos.length} hallazgos en ${paginas.length} páginas.`);
  process.exit(1);
}
console.log(`Sin hallazgos. ${paginas.length} páginas revisadas.`);
```

- [ ] **Step 2: Ejecutar el lint contra la wiki actual**

Run: `node scripts/wiki-lint.mjs`
Expected: el aviso `Veracidad: sin pase registrado todavía…`, y luego hallazgos `ENLACE … roto` para `[[arquitectura]]`, `[[importacion]]`, `[[scheduling]]`, `[[gantt-y-ui]]`, `[[datos-y-persistencia]]`, `[[qa-y-entorno]]` y `[[estado]]` — las siete páginas que aún no existen (Tasks 5 y 8). Salida con código `1`.

Esto es correcto y esperado: demuestra que el lint detecta enlaces rotos de verdad. **No lo arregles aquí.**

- [ ] **Step 3: Comprobar que el lint también aprueba lo que está bien**

Run:
```bash
node scripts/wiki-lint.mjs 2>&1 | grep -c "FRONTMATTER\|AREA\|MULTIHECHO\|INDICE"
```
Expected: `0` — es decir, ningún hallazgo que no sea de enlace. Si sale distinto de `0`, hay frontmatter mal escrito en Task 2; arréglalo antes de seguir.

- [ ] **Step 4: Añadir el script a `v2/package.json`**

En el objeto `"scripts"`, junto a `"test": "jest"`, añadir:

```json
    "test:wiki": "node ../scripts/wiki-lint.mjs",
    "test:wiki:unit": "node --test ../scripts/wiki-veracidad.test.mjs",
```

- [ ] **Step 5: Verificar que el script npm funciona desde `v2/`**

Run: `cd v2 && npm run test:wiki:unit && cd ..`
Expected: `# pass 11`, `# fail 0`. (`test:wiki` seguirá en rojo hasta la Task 8; se comprueba en verde allí.)

- [ ] **Step 6: Commit**

```bash
git add scripts/wiki-lint.mjs v2/package.json
git commit -m "feat(wiki): lint de forma de la wiki y scripts npm"
```

---

### Task 5: Mapas por área

Seis mapas que cubren las doce áreas. Cada mapa dice **qué documentos mandan** en su área y **qué trampas hay puestas** — es lo primero que se lee antes de tocar el área.

**Files:**
- Create: `memoria/mapas/arquitectura.md`
- Create: `memoria/mapas/importacion.md`
- Create: `memoria/mapas/scheduling.md`
- Create: `memoria/mapas/gantt-y-ui.md`
- Create: `memoria/mapas/datos-y-persistencia.md`
- Create: `memoria/mapas/qa-y-entorno.md`

**Interfaces:**
- Consumes: `memoria/index.md` (Task 2) ya los enlaza por esos seis nombres exactos; no los renombres.
- Produces: seis páginas `tipo: mapa`. Las Tasks 6 y 7 enlazan **desde** estos mapas hacia las decisiones, trampas, conceptos y módulos que creen.

- [ ] **Step 1: Leer las fuentes antes de escribir**

Lee, en este orden, y toma notas de qué manda en cada área:

```bash
cat AGENTS.md v2/AGENTS.md README.md SCAFFOLDING.md ROADMAP.md
ls v2/src/lib v2/src/components v2/src/app services/mpp-parser
cat docs/ms-project-calculated-fields.md docs/deploy-production-hetzner.md
```

- [ ] **Step 2: Escribir los seis mapas**

Todos con este frontmatter, cambiando `areas` y `resumen`:

```yaml
---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [arquitectura, docker]
fuente: AGENTS.md
resumen: "Qué documentos mandan en arquitectura y qué trampas hay puestas"
---
```

Áreas por mapa (cada una de las doce aparece al menos una vez):

| Mapa | `areas` |
|---|---|
| `arquitectura.md` | `[arquitectura, docker]` |
| `importacion.md` | `[importacion, datos]` |
| `scheduling.md` | `[scheduling]` |
| `gantt-y-ui.md` | `[gantt, ui, reportes]` |
| `datos-y-persistencia.md` | `[datos, auth]` |
| `qa-y-entorno.md` | `[qa, docker, deploy, proceso]` |

Cada mapa lleva tres secciones, en este orden:

1. **Qué manda** — enlaces a las fuentes autoritativas del área, con wikilink de ruta:
   `[[AGENTS]]`, `[[v2/AGENTS|v2/AGENTS]]`, `[[docs/ms-project-calculated-fields|campos calculados]]`, etc.
2. **Dónde vive en el código** — rutas exactas con una línea de qué hace cada una. Por ejemplo,
   en `scheduling.md`: `v2/src/lib/scheduling/` (motor de calendario y CPM),
   `v2/src/lib/matrix/` (programación matricial), `v2/src/lib/state/ProjectContext.tsx`
   (estado editable e historial).
3. **Trampas y decisiones del área** — vacío por ahora, con el texto literal
   `Se llena en la pasada de ingest.` La Task 6 lo reemplaza por los enlaces reales.

**Regla dura:** los mapas describen el repo tal como está hoy, verificado leyendo el código en el Step 1. No copies afirmaciones de `lps-aia` ni inventes rutas. Si no verificaste algo, no lo escribas.

- [ ] **Step 3: Ejecutar el lint**

Run: `node scripts/wiki-lint.mjs`
Expected: desaparecen los seis hallazgos `ENLACE … roto` de los mapas. Queda solo `roto: [[estado]]` (lo crea la Task 8). Ningún hallazgo `FRONTMATTER`, `AREA` ni `INDICE`.

- [ ] **Step 4: Commit**

```bash
git add memoria/mapas/
git commit -m "docs(memoria): seis mapas de area con lo que manda y donde vive"
```

---

### Task 6: Pasada de ingest — decisiones, trampas y conceptos

El corazón del trabajo. Aquí se desentierra el porqué que hoy está sepultado en `goals/`.

**Files:**
- Create: `memoria/decisiones/*.md` (varias)
- Create: `memoria/trampas/*.md` (varias)
- Create: `memoria/conceptos/*.md` (varias)
- Create: `memoria/referencias/*.md` (varias)
- Modify: `memoria/mapas/*.md` (rellenar la sección «Trampas y decisiones del área»)
- Modify: `memoria/log.md` (anexar la línea de ingest)

**Interfaces:**
- Consumes: los seis mapas de Task 5; el catálogo `memoria/paginas.base` de Task 2 (cubre los tipos `decision`, `trampa`, `concepto` y `referencia`, así que **estas páginas no necesitan enlace desde `index.md`** — el lint no las marcará como huérfanas).
- Produces: el cuerpo de la wiki. La Task 9 lo verifica en el pase de veracidad.

- [ ] **Step 1: Leer las fuentes, una por una**

```bash
cat goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md
for d in goals/*/; do echo "===== $d"; cat "$d"goal.md; done
for f in goals/*/facts.md goals/*/cierre.md; do echo "===== $f"; cat "$f"; done
cat goals/top5-ui-ux-business-improvements-gantt/completion-audit-2026-07-03.md
cat goals/correcciones-gantt-matriz-evidencia/evidence-audit.md
cat docs/mpp-calculation-field-replication-plan.md
cat CHANGELOG.md
```

- [ ] **Step 2: Extraer y clasificar**

Para cada hallazgo, decide el tipo:

- **`decision`** — se eligió X en vez de Y y la elección sigue vigente. Ej.: predecesoras y sucesoras usan **Row ID**, no Unique ID.
- **`trampa`** — algo que ya costó tiempo y volverá a costarlo. Ej.: una evidencia de navegador que parece correcta pero mide el árbol equivocado; Docker sirviendo una imagen vieja y dando por buena una verificación.
- **`concepto`** — vocabulario del dominio que hay que entender antes de tocar el área. Ej.: la distinción `Unique ID` ↔ `Row ID`; qué es `matrixSource`; qué garantiza la simetría Matriz ↔ Gantt.
- **`referencia`** — puntero a una fuente externa o a un documento del repo que se consulta pero no se resume.

**Criterio para no escribir una nota:** si el hecho ya está dicho, completo y bien, en `AGENTS.md`, **no lo dupliques** — enlázalo desde el mapa del área. La wiki añade el porqué y el contexto, no reescribe el contrato.

- [ ] **Step 3: Escribir cada nota**

Una por archivo, nombre en kebab-case sin tildes, en la carpeta de su tipo. Plantilla para `decision` y `trampa`:

```markdown
---
tipo: decision
estado: vigente
fecha: 2026-07-15
areas: [scheduling]
fuente: goals/predecessors-use-row-id/facts.md
resumen: "Predecesoras y sucesoras se muestran y editan por Row ID, nunca por Unique ID"
---
El contrato visible y editable de predecesoras/sucesoras es el `Row ID` consecutivo de Microsoft
Project. La importación puede recibir relaciones por `Unique ID`, y la traducción entre ambos
ocurre en los límites (`v2/src/lib/import/mpp-project.ts` al entrar, la capa de presentación al
salir).

**Why:** el usuario lee y edita el cronograma con los mismos números que ve en MS Project. Un
`Unique ID` expuesto en la columna de predecesoras es indistinguible de un número de fila y
produce dependencias silenciosamente equivocadas.

**How to apply:** al tocar importación, edición, guardado o recálculo, prueba el ciclo completo —
la traducción se rompe en un solo extremo y el otro la enmascara. Relacionado:
[[identidad-uid-vs-row-id]].
```

Para `concepto` y `referencia`, el mismo frontmatter sin las líneas **Why:**/**How to apply:**.

**Regla dura:** cada afirmación se verifica contra el código o contra la fuente citada en `fuente:`. Si no pudiste verificarla, no la escribas. Una wiki con afirmaciones sin verificar es peor que no tener wiki.

**Regla de tamaño:** una nota, un hecho. El lint marca `MULTIHECHO` por encima de tres hechos numerados — si salta, parte la nota en dos.

- [ ] **Step 4: Enlazar desde los mapas**

En cada uno de los seis mapas, reemplazar el texto `Se llena en la pasada de ingest.` por los wikilinks a las notas de esa área, agrupados en **Decisiones**, **Trampas** y **Conceptos**.

- [ ] **Step 5: Anexar la línea de ingest a `memoria/log.md`**

```markdown
- 2026-08-05 · ingest · pasada inicial sobre goals/, docs/ y los .md de la raiz: N decisiones, N trampas, N conceptos
```

(Sustituye cada `N` por el conteo real.)

- [ ] **Step 6: Ejecutar el lint**

Run: `node scripts/wiki-lint.mjs`
Expected: sin hallazgos `FRONTMATTER`, `AREA`, `MULTIHECHO` ni `INDICE`. Sigue solo `roto: [[estado]]`, más cualquier enlace a una nota que aún no escribiste — si aparece uno, o escribes la nota o quitas el enlace.

- [ ] **Step 7: Commit**

```bash
git add memoria/
git commit -m "docs(memoria): pasada de ingest sobre goals, docs y contratos de la raiz"
```

---

### Task 7: Arquitectura por módulo

**Files:**
- Create: `memoria/arquitectura/*.md` (uno por módulo real)
- Modify: `memoria/mapas/arquitectura.md` (enlazar los módulos)

**Interfaces:**
- Consumes: `memoria/mapas/arquitectura.md` (Task 5).
- Produces: páginas `tipo: modulo`, cubiertas por la vista «Módulos» de `paginas.base` — no necesitan enlace desde `index.md`.

- [ ] **Step 1: Inventariar los módulos reales**

```bash
ls v2/src/lib v2/src/components v2/src/app/api v2/src/app/actions
ls services/mpp-parser
cat docker-compose.yml
```

Un módulo = una unidad con responsabilidad propia y límite claro. Candidatos esperados, a confirmar contra lo que salga: `mpp-parser` (servicio FastAPI), `importacion`, `scheduling`, `matriz`, `gantt`, `persistencia`, `auth`, `reportes`.

- [ ] **Step 2: Escribir una página por módulo**

```markdown
---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [scheduling]
fuente: v2/src/lib/scheduling/
resumen: "Motor de calendario y CPM: qué entra, qué sale y quién lo llama"
---
# Scheduling

**Qué hace.** Una o dos frases.

**Dónde vive.** Rutas exactas de los archivos que lo componen.

**Qué consume.** Módulos y datos de los que depende.

**Quién lo consume.** Qué lo llama.

**Invariantes.** Lo que no puede romperse, con enlace a la decisión o el concepto que lo explica.
```

**Aviso explícito, que va escrito en `memoria/mapas/arquitectura.md`:** estas páginas están escritas a mano y **no hay generador** que las sincronice con el código. Se desactualizan en silencio. Lo único que las mantiene honestas es el pase de veracidad.

- [ ] **Step 3: Enlazar los módulos desde `memoria/mapas/arquitectura.md`**

Añadir una sección **Módulos** con un wikilink por página creada.

- [ ] **Step 4: Ejecutar el lint**

Run: `node scripts/wiki-lint.mjs`
Expected: sin hallazgos nuevos. Sigue solo `roto: [[estado]]`.

- [ ] **Step 5: Commit**

```bash
git add memoria/
git commit -m "docs(memoria): arquitectura por modulo escrita a mano"
```

---

### Task 8: Tejer `goals/` en el grafo

La única escritura sobre las fuentes. Sin ella, los 35 archivos de `goals/` quedan como islas.

**Files:**
- Create: `memoria/estado.md`
- Modify: `goals/cierre-auditoria-goals/goal.md`
- Modify: `goals/correcciones-gantt-matriz-evidencia/goal.md`
- Modify: `goals/optimize-gantt-recalculation/goal.md`
- Modify: `goals/paridad-visor-10/goal.md`
- Modify: `goals/predecessors-use-row-id/goal.md`
- Modify: `goals/production-e2e-gantt-benchmarks/goal.md`
- Modify: `goals/server-side-mpp-import/goal.md`
- Modify: `goals/top5-ui-ux-business-improvements-gantt/goal.md`

**Interfaces:**
- Consumes: `memoria/index.md` (Task 2) ya enlaza `[[estado|Estado de los goals]]`.
- Produces: `memoria/estado.md`, la página que cada `goal.md` enlaza de vuelta.

Son **ocho** carpetas de goal. `goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md` es un archivo suelto en la raíz de `goals/`, no una carpeta: se enlaza desde `estado.md`, no lleva sección al pie.

- [ ] **Step 1: Determinar el estado real de cada goal**

Un goal con `cierre.md` está cerrado; sin él, hay que mirar. No lo supongas:

```bash
for d in goals/*/; do echo "===== $d"; ls "$d" | tr '\n' ' '; echo; done
cat goals/cierre-auditoria-goals/cierre.md
cat goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md
git log --oneline -20
```

- [ ] **Step 2: Escribir `memoria/estado.md`**

```markdown
---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [proceso]
fuente: goals/
resumen: "Qué goal está abierto, cerrado o absorbido, y qué dejó cada uno"
---
# Estado de los goals

Ocho carpetas en `goals/`, más la auditoría suelta
[[goals/AUDITORIA-FACT-BY-FACT-2026-08-04|fact-by-fact del 2026-08-04]].

| Goal | Estado | Qué dejó |
|---|---|---|
| [[goals/predecessors-use-row-id/goal\|predecessors-use-row-id]] | cerrado | … |

(una fila por goal, con el estado verificado en el Step 1)
```

**Ojo con la sintaxis:** dentro de una celda de tabla, el `|` del alias del wikilink hay que escaparlo como `\|` o rompe la tabla.

- [ ] **Step 3: Añadir la sección al pie de los ocho `goal.md`**

Al **final** de cada archivo, sin tocar una sola línea de lo que ya hay. Ejemplo para `goals/predecessors-use-row-id/goal.md`, listando sus hermanos reales (`cierre.md`, `facts.md`, `plan.md`):

```markdown

## Archivos de este goal

- [[goals/predecessors-use-row-id/facts|facts]] — la comprensión compartida
- [[goals/predecessors-use-row-id/plan|plan]] — el plan de ejecución aprobado
- [[goals/predecessors-use-row-id/cierre|cierre]] — el cierre verificado

Estado de todos los goals: [[estado|Estado de los goals]].
```

Los hermanos varían por carpeta — usa la salida del Step 1, no esta lista. Los `.json` y `.png` no se enlazan.

- [ ] **Step 4: Ejecutar el lint y verificar que sale en VERDE**

Run: `node scripts/wiki-lint.mjs`
Expected: `Sin hallazgos. N páginas revisadas.` y código de salida `0`. Es el primer verde del proyecto.

Si sale `roto: [[estado]]`, el nombre del archivo no es `memoria/estado.md`. Si sale `ambiguo`, hay dos archivos con el mismo nombre corto en el vault: usa la ruta completa en el enlace.

- [ ] **Step 5: Verificar que no se tocó nada más que el pie de los goals**

Run: `git diff --stat goals/`
Expected: ocho archivos, todos con inserciones y **cero borrados** (`0 deletions`). Si aparece un borrado, se modificó contenido existente — revierte y rehaz añadiendo solo al final.

- [ ] **Step 6: Commit**

```bash
git add memoria/estado.md goals/
git commit -m "docs(goals): tejer los goals en el grafo con estado y navegacion al pie"
```

---

### Task 9: Contrato en `AGENTS.md` y cierre

**Files:**
- Modify: `AGENTS.md` (nueva sección)
- Modify: `memoria/log.md` (sembrar la línea de veracidad)

**Interfaces:**
- Consumes: todo lo anterior. `memoria/wiki-operacion.md` (Task 2) y `memoria/index.md` enlazan `[[AGENTS]]`, así que el enlace de vuelta cierra el grafo.
- Produces: nada que consuma otra tarea. Es el cierre.

- [ ] **Step 1: Añadir la sección a `AGENTS.md`**

Va **después** de «Autoridad y alcance» y **antes** de «Runtime y mapa de responsabilidades», porque es una regla de autoridad, no de runtime.

```markdown
## Memoria del proyecto

- `memoria/` es la wiki del proyecto: el porqué de las decisiones, las trampas que ya costaron tiempo y un mapa por área. La escribe el asistente; no se edita a mano. El esquema completo está en `memoria/wiki-operacion.md`.
- Precedencia: **código > este archivo > `memoria/`**. Ninguna nota de la wiki es contrato. Si una nota contradice al repo, gana el repo: corrige la nota y márcala `estado: derogada` en vez de borrarla.
- Antes de tocar un área, lee su mapa en `memoria/mapas/`: dice qué documentos mandan y qué trampas hay puestas. Empieza siempre por `memoria/index.md`.
- Al cerrar una tarea, haz **ingest**: escribe o actualiza la página, actualiza `memoria/index.md`, revisa las páginas relacionadas y anexa una línea a `memoria/log.md`.
- Comprueba la forma con `node scripts/wiki-lint.mjs` (o `npm run test:wiki` desde `v2/`). Reporta, nunca corrige: un verde significa que la forma está bien, no que la wiki diga la verdad. Eso lo comprueba el pase de **veracidad**, y el lint sale en rojo pasados 40 commits de código sin uno.
```

- [ ] **Step 2: Sembrar la línea de veracidad en `memoria/log.md`**

Es legítima: la wiki se acaba de escribir verificando cada afirmación contra el código, así que hoy la fecha del último pase es hoy.

```markdown
- 2026-08-05 · veracidad · areas: todas · pase inicial, escrita verificando contra el codigo
```

- [ ] **Step 3: Lint en verde, con la veracidad ya sembrada**

Run: `node scripts/wiki-lint.mjs`
Expected: primero la línea `Veracidad: 0 commits de código desde el pase del 2026-08-05 (umbral 40).`, y después `Sin hallazgos. N páginas revisadas.` Código de salida `0`.

- [ ] **Step 4: Tests unitarios en verde**

Run: `node --test scripts/wiki-veracidad.test.mjs`
Expected: `# pass 11`, `# fail 0`.

- [ ] **Step 5: Verificar el vault en Obsidian**

Abre la raíz del repo como vault en Obsidian y comprueba, mirando:

1. El explorador **no** muestra `node_modules`, `.next`, `test-results` ni `.omo`.
2. `memoria/index.md` se ve con la tabla de mapas y el catálogo `paginas.base` embebido, con sus seis pestañas.
3. En la vista de grafo (Cmd+G), `memoria/` está conectada y los `goals/` cuelgan de sus `goal.md` — no hay un archipiélago de islas.

Si la base sale vacía, revisa que `bases` esté en `true` en `.obsidian/core-plugins.json` y que la versión de Obsidian sea 1.9 o superior.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md memoria/log.md
git commit -m "docs(agents): declarar memoria/ y su regla de precedencia"
```

---

## Condición de hecho

Copiada de la spec. Todo se comprueba con salida real, no de memoria.

1. Obsidian abre la raíz del repo y el explorador muestra solo archivos relevantes.
2. `memoria/` existe con `index.md`, `wiki-operacion.md`, `log.md`, `estado.md`, `paginas.base` y las carpetas por tipo.
3. La pasada de ingest dejó escritas las decisiones, trampas y conceptos extraídos de las fuentes, y `log.md` la registra.
4. Los 8 `goals/<slug>/goal.md` tienen su sección «Archivos de este goal».
5. `node scripts/wiki-lint.mjs` sale en verde, con salida real pegada en el cierre.
6. `AGENTS.md` tiene la sección que resume el esquema.
7. El grafo de Obsidian no muestra `memoria/` como islas sueltas.
