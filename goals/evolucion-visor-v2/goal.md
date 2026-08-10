---
tipo: goal
estado: cerrado
fecha: 2026-08-06
areas: [producto, ux, cronograma, matriz]
fuente: docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md
resumen: "Goal maestro: cinco proyectos que cierran el backlog de UX y convierten en producto lo que hoy está construido pero inalcanzable"
---

# Evolución visor-gantt v2 — goal maestro

## Objetivo

Que visor-gantt deje de esconder lo que ya sabe hacer: **nada se pierde, nada promete lo que no da, y lo
construido se puede alcanzar.** Cinco proyectos, ejecutables en dos carriles paralelos.

## De dónde sale

Nueve fases de auditoría (`improve-app`), un inventario de 16 módulos con 36 hallazgos, y **103 decisiones
de grilleo** con el usuario el 2026-08-06. Todo el detalle vive en
[la spec del grilleo](../../docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md).

El diagnóstico que ordena el trabajo: el problema dominante **no es lo que falta, es lo que está construido y
nadie puede usar** — una API de Last Planner completa que ningún botón llama, un export de presupuesto sin
botón, una comparación con línea base que nunca se dibuja, la matriz fuera del menú, «Excel» que es CSV,
«Escenario» que es un campo de duración, «Productividad» que es el inverso de la duración.

## Los cinco proyectos

### P1 · No perder trabajo — ✅ *cerrado el 2026-08-08*
> Diseñado el 2026-08-07, ejecutado y fusionado el 2026-08-08: [goal](../no-perder-trabajo/goal.md) ·
> [spec](../../docs/superpowers/specs/2026-08-07-no-perder-trabajo-design.md) ·
> [plan](../../docs/superpowers/plans/2026-08-07-no-perder-trabajo.md)

Dos bugs de pérdida de datos confirmados en código:
- Las **observaciones no disparan el autoguardado**: anotar en obra y cerrar la pestaña pierde lo escrito. Es
  el flujo que el propio código documenta como «lo que hacía valioso al visor 1.0».
- **Dos sistemas de líneas base desconectados**: el botón visible guarda pero nunca dibuja; el que dibuja
  usa estado local que no se guarda.

Incluye: guardado inmediato de observaciones, unificación de líneas base con dibujo en el Gantt principal,
nombrar y borrar líneas base, aviso al cerrar con cambios pendientes, y que «Reintentar» sea un botón real.

### P2 · Cerrar el backlog de UX — ✅ *cerrado el 2026-08-08*
> Diseñado el 2026-08-07, ejecutado y fusionado el 2026-08-08: [goal](../cerrar-backlog-ux/goal.md) ·
> [spec](../../docs/superpowers/specs/2026-08-07-cerrar-backlog-ux-design.md) ·
> [plan](../../docs/superpowers/plans/2026-08-07-cerrar-backlog-ux.md)

Los 27 experimentos vivos más los remates del inventario. Entrada (login que conserva el correo, salida para
usuario bloqueado, retorno al destino, límite de 50 MB anunciado, errores del analizador traducidos), tabla y
Gantt (celdas calculadas, validación que explica, tiradores visibles, arrastre honesto, impacto resaltado),
pulido (menú agrupado, chip de filtro con contador, destructivas separadas, esqueleto de carga) y
exportaciones honestas (renombrar «Excel» y «PDF», CSV real, **conectar la API de Last Planner**).

### P3 · Motor de detección — ✅ *cerrado el 2026-08-08*
📄 [`goals/motor-deteccion/goal.md`](../motor-deteccion/goal.md) ·
[spec](../../docs/superpowers/specs/2026-08-07-motor-deteccion-design.md) ·
[plan, 14 tareas](../../docs/superpowers/plans/2026-08-07-motor-deteccion.md)

El motor que reconoce piso y sistema en los nombres de tarea **falló en 44 de 239 tareas** de un archivo real.
Portar de PDC V2 (`lps-aia`) su extractor de ubicación —que cubre `Etapa`, `Zona`, `Sector`, `Tramo`,
`mezanine`, códigos `P01`/`S1` y sótanos como negativos— y su **cascada**: diccionario → nombre exacto →
similitud de palabras. Más un **diccionario que se llena con las correcciones del usuario**.

Va aparte porque **mejora tres módulos a la vez** (Línea de Balance, Unidad Típica y el generador de matrices)
y ninguno rinde hasta que esto funcione.

### P4 · La matriz como producto — ✅ *cerrado el 2026-08-08, las tres fases*
📄 [`goals/matriz-como-producto/goal.md`](../matriz-como-producto/goal.md) ·
[spec](../../docs/superpowers/specs/2026-08-07-matriz-como-producto-design.md) ·
[plan, 26 tareas en 3 fases](../../docs/superpowers/plans/2026-08-07-matriz-como-producto.md)

Editor completo de recetas, plantillas de fábrica y propias, **generador de matrices desde un `.mpp`**,
dependencias reales piso a piso configurables por alcance, calendario del proyecto en vez del propio,
panel para aprobar rendimientos observados, conflictos visibles con elección, duplicar y crear N ubicaciones,
edición en lote y escala para más de 1000 celdas.

### P3b · La obra lineal — ✅ *cerrado el 2026-08-08*
📄 [`goals/obra-lineal/goal.md`](../obra-lineal/goal.md) ·
[spec](../../docs/superpowers/specs/2026-08-08-obra-lineal-design.md) ·
[plan, 7 tareas](../../docs/superpowers/plans/2026-08-08-obra-lineal.md)

Ejecutado en siete tareas TDD. Salió del límite conocido de P3, medido sobre un archivo real: una estación de metro nombra sus ubicaciones
con `Eje`, `Módulo` y `Edificio` —84 menciones frente a 15 de `Piso`—. El usuario confirmó el 2026-08-08 que
la infraestructura es una línea real de trabajo. La idea que lo ordena: **una ubicación puede ser un tramo,
no un punto**, y eso arregla de paso las tareas que cruzan dos pisos, que hoy se resuelven a medias y en
silencio.

### P5 · Analíticos avanzados — *después de los cuatro*
Proyección con escenarios en la Curva S, tablero por capas con historial de cortes, editor de dependencias en
el Diagrama de Red. **No se planifica todavía**: varios dependen del motor de P3 y de un historial de cortes
que aún no existe. Diseñarlos antes sería planificar sobre arena.

## Los dos carriles

`GanttView.tsx` tiene **1.889 líneas y monta 15 vistas**: es el cuello de botella. Dos proyectos que lo toquen
a la vez colisionan en cada tarea.

| Carril | Proyectos | ¿Toca `GanttView.tsx`? |
|---|---|---|
| **A** | P1 → P2 | Sí, ambos — **cerrado el 2026-08-08** |
| **B** | P3 → núcleo de P4 → P3b | **No** (P3 y P3b no lo tocan; P4 solo al cablear) — **cerrado el 2026-08-08** |

**Reglas de coordinación:**
1. **Una rama por proyecto**, fusionada a `main` cuando pasa su revisión.
2. **El carril B no toca `GanttView.tsx` ni `ProjectContext.tsx`.** Cuando P4 necesite cablear el editor,
   espera a que el carril A haya fusionado.
3. Máximo **dos carriles**: un tercero acabaría inevitablemente en `GanttView` o `ProjectContext`.

**Límite conocido:** el techo de dos carriles no lo imponen los proyectos, lo impone ese archivo. Partirlo
sería un proyecto en sí mismo, no incluido aquí.

## Cómo se construye

- **TDD estricto**: test primero, verlo fallar, código mínimo.
- **Ayudantes por tarea con revisión independiente** más una revisión final del conjunto — el método que en el
  plan anterior cazó un test borrado en silencio, una vista huérfana y tres fallos que solo existían en la
  unión de piezas.
- Verificación por proyecto: suite completa, lint, tipos, build y comprobación en navegador.

## Condición de hecho

1. Los cinco proyectos **cerrados o descartados con motivo escrito** — nada en el limbo.
2. Ninguna acción del usuario puede perder trabajo sin aviso.
3. Ninguna función construida queda inalcanzable, y ningún control promete lo que no hace.
4. ✅ **Revisión en frío final ejecutada el 2026-08-08: veredicto 7/10**, registrado en
   [docs/PRODUCT.md](../../docs/PRODUCT.md). Supera el 6/10 del 2026-08-05. Encontró **cuatro defectos vivos
   en producción** que sobrevivieron a 1.400 tests en verde —entre ellos un aviso de importación muerto por
   una línea sin probar en la costura, y un test que defendía la pérdida del borrador de la Matriz—, los
   cuatro corregidos con su test de regresión. Lo que sigue abierto: el recorte del menú es contabilidad
   (~19 superficies reales), y cinco estados vacíos dicen «0» en vez de enseñar, teniendo el texto ya
   escrito en `viewHelp.ts`.

## Fuera de alcance

- **E51** (abrir un `.mpp` sin cuenta): descartado en firme por el usuario. No reabrir.
- **Alimentar el presupuesto desde PDC**: es una integración entre aplicaciones, con su propio diseño.
  Proyecto aparte. Mientras tanto no se invierte en pulir la carga manual de presupuesto.
- **Partir `GanttView.tsx`**: reconocido como el límite estructural, no abordado aquí.
