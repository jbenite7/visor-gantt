# GEMINI.md - AI Constitution

Este archivo define las reglas y filosofías que la IA debe seguir al trabajar en este proyecto.

## Filosofía de Código

1.  **Mobile First**: Todo el CSS debe escribirse pensando primero en pantallas pequeñas y escalar con `@media (min-width: ...`.
2.  **Simplicidad**: Evitar sobreingeniería. Para este proyecto, una función limpia es mejor que una clase abstracta compleja.
3.  **Modernidad**: Usar características modernas de TypeScript/JS (ES2022+, async/await, React Server Components) manteniendo compatibilidad.
4.  **Robustez**: Validar siempre la existencia de archivos y manejar errores de parsing con gracia.

## Reglas de Arquitectura

- **Separación de Responsabilidades**: El parseo binario de `.mpp` es responsabilidad del microservicio Python; el frontend (`v2/`) consume JSON. La lógica de scheduling/matriz vive en `v2/src/lib`, no en los componentes de render.
- **TypeScript**: Mantener `strict` habilitado; tipar los contratos de datos del proyecto (`project_data`).

## Flujo de Trabajo

- Actualizar `CHANGELOG.md` al finalizar funcionalidades grandes.
- Mantener `README.md` actualizado con instrucciones de despliegue.
