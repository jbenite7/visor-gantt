# Scaffolding & Arquitectura

## Estructura de Directorios

El proyecto es una aplicación Next.js 16 (`v2/`, código activo) apoyada por un microservicio Python para el parseo binario de `.mpp` y PostgreSQL para persistencia. Todo corre bajo Docker Compose.

```
/
├── v2/                 # Aplicación ACTIVA — Next.js 16 (TypeScript, App Router)
│   ├── src/
│   │   ├── app/        # Routes, api/, globals.css (design system)
│   │   ├── components/ # gantt/GanttChart.tsx, matriz, UI
│   │   └── lib/        # parser/, scheduling/, matrix/, import/, auth/, db.ts
│   └── scripts/        # init-schema.sql
├── services/           # Microservicios (mpp-parser: Python FastAPI + MPXJ)
├── test_data/          # Fixtures XML, manual-de-marca-aia.json
├── docs/               # Documentación (despliegue Hetzner, campos MS Project)
└── docker-compose.yml  # Stack: frontend + mpp-parser + db + pgadmin
```

## Architectural Decision Records (ADR)

### 1. Frontend: Next.js 16 (TypeScript)

- **Contexto**: Se necesita una interfaz moderna, interactiva y consistente con el resto del stack.
- **Decisión**: Next.js 16 con App Router, TypeScript, y React Server Components, ejecutado dentro de Docker Compose.
- **Consecuencia**: Un único flujo de ejecución para desarrollo, pruebas y entrega, sin rutas de ejecución paralelas fuera de Docker.

### 2. Microservicio MPP Parser

- **Contexto**: Los archivos .mpp son binarios complejos. Java (MPXJ) es el estándar para parsearlos.
- **Decisión**: Microservicio Python (FastAPI) que usa MPXJ vía subprocess y corre como servicio Docker.
- **Consecuencia**: Separación de responsabilidades, red interna estable por nombres de servicio, y despliegue homogéneo.
