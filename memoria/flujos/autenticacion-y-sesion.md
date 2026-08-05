---
tipo: flujo
estado: vigente
fecha: 2026-08-05
areas: [auth]
fuente: v2/src/lib/auth/, v2/src/app/actions/auth.ts, v2/src/app/api/auth/microsoft/
resumen: "Login por contraseña o Microsoft, cookie de sesión firmada y RBAC en cada mutación"
---
# Flujo: autenticación y sesión

- **Entrada.** El usuario llega a `v2/src/app/login/page.tsx`. Dos caminos:
   - **Contraseña**: la Server Action `v2/src/app/actions/auth.ts` verifica el hash con
     `password.ts` contra la tabla de usuarios ([[persistencia]]). El primer admin se siembra con
     `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` de `docker-compose.yml`.
   - **Microsoft (OAuth)**: `v2/src/app/api/auth/microsoft/start/route.ts` redirige al proveedor y
     `.../callback/route.ts` recibe el retorno y crea la sesión.
- **Sesión.** `session.ts` emite una cookie firmada; sus atributos de seguridad están
   centralizados en `cookie-security.ts` y **no se reimplementan inline** en ningún otro punto.
- **Autorización.** Cada ruta y Server Action protegida verifica la sesión vía `session.ts`, y
   `rbac.ts` decide qué puede hacer cada rol **en las Server Actions** (p. ej.
   `v2/src/app/actions/project.ts`), no en los componentes de UI.
- **UI de sesión.** `v2/src/components/auth/AuthMenu.tsx` muestra el estado y el logout (misma
   Server Action de `auth.ts`).

Ver el módulo [[auth]] para el detalle de archivos e invariantes.
