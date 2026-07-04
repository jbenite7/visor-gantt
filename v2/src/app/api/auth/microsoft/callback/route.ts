import { NextRequest, NextResponse } from "next/server";
import {
  createSessionForUser,
  upsertMicrosoftUser,
} from "@/lib/auth/session";
import { shouldUseSecureCookiesFromHeaders } from "@/lib/auth/cookie-security";

const STATE_COOKIE = "ms_oauth_state";

function buildPublicUrl(request: NextRequest, pathname: string): URL {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  return new URL(`${protocol}://${host}${pathname}`);
}

interface MicrosoftProfile {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

function loginRedirect(request: NextRequest, message: string) {
  return NextResponse.redirect(
    buildPublicUrl(request, `/login?error=${encodeURIComponent(message)}`),
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";

  if (!code || !state || state !== expectedState) {
    return loginRedirect(request, "La validación de Microsoft 365 falló");
  }

  if (!clientId || !clientSecret) {
    return loginRedirect(request, "Microsoft 365 no está configurado");
  }

  const redirectUri = buildPublicUrl(
    request,
    "/api/auth/microsoft/callback",
  ).toString();
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "openid profile email User.Read",
  });

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    },
  );

  if (!tokenResponse.ok) {
    return loginRedirect(request, "No se pudo obtener el token de Microsoft 365");
  }

  const tokenJson = await tokenResponse.json() as { access_token?: string };
  if (!tokenJson.access_token) {
    return loginRedirect(request, "Microsoft 365 no devolvió un token válido");
  }

  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!profileResponse.ok) {
    return loginRedirect(request, "No se pudo leer el perfil de Microsoft 365");
  }

  const profile = await profileResponse.json() as MicrosoftProfile;
  const email = profile.mail || profile.userPrincipalName;
  if (!profile.id || !email) {
    return loginRedirect(request, "El perfil de Microsoft 365 no tiene correo");
  }

  const userId = await upsertMicrosoftUser({
    email,
    name: profile.displayName || email,
    microsoftOid: profile.id,
  });
  await createSessionForUser(userId);

  const response = NextResponse.redirect(buildPublicUrl(request, "/"));
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookiesFromHeaders(request.headers),
    maxAge: 0,
    path: "/",
  });
  return response;
}
