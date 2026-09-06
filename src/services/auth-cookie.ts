import type { CookieOptions, Response } from "express";

export const AUTHENTICATION_COOKIE = "helpdesk_access";

function publicBasePath(): string {
  return process.env.PUBLIC_BASE_PATH?.trim() || "/";
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict. The session cookie is set on the Microsoft callback and
    // the browser is then redirected to the success path. Browsers evaluate
    // SameSite across the whole navigation chain, so a Strict cookie is
    // withheld on the hop immediately after a cross-site-initiated navigation
    // and the user lands on the success page unauthenticated.
    //
    // This does not weaken CSRF protection: requireAuthentication calls
    // requireSameOriginRequest whenever the token came from a cookie, which
    // rejects any state-changing request without a matching Origin. Lax also
    // still withholds the cookie from cross-site non-GET requests.
    sameSite: "lax",
    path: publicBasePath(),
  };
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;

    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

export function readAuthenticationCookie(
  cookieHeader: string | undefined,
): string | undefined {
  return cookieHeader
    ? readCookie(cookieHeader, AUTHENTICATION_COOKIE)
    : undefined;
}

export function setAuthenticationCookie(
  response: Response,
  accessToken: string,
  expiresInSeconds: number,
): void {
  response.cookie(AUTHENTICATION_COOKIE, accessToken, {
    ...cookieOptions(),
    maxAge: expiresInSeconds * 1_000,
  });
}

export function clearAuthenticationCookie(response: Response): void {
  response.clearCookie(AUTHENTICATION_COOKIE, cookieOptions());
}

export function authenticationSuccessPath(): string {
  const basePath = publicBasePath();
  return basePath === "/"
    ? "/api/v1/me"
    : `${basePath}/api/v1/me`;
}

export function authenticationCookiePath(): string {
  return publicBasePath();
}
