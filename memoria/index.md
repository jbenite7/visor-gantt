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
| [[esquema-estrategico]] | Esquema para usuario final: problema, roles, metodología (CPM · matriz/LOB · Last Planner) y recorrido |
| [[esquema-app]] | Esquema técnico global: servicios, capas, módulos y catálogo de flujos de trabajo |
| [[arquitectura]] | Stack dockerizado, `v2/src/`, `services/mpp-parser/`, límites entre servicios |
| [[importacion]] | `.mpp` y `.xml` → modelo de la aplicación; procedencia de los datos originales |
| [[scheduling]] | CPM, calendarios, dependencias FS/SS/FF/SF, holguras, identidad UID ↔ Row ID |
| [[gantt-y-ui]] | Vista Gantt, matriz, línea de balance, componentes y estado editable |
| [[datos-y-persistencia]] | PostgreSQL, `projects.project_data` (JSONB), guardar → recargar → reabrir |
| [[qa-y-entorno]] | Jest, Playwright, Docker Compose, despliegue |

Además: **[[estado|Estado de los goals]]** (qué goal está abierto, cerrado o absorbido) y
**[[log]]** (bitácora cronológica de lo que se ha ingerido y verificado).

## Flujos de trabajo

Una página por flujo end-to-end de la app, en `memoria/flujos/`: [[importacion-mpp]],
[[autenticacion-y-sesion]], [[edicion-y-recalculo]], [[sincronizacion-matriz-gantt]],
[[analisis-y-reportes]], [[guardar-y-reabrir]], [[integracion-last-planner]]. El punto de entrada
es [[esquema-app]].

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
