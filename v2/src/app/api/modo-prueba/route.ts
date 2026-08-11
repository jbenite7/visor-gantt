import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureAuthTables } from "@/lib/auth/rbac";
import { createSessionForUser } from "@/lib/auth/session";
import { correoDeModoPrueba, modoPruebaActivo } from "@/lib/auth/testMode";

/**
 * La puerta del modo de prueba. Ver `@/lib/auth/testMode` para el porqué y el
 * candado.
 *
 * Apagada responde **404**, no 403: un 403 confirma que la ruta existe y que
 * hay algo que forzar. Apagada, esta ruta es indistinguible de una que nunca se
 * escribió.
 *
 * Es `GET` a propósito, contra la costumbre de que lo que cambia estado sea
 * `POST`: lo que hace falta es **escribir la URL en la barra del navegador**.
 * El riesgo que evita `POST` —que un sitio ajeno la dispare— aquí no aplica:
 * con el modo apagado no hay nada que disparar, y encendido el atacante ya
 * tendría el servidor de pruebas.
 */
export const dynamic = "force-dynamic";

const ROL_POR_DEFECTO = "member";

export async function GET(request: NextRequest) {
  if (!modoPruebaActivo(process.env)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const correo = correoDeModoPrueba(process.env);
  // `member`, no `admin`: el admin ve y edita **cualquier** proyecto, así que
  // una sesión de revisión con admin no distingue «lo veo porque soy miembro»
  // de «lo veo porque soy admin», y es justo esa diferencia la que hay que
  // poder mirar. Se puede pedir admin explícitamente para revisar lo suyo.
  const rol = request.nextUrl.searchParams.get("rol") === "admin" ? "admin" : ROL_POR_DEFECTO;

  await ensureAuthTables();
  const resultado = await pool.query(
    `INSERT INTO users (email, name, provider)
     VALUES ($1, $2, 'password')
     ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [correo, "Modo de prueba"],
  );
  const userId = resultado.rows[0].id as string;

  // Solo el rol pedido: si una visita anterior dejó `admin`, una posterior sin
  // `?rol=admin` tiene que volver a ver la app como la ve un miembro.
  await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, rol],
  );

  await createSessionForUser(userId);

  const destino = request.nextUrl.searchParams.get("destino");
  // Solo rutas internas: un `destino` absoluto convertiría esto en un redirector
  // abierto hacia cualquier sitio.
  const ruta = destino && destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";
  return NextResponse.redirect(new URL(ruta, request.nextUrl.origin));
}
