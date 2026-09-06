import { Router, type RequestHandler } from "express";
import { HttpError } from "../../errors/http-error.js";
import type { ExternalIdentity } from "../../providers/identity/identity-provider.js";
import {
  AuthenticationError,
  completeExternalLogin,
} from "../../services/auth.service.js";
import {
  authenticationCookiePath,
  authenticationSuccessPath,
  setAuthenticationCookie,
} from "../../services/auth-cookie.js";
import {
  EntraNotConfiguredError,
  getEntraIdentityProvider,
} from "./entra-identity-provider.js";
import {
  createLoginTransaction,
  InvalidLoginStateError,
  verifyLoginState,
} from "./login-state.js";

export const alexAuthRoutes = Router();

const LOGIN_COOKIE = "helpdesk_login";
const LOGIN_COOKIE_LIFETIME_MS = 10 * 60 * 1000;

interface BrowserLoginTransaction {
  state: string;
  codeVerifier: string;
}

const loginCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: authenticationCookiePath(),
};

function encodeLoginCookie(transaction: BrowserLoginTransaction): string {
  return Buffer.from(JSON.stringify({
    state: transaction.state,
    codeVerifier: transaction.codeVerifier,
  })).toString("base64url");
}

function readLoginCookie(cookieHeader: string | undefined): BrowserLoginTransaction {
  const encodedValue = cookieHeader
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === LOGIN_COOKIE)
    ?.slice(1)
    .join("=");

  if (!encodedValue) {
    throw new InvalidLoginStateError();
  }

  try {
    const value = JSON.parse(
      Buffer.from(decodeURIComponent(encodedValue), "base64url").toString(),
    ) as Partial<BrowserLoginTransaction>;

    if (
      typeof value.state !== "string" ||
      typeof value.codeVerifier !== "string" ||
      value.codeVerifier === ""
    ) {
      throw new InvalidLoginStateError();
    }

    return { state: value.state, codeVerifier: value.codeVerifier };
  } catch {
    throw new InvalidLoginStateError();
  }
}

function toRouteError(error: unknown): HttpError | AuthenticationError {
  if (error instanceof HttpError || error instanceof AuthenticationError) {
    return error;
  }

  if (error instanceof EntraNotConfiguredError) {
    // Expected in development, where no Entra settings exist and the
    // development login is used instead.
    return new HttpError(503, "MICROSOFT_LOGIN_UNAVAILABLE", error.message);
  }

  if (error instanceof InvalidLoginStateError) {
    return new HttpError(400, "INVALID_LOGIN_STATE", error.message);
  }

  // Microsoft and MSAL failures are reported without their internals, which
  // can carry request identifiers and correlation data.
  return new HttpError(
    502,
    "MICROSOFT_LOGIN_FAILED",
    "Microsoft login could not be completed",
    { cause: error },
  );
}

/** GET /api/v1/auth/login - begin the university Microsoft sign-in. */
const startMicrosoftLogin: RequestHandler = async (_request, response, next) => {
  try {
    const provider = getEntraIdentityProvider();
    const transaction = await createLoginTransaction();
    const authorizationUrl = await provider.getAuthorizationUrl(
      transaction.state,
      transaction.codeChallenge,
    );

    response.cookie(
      LOGIN_COOKIE,
      encodeLoginCookie(transaction),
      { ...loginCookieOptions, maxAge: LOGIN_COOKIE_LIFETIME_MS },
    );
    response.redirect(authorizationUrl);
  } catch (error: unknown) {
    next(toRouteError(error));
  }
};

/** GET /api/v1/auth/callback - finish the flow Microsoft redirected back to. */
const completeMicrosoftLogin: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const transaction = readLoginCookie(request.get("cookie"));
    await verifyLoginState(request.query.state, transaction.state);
    response.clearCookie(LOGIN_COOKIE, loginCookieOptions);

    // Microsoft reports consent and sign-in failures on the redirect itself.
    if (typeof request.query.error === "string") {
      throw new HttpError(
        400,
        "MICROSOFT_LOGIN_REJECTED",
        "Microsoft did not complete the sign-in",
      );
    }

    const code = request.query.code;
    if (typeof code !== "string" || code === "") {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        "An authorization code is required",
      );
    }

    let identity: ExternalIdentity;

    try {
      identity = await getEntraIdentityProvider().completeLogin({
        code,
        codeVerifier: transaction.codeVerifier,
      });
    } catch (error: unknown) {
      throw toRouteError(error);
    }

    const result = await completeExternalLogin(identity);
    setAuthenticationCookie(
      response,
      result.accessToken,
      result.expiresInSeconds,
    );
    response.redirect(303, authenticationSuccessPath());
  } catch (error: unknown) {
    next(
      error instanceof InvalidLoginStateError
        ? toRouteError(error)
        : error,
    );
  }
};

alexAuthRoutes.get("/login", startMicrosoftLogin);
alexAuthRoutes.get("/callback", completeMicrosoftLogin);
