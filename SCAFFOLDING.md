# Scaffolding & Arquitectura

## Estructura de Directorios

El proyecto sigue una estructura de monorepo con frontend Next.js y backend PHP.

```
/
├── backend/            # Lógica de Negocio (PHP 8.2+, DDD)
│   ├── src/            # Domain + Services + Controllers
│   ├── tests/          # Scripts de prueba PHP
│   ├── config/         # database.php, holidays.php
│   ├── sql/            # Esquemas PostgreSQL
│   └── uploads/        # Directorio temporal de subidas
├── v2/                 # Frontend Next.js 16 (TypeScript)
│   └── src/
│       ├── app/        # Routes (App Router)
│       ├── components/ # GanttChart, etc.
│       └── lib/        # parser/, scheduling/, db.ts
├── services/           # Microservicios (mpp-parser Python)
├── test_data/          # Fixtures XML y datos de prueba
├── docker/             # Configuración de contenedores
└── docs/               # Documentación
```

## Architectural Decision Records (ADR)

### 1. Frontend: Next.js 16 (TypeScript)

- **Contexto**: Se necesita una interfaz moderna, interactiva y consistente con el resto del stack.
- **Decisión**: Next.js 16 con App Router, TypeScript, y React Server Components, ejecutado dentro de Docker Compose.
- **Consecuencia**: Un único flujo de ejecución para desarrollo, pruebas y entrega, sin rutas de ejecución paralelas fuera de Docker.

### 2. Backend: PHP 8.2+ con DDD

- **Contexto**: El backend maneja parsing de .mpp, cálculos CPM, y persistencia.
- **Decisión**: PHP puro con arquitectura DDD (Domain-Driven Design).
- **Consecuencia**: Código mantenible, testable, y sin dependencias de frameworks pesados.

### 3. Microservicio MPP Parser

- **Contexto**: Los archivos .mpp son binarios complejos. Java (MPXJ) es el estándar para parsearlos.
- **Decisión**: Microservicio Python (FastAPI) que usa MPXJ vía subprocess y corre como servicio Docker.
- **Consecuencia**: Separación de responsabilidades, red interna estable por nombres de servicio, y despliegue homogéneo.
