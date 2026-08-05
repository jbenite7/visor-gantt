---
tipo: referencia
estado: vigente
fecha: 2026-08-05
areas: [proceso]
fuente: sesion
resumen: "El esquema de la wiki: qué capa manda, qué forma tiene una página y cuáles son las cuatro operaciones"
---
# Cómo se opera la wiki

Esta página es el **esquema**: explica cómo funciona `memoria/`. [[AGENTS]] la resume para el
asistente. Si algo aquí contradice a `AGENTS.md`, gana `AGENTS.md`.

## Las tres capas

| Capa | Dónde | Regla |
|---|---|---|
| Fuentes | `docs/`, `goals/`, los `.md` de la raíz, el código | Se leen. **Su contenido no se edita desde aquí.** |
| Wiki | `memoria/` | La escribe el asistente. **Nunca se edita a mano.** |
| Esquema | esta página | Explica la estructura y las cuatro operaciones. |

**Precedencia: Código > [[AGENTS]] > `memoria/`.** Nada de lo que hay aquí es contrato. Si una
nota contradice al repo, gana el repo: corrige la nota y márcala `estado: derogada` en vez de
borrarla — saber que algo dejó de ser cierto también es memoria.

## Forma de una página

Frontmatter obligatorio, seis claves:

```yaml
---
tipo: decision          # mapa | decision | concepto | trampa | referencia | modulo | flujo
estado: vigente         # vigente | derogada
fecha: 2026-08-05       # ISO
areas: [scheduling]     # de la lista cerrada de doce
fuente: goals/predecessors-use-row-id/facts.md
resumen: "Una línea que dice de qué va la página"
---
```

Las notas `decision` y `trampa` llevan además, en el cuerpo, una línea **Why:** (por qué se
decidió o qué costó tiempo) y una línea **How to apply:** (qué hacer la próxima vez).

**Una nota, un hecho.** Si no cabe en una pantalla, probablemente son dos. El lint avisa cuando
una página acumula más de tres hechos numerados.

## Áreas válidas

Lista cerrada de doce; `scripts/wiki-lint.mjs` la comprueba:

`gantt` · `importacion` · `scheduling` · `datos` · `ui` · `auth` · `reportes` · `qa` · `docker` ·
`deploy` · `proceso` · `arquitectura`

Si hace falta una nueva, se añade **primero** al script y se explica en [[index]] qué cubre. Una
lista que crece sin control deja de servir para filtrar.

## Las cuatro operaciones

- **Ingest** — al cerrar una tarea o al aparecer una fuente nueva: se escribe o actualiza la
  página, se actualiza [[index]], se revisan las páginas relacionadas y se anexa una línea a
  [[log]].
- **Query** — preguntas contra la wiki, respondidas citando páginas. Si la respuesta era valiosa
  y no estaba escrita, se convierte en página.
- **Lint** — `node scripts/wiki-lint.mjs` (o `npm run test:wiki` desde `v2/`): comprueba la
  **forma** — frontmatter, áreas, enlaces, orfandad. Comprueba y reporta; **nunca corrige**. Un
  verde no significa que la wiki sea correcta.
- **Veracidad** — la otra mitad: verificar contra el código que lo escrito sigue siendo cierto,
  por rotación de áreas y verificando cada afirmación en vez de sospecharla. No depende de que
  alguien se acuerde: el lint cuenta los commits de código desde el último pase y sale en rojo
  por encima de 40.

Un pase de veracidad se cierra anexando a [[log]] una línea con esta forma exacta, que es la que
el lint reconoce:

    - 2026-08-05 · veracidad · areas: scheduling, importacion · sin correcciones
