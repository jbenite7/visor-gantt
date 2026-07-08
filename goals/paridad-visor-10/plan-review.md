# Plan de implementación — Paridad funcional con Visor de Cronogramas (.mpp)

## Tasks

### 1. ViewType infrastructure
- **Esfuerzo**: 2h
- **Dependencias**: ninguna
- **Descripción**: Agregar `conflictos`, `unidadTipica`, `calendario` al enum ViewType, ViewSwitcher, GanttView routing, y toolbar con iconos.

### 2. Vista Conflictos
- **Esfuerzo**: 6h
- **Dependencias**: #1
- **Descripción**: ConflictosView que detecta violaciones de restricción (FS/SS/FF/SF contradichas por fechas) y desviaciones atípicas (pares sin dependencia con orden anómalo). Tablas con columnas: Nivel, Predecesora, Sucesora, Relación, Lag, Fecha esperada, Fecha real, Días de atraso. Contadores: X violaciones · Y desviaciones.

### 3. Vista Unidad Típica
- **Esfuerzo**: 8h
- **Dependencias**: #1
- **Descripción**: UnidadTipicaView que detecta sistemas repetidos ≥3 niveles (patrones UNIT_PATTERNS + WBS). Toggle Por Nivel / Consolidado. Análisis de productividad (unidades/día). Degradación limpia sin datos suficientes.

### 4. Mejoras Líneas de Balance
- **Esfuerzo**: 3h
- **Dependencias**: ninguna
- **Descripción**: Mensaje de degradación alineado con app destilada. Etiqueta de ubicación/nivel en cada actividad. Selector de escala temporal (semanas/meses).

### 5. Vista Calendario
- **Esfuerzo**: 8h
- **Dependencias**: #1
- **Descripción**: CalendarioView con grid mensual, celdas coloreadas (laboral/finde/festivo/laboral especial), barra de resumen (N laborales · N finde · N festivos), y barras de tareas sobrepuestas.

### 6. Jerarquía dinámica
- **Esfuerzo**: 3h
- **Dependencias**: ninguna
- **Descripción**: Botones L1–LX dinámicos según max outlineLevel del proyecto. Botones Expandir todo / Colapsar todo.

### 7. Toolbar mejorado + Banner
- **Esfuerzo**: 2h
- **Dependencias**: ninguna
- **Descripción**: ProjectToolbar con duración total, % completado, conteo de dependencias. Banner sutil entre toolbar y SplitPane: nombre proyecto, Inicio, Fin, duración, % completado, N tareas, N dependencias.

### 8. Escala Trimestres
- **Esfuerzo**: 2h
- **Dependencias**: ninguna
- **Descripción**: 'Trimestre' como 4ta opción de escala (Día/Semana/Mes/Trimestre) en ProjectToolbar y GanttChart.

### 9. % Completado en barras
- **Esfuerzo**: 2h
- **Dependencias**: ninguna
- **Descripción**: Fill proporcional de % completado dentro de cada barra de tarea en GanttChart.

### 10. Feriados Colombia
- **Esfuerzo**: 2h
- **Dependencias**: ninguna
- **Descripción**: Carga automática de festivos colombianos (fijos + móviles con Ley de Emiliani) como excepciones no laborables al importar .mpp.

---

**Total estimado**: ~38h
**Dependencias clave**: #1 debe completarse antes de #2, #3, #5 — lo demás es paralelizable.

## Checklist de revisión

- [ ] Cada task es atómica y completable en 1-3 tool calls?
- [ ] Las dependencias sequential son correctas?
- [ ] Los esfuerzos estimados son realistas?
- [ ] Falta alguna feature de las 10 ideas originales?
- [ ] El orden de implementación tiene sentido?
