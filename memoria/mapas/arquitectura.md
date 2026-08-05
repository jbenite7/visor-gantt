---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [arquitectura, docker]
fuente: AGENTS.md
resumen: "Qué documentos mandan en arquitectura y qué trampas hay puestas"
---
# Mapa de arquitectura

## Qué manda

- [[AGENTS]] — contrato raíz: `v2/` es la aplicación activa, no inventar rutas legacy; mapa de
  responsabilidades por servicio Docker (`frontend`, `mpp-parser`, `db`, `pgadmin`).
- [[v2/AGENTS|v2/AGENTS]] — override técnico dentro de `v2/`: Next.js 16 App Router, React 19,
  TypeScript estricto, Tailwind CSS 4, PostgreSQL vía `pg`; límites Server/Client Components.
- [[SCAFFOLDING]] — estructura de directorios y los dos ADR vigentes (Next.js 16 como frontend,
  microservicio Python/MPXJ para `.mpp`).
- [[README]] — cómo se levanta el stack completo con `docker compose up --build`.

## Dónde vive en el código

- `v2/src/app/` — rutas, layouts, Server Actions (`actions/`) y Route Handlers (`api/`).
- `v2/src/components/` — UI: `gantt/`, `budget/`, `charts/`, `network/`, `reports/`,
  `resources/`, `theme/`, `ui/`, `upload/`, `views/`.
- `v2/src/lib/` — dominio e integración: `import/`, `scheduling/`, `matrix/`, `state/`, `gantt/`,
  `mpp/`, `parser/`, `auth/`, `api/`, `date/`, `budget/`, `integrations/`, `layout/`, `db.ts`.
- `v2/scripts/init-schema.sql` — bootstrap del schema PostgreSQL para volúmenes nuevos.
- `services/mpp-parser/` — microservicio FastAPI + MPXJ que convierte `.mpp` binario a JSON
  (`main.py`, `libs/`, `utils/`).
- `docker-compose.yml` — orquesta `frontend`, `mpp-parser`, `db` y `pgadmin` opcional.

## Módulos

Una página por módulo real, en `memoria/arquitectura/`: [[mpp-parser]],
[[memoria/arquitectura/importacion-modulo|importacion]], [[mpp-calculo]],
[[memoria/arquitectura/scheduling-modulo|scheduling]], [[matriz]], [[gantt]], [[reportes]],
[[persistencia]], [[auth]], [[integraciones]].

**Están escritas a mano.** No hay generador que las sincronice con el código: se desactualizan en
silencio. Lo único que las mantiene honestas es el pase de veracidad.

## Trampas y decisiones del área

**Decisiones**
- Aún no hay decisiones registradas para esta área.

**Trampas**
- Aún no hay trampas registradas para esta área.

**Conceptos**
- Aún no hay conceptos registrados para esta área.
