---
tipo: trampa
estado: vigente
fecha: 2026-08-05
areas: [deploy]
fuente: docs/deploy-production-hetzner.md
resumen: "El checkout vivo de produccion es /tmp/visor-gantt-deploy, no /root/visor-gantt"
---
El servidor de producción es `hetzner-vps-openclaw` (`62.238.11.226:3000`), y el checkout que
sirve la app en vivo está en `/tmp/visor-gantt-deploy`. El propio doc lo aclara explícitamente:
"no `/root/visor-gantt`" — la ruta que cualquiera asumiría por convención para un checkout de
producción. No hay workflow de GitHub Actions en el repo: el deploy es enteramente manual por
SSH, `git pull origin main`, y `docker compose up -d --build frontend` (más `mpp-parser` si el
cambio toca el parser o la base).

**Why:** una ruta bajo `/tmp` para un checkout de producción es contraintuitiva — `/tmp` sugiere
temporal/descartable. Alguien que asuma `/root/visor-gantt` (la convención habitual) editará o
desplegará contra un checkout que no es el que sirve tráfico real, o simplemente no lo
encontrará.

**How to apply:** antes de cualquier despliegue manual, confirma la ruta con
`ssh hetzner-vps-openclaw "pwd"` dentro del checkout en vez de asumir la convención. Ver
[[runbook-deploy-produccion-hetzner]] para el procedimiento completo.
