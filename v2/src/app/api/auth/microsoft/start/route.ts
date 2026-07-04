import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { shouldUseSecureCookiesFromHeaders } from "@/lib/auth/cookie-security";

const STATE_COOKIE = "ms_oauth_state";

function buildPublicUrl(request: NextRequest, pathname: string): URL {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  return new URL(`${protocol}://${host}${pathname}`);
}

export async function GET(request: NextRequest) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";

  if (!clientId) {
    return NextResponse.redirect(
      buildPublicUrl(
        request,
        "/login?error=Microsoft%20365%20no%20est%C3%A1%20configurado",
      ),
    );
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = buildPublicUrl(
    request,
    "/api/auth/microsoft/callback",
  ).toString();
  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  );

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "openid profile email User.Read");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookiesFromHeaders(request.headers),
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
