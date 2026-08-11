# Modo de prueba: mirar las vistas con cuenta sin escribir una contraseña

## Para qué

Los dos mejores hallazgos del 2026-08-11 —el enlace público que entregaba media
aplicación, y su 404 hablándole a alguien con cuenta— salieron de **mirar la app
funcionando**, y los dos eran invisibles leyendo el código: cada pieza por
separado estaba bien. La ruta pública `/ver/<token>` sirvió de mirador para las
once vistas de análisis, pero no alcanza lo que **solo existe con cuenta**:
guardar, adoptar y listar.

El bloqueo era concreto: la cookie de sesión es `httpOnly` y no se inyecta desde
JS, y una sesión de revisión no escribe contraseñas en formularios. Este modo lo
levanta sin pedir credenciales de nadie.

## Cómo se usa

```bash
# 1. Material: una cuenta de revisión y una copia propia de un cronograma real
cd v2 && npm run seed:modo-prueba

# 2. Servidor con el modo encendido (puerto 3001, no pisa el 3000 del e2e)
npm run dev:modo-prueba
```

El script imprime el id del proyecto copiado y la URL de entrada:

```
http://127.0.0.1:3001/api/modo-prueba?destino=/project/<id>
```

Se abre esa URL en el navegador y ya se está dentro, con sesión. `destino`
acepta cualquier ruta **interna** —se puede caer directo en la vista que se va a
revisar—; una URL externa se ignora, para que esto no sea un redirector abierto.
Con `?rol=admin` se entra como administrador; sin él, como `member`, que es como
lo ve la mayoría de la gente.

Desde ahí se llega a todo lo que antes no se podía mirar: **Gantt con cuenta**
(240 tareas), **Matriz**, **Ejecutivo**, **Cortes** (dentro de Curva S) y el
**listado de proyectos**, que con `member` enseña solo lo propio.

## Qué copia el script, y por qué no inventa datos

`seed-modo-prueba.ts` **copia** el proyecto más reciente que ya tenga más de 100
tareas y alguna asignación —por defecto el cronograma de obra, 240 tareas y 213
asignaciones—, o el que se le pase con `--desde=<id>`. Es idempotente: reusa la
misma copia en vez de acumular proyectos.

Un cronograma sintético habría escondido justo lo que se busca: el enlace
público que entregaba media aplicación se vio **porque las 213 asignaciones
existían y no se pintaban**.

## El candado

El modo está **apagado salvo que alguien lo encienda a propósito**: hace falta
`VISOR_TEST_MODE=1` exacto en el entorno del servidor. Ausente, vacía, `true`,
`0` o `01` lo dejan apagado, y apagado `/api/modo-prueba` responde **404** —no
403— para no delatar siquiera que la ruta existe.

Está fijado en pruebas, y la mayoría son del lado apagado a propósito:
`v2/src/lib/auth/testMode.test.ts` y `v2/src/app/api/modo-prueba/route.test.ts`,
que además comprueban que apagado **no toca la base ni firma ninguna cookie**.

Medido el 2026-08-11 contra un `next dev` sin la variable:

```
GET /api/modo-prueba -> HTTP 404      (0 cabeceras set-cookie)
```

**Segundo cerrojo:** una instalación que se anuncia por `https://`
—`PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_URL` o `APP_URL`— **no enciende el modo ni
con la variable puesta**. Son las mismas variables que ya deciden si la cookie
va marcada como `secure`, así que no hay una señal nueva que mantener. En local
no estorba —nadie configura `https://` para `next dev`— y atrapa el caso que de
verdad importa: la variable filtrada a un despliegue real.

**Límite conocido y deliberado:** el candado es una variable de entorno, no
`NODE_ENV`. La suite e2e y la revisión en navegador corren contra un build de
producción (`next build && next start`), así que atar el modo a
`NODE_ENV !== "production"` lo habría dejado inservible justo donde se usa.
Quien despliega **no debe definir `VISOR_TEST_MODE` en producción**;
`.env.example` la trae vacía y lo dice.
