# Decisiones del frente modo-de-prueba — resueltas

**Resueltas por la coordinadora el 2026-08-11**, después de la entrega. Se deja
el planteamiento entero y no solo la conclusión: el argumento es lo que permite
volver sobre la decisión más adelante sin rehacer la medición.

- **1 → sí, añadido.** Segundo cerrojo por `https://`, sin atarlo a `NODE_ENV`
  por la razón que ya estaba escrita abajo. Implementado en `testMode.ts` con su
  prueba del lado apagado, y entregado con la mutación que la pone roja.
- **2 → se queda en `member`.** El argumento de abajo es el que la sostiene;
  `?rol=admin` sigue disponible explícitamente.
- **3 → no se toca `clean-e2e-projects.ts`. Medido antes de decidir:** borra por
  `name LIKE '%run-%'` combinado con antigüedad. Ese `%run-%` es una **subcadena,
  no un marcador inequívoco** — un proyecto real llamado «Torre run-off» caería
  igual. Es exactamente el criterio ancho del que había que desconfiar. La copia
  de prueba se llama «Modo de prueba — cronograma de obra», no lleva `run-` y
  hoy está a salvo; meterla ahí obligaría a **ampliar** lo que ese script borra,
  y un script de limpieza que se lleve por delante un proyecto real es un daño
  que no se deshace. Queda un proyecto de más, por diseño, y `seed` lo reusa en
  vez de acumular.

---

## Planteamiento original (encolado, sin decidir)

Ninguna bloqueó: en las tres, si la respuesta es la contraria a lo que supuse,
no hay que borrar nada escrito —se cambia una línea del predicado o una etiqueta
de rol—. Van aquí para que se decidan de una vez, con todo delante.

## 1. ¿El candado debería exigir además que no sea producción?

Hoy el modo se enciende solo con `VISOR_TEST_MODE=1`, que es lo que pedía el
encargo. Se podría **además** negarse cuando `NODE_ENV=production` o cuando la
URL configurada es `https://`.

- A favor: dos candados en vez de uno; una variable filtrada a un despliegue
  real no bastaría para abrir la puerta.
- En contra: la revisión en navegador y la suite e2e corren contra un build de
  producción (`next build && next start`), así que atarlo a `NODE_ENV` lo deja
  inservible justo donde se usa. La variante de `https://` sí sería compatible.

Recomendación: añadir solo la negativa por `https://`, que no estorba en local.

## 2. ¿La cuenta de prueba debería entrar como `admin` por defecto?

Entra como `member`, y con `?rol=admin` se puede pedir admin. Elegí `member`
porque el admin ve y edita **cualquier** proyecto, y entonces no se distingue
«lo veo porque soy miembro» de «lo veo porque soy admin» — que es justo la
diferencia que hay que poder mirar. Si lo que se quiere revisar es la vista del
administrador, el valor por defecto conviene al revés.

## 3. ¿Se limpia la copia de prueba, y cuándo?

`seed-modo-prueba.ts` es idempotente: reusa el proyecto «Modo de prueba —
cronograma de obra» en vez de acumular. Pero no lo borra nunca, y la base ya
venía de un problema de acumulación (268 proyectos el 2026-08-10). Queda vivo un
proyecto de más, por diseño. Si molesta, `clean-e2e-projects.ts` es el sitio
natural para incluirlo, pero eso es tocar lo que ese script borra y no lo hago
por mi cuenta.

## Saltado, no decidido

- **`memoria/log.md`**: `wiki-lint` avisa de 347 commits desde el último pase de
  veracidad (umbral 40). Es previo a este frente y ajeno a él; no lo toqué.
- **«Sin recursos todavía» con 213 asignaciones**: se ve en la barra lateral del
  proyecto de prueba. Es el recurso nulo ya documentado en el punto 1 de
  `barridos-por-clase.md`, no un hallazgo nuevo, pero ahora se ve también con
  cuenta. No es de este frente.
