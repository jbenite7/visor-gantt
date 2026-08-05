# POSITIONING — visor-gantt (v2)

Creado 2026-08-05 en Fase 6 de `improve-app` (made-to-stick). Alcance: **copy dentro de la app**, no
marketing. Job de referencia: [CUSTOMER.md](CUSTOMER.md). Tono de referencia: «Ayuda de esta pestaña» del
visor 1.0 ([DESTILACION-VISOR-V1.md](DESTILACION-VISOR-V1.md)).

## Commander's Intent del producto

> **Si el usuario recuerda una sola cosa: aquí el cronograma de la obra se revisa, se anota y se reparte
> — sin MS Project.**

## El tono que funciona (y por qué)

El visor 1.0 escribía así: *«Cada línea es un sistema; el eje vertical son los niveles y el horizontal el
tiempo»*. Explica **qué estás viendo**, en palabras de obra, sin nombrar tecnología. Y cuando la detección
automática no alcanza, lo dice: *«195 de 239 tareas tienen ubicación detectada (44 sin ubicación no se
muestran aquí)»* — honestidad concreta, que es exactamente el principio *Credible* de SUCCESs.

Reglas derivadas para v2:

1. **Nombrar el trabajo, no la infraestructura.** El usuario tiene una obra, no una base de datos.
2. **Concreto sobre abstracto.** «44 tareas sin ubicación» vence a «datos incompletos».
3. **Decir qué hacer a continuación**, sobre todo en los errores.
4. **Sin jerga de desarrollador en pantalla**: nada de `.env`, «heredado», «Conectado».

## Key Messages

Puntuación SUCCESs por superficie (S·U·C·C·E·S, 1-10 cada uno, 60 máx.).

| Superficie | Antes | Ahora / Propuesto | SUCCESs | Estado |
|---|---|---|---|---|
| Chip de estado (home) | «Conectado» / «Desconectado» / «Error» | **«Cronogramas al día»** / «Sin conexión» | 12 → 34 | **shipped** |
| Home sin proyectos | «No hay proyectos guardados» | **«Todavía no tienes cronogramas.** Sube un `.mpp` para empezar.» | 18 → 38 | **shipped** (E2) |
| Home con fallo de datos | (mismo texto que el vacío) | **«No pudimos cargar tus cronogramas.** Tus proyectos siguen guardados. Reintentar» | — → 42 | **shipped** (E2) |
| Login — cuenta inexistente | «Usa las credenciales iniciales configuradas en .env» | **«No encontramos ninguna cuenta con ese correo. Pide acceso a quien administra el proyecto.»** | 10 → 40 | **shipped** |
| Login — credenciales | «Correo o contraseña inválidos» | **«El correo o la contraseña no coinciden.»** | 24 → 34 | **shipped** |
| Login — primer usuario | «En una base limpia, el primer correo que entra se crea como administrador» | **«¿Primera vez en este servidor? La primera persona que entra queda como administradora del equipo.»** | 14 → 36 | **shipped** |
| Login — Microsoft | «Microsoft 365 no está configurado» | **«Entrar con Microsoft 365 no está disponible todavía»** | 16 → 30 | **shipped** |
| Upload — rama XML | «Usa la opción heredada» | **«Si tienes el cronograma exportado como XML, usa esta opción»** | 12 → 34 | **shipped** |
| Celda editable | `title="Double-click to edit"` (en inglés) | **«Doble clic para editar»** | 14 → 30 | **shipped** |
| Edición rechazada | (silencio) | **«El cambio no se aplicó — La duración mínima es 1 día. Marca la tarea como hito si dura cero.»** | 0 → 46 | **shipped** (E23/E26) |
| Observaciones — vacío | (no existía) | **«Sin observaciones. Anota lo que encontraste en obra para que quede registrado sobre el cronograma.»** | — → 44 | **shipped** (E43) |
| Importación — espera | «Importando…» | *Propuesto:* «Analizando *<archivo>*… los cronogramas grandes pueden tardar un minuto» | 16 | backlog (E4) |
| Importación — error de parser | texto crudo del microservicio | *Propuesto:* «No pudimos leer *<archivo>*. Suele pasar con archivos guardados en versiones muy antiguas de MS Project.» | 8 | backlog (E5) |
| Ayuda por vista | (no existe; los textos viven presos en Cmd+K) | *Propuesto:* portar «Ayuda de esta pestaña» con el tono del visor 1.0 | — | backlog (E8) |
| Vista «Cuellos» | «Cuellos» | *Propuesto:* «Cuellos de botella» | 12 | backlog (E14) |

## Commander's Intent por pantalla

| Pantalla | La única cosa que debe quedar clara |
|---|---|
| `/login` | Esta app guarda **tus** cronogramas; si no puedes entrar, hay a quién pedirle acceso. |
| Home | Aquí están tus cronogramas; para empezar, sube un `.mpp`. |
| `/upload` | Suelta el archivo de MS Project y lo verás como cronograma. |
| Gantt | Este es el plan **y** su estado real: lo crítico se ve, lo pendiente se anota. |
| Vistas de análisis | Cada vista responde una pregunta de obra concreta (¿qué se atrasa?, ¿qué se repite por piso?). |
| Configuración/Calendario | Los días y horas que aquí definas mandan sobre todas las fechas del cronograma. |

## Pendiente

- **Textos sin tildes** heredados en la capa de API (#23/E21): «extension», «maximo», «importacion».
- **Ayuda contextual por vista** (E8) es el mayor hueco de copy que queda: el material ya está escrito
  dentro de la paleta de comandos, solo hay que sacarlo a donde el usuario mira.
