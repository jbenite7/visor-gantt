---
tipo: trampa
estado: vigente
fecha: 2026-08-04
areas: [qa]
fuente: goals/cierre-auditoria-goals/cierre.md
resumen: "Un spec E2E buscaba el .mpp en la ruta de descargas de otra maquina y era inejecutable fuera de ella"
---
`full-app-evidence.spec.ts` (y specs equivalentes) apuntaban al archivo `.mpp` de importación por
una ruta absoluta de la máquina donde se escribió el test
(`/Users/juanfelipebenitezramos/Downloads/...`), lo que lo hacía inejecutable en cualquier otra
máquina o en CI. Se corrigió resolviendo la ruta por variable de entorno, la ruta original como
fallback, o un fixture del propio repositorio.

**Why:** una evidencia de importación grabada una sola vez en una máquina concreta se ve
correcta en su sesión, pero la suite deja de ser reproducible en cuanto alguien más intenta
correrla — el fallo aparece lejos de la sesión que introdujo la ruta hardcodeada.

**How to apply:** ningún path a un archivo de prueba real va hardcodeado a una máquina concreta;
resuélvelo por variable de entorno con un fallback dentro del repo (`fixtures/` o similar).
