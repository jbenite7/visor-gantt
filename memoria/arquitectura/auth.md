---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [auth]
fuente: v2/src/lib/auth/, v2/src/app/api/auth/microsoft/
resumen: "Sesión por cookie, hashing de contraseña, RBAC y login con Microsoft"
---
# auth

**Qué hace.** Gestiona la sesión del usuario (cookie firmada), el hashing/verificación de
contraseña, el control de acceso por rol (RBAC) y el flujo de login con Microsoft (OAuth).

**Dónde vive.** `v2/src/lib/auth/session.ts`, `cookie-security.ts`, `password.ts`, `rbac.ts`;
`v2/src/app/api/auth/microsoft/start/route.ts` y `.../callback/route.ts` (Route Handlers del flujo
OAuth); `v2/src/app/actions/auth.ts` (Server Action de login/logout); `v2/src/components/auth/`.

**Qué consume.** `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` (seed inicial, definidos en
`docker-compose.yml`) y la tabla de usuarios en Postgres vía [[persistencia]].

**Quién lo consume.** Todas las rutas y Server Actions protegidas verifican la sesión a través de
`session.ts`; `rbac.ts` decide qué puede hacer cada rol en las vistas.

**Invariantes.** La seguridad de la cookie de sesión está centralizada en `cookie-security.ts`
(cubierto por `cookie-security.test.ts`); no debe reimplementarse inline en otra parte del código.
