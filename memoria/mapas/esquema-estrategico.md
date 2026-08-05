---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [proceso, arquitectura]
fuente: AGENTS.md, ROADMAP.md, memoria/flujos/
resumen: "Qué problema resuelve la app, para quién, con qué metodología de planificación y cuál es el recorrido del usuario"
---
# Esquema estratégico y de metodología

Este es el esquema **para personas**, no para código: qué hace Visor Gantt, para quién y con qué
método. El plano técnico es [[esquema-app]].

## El problema que resuelve

Los cronogramas de obra se hacen en Microsoft Project, pero Project es caro, cerrado y difícil de
compartir con el equipo de campo. Visor Gantt toma ese mismo cronograma (`.mpp`) y lo convierte en
una herramienta viva en el navegador: se puede ver, editar, recalcular, analizar y compartir sin
licencias de Project — y sin perder fidelidad con el archivo original.

## Para quién

| Rol | Qué le da la app |
|---|---|
| **Programador de obra** | Importa el `.mpp`, edita tareas y dependencias, y el cronograma se recalcula solo (ruta crítica, holguras, calendarios con festivos). |
| **Residente / equipo de campo** | La programación matricial (unidad × actividad) y la vista Last Planner: qué se hace esta semana, en qué piso, en qué orden. |
| **Gerencia** | Dashboard ejecutivo: avance, presupuesto, hitos, curva S — y exportable a reporte. |

## La metodología que implementa

La app no inventa un método: combina tres prácticas estándar de planificación de obra y las
mantiene sincronizadas entre sí.

1. **Ruta crítica (CPM)** — el método clásico de Project: cada tarea tiene predecesoras, duración y
   calendario; el motor calcula qué tareas no pueden atrasarse sin atrasar la obra. Es la columna
   vertebral: todo lo demás se deriva de aquí.
2. **Programación rítmica (matriz y línea de balance)** — para obra repetitiva (torres, pisos,
   casas iguales): la matriz cruza unidades con actividades y la línea de balance muestra si las
   cuadrillas avanzan a ritmo parejo o van a chocar. La app la deriva automáticamente del
   cronograma; no hay que armarla dos veces.
3. **Last Planner** — la planificación semanal colaborativa con el equipo de campo: la app traduce
   el plan general a la vista semanal para comprometer trabajo real.

```mermaid
flowchart TB
    PLAN[("🎯 EL PLAN<br/>una sola fuente de verdad<br/>(cronograma CPM)")]

    CPM["🧭 Ruta crítica<br/>qué no puede atrasarse"]
    LOB["🏗️ Matriz y línea de balance<br/>ritmo en obra repetitiva"]
    LP["🤝 Last Planner<br/>compromiso semanal en campo"]
    SIM["🔮 Escenarios y asistente<br/>simulación: no tocan el plan<br/>hasta aplicarse"]

    PLAN === CPM
    PLAN --- LOB
    PLAN --- LP
    SIM -.->|solo al aplicar| PLAN

    PROG(["👷 Programador de obra"]) --> CPM
    CAMPO(["🦺 Equipo de campo"]) --> LOB & LP
    GER(["📈 Gerencia"]) --> PLAN
```

**Principio rector:** una sola fuente de verdad. El cronograma CPM manda; matriz, línea de balance,
reportes y Last Planner son vistas del mismo plan, siempre sincronizadas. Lo que se analiza (
escenarios "¿qué pasa si…?", recomendaciones del asistente) es simulación: **nada cambia el plan
hasta que el usuario lo aplica**.

## El recorrido del usuario

```mermaid
flowchart LR
    A["📁 Importar<br/>el .mpp de Project"] --> B["✏️ Revisar y editar<br/>el cronograma"]
    B --> C["🔄 Recálculo automático<br/>ruta crítica y fechas"]
    C --> D["📊 Analizar<br/>matriz · línea de balance<br/>escenarios · asistente"]
    D --> E["🗓️ Ejecutar<br/>plan semanal Last Planner"]
    E --> F["📈 Reportar<br/>dashboard ejecutivo"]
    F -.->|la obra avanza,<br/>el plan se ajusta| B
    C --> G[("💾 Guardado<br/>todo queda en la nube<br/>propia del equipo")]
```

El ciclo se repite durante toda la obra: importar una vez, ajustar cada semana, reportar siempre
desde el mismo plan.

## Promesas al usuario (los "no negociables")

- **Fidelidad**: lo que dice el `.mpp` original se conserva; la app nunca sobrescribe en silencio
  los datos de Project.
- **Sin sorpresas**: si el archivo viene con errores (ciclos, referencias rotas), la app los
  muestra en claro y conserva el último cronograma válido en vez de romperse.
- **Nada se pierde**: todo cambio sobrevive guardar, recargar y reabrir el proyecto.
- **Análisis sin riesgo**: simular escenarios nunca toca el plan real.

Los flujos que sostienen cada promesa están en `memoria/flujos/` (ver [[esquema-app]]).
