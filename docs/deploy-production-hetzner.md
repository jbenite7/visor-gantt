# Despliegue a Produccion en Hetzner

Servidor: `hetzner-vps-openclaw`
Host: `62.238.11.226`
Puerto: `3000`

## Procedimiento

1. Entrar por SSH al servidor.
   ```bash
   ssh hetzner-vps-openclaw
   ```

2. Ir al checkout de produccion.
   ```bash
   cd /tmp/visor-gantt-deploy
   ```

3. Traer los cambios desde GitHub.
   ```bash
   git pull origin main
   ```

4. Reconstruir y recrear el frontend.
   ```bash
   docker compose up -d --build frontend
   ```

5. Si el cambio toca el parser o la base, recrear tambien el servicio afectado.
   ```bash
   docker compose up -d --build mpp-parser
   ```

## Verificacion

- Abrir `http://62.238.11.226:3000`
- Confirmar que el contenedor `frontend` quede `Up`
- Si hubo cambios de importacion MPP, revisar tambien `mpp-parser`

## Notas

- No hay workflow de GitHub Actions en este repo.
- El deploy real es manual por SSH + `git pull` + Docker Compose.
- El checkout vivo de produccion es `/tmp/visor-gantt-deploy`, no `/root/visor-gantt`.
