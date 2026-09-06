import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import "dotenv/config";

const testDatabaseName = process.env.TEST_DATABASE_NAME?.trim();

if (!testDatabaseName || testDatabaseName === "helpdesk") {
  throw new Error(
    "TEST_DATABASE_NAME must name a separate migrated test database",
  );
}

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.pathname = `/${testDatabaseName}`;
process.env.DATABASE_URL = databaseUrl.toString();
process.env.NODE_ENV = "test";
process.env.PUBLIC_BASE_PATH = "/";
process.env.ENTRA_TENANT_ID = "11111111-1111-1111-1111-111111111111";
process.env.ENTRA_CLIENT_ID = "22222222-2222-2222-2222-222222222222";
process.env.ENTRA_CLIENT_SECRET = "local-test-client-secret";
process.env.ENTRA_REDIRECT_URI = "http://127.0.0.1/auth/callback";
process.env.LOG_LEVEL = "error";

const [
  { createApp },
  { prisma },
  authService,
  authCookie,
  loginState,
  notificationService,
  { safeErrorDetails },
] = await Promise.all([
  import("../dist/src/app.js"),
  import("../dist/src/database/prisma.js"),
  import("../dist/src/services/auth.service.js"),
  import("../dist/src/services/auth-cookie.js"),
  import("../dist/src/alex/identity/login-state.js"),
  import("../dist/src/services/notification.service.js"),
  import("../dist/src/logging/logger.js"),
]);

const tag = `${Date.now()}-${process.pid}`;
const createdUserIds = [];
const createdTicketIds = [];

test.after(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.emailNotification.deleteMany({
      where: { ticketId: { in: createdTicketIds } },
    });
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

test("external identity login creates, updates, and protects local users", async () => {
  const identity = {
    microsoftOid: `step5-user-${tag}`,
    email: `step5-${tag}@helpdesk.local`,
    displayName: "Step 5 User",
  };

  const firstLogin = await authService.completeExternalLogin(identity);
  createdUserIds.push(firstLogin.user.id);
  assert.equal(firstLogin.user.role, "STUDENT");
  assert.equal(firstLogin.user.email, identity.email);
  assert.equal(
    (await authService.authenticateAccessToken(firstLogin.accessToken)).id,
    firstLogin.user.id,
  );

  await prisma.user.update({
    where: { id: firstLogin.user.id },
    data: { role: "TECHNICIAN" },
  });
  const updatedEmail = `step5-updated-${tag}@helpdesk.local`;
  const secondLogin = await authService.completeExternalLogin({
    ...identity,
    email: updatedEmail,
    displayName: "Updated Step 5 User",
  });
  assert.equal(secondLogin.user.id, firstLogin.user.id);
  assert.equal(secondLogin.user.role, "TECHNICIAN");
  assert.equal(secondLogin.user.email, updatedEmail);

  await prisma.user.update({
    where: { id: firstLogin.user.id },
    data: { isActive: false },
  });
  await assert.rejects(
    authService.completeExternalLogin({ ...identity, email: updatedEmail }),
    (error) => error.code === "USER_INACTIVE",
  );
  await prisma.user.update({
    where: { id: firstLogin.user.id },
    data: { isActive: true },
  });

  const conflictOwner = await prisma.user.create({
    data: {
      microsoftOid: `step5-owner-${tag}`,
      email: `step5-conflict-${tag}@helpdesk.local`,
      displayName: "Conflict Owner",
    },
  });
  createdUserIds.push(conflictOwner.id);
  await assert.rejects(
    authService.completeExternalLogin({
      microsoftOid: `step5-other-${tag}`,
      email: conflictOwner.email,
      displayName: "Wrong Identity",
    }),
    (error) => error.code === "EXTERNAL_IDENTITY_CONFLICT",
  );
});

test("OAuth state is browser-bound and PKCE values match", async () => {
  const transaction = await loginState.createLoginTransaction();
  assert.ok(transaction.codeVerifier.length >= 43);
  assert.equal(
    transaction.codeChallenge,
    createHash("sha256").update(transaction.codeVerifier).digest("base64url"),
  );
  await loginState.verifyLoginState(transaction.state, transaction.state);
  await assert.rejects(
    loginState.verifyLoginState(transaction.state, "different-browser-state"),
    loginState.InvalidLoginStateError,
  );
  await assert.rejects(
    loginState.verifyLoginState(undefined, transaction.state),
    loginState.InvalidLoginStateError,
  );
});

test("authentication cookies use secure production settings", () => {
  let written;
  let cleared;
  let successPath;
  const response = {
    cookie(name, value, options) {
      written = { name, value, options };
    },
    clearCookie(name, options) {
      cleared = { name, options };
    },
  };

  const previousEnvironment = process.env.NODE_ENV;
  const previousBasePath = process.env.PUBLIC_BASE_PATH;
  process.env.NODE_ENV = "production";
  process.env.PUBLIC_BASE_PATH = "/helpdesk";
  try {
    authCookie.setAuthenticationCookie(response, "signed-token", 3600);
    authCookie.clearAuthenticationCookie(response);
    successPath = authCookie.authenticationSuccessPath();
  } finally {
    process.env.NODE_ENV = previousEnvironment;
    process.env.PUBLIC_BASE_PATH = previousBasePath;
  }

  assert.equal(written.name, authCookie.AUTHENTICATION_COOKIE);
  assert.equal(written.options.httpOnly, true);
  assert.equal(written.options.secure, true);
  assert.equal(written.options.sameSite, "strict");
  assert.equal(written.options.path, "/helpdesk");
  assert.equal(written.options.maxAge, 3_600_000);
  assert.equal(successPath, "/helpdesk/api/v1/me");
  assert.deepEqual(cleared.options, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/helpdesk",
  });
  assert.equal(
    authCookie.readAuthenticationCookie(
      `another=value; ${authCookie.AUTHENTICATION_COOKIE}=signed-token`,
    ),
    "signed-token",
  );
});

test("development login cookie authenticates and logout clears it", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const microsoftStart = await fetch(`${baseUrl}/api/v1/auth/login`, {
      redirect: "manual",
    });
    assert.equal(microsoftStart.status, 302);
    const authorizationUrl = new URL(microsoftStart.headers.get("location"));
    assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
    assert.ok(authorizationUrl.searchParams.get("code_challenge"));
    const state = authorizationUrl.searchParams.get("state");
    assert.ok(state);
    const loginCookie = microsoftStart.headers.get("set-cookie");
    assert.ok(loginCookie?.includes("helpdesk_login="));
    assert.ok(loginCookie.includes("HttpOnly"));
    assert.ok(loginCookie.includes("SameSite=Lax"));

    const crossBrowserCallback = await fetch(
      `${baseUrl}/api/v1/auth/callback?state=${encodeURIComponent(state)}&code=unused`,
    );
    assert.equal(crossBrowserCallback.status, 400);
    assert.equal(
      (await crossBrowserCallback.json()).error,
      "INVALID_LOGIN_STATE",
    );

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/dev-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "student@helpdesk.local" }),
    });
    assert.equal(loginResponse.status, 200);
    const authenticationCookie = loginResponse.headers.get("set-cookie");
    assert.ok(authenticationCookie?.includes(`${authCookie.AUTHENTICATION_COOKIE}=`));
    assert.ok(authenticationCookie.includes("HttpOnly"));
    assert.ok(authenticationCookie.includes("SameSite=Strict"));
    const cookie = authenticationCookie.split(";", 1)[0];

    const currentUser = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { cookie },
    });
    assert.equal(currentUser.status, 200);
    assert.equal((await currentUser.json()).user.role, "STUDENT");

    const crossSiteChange = await fetch(`${baseUrl}/api/v1/categories`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Cross-site request" }),
    });
    assert.equal(crossSiteChange.status, 403);
    assert.equal(
      (await crossSiteChange.json()).error,
      "INVALID_REQUEST_ORIGIN",
    );

    const sameSiteChange = await fetch(`${baseUrl}/api/v1/categories`, {
      method: "POST",
      headers: {
        cookie,
        origin: baseUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Same-site request" }),
    });
    assert.equal(sameSiteChange.status, 403);
    assert.equal(
      (await sameSiteChange.json()).error,
      "CATEGORY_MANAGEMENT_FORBIDDEN",
    );

    const crossSiteLogout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(crossSiteLogout.status, 403);
    assert.equal(
      (await crossSiteLogout.json()).error,
      "INVALID_REQUEST_ORIGIN",
    );

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { cookie, origin: baseUrl },
    });
    assert.equal(logoutResponse.status, 204);
    const clearedCookie = logoutResponse.headers.get("set-cookie");
    assert.ok(clearedCookie?.includes(`${authCookie.AUTHENTICATION_COOKIE}=`));
    assert.ok(clearedCookie.includes("Expires=Thu, 01 Jan 1970"));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

async function createNotification(notificationType) {
  const requester = await prisma.user.findUniqueOrThrow({
    where: { email: "student@helpdesk.local" },
  });
  const category = await prisma.ticketCategory.findUniqueOrThrow({
    where: { name: "IT Support" },
  });
  const ticket = await prisma.ticket.create({
    data: {
      requesterId: requester.id,
      categoryId: category.id,
      title: `Step 5 notification ${tag}`,
    },
  });
  createdTicketIds.push(ticket.id);
  const notification = await prisma.emailNotification.create({
    data: {
      ticketId: ticket.id,
      recipientEmail: requester.email,
      notificationType,
    },
  });
  return { ticket, notification };
}

test("notification delivery records success and blocks duplicate in-flight sends", async () => {
  const { notification } = await createNotification("TICKET_CREATED");
  let sends = 0;
  notificationService.configureEmailProvider({
    async send() {
      sends += 1;
      return { providerMessageId: "step5-success" };
    },
  });
  assert.equal(await notificationService.deliverNotification(notification.id), true);
  const sent = await prisma.emailNotification.findUniqueOrThrow({
    where: { id: notification.id },
  });
  assert.equal(sent.deliveryStatus, "SENT");
  assert.equal(sent.attemptCount, 1);
  assert.equal(sent.providerMessageId, "step5-success");
  assert.equal(sent.nextAttemptAt, null);
  assert.equal(sends, 1);

  const duplicate = await createNotification("TICKET_UPDATED");
  let release;
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  const releasePromise = new Promise((resolve) => { release = resolve; });
  notificationService.configureEmailProvider({
    async send() {
      sends += 1;
      started();
      await releasePromise;
      return { providerMessageId: "step5-once" };
    },
  });
  const firstAttempt = notificationService.deliverNotification(
    duplicate.notification.id,
  );
  await startedPromise;
  const secondAttempt = await notificationService.deliverNotification(
    duplicate.notification.id,
  );
  assert.equal(secondAttempt, false);
  release();
  assert.equal(await firstAttempt, true);
  assert.equal(sends, 2);
});

test("notification retries stop at EXHAUSTED and logs omit sensitive data", async () => {
  const { ticket, notification } = await createNotification("TICKET_UPDATED");
  const sensitiveText = `secret-${tag}`;
  const retryDelays = [5, 15, 60, 360].map(
    (minutes) => minutes * 60 * 1_000,
  );
  notificationService.configureEmailProvider({
    async send() {
      throw Object.assign(new Error(sensitiveText), {
        code: "ECONNRESET",
        statusCode: 503,
      });
    },
  });

  const capturedLogs = [];
  const originalConsoleError = console.error;
  console.error = (...values) => capturedLogs.push(values.join(" "));
  try {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const attemptedAt = Date.now();
      assert.equal(
        await notificationService.deliverNotification(notification.id),
        false,
      );
      const record = await prisma.emailNotification.findUniqueOrThrow({
        where: { id: notification.id },
      });
      assert.equal(record.attemptCount, attempt);

      if (attempt < 5) {
        assert.equal(record.deliveryStatus, "FAILED");
        assert.ok(record.nextAttemptAt);
        const scheduledDelay = record.nextAttemptAt.getTime() - attemptedAt;
        assert.ok(scheduledDelay >= retryDelays[attempt - 1]);
        assert.ok(scheduledDelay < retryDelays[attempt - 1] + 2_000);
        await prisma.emailNotification.update({
          where: { id: notification.id },
          data: { nextAttemptAt: new Date(0) },
        });
      } else {
        assert.equal(record.deliveryStatus, "EXHAUSTED");
        assert.equal(record.nextAttemptAt, null);
      }
      assert.ok(!record.errorMessage?.includes(sensitiveText));
    }
  } finally {
    console.error = originalConsoleError;
  }

  const logs = capturedLogs.join("\n");
  assert.ok(!logs.includes(sensitiveText));
  assert.ok(!logs.includes(notification.recipientEmail));
  assert.ok(!logs.includes(ticket.title));
  assert.deepEqual(
    safeErrorDetails(Object.assign(new Error(sensitiveText), {
      code: "ECONNRESET",
      statusCode: 503,
    })),
    { errorType: "Error", code: "ECONNRESET", upstreamStatus: 503 },
  );
});
