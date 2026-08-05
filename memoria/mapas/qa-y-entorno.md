---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [qa, docker, deploy, proceso]
fuente: AGENTS.md
resumen: "Qué documentos mandan en QA, entorno, Docker y despliegue, y qué trampas hay puestas"
---
# Mapa de QA y entorno

## Qué manda

- [[AGENTS]] — verificación proporcional: primero tests enfocados del dominio tocado, después
  lint y build cuando aplique; cambios visuales o interactivos requieren navegador real y
  Playwright sobre la app servida. Docker Compose es la fuente de verdad del runtime integrado;
  si Docker sirve una imagen desactualizada hay que reconstruir/reiniciar antes de aceptar
  evidencia.
- [[v2/AGENTS|v2/AGENTS]] — desde `v2/`: `npm test -- --runInBand <rutas>` para Jest sobre
  archivos afectados, luego `npm run lint` y `npm run build` según riesgo; UI añade tests de
  componente y Playwright, verifica consola, red, hidratación y viewport.
- [[README]] — comandos de entorno dockerizado: `docker compose up --build`,
  `docker compose run --rm frontend npm test|lint|build`, `docker compose down -v`.
- [[docs/deploy-production-hetzner|despliegue a Hetzner]] — procedimiento manual por SSH: checkout
  vivo en `/tmp/visor-gantt-deploy` (no `/root/visor-gantt`), `git pull origin main`,
  `docker compose up -d --build frontend` (y `mpp-parser` si aplica), sin workflow de GitHub
  Actions.

## Dónde vive en el código

- `docker-compose.yml` — define `frontend`, `mpp-parser`, `db`, `pgadmin`.
- `services/mpp-parser/tests/` — pruebas del microservicio de parseo.
- Archivos `*.test.ts` / `*.test.tsx` junto a su módulo en `v2/src/lib/` y `v2/src/components/`
  (Jest, co-localizados, no en una carpeta `__tests__` global salvo `v2/src/lib/api/__tests__` y
  `v2/src/components/upload/__tests__`).
- `v2/src/lib/date/projectDate.ts` y su test — utilidades de fecha compartidas usadas en varias
  suites.
- `docs/deploy-production-hetzner.md` — único documento de proceso de despliegue.

## Trampas y decisiones del área

**Decisiones**
- [[conservacion-de-proyectos-e2e-por-runid]]
- [[playwright-chromium-unico-worker-permanente]]

**Trampas**
- [[fixture-mpp-no-portable-entre-maquinas]]
- [[e2e-borraba-los-proyectos-que-debia-conservar]]
- [[carrera-de-hidratacion-en-subida-e2e]]
- [[checkout-de-produccion-no-esta-en-root]]

**Conceptos**
- Aún no hay conceptos registrados para esta área.

**Referencias**
- [[auditoria-fact-by-fact-2026-08-04]]
- [[evidence-audit-correcciones-gantt-matriz]]
- [[runbook-deploy-produccion-hetzner]]
