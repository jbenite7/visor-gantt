# Visor MPP (visor-mpp)

Visor web "Mobile First" diseñado para visualizar archivos de Microsoft Project (.mpp) de forma rápida y sencilla en el navegador.

## Descripción

Este proyecto permite a los usuarios subir archivos `.mpp`, procesarlos en el servidor y:

- **Visualización Gantt Avanzada**:
  - Zoom (Día/Semana/Mes) y Pantalla Completa.
  - Hitos en forma de diamante y barras de alto contraste.
  - **Análisis de Progreso**: Línea de fecha de corte y cálculo automático de desviación (Real vs Teórico).
- **Control de Versiones y Agrupación**: Gestión inteligente de versiones de cronogramas.
- Visualizar su contenido (Tareas, Cronograma, Recursos) en una interfaz moderna y adaptativa, sin necesidad de tener Microsoft Project instalado.

## Stack Tecnológico

- **Frontend**: Vanilla HTML5, CSS3 (Moderno), JavaScript (ES6+). Sin procesos de compilación complejos.
- **Backend**: PHP 8.2+ (Puro).
- **Infraestructura**: Docker (Dev), Compatible con Hosting Compartido (cPanel/SiteGround).

## Instalación y Uso (Desarrollo)

### Prerrequisitos

- Docker & Docker Compose
- O MAMP/XAMPP con PHP 8.2+

### Iniciar con Docker

```bash
docker-compose up -d
```

Acceder a: `http://localhost:8080`

### Iniciar con MAMP

1. Apuntar el document root de MAMP a la carpeta `frontend/public`.
2. Asegurar que PHP tiene permisos de escritura en `backend/uploads`.

## Despliegue (Producción/SiteGround)

1. Subir el contenido de `frontend/public` a la carpeta `public_html` de tu hosting.
2. Subir la carpeta `backend/src` a un nivel seguro (o protegerla con .htaccess si está dentro de public).
3. Configurar la versión de PHP a 8.2 o superior en el panel de control.

## Autenticación

El sistema actualmente es de acceso público (sin login). La autenticación se implementará en fases futuras si es requerido.

## Microservicio MPP

El proyecto incluye un microservicio en Python (FastAPI) que convierte archivos `.mpp` de Microsoft Project a JSON usando la librería Java MPXJ. Este servicio es independiente del backend PHP y corre por separado.

### Stack

- **Runtime**: Python 3.10+, Java 11+ (para MPXJ)
- **Framework**: FastAPI con Uvicorn
- **Librería externa**: [MPXJ](https://sourceforge.net/projects/mpxj/) (jar Java para leer .mpp)
- **Ubicación**: `services/mpp-parser/`

### Requisitos

- Python 3.10 o superior
- Java 11 o superior (`java` en PATH)
- MPXJ jar (descarga manual)

### Instalación

```bash
cd services/mpp-parser

# 1. Instalar dependencias Python
pip install -r requirements.txt

# 2. Descargar MPXJ
# Ve a https://sourceforge.net/projects/mpxj/
# Descarga mpxj.jar y colócalo en:
mkdir -p libs
# Copia mpxj.jar a services/mpp-parser/libs/
```

### Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MPXJ_JAR_PATH` | `libs/mpxj.jar` | Ruta al archivo mpxj.jar |
| `MPXJ_TIMEOUT` | `30` | Timeout (segundos) para la conversión Java |
| `NEXT_PUBLIC_MPP_PARSER_URL` | `http://localhost:8000` | URL base del servicio (para el frontend v2) |

### Ejecución

```bash
# Desde services/mpp-parser/
python main.py

# O con uvicorn directamente
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

El servicio corre en `http://localhost:8000`.

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Health check: reporta si MPXJ está disponible |
| `POST` | `/api/parse-mpp` | Sube un .mpp y devuelve JSON estructurado |

#### POST /api/parse-mpp

Recibe `multipart/form-data` con un campo `file` (`.mpp`). Devuelve:

```json
{
  "name": "Nombre del Proyecto",
  "startDate": "2026-01-01T00:00:00",
  "finishDate": "2026-12-31T00:00:00",
  "tasks": [
    {
      "UID": 1,
      "Name": "Tarea 1",
      "Start": "2026-01-01T00:00:00",
      "Finish": "2026-01-15T00:00:00",
      "Duration": "PT120H0M0S",
      "PercentComplete": 0,
      "Summary": false,
      "Milestone": false,
      "OutlineLevel": 1,
      "WBS": "1",
      "PredecessorLink": [],
      "predecessors": [],
      "successors": [],
      "duration": 15.0,
      "isSummary": false,
      "isMilestone": false
    }
  ],
  "resources": [],
  "calendar": { "weekDays": {}, "exceptions": [] },
  "availableColumns": ["Duration", "Finish", "ID", "Name", ...]
}
```

Errores posibles:

- `400` — Validación fallida (extensión incorrecta, archivo vacío)
- `422` — Archivo muy grande (>50MB) o demasiado pequeño
- `500` — Error de conversión MPXJ, timeout, o archivo corrupto

### Integración con Frontend v2

El frontend Next.js (v2) se conecta al microservicio automáticamente. Para indicar la URL del servicio, configura la variable de entorno en `v2/.env.local`:

```
NEXT_PUBLIC_MPP_PARSER_URL=http://localhost:8000
```

La URL por defecto es `http://localhost:8000`.

### Troubleshooting

**"MPXJ jar not found"**
Descarga mpxj.jar desde SourceForge y colócalo en `services/mpp-parser/libs/`. O configura la variable `MPXJ_JAR_PATH` apuntando a tu archivo.

**"java: command not found"**
Instala Java 11+ y asegúrate de que está en el PATH. Verifica con `java -version`.

**"MPXJ timed out"**
El archivo puede ser demasiado grande o complejo. Aumenta el timeout con `MPXJ_TIMEOUT=60`.

**"File is too small"**
Los archivos .mpp válidos pesan al menos unos kilobytes. Verifica que el archivo no esté corrupto.

**"Conexión rechazada" (frontend)**
Asegúrate de que el microservicio esté corriendo en el puerto 8000. Verifica la variable `NEXT_PUBLIC_MPP_PARSER_URL` en `v2/.env.local`.
