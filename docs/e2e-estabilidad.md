# Por qué la suite E2E fallaba distinto cada vez

*Diagnóstico del 2026-08-10. Todo lo que sigue está medido en esta máquina, no supuesto.*

## El síntoma

Tres corridas completas, tres fallos distintos, los tres verdes al correrlos en aislamiento:

1. `resource-sheet-view` invisible a los 30 s.
2. El login se quedaba en `/login` y `toHaveURL` agotaba sus 5 s.
3. `command-palette-input` existía en la página pero no era editable, 180 s.

Tres síntomas sin nada en común invitan a tratarlos por separado: subir un timeout aquí,
añadir una espera allá. Eso habría escondido el problema, porque **ninguno de los tres era
el problema**.

## La causa

**La suite no tenía margen de tiempo, y el reloj se acababa en un sitio distinto cada vez.**

Playwright, cuando agota el presupuesto de un test, culpa a lo que estuviera esperando en
ese instante. Si el test va justo de tiempo, lo que aparece en el informe es azar: el
localizador que tocó. El fallo 3 no era la paleta de comandos; era el cronómetro.

Los números, con la máquina ociosa y el servidor ya caliente —es decir, en el mejor día
posible—:

| Test | Duración | Presupuesto | Consumido |
|---|---|---|---|
| `flow matrix-housing-full-flow` | 136 s | 180 s | **76 %** |
| `matrix-housing project module Hoja Tareas` | 54 s | 180 s | 30 % |

Cuarenta y cuatro segundos de margen en el mejor día. Y la máquina no está en su mejor
día casi nunca: **load average 23 sobre 10 núcleos** en el momento de medir, con Docker,
una máquina virtual y dos aplicaciones de escritorio compitiendo.

### Lo que se comía el margen

**Uno: la grabación automática, siempre encendida.** `trace`, `video` y `screenshot`
estaban en `"on"` para los 51 tests. El coste no solo era alto, era *variable*: medido
dentro de un mismo test, la **misma** captura del **mismo** documento de 1280×720 tardó
**135 ms y después 7.490 ms**. Cincuenta y cinco veces más, sin que cambiara nada de lo
que se estaba fotografiando.

**Dos: cobertura fotografiada dos veces.** Los dos tests `flow ...-full-flow` recorren los
14 módulos del proyecto, y otros 28 tests `project module X` recorren esos mismos módulos
uno por uno. Ambos escribían su evidencia con el mismo nombre de archivo, así que el
segundo pisaba al primero: se pagaba dos veces por un archivo que solo quedaba una vez.
De los 136 s del test crítico, unos 119 s eran ese recorrido repetido.

## Lo que se cambió

**La grabación automática pasa a `retain-on-failure`.** No se pierde evidencia: la que esta
suite entrega son las capturas y los logs que ella misma escribe en `attachEvidence`, y
siguen intactas. Lo que estaba siempre encendido era la grabación de depuración de
Playwright, que ahora se conserva justo cuando hace falta — al fallar.

**El recorrido del flow deja de escribir archivos duplicados.** Sigue comprobando los 14
módulos exactamente igual, incluida la comprobación de desbordamiento horizontal. Solo
deja de escribir unos archivos que el test por módulo vuelve a escribir con el mismo
nombre.

Efecto medido en el test crítico: **136 s → 110 s**, del 76 % al 61 % del presupuesto.

## Dos deudas que se arreglaron de paso

**`assertNoCriticalLogs` clasificaba por dónde, no por qué.** Trataba `net::ERR_ABORTED`
—consecuencia normal de que una navegación cancele una petición en vuelo— como fallo
crítico, y se defendía con una lista blanca de URLs que había crecido tres veces, una por
cada corrida que falló sin que nada estuviera roto. El comentario que acompañaba a la
última entrada lo decía con todas las letras: «hacía fallar la corrida una de cada dos
veces sin que nada estuviera roto». Filtrar por URL obliga a ampliar la lista cada vez que
aparece una ruta nueva; en cuanto E32 añadió `?tareas=…` a la URL del proyecto, el ancla
dejó de casar y volvió a fallar.

Ahora se filtra por tipo de error. Una petición cancelada nunca es prueba de que la app
esté rota. Un fallo de verdad llega como `pageerror`, como respuesta 5xx o como otro
`net::ERR_*`, y todos esos siguen tumbando el test.

**La suite no limpiaba la base.** El 2026-08-10 había **268 proyectos y 25 MB**
acumulados, y dos corridas sueltas de un solo test le sumaron 14 más. Ahora hay un
`globalTeardown` que borra los proyectos que creó **esa** corrida, y solo esos: nada
anterior al arranque se toca. Limpiar lo que ya estaba acumulado es decisión del dueño de
la base, no de un teardown.

Dos trampas que costaron una vuelta y merecen quedar escritas:

- `project_snapshots` **no tiene clave foránea** a `projects` —su `project_id` es TEXT y
  el tipo de `projects.id` es ambiguo entre las fuentes del esquema—, así que no cae en
  cascada. Se borra a mano, igual que hace `deleteProject` en la app. Sin eso, la limpieza
  cambiaba una fuga por otra.
- La marca de arranque la da `now()` de Postgres **como texto**, no `new Date()` de Node.
  `projects.created_at` es `timestamp` sin zona horaria; si se deja que el driver lo
  convierta a `Date`, `toISOString()` lo reescribe en UTC y la marca se desplaza el huso
  entero. Medido: cinco horas hacia adelante, y la limpieza no alcanzaba nada. El error
  cayó del lado seguro —borrar de menos—, pero del lado contrario habría borrado datos
  ajenos.

## Lo que no se tocó, y por qué

**La suite corre contra `next dev`**, que compila cada ruta la primera vez que se visita.
Eso ya se sabía: `full-app-evidence.spec.ts` tiene un `beforeAll` que calienta `/login` a
mano, con un comentario que explica la carrera. Es un parche por ruta, y hay más rutas.
Correr contra un `next build` + `next start` quitaría de raíz tanto la compilación
perezosa como el ruido de Fast Refresh —ese `.hot-update.json` que había que perdonar en
la lista blanca—, pero cambia el entorno bajo el que se firmó toda la evidencia visual
existente. Es un cambio de más peso que estos, y merece su propia decisión.

**El límite honesto:** con la máquina a load average 23, ninguna suite de 51 tests de
navegador es inmune. Lo que se ha hecho es devolverle margen y quitarle la varianza que
sí estaba bajo control. Si vuelve a fallar de forma dispersa, el primer dato a mirar es
`uptime`, no el test que aparezca en el informe.
