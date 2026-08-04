# Acta de cierre — cierre-auditoria-goals

**Fecha:** 2026-08-04
**Rama:** `cierre-auditoria-goals`
**Plan ejecutado:** `docs/superpowers/plans/2026-08-04-cierre-auditoria-goals.md`

## Verificación ejecutada en esta sesión

Salida real de comandos, no autoreporte.

| Comando | Resultado |
| --- | --- |
| `npm test -- --runInBand` | **79 suites, 586 tests, todos pasan** |
| `npm run lint` | limpio, sin hallazgos |
| `npm run build` | compila y genera todas las rutas |
| `npx playwright test --project=chromium` | **50 passed, 1 skipped, 0 failed** |

El único test saltado es `production-gantt-benchmark`, que requiere `PRODUCTION_SSH_HOST` por diseño del propio spec.

Punto de partida al abrir la sesión: 75 suites / 543 tests, y una suite E2E con **5 fallos** que ninguna acta previa
registraba. La suite unitaria creció en 4 suites y 43 tests; la E2E pasó de 5 fallos y 37 tests sin ejecutar a
**50 en verde**.

### Evolución de la suite E2E durante la sesión

| Momento | Resultado |
| --- | --- |
| Estado preexistente | 5 failed, 7 passed, 37 did not run |
| Tras reparar los specs desactualizados | 1 failed, 13 passed, 36 did not run |
| Estado final | **50 passed, 1 skipped** |

## Facts cerrados con evidencia

### Facts 8 y 111 — conservación de proyectos E2E

Contradicción resuelta. Antes, 9 de 12 specs ejecutaban `DELETE FROM projects` pese a que los facts exigen conservar
los proyectos. Ahora ninguno lo hace: el aislamiento viene de un identificador de corrida (`e2e/helpers/runId.ts`).

Prueba: tras la corrida completa en verde, `select count(*) from projects` devuelve **87 proyectos**, con nombres
como `E2E What If Persistence run-msf2srrr` y `E2E Matriz 2 etapas 2 torres 20 pisos run-msf2y5xz`, conviviendo
corridas distintas sin colisión. El conteo creció de 35 a 87 al ejecutar la suite entera, sin perder ninguno.

El caso difícil — un proyecto importado cuyo nombre viene del propio `.mpp` — se resolvió renombrando la fila con el
id obtenido del redirect, sin tocar el motor de importación.

La limpieza pasó a `v2/scripts/clean-e2e-projects.ts`, probado de extremo a extremo: borró una fila de prueba
sembrada a propósito y **respetó** el proyecto id 38, que carece de marcador de corrida. Sin `--yes` no borra nada.

### Facts 65, 66, 67 y 92 — clasificación de familias

Implementado desde cero en `v2/src/lib/scheduling/activityFamily.ts`. Devuelve familia, `matchedBy`, `confidence`,
`breadcrumbLevel` y `reviewReason`. La prioridad es breadcrumb sobre WBS sobre nombre, de modo que una tarea llamada
"Piso 3" bajo un capítulo "Redes MEP" se clasifica como Redes MEP, con `matchedBy: "breadcrumb"` — hay test que lo
demuestra.

Las seis palabras ambiguas del fact 67 (piso, torre, staff, retiro, ejes, zona) nunca deciden familia por sí solas.

Consumido por los **tres** generadores de LOB, incluido `generateAutomaticLOBFromTasks`, que es el que la aplicación
usa realmente, y por Unidad Típica.

### Fact 35 — persistencia del arrastre de jerarquía

Cubierto con arrastre HTML5 real (`dragstart`/`dragover`/`drop`), en ambos sentidos: indentar y desindentar, con
verificación en base de datos y tras recarga. 2 tests en verde.

### Errores de importación

Los cinco caminos de error de `/api/import-mpp` (400 archivo inválido, 400 extensión, 413 tamaño, status del parser,
500 fallo al guardar) ahora se muestran dentro de la aplicación en lugar de como JSON crudo a pantalla completa. Cada
uno tiene test. Una importación correcta vuelve a abrir `/project/{id}`.

## Corrección de la auditoría

**El hallazgo del banner ausente era un falso positivo.** La auditoría concluyó que el fact 34 de `paridad-visor-10`
no estaba implementado porque la palabra "banner" no aparecía en el código. El elemento existe desde antes con otro
nombre: `gantt-project-meta-strip` (`GanttView.tsx:1155`), situado entre la barra de herramientas y el contenido, y
muestra nombre del proyecto, inicio, fin, duración, avance, número de tareas y de dependencias.

Se implementó un banner y **se revirtió** al detectar la duplicación. El criterio 6 de `paridad-visor-10` estaba
cumplido; el error fue buscar una palabra en lugar de la funcionalidad.

## Bugs reales encontrados durante la ejecución

1. **`systemName()` usaba una regex desactualizada** (`typicalUnit.ts`): Zona, Lote, Tramo y Etapa detectaban nivel
   pero nunca llegaban a formar grupo, porque el nombre no se limpiaba con la lista unificada. Corregido y cubierto.
2. **Falsos positivos del clasificador**: una primera versión capturaba "Gastos generales" como Redes MEP y
   "Viáticos de personal" como Urbanismo. Corregido acotando los patrones y fijado con tests.
3. **Fixture `.mpp` no portable**: `full-app-evidence.spec.ts` buscaba el archivo en el directorio de descargas de
   otra máquina, inexistente aquí. Ahora resuelve por variable de entorno, ruta original o fixture del repositorio.
4. **Carrera de hidratación en la subida**: el test subía el archivo antes de que React estuviera escuchando. Ahora
   espera a que el navegador emita `filechooser` y envuelve la subida en `waitForRequest`.

5. **Tipo de ubicación inexistente en el test**: el flujo matricial intentaba asignar el tipo "Urbanismo", que no
   está en `areaTypeOptions` porque es el nombre de una ubicación, no una categoría estructural. Se corrigió el test
   usando "Zona"; **no** se añadió la opción a la aplicación, que habría sido modificar el producto para acomodar un
   test mal escrito.
6. **Aborto del chunk de `/login`**: la navegación del server action cancelaba la petición del chunk aún en vuelo.
   Resuelto esperando la carga antes de interactuar con el formulario.

## Deuda registrada

- La ruta `mousedown` + `mouseup` en ventana de `GanttTable.tsx:640,653-668` es código muerto: el atributo
  `draggable` de la fila secuestra el gesto antes. No afecta al usuario, porque `handleRowDrop:691-717` aplica la
  indentación por la ruta nativa.
- `columna\w*` podría capturar "columnata", vocabulario inexistente en obra.
