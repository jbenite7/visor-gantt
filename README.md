# Visor MPP (visor-mpp)

Aplicación web para visualizar archivos de Microsoft Project (`.mpp`) desde un stack completamente dockerizado.

## Stack

- `frontend`: Next.js 16 + TypeScript
- `mpp-parser`: FastAPI + MPXJ para convertir `.mpp` a JSON
- `db`: PostgreSQL
- `pgadmin`: Administración opcional de la base de datos

## Inicio

```bash
docker compose up --build
```

## Acceso

- App: puerto `3000` publicado por Docker Compose
- Parser: `mpp-parser` en `/api/health`
- pgAdmin: puerto `5050` publicado por Docker Compose

## Variables

El stack usa nombres de servicio de Docker para la comunicación interna:

- `NEXT_PUBLIC_MPP_PARSER_URL=http://mpp-parser:8000`
- `DATABASE_URL=postgresql://visoruser:visorpass@db:5432/visormpp`

## Comandos útiles

```bash
docker compose run --rm frontend npm test
docker compose run --rm frontend npm run lint
docker compose run --rm frontend npm run build
docker compose down -v
```

## Notas

- El frontend no tiene flujo soportado fuera de Docker.
- El parser usa `MPXJ_TIMEOUT` y `LOG_LEVEL` dentro del contenedor.
- Los datos de PostgreSQL viven en el volumen `postgres_data`.
