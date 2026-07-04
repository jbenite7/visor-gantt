type HeaderSource = {
  get(name: string): string | null;
};

function isHttpsProto(value: string | null): boolean {
  if (!value) return false;
  const proto = value.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}

function httpsFromConfiguredUrl(): boolean {
  const configuredUrl =
    process.env.PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL;

  return configuredUrl ? configuredUrl.startsWith("https://") : false;
}

export function shouldUseSecureCookiesFromHeaders(headers: HeaderSource): boolean {
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return isHttpsProto(forwardedProto);
  }

  return httpsFromConfiguredUrl();
}
