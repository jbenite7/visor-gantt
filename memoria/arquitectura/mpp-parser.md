---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [importacion, docker]
fuente: services/mpp-parser/, docker-compose.yml
resumen: "Microservicio FastAPI que convierte un .mpp binario a JSON usando MPXJ"
---
# mpp-parser

**Qué hace.** Recibe un archivo `.mpp` por HTTP y devuelve su contenido (tareas, recursos,
calendarios, campos custom) como JSON, usando la librería Java MPXJ vía `libs/`.

**Dónde vive.** `services/mpp-parser/main.py` (rutas FastAPI, incluida `/api/health`),
`services/mpp-parser/libs/`, `services/mpp-parser/utils/`, `services/mpp-parser/openapi.yaml`.
Se construye como contenedor propio (`services/mpp-parser/Dockerfile`) y se orquesta en
`docker-compose.yml` bajo el servicio `mpp-parser` (puerto 8000, healthcheck sobre `/api/health`).

**Qué consume.** El archivo `.mpp` binario que le llega en la petición; internamente invoca MPXJ
(Java) a través de los wrappers de `libs/`.

**Quién lo consume.** El Route Handler `v2/src/app/api/parse-mpp/route.ts` del frontend, que le
reenvía el archivo usando `MPP_PARSER_URL` (o `NEXT_PUBLIC_MPP_PARSER_URL` desde el navegador vía
proxy). El `frontend` en `docker-compose.yml` declara `depends_on: mpp-parser: condition:
service_healthy`.

**Invariantes.** El servicio es la única pieza del stack que sabe leer el binario `.mpp`; el
frontend nunca lo parsea directamente. Debe levantar `service_healthy` antes de que `frontend`
reciba tráfico (lo fija el `healthcheck` de `docker-compose.yml`).
