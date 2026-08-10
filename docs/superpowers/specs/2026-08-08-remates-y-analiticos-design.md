---
tipo: spec
fecha: 2026-08-08
padre: goals/evolucion-visor-v2/goal.md
proyectos: [P6 remates, P5 analiticos avanzados]
resumen: "Los dos proyectos que cierran el goal maestro: rematar lo que P2 dejó parcial y construir los tres analíticos que estaban bloqueados"
---

# Remates y analíticos avanzados — diseño

Cierra el goal maestro [evolución visor-gantt v2](../../../goals/evolucion-visor-v2/goal.md). Cuatro
proyectos entregados (P1, P2, P3, P4) más P3b. Quedan dos proyectos y una revisión final.

**Se ejecutan en secuencia, un solo carril**: P6 primero, P5 después, revisión en frío al final. No hay
reparto de territorios porque no hay otro carril vivo. Cada proyecto tendrá **su propio plan**.

## El hallazgo que reabre P5

El goal maestro aplazó P5 con este motivo escrito: *«varios dependen del motor de P3 y de un historial de
cortes que aún no existe. Diseñarlos antes sería planificar sobre arena.»*

**Las dos condiciones se cumplieron.** El motor de P3 está entregado. Y el historial de cortes lo creó P1 sin
proponérselo: [`types/baseline.ts:27`](../../../v2/src/types/baseline.ts) define `Baseline` con `id`, `name` y
fecha de captura, se persiste una colección sin límite, y P1 unificó ese sistema en uno solo que además
dibuja. **Cada línea base guardada ya es una foto del plan en una fecha.**

La arena se volvió suelo firme. P5 deja de estar bloqueado.

---

# P6 · Remates

Cuatro piezas, ninguna arriesgada. Cierra P2 sin asteriscos, sube la app a su techo alcanzable y deja la
documentación diciendo la verdad.

## R0 · La Matriz y Recursos se anuncian por lo que son — *primero de todo*

**El hallazgo que duele.** La revisión en frío del 2026-08-08 lo dijo sin rodeos: **«Matriz» sigue siendo un
botón de 12 caracteres**, idéntico al de agosto, con **26 tareas de trabajo construidas detrás** que no se
intuyen desde la puerta. Recursos está igual (F7).

**Por qué encabeza este proyecto.** Es el patrón que el goal maestro existía para eliminar —función construida
que nadie puede alcanzar— sobreviviendo justo donde más caro sale: todo P4 está detrás de esa puerta muda. Y
**no pide construir nada nuevo, solo enseñar lo que ya está**. Es la mejor relación entre esfuerzo y resultado
de todo lo que queda: las dos filas suben la app de 7/10 a su techo de 9/10.

Va **antes que P5** por eso mismo. Construir tres analíticos nuevos mientras la matriz sigue escondida sería
repetir el error que este goal vino a corregir.

**Qué cambia.** La entrada del menú deja de ser una etiqueta desnuda y dice qué hay dentro y en qué estado —
si hay matriz, cuántas ubicaciones; si no la hay, para qué sirve crearla. Lo mismo para Recursos. El texto
existente ya está escrito en la ayuda por vista (E8): esto es sacarlo a la puerta, no redactarlo de cero.

**Cómo se prueba.** Un test por entrada afectada: con datos, la entrada refleja el contenido real; sin datos,
explica para qué sirve en vez de quedarse muda. Y un test que falla si alguna entrada del menú vuelve a ser
solo una etiqueta sin descripción — el mismo patrón del detector de copy que ya protege el reverso de la valla.

## R1 · Deshacer en el editor de matriz

**El problema.** [`MatrixEditorView.tsx:815-853`](../../../v2/src/components/views/MatrixEditorView.tsx)
(`deleteScope`, `deleteArea`) mutan el borrador con `applyNextDraft(...)` sin pasar por `runUndoable`. Es la
**única acción destructiva de la app sin vuelta atrás**. El propio diálogo lo admite: «Esta acción no se puede
deshacer».

**Por qué `runUndoable` no encaja tal cual.** El editor trabaja sobre un borrador que es estado local de React
([`MatrixEditorView.tsx:330`](../../../v2/src/components/views/MatrixEditorView.tsx)), separado del proyecto
persistido. `runUndoable` opera sobre el estado del proyecto en `ProjectContext`. Son dos ámbitos distintos.

**La decisión: pila propia del editor.** El editor lleva su propio historial, local al borrador:

- `Cmd+Z` / `Cmd+Shift+Z` deshacen y rehacen mientras estás dentro del editor.
- La pila se descarta al salir sin guardar, porque el borrador entero se descarta con ella.
- **Al guardar, el conjunto entra al historial general como un solo cambio**, no como N pasos intermedios.

Esto respeta que el borrador aún no es parte del proyecto, y evita llenar el historial global de estados que
nunca se persistieron.

**Alcance.** Toda operación que hoy llame a `applyNextDraft` pasa por la pila. No solo los dos borrados: si el
historial solo cubriera algunas, el usuario no podría predecir qué se deshace.

**Cómo se prueba.** Un test por operación: aplicarla, deshacer, y comprobar que el borrador vuelve **exactamente**
al estado anterior. Más un test del caso que importa: borrar un alcance con ubicaciones dentro y deshacerlo
devuelve también las ubicaciones. Y uno que fija el contrato del guardado: N operaciones seguidas de un guardado
producen **una** entrada en el historial general.

## R2 · Encabezados con abreviatura real

**El problema.** [`globals.css:1919-1937`](../../../v2/src/app/globals.css) aplica
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis` a `.gantt-column-header`. En columnas angostas
el título se corta a mitad de palabra, con el `title` del navegador como único respaldo.

**La decisión: cada columna declara su forma corta.** «Duración» → «Dur.», «Predecesoras» → «Pred.». Cuando el
ancho disponible no admite el título completo, se usa la abreviatura **en vez de** cortar. El nombre completo
permanece accesible en el `title`.

**Dónde vive.** La forma corta es un campo más de la definición de columna, junto al `label` que ya existe.
Ninguna columna queda sin abreviatura: si no se declara una, se usa el `label` completo y esa columna
simplemente no se abrevia — pero nunca se corta a mitad de palabra.

**Cómo se prueba.** Tests puros sobre la función que elige entre forma larga y corta según el ancho: no
requiere medir el DOM. Más un test que recorre todas las definiciones de columna y falla si alguna abreviatura
declarada es más larga que su `label` — que sería un error de datos, no de código.

## R3 · La documentación deja de mentir

La auditoría del 2026-08-08 encontró **dos afirmaciones falsas** en la documentación. Ninguna afecta al código,
pero ambas envenenan la siguiente auditoría, que arrancaría con datos equivocados.

**Error 1 — `EXPERIMENTS.md` se subestima.** Alrededor de la línea 245 declara cinco casos del deshacer sin
cubrir. **Cuatro ya se resolvieron**: editar recurso ([`GanttView.tsx:736`](../../../v2/src/components/views/GanttView.tsx)),
editar partida (`:773`), `handleSyncMatrixFromGantt` (`:1033`) y el reset de columnas en las tres tablas
(`:1046`, `:1060`, `:1115`), todos vía `runUndoable`. El documento quedó congelado en el 2026-08-05. Se corrige
dejando solo el caso realmente abierto (el editor de matriz, que R1 resuelve) y el borrado de proyecto, que es
**irreversible por diseño** ([`project.ts:597`](../../../v2/src/app/actions/project.ts)) y no cuenta como deuda.

**Error 2 — la excusa de E38 no existe.** La línea 94 justifica el estado parcial diciendo que los encabezados
«tienen sistema responsivo propio con abreviaturas». **No existe tal sistema**: es truncamiento CSS, algo peor
de lo que el documento admite. Se corrige describiendo lo que había, y R2 lo cierra.

**Error 3 — `DESIGN.md` y `PRODUCT.md` muestran como abiertas cosas ya cerradas.** Varias filas de la auditoría
UX (#4 a #25) y el «Outcome Roadmap» siguen marcadas `open` con fecha del 2026-08-05, pero P2 las resolvió esta
semana. Quien lea esos documentos sueltos concluirá que hay deuda que no existe. Se sincronizan contra el
cierre registrado en [`goals/cerrar-backlog-ux/goal.md`](../../../goals/cerrar-backlog-ux/goal.md).

**Además — `PRODUCT.md` registra C3 revertido.** El corte C3 proponía sacar el Diagrama de Red de la barra
principal por falta de contenido. P5 le da un editor de dependencias, que lo convierte en el sitio donde se
dibujan las relaciones entre tareas. **La decisión se revierte con motivo escrito**, para que no quede como una
contradicción silenciosa entre dos documentos.

---

# P5 · Analíticos avanzados

Las tres piezas del goal maestro. La segunda es la única con trabajo estructural.

## A1 · Proyección en la Curva S

**Base existente.** [`SCurveView.tsx:17`](../../../v2/src/components/views/SCurveView.tsx) ya tiene tres
sub-vistas: `schedule`, `budget` y `earnedValue`. El valor ganado ya se calcula.

**Qué se añade.** Sobre esa base, proyectar a fin de obra: se mide el **ritmo real logrado** hasta la fecha de
corte y se extiende en tres líneas — optimista, probable y pesimista. Responde la pregunta de obra: *¿cuándo
termino si sigo a este ritmo?*

**La decisión: sin palancas.** No se le pide al usuario inventar porcentajes. La obra ya dio los números a
través del avance registrado. Una vista que exige configuración para mostrar algo es exactamente el fallo que
este goal vino a corregir — cuatro vistas vacías que no explicaban qué hacer para llenarlas.

**El caso sin datos.** Si no hay avance registrado suficiente para medir un ritmo, la vista **dice qué falta**
para poder proyectar, en lugar de mostrar una línea plana o un cero. El patrón ya está establecido por el
`EmptyState` de la propia vista ([`SCurveView.tsx:300`](../../../v2/src/components/views/SCurveView.tsx)).

**Cómo se prueba.** Funciones puras de proyección, con tests sobre series de avance conocidas: ritmo constante,
ritmo que se acelera, ritmo que se frena, avance cero. Cada caso fija la fecha proyectada esperada. Un test
específico para el umbral mínimo de datos por debajo del cual no se proyecta.

## A2 · Historial de cortes y tablero por capas

Aquí está el único trabajo estructural de los dos proyectos.

**El problema de persistencia.** El proyecto entero se guarda como **un solo blob JSON** (`project_data`,
[`project.ts:206`](../../../v2/src/app/actions/project.ts)), y las líneas base viven dentro. Cada autoguardado
reescribe el blob completo. Si cada importación metiera una foto de 300-1.000 tareas ahí dentro, el blob
crecería sin techo y **cada guardado se volvería más lento** — degradando justo el autoguardado que P1 acaba de
hacer inmediato.

**La decisión: tabla propia, con migración.** Las fotos salen del blob y viven en su propia tabla. Se leen
**solo al abrir el tablero**, nunca en el camino del guardado. El autoguardado no se entera de que existen.

Es la opción que no hipoteca lo que P1 arregló. Las dos alternativas se descartaron con motivo: guardar solo
diferencias deja el blob creciendo igual y obliga a recorrer la cadena entera para reconstruir una foto vieja;
limitar a las últimas N pierde historia en silencio, inaceptable en una app cuyo lema es «no perder trabajo».

**Cómo se llenan las fotos.** Dos vías, ambas activas:

1. **Automática en cada importación** de un `.mpp`. Cada versión del cronograma que llega de la obra queda
   registrada sin que nadie se acuerde de guardarla.
2. **Marcadas a mano**, con nombre propio, para los hitos que importan.

**El tablero.** Compara el plan actual contra cualquier foto: qué tareas se movieron, cuánto, y en qué
dirección. Las líneas base existentes siguen siendo válidas como fotos — no se migran a la fuerza ni se
duplican.

**Cómo se prueba.** La migración se prueba en los dos sentidos, con un proyecto que ya tiene líneas base
dentro del blob: tras migrar, las fotos son legibles y el blob no las contiene por duplicado. La comparación
entre dos fotos se prueba con funciones puras: tarea que se atrasa, tarea que se adelanta, tarea nueva que no
existía en la foto vieja, tarea borrada que sí existía.

## A3 · Editor de dependencias en el Diagrama de Red

**Estado actual.** [`NetworkDiagramView.tsx`](../../../v2/src/components/views/NetworkDiagramView.tsx) tiene
176 líneas y solo permite zoom y seleccionar un nodo. Es la vista más pobre de la app.

**Qué se añade.** Crear, cambiar y borrar predecesoras dibujando sobre el diagrama, con **las mismas
validaciones que ya rechazan ciclos** — no se duplica esa lógica, se reutiliza.

**La contradicción, resuelta explícitamente.** `PRODUCT.md` proponía en C3 sacar esta vista de la barra
principal: *«ningún job de CUSTOMER.md lo pide; es paridad con MS Project, no valor de obra»*. Construirle un
editor invierte en lo que se decidió recortar. **La decisión del usuario es revertir C3**: con el editor, la
vista deja de ser paridad decorativa y pasa a ser donde se dibujan las dependencias, lo que le gana su sitio.
R3 lo deja escrito en `PRODUCT.md`.

**Cómo se prueba.** La creación y el borrado de dependencias se prueban contra el mismo motor de validación
que ya usa la tabla, incluido el rechazo de ciclos. Un test comprueba que crear una dependencia desde el
diagrama y desde la tabla produce **el mismo resultado** — si divergen, hay dos fuentes de verdad.

---

# Cierre del goal maestro

## La revisión en frío ya se hizo — y dictó la prioridad

**Ejecutada el 2026-08-08**: NOT DONE, **7/10**, sobre el build de producción y con el mismo método
(`steve-jobs-design-review`) que la del 2026-08-05, para que la comparación valga. Registrada al final de
[`PRODUCT.md`](../../PRODUCT.md). Supera el 6/10 anterior, y el veredicto sigue siendo «no terminado»: ambas
cosas son ciertas.

Falla en dos de sus siete filas. **Una ya está decidida**: con E51 descartado en firme, el usuario nuevo
seguirá necesitando 6 pasos, así que el techo real de esta app es **9/10**, no 10. La otra es el hallazgo que
reordena este spec, y por eso encabeza P6.

## Condición de hecho

1. **F6 y F7 entregados**: la Matriz y Recursos se anuncian desde el menú por lo que contienen.
2. R1, R2 y R3 entregados: ninguna acción destructiva sin vuelta atrás, ningún encabezado cortado a mitad de
   palabra, y cero afirmaciones falsas en `EXPERIMENTS.md`, `PRODUCT.md` y `DESIGN.md`.
3. A1, A2 y A3 entregados, cada uno con su estado vacío que **enseña** en lugar de quedarse en blanco.
4. Los cinco proyectos del goal maestro **cerrados o descartados con motivo escrito** — nada en el limbo.
5. **Una revisión en frío de cierre** que confirme que F6/F7 subieron la app a su techo de 9/10. Es una
   comprobación acotada a lo que falló, no una novena auditoría completa.

## Fuera de alcance

- **Partir `GanttView.tsx`**: sigue siendo el límite estructural reconocido. No se aborda aquí.
- **E51** (abrir un `.mpp` sin cuenta): descartado en firme por el usuario. No reabrir.
- **Alimentar el presupuesto desde PDC**: integración entre aplicaciones, con su propio diseño.
- **Palancas de escenario en la Curva S**: A1 proyecta desde el avance real. Añadir controles para simular
  «¿y si acelero un 20%?» es una función distinta, no un remate de esta.
