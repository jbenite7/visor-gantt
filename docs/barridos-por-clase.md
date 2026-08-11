# Barridos por clase de defecto

*2026-08-11. Escrito porque trabajé sin la lista de hallazgos de la auditoría y tuve que
encontrarlos yo. Esto es el mapa que me habría ahorrado el día.*

## Por qué existe este documento

La sesión que coordinaba me pasó cuatro hallazgos concretos y dijo que quedaban 18 más. Esa
lista no estaba en el repositorio y la sesión dejó de ser alcanzable. En vez de parar, barrí
**por clases de defecto**: en lugar de buscar «el hallazgo número 7», busqué «todos los sitios
donde puede repetirse este tipo de error».

Funcionó mejor de lo esperado —doce hallazgos— y produjo algo que una lista no da: **guardianes
que cierran la clase entera**, no el caso concreto.

## El método, y la lección que costó tres vueltas

**Medir los datos, no razonar sobre el código.**

Perdí dos intentos con el eje de la Línea de Balance. El primero afirmó un desfase con una
«prueba» que usaba una fecha que ese código nunca produce. El segundo se retractó por completo,
basándose en cómo se construyen las marcas. **Los dos estaban mal.** El tercero acertó porque
consultó la base: 66.550 fechas revisadas, 2.432 en la franja peligrosa, 1.185 de ellas del
`.mpp` real de obra.

Un razonamiento sobre el código describe lo que el código *debería* hacer. Los datos dicen lo
que *hay*.

## Clases barridas

| Clase | Resultado |
|---|---|
| Errores descartados (`if (!result.success) return`) | limpio |
| Manejadores vacíos (`onClick={() => {}}`) | limpio |
| Resultados de acciones que nadie mira | limpio |
| `console.log` en producción | limpio |
| Botones desactivados para siempre | limpio |
| Botones sin nombre accesible | limpio *(tras afinar la heurística: la primera versión daba 23 falsos positivos)* |
| Props recibidas y nunca usadas | limpio |
| `new Date("AAAA-MM-DD")` en producción | limpio |
| **Componentes que nadie importa** | 1 — `ErrorDisplay`, retirado |
| **Acciones de servidor sin llamador** | 1 — plantillas de matriz, guardaban solo en memoria |
| **Promesas que el código no cumple** | 2 — foto de importación, portada de Recursos |
| **Constantes duplicadas** | 2 — tope de subida (×5), plazo de caducidad (×2) |
| **Formateadores duplicados** | 5 copias de fechas, en 2 grupos incompatibles |
| **Lógica que depende de leer un texto** | 2 — botón de recargar, línea real vs planificada |
| **Tokens de color inexistentes** | 2 — uno con reserva, otro sin ella |
| **Cálculos con la fuente equivocada** | 2 — diagnóstico de curva S, eje de Línea de Balance |

## Guardianes que quedan puestos

Todos probados **rompiéndolos a propósito**; ninguno se dio por bueno naciendo verde.

| Guardián | Qué impide |
|---|---|
| `componentesAlcanzables` | que se construya un componente que nadie puede usar |
| `enlacesInternos` | que un enlace apunte a una ruta que no existe |
| `todasLasAccionesAutorizan` | que una acción toque la base sin comprobar sesión |
| `limitesUnaSolaVez` | que un número que el usuario ve se escriba dos veces |
| `clienteSinServidor` | que una pantalla arrastre `node:crypto` al navegador |
| `coloresDelSistema` | colores a mano, y tokens que no existen |
| `fechaDeCorteLlega` | que un eslabón deje de pasar la fecha de corte |
| `projectViewWiring` | que un dato de `ProjectData` no llegue a la pantalla |
| `check-empty-suites` | que un `describe.skip` apague un fichero en silencio |

## Preguntas abiertas, medibles, que no pude cerrar

**1. Los recursos del `.mpp` real.** El archivo de obra produce 240 tareas, **0 recursos y 213
asignaciones**, todas con `resourceId: 0`. 88 de 297 proyectos están igual. El `.mpp` trae
`ASSIGNMENT_RESOURCE_GUID` pero ningún identificador numérico, y el importador solo busca cuatro
nombres de campo.

No toqué el importador: para saber si el archivo trae recursos **sin nombre** —que el importador
descarta— o no trae ninguno, hay que correr el analizador contra el archivo. Arreglarlo a ciegas
sería inventarse datos de una obra real. **Quien tenga el `.mpp` delante puede cerrarlo en diez
minutos.**

**2. Las vistas autenticadas, sin revisar en navegador.** Los mejores hallazgos de esta semana
salieron de mirar la app funcionando. No pude: la cookie de sesión es `httpOnly` y no se inyecta
desde JS, y no escribo contraseñas en formularios. Hace falta otra vía —una sesión ya abierta, o
un modo de prueba— para revisar Gantt, Matriz, Ejecutivo y Cortes con datos reales.

**3. Dos rarezas del `.mpp` real, de una tarea cada una:** un resumen sin hijos y un hito con
duración mayor que cero. Poco alcance; sin comprobar cómo los dibuja el Gantt.

## Dos errores míos de este día, para que no se repitan

**Rompí el build y lo fusioné.** Encadené `build && merge` en un solo comando y no leí la salida.
`main` estuvo sin compilar unos minutos. La suite no lo cazaba porque Jest corre en Node, donde
`node:crypto` existe. Desde entonces: verificación y fusión, en comandos separados.

**Deshice una mutación con `git checkout --`** y me llevé por delante un arreglo sin commitear.
Las mutaciones se deshacen con la copia del fichero, nunca con git.
