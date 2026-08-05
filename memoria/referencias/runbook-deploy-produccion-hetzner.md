---
tipo: referencia
estado: vigente
fecha: 2026-08-05
areas: [deploy]
fuente: docs/deploy-production-hetzner.md
resumen: "Runbook manual de despliegue a Hetzner: SSH, checkout, git pull, Docker Compose"
---
`docs/deploy-production-hetzner.md` es el único documento de proceso de despliegue: procedimiento
paso a paso por SSH al host `hetzner-vps-openclaw` (`62.238.11.226:3000`), sin workflow de CI/CD.
Consúltalo directamente para el procedimiento exacto (orden de comandos, verificación post-deploy
con el contenedor `frontend` en estado `Up`) — no lo resumas de memoria, porque un paso
desactualizado ahí es la única fuente de verdad del proceso real.
