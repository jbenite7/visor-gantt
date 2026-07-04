# Facts

- Las columnas visibles Predecesora y Sucesora usan el ID de fila de la tarea, no el Unique ID.
- Los campos especificos Unique ID Predecessors y Unique ID Successors siguen mostrando Unique ID.
- La importacion y el calculo MPP resuelven las relaciones internas correctamente aunque ID y Unique ID sean distintos.
- Editar predecesoras o sucesoras en la tabla o panel acepta y guarda el ID de fila como referencia visible.
- Despues de guardar y recargar el proyecto, las dependencias editadas sobreviven y se muestran con ID de fila.
- La verificacion final incluye pruebas enfocadas y un chequeo en navegador sobre la app servida por Docker.
