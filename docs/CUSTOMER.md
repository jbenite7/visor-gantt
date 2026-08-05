# CUSTOMER — visor-gantt

Creado 2026-08-05 en Fase 1 de `improve-app` (jobs-to-be-done). Evidencia: destilación del visor 1.0
([DESTILACION-VISOR-V1.md](DESTILACION-VISOR-V1.md)), auditorías en `goals/`, vault `memoria/`.

## Job Statement

> **Cuando recibo el cronograma .mpp de la obra, quiero revisarlo, anotarlo y compartir el análisis con el
> equipo sin depender de MS Project, para decidir a tiempo.**

Confirmado por el usuario el 2026-08-05. No menciona el producto; el circunstancial es «recibir el .mpp de
la obra» (planificador/residente en construcción, ecosistema AIA/Colombia — calendarios con festivos
Colombia, archivos reales tipo «PORTO TORRE 3», «ESTACION 16 ML1»).

## Job Dimensions

| Dimensión | Qué busca | Dónde v2 subentrega |
|---|---|---|
| **Funcional** (débil — a atacar) | Abrir el .mpp, ver ruta crítica/avance por sistema y nivel, anotar hallazgos sobre las actividades y sacarlos en un formato que el equipo use (CSV/LPS) | Falta el loop de observaciones del visor 1.0 (anotar desde la barra, badge de estado, registro Pendiente/Atendida, export/import CSV y LPS); la importación de 11 MB tarda ~36 s sin progreso ni mensaje de error humano |
| **Emocional** (débil — a atacar) | Sentirse en control del cronograma: entender rápido, enfocarse en lo crítico, confiar en lo que ve | 14 vistas sin jerarquía clara de entrada abruman; sin modo foco tipo «solo ruta crítica» (atenuar); sin ayuda contextual por vista; densidad de toolbar/tabla alta |
| **Social** | Quedar bien ante equipo/cliente al compartir: reportes claros, lenguaje de obra | Menos crítica hoy: v2 ya exporta CSV ejecutivo/PDF/Excel; mejorable con export LPS del registro de observaciones y transparencia de cobertura («X de Y tareas detectadas») |

## Big Hire vs Little Hire

Decisión del usuario: **el leak está en ambos, por igual.**

- **Big Hire** (primera vez): v2 exige login y proyecto antes de mostrar valor; el visor 1.0 gana con
  upload→ver sin cuenta. Ansiedad principal: «¿me va a leer bien el archivo?» — hoy la respuesta tarda 36 s
  en silencio.
- **Little Hire** (uso diario): navegar 14 vistas, editar y recalcular; el costo cognitivo de encontrar la
  vista correcta cada vez compite contra el hábito de volver a MS Project o al PDF.

## Fuerzas de progreso

- **Push**: MS Project es caro, pesado y no todos en la obra lo tienen; compartir por PDF congela el análisis.
- **Pull**: ver LOB/curva S/conflictos sin licencia; anotar y repartir restricciones al equipo.
- **Ansiedad**: «¿parseará mi .mpp real?», «¿perderé mis anotaciones?» → reducir con progreso visible, errores humanos con reintento y autosave visible.
- **Hábito**: revisar en MS Project + Excel + reunión → reducir con entrada sin cuenta y export en formatos que ya usan (Excel, LPS).

## Competing Alternatives

| Alternativa | Por qué la contratan | Debilidad |
|---|---|---|
| MS Project (licencia de otro) | Fuente de la verdad, todo el detalle | Caro, no está en obra, no colaborativo |
| PDF/pantallazos del cronograma | Compartir fácil por WhatsApp/correo | Estático, sin ruta crítica ni anotación viva |
| Excel exportado | Todos lo abren, se puede anotar | Pierde jerarquía, links y recálculo |
| Visor 1.0 desplegado | Cero fricción, loop de observaciones, LOB | Sin persistencia, sin edición, mensajes de error crudos |
| **No-consumo** (revisar en reunión, de memoria) | Cero costo aparente | Los hallazgos no quedan registrados ni se les hace seguimiento |

## Métricas del job (para EXPERIMENTS)

- Big Hire: tiempo de «archivo elegido → primera vista útil» y % de importaciones que terminan en vista.
- Little Hire: uso semanal de las vistas (cuáles se abren de verdad) y nº de observaciones creadas/atendidas.
