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
