# Dependencias huérfanas: avisar en vez de descartar en silencio — diseño

Fecha: 2026-08-10 · Rama `fix/huerfanas-con-aviso`
Origen: la divergencia que destapó el test de paridad de P5
(`v2/src/lib/state/dependencyParity.test.tsx`), y la decisión del usuario del 2026-08-10.

---

## 1. El problema, con el código delante

Una dependencia puede quedar apuntando a una actividad que no está. Hoy la aplicación responde de dos
formas distintas al mismo hecho:

| Camino | Qué hace hoy |
|---|---|
| **Diagrama de Red** | La rechaza **y explica por qué** |
| **Tabla** | La descarta **en silencio** |

La causa está en `recalculateSchedule` (`v2/src/lib/scheduling/scheduleEngine.ts:183-185`):

```ts
const canonicalTasks = normalizeDependencies(tasks);   // ← aquí ya se han perdido
const dependencies = collectDependencies(canonicalTasks);
const issues = validateDependencies(canonicalTasks, dependencies);
```

`normalizeDependencies` filtra las huérfanas **antes** de que `validateDependencies` pueda verlas, así que
`missingTask` **no llega a dispararse nunca** por ese camino. El diagrama, en cambio, llama a
`validateDependencies` directamente y sí las ve.

En la práctica: un jefe de obra teclea mal un predecesor en la tabla y **no pasa nada, sin explicación**.

## 2. El hallazgo que ordena el diseño

**El código ya distingue los dos casos, sin que nadie lo hubiera notado.**

`deleteTasks` (`v2/src/lib/state/ProjectContext.tsx:772`) **ya retira** las dependencias que apuntan a una
tarea borrada, a propósito y con su comentario:

```ts
// Las dependencias que apuntaban a una tarea borrada dejarían el
// cronograma con enlaces colgantes: se retiran junto con ella.
```

Por tanto, **cualquier huérfana que llegue al motor no viene de un borrado**: viene de un id que nunca
existió. La distinción que parecía difícil está hecha desde antes de este trabajo.

## 3. El riesgo que manda sobre todo lo demás

`setTasks` (`ProjectContext.tsx:349-355`) **rechaza la edición entera** cuando aparece cualquier problema:

```ts
const result = recalculateSchedule(updater(tasks), { calendar });
setScheduleIssues(result.issues);
if (result.issues.length > 0) {
  rejectWith(result.issues, "El cambio deja el cronograma en conflicto.");
} else { … }
```

Eso hacía temer que **un proyecto ya guardado con un enlace roto quedara imposible de editar**: cada edición
se rechazaría por un problema preexistente que el usuario no causó.

> **Ese temor resultó infundado, comprobado el 2026-08-10.** La huérfana no sobrevive al montaje, así que
> nunca llega a una edición posterior. Se deja escrito porque **el diseño se construyó sobre él** y porque
> es lo que hay que verificar antes de dar por buena una precaución: una precaución contra un riesgo
> inexistente no sale gratis — aquí introdujo un fallo propio (ver D3).

**Aun así, el diseño separa por dónde entra el dato, no por qué tipo de dato es**, y eso sigue siendo
correcto: la carga informa sin bloquear porque el usuario no causó esa huérfana ni puede arreglarla desde
ahí, y la edición rechaza porque acaba de causarla.

## 4. El reparto

| Momento | Qué hace | Dónde |
|---|---|---|
| **Cargar o importar** | Limpia el enlace roto **y lo cuenta**. Nunca bloquea | `ProjectContext.tsx:294` |
| **Editar** | Rechaza y explica: «la actividad 99 no existe» | `ProjectContext.tsx:351` y `:379` |
| **Borrar tareas** | El aviso que ya sale dice también el impacto | `ProjectContext.tsx:772` |

Decidido por el usuario el 2026-08-10: **la carga informa sin bloquear**.

### D1 · El motor deja de cegarse, y sigue limpiando

`recalculateSchedule` pasa a validar **antes** de normalizar, y devuelve las dos cosas: las tareas ya
limpias —como hoy— y el dato de qué se limpió.

**No se cambia el filtrado.** `normalizeDependencies` sigue haciendo exactamente lo mismo; lo único que
cambia es que ahora se sabe qué quitó, en vez de perderse. Quien llama decide qué hacer con ese dato.

`RecalculateScheduleResult` gana un campo:

```ts
/**
 * Dependencias que apuntaban a una actividad inexistente y se retiraron.
 *
 * Va aparte de `issues` a propósito: `issues` bloquea la edición, y esto no
 * siempre debe bloquear. Al cargar un proyecto se informa; al editar, quien
 * llama lo convierte en rechazo.
 */
orphanedDependencies: GanttDependency[];
```

### D2 · La carga informa

En el montaje inicial (`ProjectContext.tsx:294`), si vienen huérfanas se retiran —como hoy— y se publica un
aviso con **cuántas**, sin impedir nada. El proyecto se abre y se puede trabajar.

### D3 · La edición rechaza

En `setTasks` y `commitTaskChange`, cualquier huérfana que llegue se rechaza con su motivo, igual que en el
diagrama.

> **Corrección del 2026-08-10, hecha durante la implementación.** Esta sección decía que había que
> **descontar** las huérfanas que traía el proyecto, para que un cronograma viejo con un enlace roto no
> quedara bloqueado. **Las dos mitades de esa frase eran falsas**, y lo demostró la mutación que el plan
> exigía.
>
> **El riesgo no existía**: la huérfana que trae el proyecto **no sobrevive al montaje**. El
> `recalculateSchedule` inicial ya la retira —la tarea queda con `dependencies: []`—, así que el estado
> editable nace limpio y ninguna edición posterior la vuelve a ver.
>
> **Y la resta sí introducía un fallo**, medido: un proyecto abierto con una huérfana **aceptaba en
> silencio** una huérfana nueva, porque `1 - 1 = 0`. Justo el fallo que este trabajo viene a eliminar,
> reintroducido por el propio diseño que lo eliminaba.
>
> La comprobación correcta es la simple: `result.orphanedDependencies.length > 0`.

### D4 · El borrado cuenta su impacto

`deleteTasks` ya calcula las dependencias que retira; hoy no las dice. El aviso pasa de

> «3 tareas eliminadas»

a

> «3 tareas eliminadas · 5 dependencias retiradas»

con el botón de deshacer que ya tiene. **No se añade ningún paso al flujo**: en obra se borran tareas a
menudo, y el deshacer ya existe, así que enterarse después no cuesta nada.

Cuando el borrado no retira ninguna dependencia, el texto no cambia.

## 5. Lo que este diseño NO hace

- **No toca `normalizeDependencies`.** Su filtrado es correcto para su otro caso —limpiar lo que queda
  colgando al borrar— y romperlo sería cambiar un problema pequeño por uno grande.
- **No añade confirmación antes de borrar.** Descartado por el usuario: añadiría una pulsación a cada
  borrado, incluidos los que no tocan ninguna dependencia.
- **No cambia el comportamiento del Diagrama de Red.** Ya hace lo correcto; el resto se unifica hacia él.

## 6. El dato que sostiene que esto no molestará

Medido sobre `test_data/20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp`, parseado con `mpp-parser`:

**301 tareas, 245 dependencias, cero huérfanas.**

El aviso no se disparará en el caso normal, porque el caso normal no lo produce. Si un `.mpp` llegara con
enlaces rotos, D2 lo cuenta al abrir y no impide trabajar.

## 7. Cómo se prueba

- **El test de paridad se pondrá rojo**, que es exactamente para lo que se dejó escrito. Se actualiza al
  comportamiento nuevo, conservando su comentario sobre por qué existió la divergencia.
- **La no regresión que más importa**: un proyecto que ya trae una huérfana **se puede seguir editando**.
  Es el riesgo de la sección 3 y necesita test propio.
- **Que el borrado no cambie de comportamiento**, solo de texto: las mismas dependencias retiradas que hoy.
- Y, como en todo este repositorio: **cada test se rompe a propósito** y se comprueba en rojo antes de
  darlo por bueno. En P5 aparecieron dos tests incapaces de fallar, ambos aprobados en su primera revisión.

## 8. Preguntas abiertas

1. **Qué hace la importación si un `.mpp` viene con enlaces rotos.** Con D2 se cuentan al abrir. No se
   sabe si además debería avisarse en el momento de importar, porque **no hay ningún archivo real que lo
   produzca**: implementarlo hoy sería diseñar a ciegas.
2. **Dónde se muestra el aviso de la carga.** Hay dos canales ya construidos —el aviso pasajero con
   deshacer y la vista «Problemas»—. La elección es de presentación y se decide al planificar.
