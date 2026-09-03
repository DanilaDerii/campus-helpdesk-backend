import { Router, type RequestHandler } from "express";
import { HttpError } from "../../errors/http-error.js";
import type { ExternalIdentity } from "../../providers/identity/identity-provider.js";
import {
  EntraNotConfiguredError,
  getEntraIdentityProvider,
} from "./entra-identity-provider.js";
import {
  createLoginState,
  InvalidLoginStateError,
  verifyLoginState,
} from "./login-state.js";

export const alexAuthRoutes = Router();

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
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
  );
}

/** GET /api/v1/auth/login - begin the university Microsoft sign-in. */
const startMicrosoftLogin: RequestHandler = async (_request, response, next) => {
  try {
    const provider = getEntraIdentityProvider();
    const state = await createLoginState();
    response.redirect(await provider.getAuthorizationUrl(state));
  } catch (error: unknown) {
    if (!(error instanceof EntraNotConfiguredError)) {
      console.error("Microsoft login could not be started", error);
    }
    next(toHttpError(error));
  }
};

/** GET /api/v1/auth/callback - finish the flow Microsoft redirected back to. */
const completeMicrosoftLogin: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    // Microsoft reports consent and sign-in failures on the redirect itself.
    if (typeof request.query.error === "string") {
      throw new HttpError(
        400,
        "MICROSOFT_LOGIN_REJECTED",
        "Microsoft did not complete the sign-in",
      );
    }

    await verifyLoginState(request.query.state);

    const code = request.query.code;
    if (typeof code !== "string" || code === "") {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        "An authorization code is required",
      );
    }

    const identity: ExternalIdentity = await getEntraIdentityProvider()
      .completeLogin({ code });

    // ---------------------------------------------------------------------
    // PENDING: the core must turn this verified identity into a local user
    // and an application JWT. See todo.md section 5.6. Member code must not
    // touch repositories directly, so this is the one call site waiting on
    // the backend owner:
    //
    //   const result = await completeExternalLogin(identity);
    //   response.status(200).json(result);
    //
    // Until then the resolved identity is echoed back to the person who just
    // authenticated as it, which makes the flow verifiable end to end without
    // exposing anything they do not already know about themselves.
    // ---------------------------------------------------------------------
    response.status(501).json({
      status: "not_implemented",
      operation:
        "Issue an application JWT for a verified Microsoft identity (todo.md 5.6)",
      identity: {
        email: identity.email,
        displayName: identity.displayName,
      },
    });
  } catch (error: unknown) {
    if (
      !(error instanceof HttpError) &&
      !(error instanceof InvalidLoginStateError) &&
      !(error instanceof EntraNotConfiguredError)
    ) {
      console.error("Microsoft login callback failed", error);
    }
    next(toHttpError(error));
  }
};

alexAuthRoutes.get("/login", startMicrosoftLogin);
alexAuthRoutes.get("/callback", completeMicrosoftLogin);
