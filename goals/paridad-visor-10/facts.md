# Facts — Paridad funcional con Visor de Cronogramas (.mpp)

## Vista Conflictos
- Nueva vista 'Conflictos' como ViewType 'conflictos' agregada al ViewSwitcher con su propio ícono y pestaña, separada de BottlenecksView.
- ConflictosView detecta violaciones de restricción: una dependencia formal FS/SS/FF/SF existe pero las fechas de las tareas la contradicen.
- ConflictosView detecta desviaciones atípicas: sin dependencia formal entre dos tareas, pero el orden de sus fechas se sale del patrón típico esperado.
- ConflictosView muestra una tabla por tipo con columnas: Nivel, Predecesora, Sucesora, Relación, Lag, Fecha esperada, Fecha real, Días de atraso.
- ConflictosView muestra contadores en el encabezado: 'X violaciones de restricción · Y desviaciones atípicas'.

## Vista Unidad Típica
- Nueva vista 'Unidad Típica' como ViewType 'unidadTipica' agregada al ViewSwitcher.
- UnidadTipicaView detecta sistemas repetidos en ≥3 niveles usando patrones de texto y estructura WBS.
- UnidadTipicaView tiene toggle entre modo 'Por Nivel' y 'Consolidado'.
- UnidadTipicaView incluye análisis de productividad (unidades/día).
- UnidadTipicaView degrada limpiamente con mensaje informativo.

## Mejoras Líneas de Balance
- Mensaje de degradación alineado con la app destilada.
- Etiqueta de ubicación/nivel/piso en cada actividad.
- Selector de escala temporal (semanas/meses).

## Vista Calendario
- Nueva vista 'Calendario' como ViewType 'calendario' agregada al ViewSwitcher.
- Grid mensual con celdas coloreadas: laboral, fin de semana, festivo, laboral especial.
- Barra de resumen con conteos de días.
- Solapa barras de tareas sobre el grid mensual.

## Jerarquía dinámica
- Botones L1–LX dinámicos según outlineLevel máximo del cronograma.
- Botones 'Expandir todo' y 'Colapsar todo' independientes.

## Banner y Toolbar
- ProjectToolbar mejorado con duración total, % completado, conteo de dependencias.
- Banner informativo sutil entre toolbar y SplitPane.

## Escala Trimestres
- 'Trimestre' como 4ta opción de escala (Día/Semana/Mes/Trimestre).

## % Completado en barras
- Las barras de tarea muestran fill proporcional de progreso.

## Feriados Colombia
- Festivos colombianos cargados automáticamente al importar .mpp.
