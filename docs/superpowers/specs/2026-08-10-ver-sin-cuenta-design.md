# E51 · Ver un `.mpp` sin cuenta — diseño

Fecha: 2026-08-10. Reabre **E51**, descartado dos veces y declarado firme el 2026-08-06. El usuario lo
reabrió el 2026-08-10 tras la revisión de cierre, que dejó la app en **9/10** con una única fila suspendida.

Grilleo con el usuario: cinco decisiones, todas tomadas el 2026-08-10 y recogidas abajo.

## Por qué se reabre

La revisión en frío de cierre puntúa **7 filas**. Seis pasan. La séptima —«llegar a ver tu cronograma en
≤3 pasos»— no puede pasar mientras la app exija cuenta antes de enseñar nada: hoy son **6 pasos** (llegar,
correo, contraseña, Entrar, Subir, elegir archivo) frente a los 2 del visor 1.0.

**Es la única fila que separa el 9 del 10**, y la decisión de mantener la cuenta era lo que la bloqueaba.

## Qué se construye

Una ruta pública donde alguien sin cuenta sube su `.mpp`, lo ve, y decide si se queda.

| Hoy | Con E51 |
|---|---|
| 1 llegar · 2 correo · 3 contraseña · 4 Entrar · 5 Subir · 6 elegir archivo | 1 llegar · 2 «Ver un .mpp sin cuenta» · 3 elegir archivo |

**3 pasos.** Cumple el criterio y cierra la fila.

## Las cinco decisiones del grilleo

| Qué | Decisión | Por qué |
|---|---|---|
| ¿El archivo se guarda? | **Sí, y caduca solo** | Sobrevive a la recarga y se puede enseñar a otro; el borrado automático evita acumular datos de gente sin cuenta |
| ¿Qué puede hacer? | **Solo verlo** | Es lo que pedía E51 y responde al trabajo real: «ver qué está en riesgo sin MS Project». Evita decidir qué pasa si dos anónimos tocan lo mismo |
| ¿Puede quedárselo? | **Sí: crear cuenta y adoptarlo** | Es el motivo de negocio del modo sin cuenta: la persona prueba con su obra y se queda. Pedirle que suba el archivo otra vez sería pedir esfuerzo en el peor momento |
| ¿Cómo es el enlace? | **Token largo, no adivinable** | Los proyectos viven hoy en rutas con identificador propio; un temporal público con identificador previsible se enumera |
| ¿Freno al abuso? | **5 subidas por hora y por IP** | Quitar la sesión abre el analizador a internet. Nadie sube cinco cronogramas por hora por casualidad |

**Plazo de caducidad: 7 días.** Propuesto en el diseño y aceptado: suficiente para enseñárselo al equipo,
corto para no acumular.

## Lo que el código ya da, y lo que no

Comprobado antes de diseñar, no supuesto:

- **`/gantt-demo` ya es una ruta pública sin sesión** que monta `GanttView` entero. La maquinaria de enseñar
  un cronograma a alguien sin cuenta **ya existe**; lo que no existe es la de meterle su archivo.
- **`POST /api/import-mpp` exige sesión antes de leer el cuerpo** (`route.ts:31`), por E3. Ese guard es
  correcto para la ruta con cuenta y no se toca: el modo sin cuenta necesita su propia entrada.
- **La tabla `projects` no tiene columna de dueño** (`db.ts:16-22`): `id`, `name`, `project_data`,
  `created_at`, `updated_at`. Hoy los proyectos se protegen **por permiso**, no por propiedad. Eso simplifica
  el diseño: un proyecto temporal no es «de nadie», es uno **marcado como temporal**.
- El analizador es un microservicio aparte que puede tardar hasta 3 minutos: por eso el freno importa.

## Arquitectura

### Dónde vive el dato

Se reutiliza la tabla `projects` con **dos columnas nuevas**:

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
```

Un proyecto con `expires_at IS NOT NULL` **es temporal**. Adoptarlo es poner las dos a `NULL`.

No se crea una tabla aparte: duplicar el guardado, el cargado y la serialización por un caso temporal es más
código del que evita, y las dos columnas dejan el caso normal exactamente como está.

### Las rutas

| Ruta | Sesión | Qué hace |
|---|---|---|
| `POST /api/ver-mpp` | **No** | Analiza el `.mpp`, guarda el proyecto como temporal, devuelve el token |
| `GET /ver/<token>` | **No** | Muestra el cronograma en solo lectura |
| `POST /api/import-mpp` | Sí | Sin cambios: la ruta con cuenta sigue igual |
| `GET /project/<id>` | Sí | Sin cambios: sigue exigiendo sesión, como quedó en P2 |

### La garantía de solo lectura — el punto que decide el diseño

`GanttView` pasa de 2.000 líneas y tiene decenas de puntos de edición. Pasar un `readOnly` y confiar en tapar
todos es la clase de red con agujeros que este trabajo lleva semanas encontrando: **basta olvidar uno**.

La garantía **no vive en la interfaz**:

1. **La cerradura está donde se canjea el enlace, no en cada escritura.** Quien llega por `/ver/<token>`
   obtiene una sesión de **solo lectura**: se comprueba una vez, al resolver el token, y ninguna escritura
   posterior necesita acordarse de nada.

   > **Corregido el 2026-08-10.** El diseño ponía la invariante dentro de `saveProject`, «por donde pasa todo
   > guardado». El carril B verificó que **eso no era cierto**: `snapshots.ts` inserta en `project_snapshots`
   > por su cuenta, sin pasar por ahí. Las escrituras sobre `projects` sí son solo tres, todas en
   > `project.ts` —el `UPDATE`, el `INSERT` y el `DELETE`—, pero la tabla de fotos quedaba fuera.
   >
   > Repartir la comprobación por cada escritura habría sido la misma forma que acabamos de desmontar en los
   > E2E: una lista que hay que ampliar cada vez que aparece una tabla nueva, y que falla justo cuando alguien
   > se olvida. Comprobar al canjear el token no tiene ese modo de fallo — una tabla nueva nace protegida,
   > porque el permiso de escribir nunca llegó a existir.
2. **La interfaz es la cortesía.** `GanttView` recibe `readOnly` y esconde lo que no aplica —editar, deshacer,
   línea base, observaciones, aplicar matriz— para no prometer lo que no da.
3. **Un guardián** comprueba que la regla del servidor existe, no que alguien se acordó de tapar los botones.

La diferencia importa: la capa 1 es una invariante comprobable en un test de servidor; la capa 2 es una lista
que envejece. Si algún día alguien añade un botón nuevo y olvida el `readOnly`, el resultado es un control
que no hace nada — molesto, no peligroso.

### La adopción

`POST /api/adoptar/<token>`, **con sesión**. Pone `share_token` y `expires_at` a `NULL` y devuelve el `id`
normal. A partir de ahí es un proyecto como cualquier otro.

En `/ver/<token>`, si no hay sesión se ofrece «Entrar y quedármelo», que lleva al login con `?next=` apuntando
a la adopción — el retorno al destino que ya construyó E18.

### La caducidad

- **Al abrir**: si `expires_at` ya pasó, la ruta responde como si no existiera y borra la fila. Garantiza que
  nadie ve un temporal caducado aunque la limpieza no haya corrido.
- **Script de limpieza** (`scripts/clean-expired-shares.ts`), para que no se acumulen filas.

Las dos piezas son necesarias: la primera es la garantía, la segunda es la higiene.

### El freno

Contador en memoria por IP, ventana de una hora, tope de 5. Al pasarse, **429** con el minuto en que puede
volver. En memoria a propósito: es un freno contra el goteo, no contra un ataque coordinado, y una tabla en
base de datos sería más infraestructura de la que el problema pide.

## Cómo se prueba

- **Módulos puros con test propio**: el token, la caducidad y el contador del freno se prueban sin DB ni DOM.
- **La invariante del servidor**: un test que, con una sesión salida de `/ver/<token>`, intenta guardar el
  proyecto **y también tomar una foto** (`project_snapshots`), y comprueba que se rechazan las dos. Las dos,
  no solo la primera: fue justo la segunda la que se escapó del diseño original. Es el test que sostiene
  toda la garantía.
- **La ruta pública**: un test que abre `/ver/<token>` sin sesión y comprueba que se ve el cronograma; otro
  con el token caducado que comprueba que no.
- **La adopción**: guardar tras adoptar debe funcionar; antes de adoptar, no.
- **Comprobación en navegador**: los 3 pasos contados de verdad, sobre build de producción y con un `.mpp`
  real.

## Riesgos

1. **El más caro: que se escape un camino de escritura.** Este riesgo **ya se materializó en el papel**, antes
   de escribir una línea: la primera versión confiaba en `saveProject` como puerta única, y no lo era —
   `snapshots.ts` escribe en `project_snapshots` sin pasar por ahí. Por eso la comprobación se movió al
   canje del token: una sesión que nunca recibió permiso de escritura no puede escapársele a una tabla nueva.
   Lo que queda por vigilar ya no es «¿añadimos la regla a la escritura nueva?», sino que **nadie fabrique una
   sesión con permisos saltándose el canje**.
2. **Exponer el analizador.** El freno lo acota; el límite de 50 MB ya existe. Si la app llega a estar en
   internet abierto, esto se revisa con datos de uso, no antes.
3. **Datos de terceros en la base.** Un cronograma de obra lleva precios y plazos. Por eso caduca, por eso el
   enlace no se adivina, y por eso el temporal es inmutable.

## Fuera de alcance

Compartir con permisos, comentarios de invitados, subir varios archivos, previsualizar antes de subir, y
cualquier edición sin cuenta. Nada de eso cierra la fila del 10/10.

## Criterio de hecho

1. Un usuario sin cuenta ve su cronograma en **3 pasos**, contados en navegador.
2. Un proyecto temporal **no se puede modificar**, y hay un test de servidor que lo fija.
3. El enlace caducado no muestra nada.
4. Adoptar convierte el temporal en proyecto normal y editable.
5. `npx jest --runInBand` en verde, `eslint` limpio, `tsc --noEmit` filtrado vacío, `next build` correcto.
6. La fila de «pasos hasta el valor» pasa, y la revisión de cierre se actualiza a **10/10**.

Plan: [2026-08-10-ver-sin-cuenta.md](../plans/2026-08-10-ver-sin-cuenta.md)
