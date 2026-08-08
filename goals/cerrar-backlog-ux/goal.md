---
tipo: goal
estado: abierto
fecha: 2026-08-07
areas: [ux, producto, cronograma, reportes]
carril: A
proyecto: P2
fuente: docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md
resumen: "Cerrar los 27 experimentos vivos del backlog de UX y conectar lo que está construido pero inalcanzable"
---

# P2 · Cerrar el backlog de UX

## Objetivo

Que la app deje de esconder lo que sabe hacer y deje de prometer lo que no da. Entrar sin perder lo escrito,
editar sin descartes mudos, encontrar las vistas sin conocer un atajo, y que cada botón haga exactamente lo
que dice su nombre.

Segundo proyecto del [goal maestro](../evolucion-visor-v2/goal.md), carril A. Va **después de**
[P1](../no-perder-trabajo/goal.md), que arregla la pérdida de datos.

## De dónde sale

Los **27 experimentos que quedaron vivos** en [EXPERIMENTS.md](../../docs/EXPERIMENTS.md) tras el plan del
2026-08-05, más los remates del inventario de 16 módulos que tocan interfaz. Todas las decisiones están
tomadas en [la spec del grilleo del 2026-08-06](../../docs/superpowers/specs/2026-08-06-supergoal-backlog-ux-design.md),
bloques A, B, C y las partes de D que tocan interfaz. **No se reabren.**

El diagnóstico que ordena el trabajo, en palabras del inventario: el problema dominante no es lo que falta,
es **lo que está construido y nadie puede alcanzar** — una API de Last Planner completa que ningún botón
llama, la Matriz fuera del menú, «Excel» que es CSV, «PDF» que es el diálogo de impresión, «Productividad»
que es el inverso de la duración.

## Alcance

Cuatro entregas, cada una desplegable por separado:

| Entrega | Qué cierra | Experimentos / hallazgos |
|---|---|---|
| **A · La entrada** | Login que conserva el correo, salida para usuario sin cuenta, retorno al destino, límite de 50 MB anunciado, errores del analizador traducidos, pérdidas de la importación visibles | E9, E10, E11, E18, E5, E33 |
| **B · Tabla y Gantt** | Celdas calculadas en solo lectura, validación que explica, celda editable reconocible, tiradores visibles, arrastre honesto, impacto resaltado, Simple/Avanzado que cumple | E27, E28, E37, E29, E30, E35, E31, E36, E44 |
| **C · Pulido** | Menú agrupado con la Matriz dentro, ⌘K visible y paleta tolerante a erratas, cinta agrupada, chip de filtro con contador, destructivas separadas, WBS sin desfase, esqueleto de carga, barrido de tildes y código muerto | E14, E7, E15, E16, E17, E19, E20, E21, E22, E34, E42, M27, M36 |
| **D · Lo inalcanzable** | Exportaciones honestas, API de Last Planner conectada, vista de observaciones, aviso al salir de la matriz, tablero ejecutivo con «sin datos» y enlaces, alta de asignaciones con avisos de sobrecarga | M25, M26, M31, M32, M28, M1, M3, M8, M14, M18, M19 |

**Fuera, y por qué:**
- **E51** (abrir un `.mpp` sin cuenta): descartado en firme por el usuario. No reabrir.
- **E47** (medición de campo): necesita usuarios reales, no código.
- **M16, M17, M20** (pulir la carga manual de presupuesto): congelados hasta que el dato venga de PDC.
- **Editar el fin cambia la duración** (Bloque B): entra con **salida degradada** — si el motor no lo soporta
  limpiamente, se deja en solo lectura y se informa. No se fuerza.
- Todo lo de `v2/src/lib/matrix/*` y del motor de detección: **carril B**.

## Condición de hecho

1. Los 27 experimentos **cerrados o descartados con motivo escrito** en `docs/EXPERIMENTS.md` — nada en el limbo.
2. Ningún control promete lo que no hace: «Excel», «PDF» y «Productividad» dicen lo que son.
3. Ninguna función construida queda inalcanzable: la Matriz está en el menú, la API de Last Planner tiene
   quien la llame, las observaciones tienen su vista.
4. Ninguna capacidad desaparece: lo que sale de un sitio queda accesible por otro.
5. `npx jest --runInBand` en verde, `npx eslint` limpio, `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`
   vacío, `npx next build` correcto, y comprobación en navegador de cada entrega.

## Archivos de este proyecto

- [spec](../../docs/superpowers/specs/2026-08-07-cerrar-backlog-ux-design.md) — el diseño
- [plan](../../docs/superpowers/plans/2026-08-07-cerrar-backlog-ux.md) — el plan de ejecución TDD

## Cerrado 2026-08-08

Ejecutado y fusionado a `claude/suspicious-joliot-8f08ea`. Los 27 experimentos quedan **cerrados o
descartados con motivo escrito**: cero en `backlog`.

**936 tests unitarios** (710 de partida) y **50 E2E en Chromium** en verde, con base de datos y microservicio
de análisis reales. `eslint` sin errores, `tsc --noEmit` filtrado vacío, `next build` correcto.

**Cuatro defectos encontrados leyendo o verificando, no diseñando**, y **seis más** que salieron de la
revisión independiente del carril — entre ellos uno serio: el modo Simple borraba las columnas del `.mpp` al
guardar. Todos corregidos con test.

Evidencia en [docs/EXPERIMENTS.md](../../docs/EXPERIMENTS.md), tarjeta «P2 · Cerrar el backlog de UX».
