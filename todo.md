# Campus HelpDesk remaining work

This is the shared handoff document for the remaining project work.

Final project deadline shown in the course guideline: **Wednesday,
23 September 2026**.

## 1. Ownership and working boundaries

| Owner | Primary paths | Responsibility |
| --- | --- | --- |
| Danila — backend owner | `src/**` except the member directories | Express application, PostgreSQL/Prisma, business rules, RBAC, validation, documentation, and automated backend tests |
| Alex — provider and deployment owner | `src/alex/**`, `deploy/alex/**` | Microsoft Entra ID, Azure Key Vault, Brevo, Linux hosting, Nginx, HTTPS, and deployment automation |
| Andrei — peer integration owner | `src/andrei/**` | EduCore client, inbound peer endpoint, peer API-key authentication, and the final peer contract |

Shared contracts remain under `src/providers/**`. A member must coordinate with
Danila before changing a shared contract or a file outside that member's paths.

Every agent must also follow the repository `AGENTS.md` and the more specific
`AGENTS.md` inside its assigned directory.

## 2. Rules that apply to everyone

- Keep business services independent from Azure, Brevo, Microsoft SDKs, and
  EduCore-specific HTTP code.
- Implement external systems through the shared provider interfaces.
- Import member-owned code through the nearest `index.ts` entry point.
- Do not query Prisma or repositories directly from provider or peer-route code;
  call a public backend service.
- Never commit real secrets, access tokens, API keys, private keys, or a
  production `.env` file.
- Never print secrets or sensitive ticket descriptions in logs.
- Preserve all existing public API behavior.
- Do not break the existing server's `/content` or `/api` routes when adding the
  `/helpdesk/` reverse-proxy path.
- Ask the user before running builds, automated tests, database tests, or live
  service tests. `git diff` and `git diff --check` may be read without asking.
- Preserve unrelated uncommitted work. Do not use `git add .` blindly.
- Each member should work from the agreed baseline on a separate branch, commit
  their own work, and merge through a reviewed pull request so contribution
  history remains clear.

## 3. Completed standalone backend baseline

The following backend work is complete:

- [x] Express application and `/health` endpoint
- [x] PostgreSQL Docker Compose development database
- [x] Prisma schema, migration, generated client, and seed data
- [x] Focused repositories and shared Prisma transaction support
- [x] Development login and application JWT handling
- [x] Authentication middleware and active-user checks
- [x] Ticket creation, listing, detail, claiming, assignment, and status changes
- [x] Ticket resolution rules and concurrent claim protection
- [x] Ticket comments and history
- [x] Role-based access control and ownership checks
- [x] User and category administration
- [x] Shared request validation using internal TypeScript validators
- [x] Shared JSON error handling
- [x] Persistent email-notification records
- [x] Notification success/failure recording and retry orchestration
- [x] Local development identity, environment-secret, and console-email providers
- [x] Shared provider contracts for identity, secrets, email, and EduCore
- [x] Ticket service split into commands, queries, comments, access, delivery,
  and errors
- [x] Explicit Alex and Andrei source ownership directories

The core build, ticket workflow, RBAC matrix, migration, seed, database workflow,
notification success path, concurrent claiming, health endpoint, and 404 response
passed before the latest Alex/Andrei directory restructuring.

**Important:** the latest ownership restructuring has only passed
`git diff --check`. It still needs an approved TypeScript build and route smoke
check before it becomes the new verified baseline.

## 4. Immediate shared checkpoint before parallel work

Owner: **Danila**, with user approval for executable verification.

- [ ] Run the TypeScript/Prisma build after the directory restructuring.
- [ ] Run strict unused-code TypeScript checks.
- [ ] Confirm these unchanged routes:
  - `POST /api/v1/auth/dev-login`
  - `GET /api/v1/me`
  - `GET /api/v1/auth/login` returns the Alex placeholder until implemented
  - `GET /api/v1/auth/callback` returns the Alex placeholder until implemented
  - `POST /peer/tickets` returns the Andrei placeholder until implemented
- [ ] Confirm the local database workflow still passes.
- [ ] Review the complete uncommitted diff and all untracked files.
- [ ] Confirm `.env`, `dist/`, `generated/`, and `node_modules/` remain ignored.
- [ ] After explicit deletion approval, remove only the obsolete empty
  `src/error_handling/` directory.
- [ ] Create a clean shared baseline commit before Alex and Andrei create their
  working branches.

Definition of done:

- The ownership refactor compiles and preserves current development behavior.
- The working tree is understood and the baseline is safe for parallel work.

## 5. Danila — remaining backend-owner work

### 5.1 Configuration validation

Primary area: create a focused configuration module under `src/`.

- [ ] Validate `NODE_ENV` against the allowed environments.
- [ ] Validate `PORT` as an integer in the valid TCP port range.
- [ ] In development, fail startup clearly when `DATABASE_URL` or `JWT_SECRET`
  is missing.
- [ ] Validate non-secret settings such as the public base path and EduCore base
  URL when the corresponding integration is enabled.
- [ ] Keep production secret retrieval behind Alex's `SecretProvider`.
- [ ] Return readable startup errors without revealing secret values.

Definition of done:

- Invalid critical configuration stops startup with a precise safe message.
- Valid development configuration starts without requiring cloud services.

### 5.2 Main README

Create a professional root `README.md` containing:

- [ ] Project purpose and main features
- [ ] Architecture and request-flow overview
- [ ] Repository and team ownership structure
- [ ] Requirements and local installation
- [ ] Safe `.env` setup using `.env.example`
- [ ] Database start, migration, seed, stop, and reset guidance
- [ ] Development, build, and production start commands
- [ ] Development accounts for every role
- [ ] Role and permission matrix
- [ ] API authentication and example requests
- [ ] Provider architecture and local-versus-production behavior
- [ ] Alex's deployment and production-provider section
- [ ] Andrei's peer API contract and integration section
- [ ] Live-system testing instructions for the instructor
- [ ] Troubleshooting without exposing credentials

Alex and Andrei must supply the final details for their own README sections.

### 5.3 API documentation

- [ ] Create an OpenAPI document, preferably `openapi.yaml`.
- [ ] Document every `/api/v1` and `/peer` endpoint.
- [ ] Document path parameters, request bodies, response bodies, and status
  codes.
- [ ] Document Bearer JWT authentication and peer `x-api-key` authentication.
- [ ] Document role and ownership requirements per endpoint.
- [ ] Document development-login accounts and safe example requests.
- [ ] Document service error codes and validation errors.
- [ ] Optionally expose Swagger UI; this is useful but is not a core course
  requirement if the OpenAPI and README documentation are complete.

### 5.4 Permanent automated tests

The repository currently has no `npm test` script or permanent test suite.

- [ ] Select a small TypeScript-compatible test setup.
- [ ] Add unit tests for request validation and ticket access rules.
- [ ] Add unit tests for allowed and forbidden ticket status transitions.
- [ ] Add tests for notification success, failure recording, duplicate-delivery
  suppression, and retry behavior.
- [ ] Add API/database tests for development login and authentication failures.
- [ ] Add API/database tests for the ticket workflow and ownership isolation.
- [ ] Add API/database tests for user and category administration.
- [ ] Keep the concurrent ticket-claim test.
- [ ] Ensure database tests create uniquely named records and always clean them
  up.
- [ ] Add an `npm test` script and document it in the README.

Automated tests are a quality safeguard. The course guideline directly requires
a working live system, even if it does not explicitly require a specific test
framework.

### 5.5 Git and checklist cleanup

- [ ] Review the large cumulative diff by feature.
- [ ] Confirm all old error-handling paths were replaced with `src/errors/`.
- [ ] Review every untracked source and documentation file.
- [ ] Scan staged changes for accidental secrets before every commit.
- [ ] Split work into understandable commits without rewriting teammates' work.
- [ ] Update `project_description/IMPLEMENTATION_CHECKLIST.md` as items finish.
- [ ] Keep this `todo.md` current after each merged responsibility.

### 5.6 Blocking request from Alex — external login service

Status: this is the only thing standing between the project and a working
university Microsoft login. Everything else in the flow is implemented,
deployed, and verified on the VM.

**What already works.** `GET /api/v1/auth/login` and
`GET /api/v1/auth/callback` are implemented in `src/alex/identity/`. A real
university account can sign in, and the callback verifies the OAuth state,
exchanges the authorization code, validates the Microsoft token through MSAL,
checks the tenant, and produces a verified `ExternalIdentity`
(`{ microsoftOid, email, displayName }`).

**Why it stops there.** Turning that identity into a local user and an
application JWT means writing to the `users` table, and `AGENTS.md` forbids
member code from calling repositories or Prisma directly. `auth.service.ts`
exports only `developmentLogin` and `authenticateAccessToken`, neither of which
accepts an external identity. So the callback currently answers 501 and echoes
the resolved identity back, purely so the flow can be verified end to end.

**The exact call site.** In `src/alex/identity/entra.routes.ts`, inside
`completeMicrosoftLogin`, there is a commented block marked `PENDING`. When the
service below exists, that block becomes two lines and the 501 disappears.

- [ ] Add a public function to `src/services/auth.service.ts`:

      completeExternalLogin(identity: ExternalIdentity): Promise<LoginResult>

  It should upsert the local user by `microsoftOid` using the existing
  `upsertUserFromIdentity` repository, reject an inactive user with the existing
  `AuthenticationError("USER_INACTIVE", ...)`, and return the same
  `{ accessToken, tokenType, expiresInSeconds, user }` shape that
  `developmentLogin` already returns. Re-export `ExternalIdentity` from the
  service layer if you would rather members did not import from
  `src/providers/**` directly.
- [ ] Confirm the default role for a first-time university user.
  `project_description/DEVELOPMENT_LOGIC.md` section 8.2 says `STUDENT`, and
  the Prisma default already matches.
- [ ] Consider renaming `DevelopmentLoginResult`, since Microsoft login will
  return the same shape and the name will be misleading.

#### 5.6.1 Two problems that appear as soon as this works

Both were found while deploying and neither is fixable from `src/alex/**`.

**No administrator can exist in production.** `upsertUserFromIdentity` creates
users with the default role `STUDENT`. Promoting anyone requires an existing
`ADMIN`, because `updateUserForAdministrator` calls `requireUserAdministrator`.
The only seeded administrator, `admin@helpdesk.local`, is reachable solely
through `developmentLogin`, which is disabled when `NODE_ENV=production`. So
after the production switch there is no path to an administrator through the
API at all, and the administration endpoints become untestable and
undemonstrable.

- [ ] Decide how the first administrator is created in production. A documented
  one-off `UPDATE users SET role = 'ADMIN' WHERE email = '...'` is acceptable
  and is what the deployment runbook currently describes, but it should be a
  deliberate decision rather than an accident, and it needs to be written down
  for the grader.

**A seeded email can break Microsoft login.** `upsertUserFromIdentity` matches
on `microsoftOid`. If a real university address happens to equal a seeded one,
the upsert finds no matching `microsoftOid`, tries to *create* a second row with
an existing `email`, and fails on the unique constraint. The user sees an
unhandled Prisma error rather than anything meaningful.

- [ ] Decide the desired behaviour when the email already belongs to a
  different `microsoftOid`: adopt the existing row, fail with a clear
  `AuthenticationError`, or keep the seeded addresses on a domain that real
  accounts cannot use. Unlikely with `@helpdesk.local`, but cheap to make
  explicit while writing 5.6.

### 5.7 Smaller core observations raised by Alex

None of these block Alex, but they sit in the backend owner's area:

- [ ] Add the optional `GET /ready` readiness endpoint from
  `project_description/DEVELOPMENT_LOGIC.md` section 10. `GET /health`
  returns 200 without touching PostgreSQL, so it reports a healthy service
  even when the database is unreachable. This happened on the deployed VM:
  after a reboot the database container did not come back, and for roughly
  eight minutes `/health` answered `{"status":"ok"}` while no authenticated
  request could be served and the notification retry worker was failing on
  every pass. A readiness check that runs a trivial query such as
  `SELECT 1` and answers 503 when it fails would make process supervision,
  uptime checks, and deployment verification meaningful.
- [ ] `package.json` has no `engines` field. The code uses ESM top-level
  `await`, so the supported Node version (22 or newer) should be pinned for
  deployment.
- [ ] `src/database/prisma.ts` and `src/services/token.service.ts` resolve
  secrets with top-level `await` at import time. Test setup in section 5.4 must
  supply `DATABASE_URL` and `JWT_SECRET` before the module graph loads, or the
  modules need an injection seam.
- [ ] `prisma/seed.ts` is outside the `tsconfig.json` `include` array, so `tsc`
  never typechecks it.
- [ ] `PUBLIC_BASE_PATH` exists in `.env.example` but nothing reads it. The app
  serves absolute paths and Nginx strips the `/helpdesk` prefix, so either wire
  it into section 5.1 configuration validation or remove it from the example.
- [ ] Deprecation from `pg` observed at runtime on the deployed VM: "Calling
  `client.query()` when the client is already executing a query is deprecated
  and will be removed in pg@9.0". It appears during normal ticket creation,
  most likely where the notification retry worker overlaps a request on the
  same client. Harmless today, breaking on `pg@9`.
- [ ] RBAC divergence: `requireTicketClaimAccess` allows `TECHNICIAN` only, but
  `DEVELOPMENT_LOGIC.md` sections 8.3 and 9.2 both say an administrator may
  claim an unassigned ticket. An administrator also cannot assign a ticket to
  themselves, because `assignTicketTechnician` requires the assignee to be a
  `TECHNICIAN`. The result is that no administrator can take ownership of a
  ticket. Either fix the code or update the document.

## 6. Alex — production providers

Primary source path: `src/alex/**`.

### 6.1 Azure Key Vault

Target: replace `src/alex/secrets/production-secret-provider.ts`.

- [x] Implement the shared `SecretProvider` contract.
- [x] Use Azure managed identity/`DefaultAzureCredential` where possible.
- [x] Retrieve production secrets at runtime rather than from `.env`.
- [x] Support the agreed Key Vault names for:
  - database URL;
  - JWT secret;
  - Brevo API key;
  - inbound peer API key;
  - outbound EduCore API key;
  - Entra client secret, only if required by the chosen flow.
- [x] Cache safely where appropriate without logging values.
- [x] Fail startup clearly if a critical secret cannot be loaded.
- [x] Document Azure identity permissions and required secret names.

Definition of done:

- The production application starts without production secrets in `.env`.
- Missing Key Vault access produces a safe readable startup failure.

### 6.2 Microsoft Entra ID

Target: replace the placeholders under `src/alex/identity/`.

- [x] Implement the university Microsoft authorization-code flow using
  OIDC/MSAL/OAuth 2.0.
- [x] Implement `GET /api/v1/auth/login`.
- [x] Implement `GET /api/v1/auth/callback`.
- [x] Validate authentication state, callback data, and Microsoft tokens.
- [x] Restrict authentication to the intended university tenant.
- [x] Normalize Microsoft `oid`, email, and display name through the shared
  identity contract.
- [ ] Agree with Danila how a first-time university user is provisioned and
  which default local role is assigned.
- [ ] Coordinate with Danila on the smallest core service needed to upsert or
  resolve the local user.
- [ ] Issue the existing application JWT after successful Microsoft login.
  Blocked on section 5.6; the call site is marked in
  `src/alex/identity/entra.routes.ts`.
- [x] Keep authorization roles in PostgreSQL rather than trusting Microsoft
  group claims.
- [ ] Reject inactive local users even after successful Microsoft login.
  Belongs to the core service in section 5.6, which already has the check.
- [x] Keep development login available outside production.
- [x] Document tenant ID, client ID, callback URL, and any required secret name.

Definition of done:

- A university user can complete real Microsoft login.
- The returned application JWT works on protected HelpDesk routes.
- Disabled users are rejected.

### 6.3 Brevo Email API

Target: replace `src/alex/email/production-email-provider.ts`.

- [x] Implement the shared `EmailProvider` contract using Brevo's public API.
- [x] Retrieve the API key through the configured secret provider.
- [x] Create and verify the approved Brevo sender identity.
- [x] Return Brevo's provider message ID on success.
- [x] Throw a safe error on failure so the existing notification service records
  `FAILED` and retries it.
- [x] Do not log ticket descriptions, API keys, or authorization headers.
- [x] Document required non-secret settings and Key Vault secret name.

Definition of done:

- A real ticket event sends a Brevo email.
- The database stores `SENT` and the provider message ID.
- A simulated Brevo failure does not undo the ticket operation and is retried.

## 7. Alex — hosting and deployment

Primary path: `deploy/alex/**`.

- [x] Provision the approved hardened Linux VPS, preferably an Azure Linux VM.
- [x] Configure managed identity and Key Vault access.
- [x] Provision or connect production PostgreSQL with a dedicated application
  user.
- [x] Keep PostgreSQL private; do not expose its port to the internet.
- [x] Create Docker Compose or an automated deployment script.
- [x] Run `prisma migrate deploy` as a controlled release step.
- [x] Run the application as a non-root user or container.
- [x] Configure automatic restart after failure and VM reboot.
- [x] Configure Nginx so only `/helpdesk/` is routed to this application.
- [x] Preserve existing `/content` and `/api` behavior on the shared server.
- [x] Keep the Express application port private.
- [x] Configure HTTPS with Let's Encrypt and automatic renewal.
- [x] Configure SSH keys, disable root password login, and enable the firewall.
- [ ] Enable safe operational logs without secrets or sensitive ticket content.
- [x] Write live deployment, migration, rollback, restart, and troubleshooting
  instructions.

Definition of done:

- A public HTTPS `/helpdesk/` URL reaches the application.
- Existing server routes still work.
- Database and application ports are not public.
- The application survives a VM reboot.
- Deployment can be repeated from repository instructions or automation.

## 8. Andrei — EduCore peer integration

Primary path: `src/andrei/**`.

### 8.1 Freeze the peer contract first

Agree and document with the EduCore team:

- [ ] Exact EduCore team/project name
- [ ] Base URLs for both deployed systems
- [ ] Student identifier and requester-resolution rule
- [ ] Inbound `POST /peer/tickets` request body
- [ ] Success response and all error responses
- [ ] Required and optional ticket fields
- [ ] Whether repeated requests need an idempotency key
- [ ] Outbound `GET /peer/enrollments/:studentId` response body
- [ ] How enrollment data affects or enriches ticket creation
- [ ] Inbound and outbound API-key exchange procedure
- [ ] Timeout and failure behavior when either system is unavailable
- [ ] Safe examples for README and OpenAPI documentation

Do not finalize code against a guessed contract.

### 8.2 Local fixture provider

- [ ] Implement a fixture `EnrollmentProvider` for development.
- [ ] Return realistic enrollment data without contacting EduCore.
- [ ] Make it easy to select the fixture outside production.
- [ ] Add deterministic success, not-found, and unavailable cases.

### 8.3 Inbound HelpDesk peer API

Target: replace the placeholder under `src/andrei/peer/`.

- [ ] Implement timing-safe `x-api-key` authentication.
- [ ] Read the inbound key through the shared secret provider.
- [ ] Reject missing or invalid keys without revealing the expected value.
- [ ] Validate the agreed peer request body.
- [ ] Implement `POST /peer/tickets`.
- [ ] Coordinate with Danila on a public core service for peer ticket creation;
  do not call Prisma or repositories directly.
- [ ] Ensure peer-created tickets use `TicketSource.EDUCORE`.
- [ ] Resolve the requester using the agreed student identity rule.
- [ ] Create ticket history and notifications through existing orchestration.
- [ ] Return the agreed response and error format.

Definition of done:

- An invalid key is rejected.
- A valid EduCore request creates exactly one correct HelpDesk ticket.
- The ticket is visible to the appropriate requester, technician, and admin.

### 8.4 Outbound EduCore API

Target: replace `src/andrei/educore/production-enrollment-provider.ts`.

- [ ] Implement the shared `EnrollmentProvider` contract.
- [ ] Read `EDUCORE_BASE_URL` from validated non-secret configuration.
- [ ] Read the outbound API key through the shared secret provider.
- [ ] Send the key in `x-api-key`.
- [ ] Apply a reasonable timeout.
- [ ] Validate EduCore's response before returning enrollment objects.
- [ ] Map not-found, unauthorized, invalid-response, timeout, and unavailable
  cases into clear integration errors.
- [ ] Use the enrollment data according to the agreed user flow.

Definition of done:

- HelpDesk fetches and uses real enrollment information from EduCore.
- Failures follow the agreed behavior and do not expose keys.

### 8.5 Two-way verification

- [ ] Test EduCore calling HelpDesk `POST /peer/tickets`.
- [ ] Test HelpDesk calling EduCore enrollment lookup.
- [ ] Test valid and invalid keys in both directions.
- [ ] Test timeout, unavailable service, malformed response, and duplicate
  request behavior.
- [ ] Supply final peer documentation to Danila for README and OpenAPI.

## 9. Final integration checkpoint

Owners: **all team members**.

- [ ] Wire Alex's real providers without changing core business services.
- [ ] Wire Andrei's real peer implementation through its entry points.
- [ ] Confirm development still works with local providers and no cloud access.
- [ ] Confirm production refuses to silently fall back to local secrets or fake
  providers.
- [ ] Run migration and seed checks in a safe non-production environment.
- [ ] Run the complete automated suite.
- [ ] Test every API endpoint and role against the deployed system.
- [ ] Test notification success, failure, persistence, and retry with Brevo.
- [ ] Test Entra login and disabled-user rejection.
- [ ] Test valid and invalid peer requests in both directions.
- [ ] Confirm `/health`, 404 behavior, graceful shutdown, and restart behavior.
- [ ] Confirm no secret appears in Git history, application responses, or logs.
- [ ] Update the implementation checklist and README with the final behavior.

## 10. Final submission deliverables

Owners: **all team members**.

- [ ] GitHub contains complete source code, Prisma schema, migrations,
  deployment automation, and documentation.
- [ ] Root README contains architecture, installation, live-system instructions,
  and complete peer API documentation.
- [ ] Instructor can reach and test the live HTTPS system.
- [ ] Prepare safe test accounts/instructions for each role.
- [ ] Confirm the deployed URL and all required routes immediately before
  submission.
- [ ] Record a video no longer than 10 minutes demonstrating:
  - the live deployed system;
  - successful core features and RBAC;
  - important code structure;
  - Prisma schema and migrations;
  - Azure Key Vault integration;
  - Microsoft login;
  - Brevo notification delivery;
  - both directions of EduCore integration.
- [ ] Submit the video file or link in the designated Microsoft Teams assignment
  channel.

## 11. Final definition of done

The project is finished only when all of the following are true:

- [ ] The standalone HelpDesk backend remains functional.
- [ ] University users authenticate through Microsoft Entra ID.
- [ ] Production secrets load from Azure Key Vault at runtime.
- [ ] Brevo sends real notifications without coupling email success to ticket
  success.
- [ ] HelpDesk securely exposes and consumes the agreed EduCore APIs.
- [ ] The backend is publicly available through HTTPS at `/helpdesk/`.
- [ ] Deployment is repeatable and does not break existing server routes.
- [ ] PostgreSQL is private and migrations are controlled.
- [ ] GitHub, README, live testing instructions, and the demonstration video are
  complete.
- [ ] No credentials or sensitive ticket data are exposed.
