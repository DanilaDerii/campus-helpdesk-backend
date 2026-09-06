# Campus HelpDesk completion plan

Complete and verify one step before starting the next. If something fails, fix
it within the current step. EduCore is no longer part of the project.

Builds, tests, Docker, and the local PostgreSQL database are approved. Inspect
existing data before changing it. Back up PostgreSQL before Azure migrations.
Do not commit secrets.

## Step 1 — Environment and build

- [x] Record the current Git state so existing work is protected.
- [x] Check Node.js, npm, Docker, and Docker Compose.
- [x] Synchronize dependencies with `package-lock.json`.
- [x] Generate the Prisma client.
- [x] Compile TypeScript.
- [x] Fix build errors without starting unrelated work.

Pass condition: Prisma generation and the TypeScript build finish successfully.

Result: passed with Node.js 22.23.2 and Prisma 7.10.0.

## Step 2 — Local PostgreSQL

- [x] Inspect the existing local database without resetting it.
- [x] Start PostgreSQL through Docker Compose.
- [x] Use a separate local test database where practical.
- [x] Apply the committed migrations.
- [x] Run the development seed.
- [x] Confirm the expected tables, columns, and migration history.

Pass condition: PostgreSQL starts, migrations apply, and the seed succeeds.

Result: passed using the isolated `helpdesk_step2_7297b6d` database. The normal
local `helpdesk` database was inspected but not migrated or seeded again.

## Step 3 — Core backend workflow

- [x] Start the backend and check `/health`.
- [x] Test development login, JWT validation, and `/api/v1/me`.
- [x] Test student, faculty, technician, and administrator RBAC.
- [x] Test category management.
- [x] Test ticket creation, listing, and detail.
- [x] Test claiming, assignment, and status changes.
- [x] Test comments and history.
- [x] Test inactive-user rejection.

Pass condition: the complete local workflow behaves correctly for every role.

Result: passed 43 HTTP checks against `helpdesk_step2_7297b6d`. All four
development users were left active and all generated notifications reached `SENT`.

## Step 4 — Backend hardening

- [x] Return suitable `4xx` errors for malformed or oversized JSON.
- [x] Return stable errors for database constraint conflicts.
- [x] Protect ticket reassignment from concurrent duplicate changes.
- [x] Validate startup configuration and ports.
- [x] Bind the backend to the intended private interface.
- [x] Add `/ready` to check PostgreSQL readiness.
- [x] Confirm graceful shutdown.
- [x] Resolve the `pg` concurrent-query deprecation warning before pg 9.
- [x] Rebuild and run focused regression checks.

Pass condition: the hardened backend passes its focused checks after a clean build.

Result: passed a clean build, strict TypeScript checks, 14 configuration checks,
19 focused hardening checks, the complete 43-check workflow, database-down
readiness/recovery, and traced graceful shutdown without the `pg` warning.

## Step 5 — Authentication and notifications

- [x] Test external login for a new user and an existing user.
- [x] Test inactive-user rejection and identity conflicts.
- [x] Test OAuth state, browser binding, and PKCE.
- [x] Finalize the secure `HttpOnly` authentication cookie.
- [x] Implement and test logout.
- [x] Test notification success, retries, attempt limits, and terminal failure.
- [x] Confirm logs do not expose secrets or sensitive ticket information.

Pass condition: authentication and notification checks pass locally without Azure.

Result: six permanent tests pass against the isolated database, covering external
identity lifecycle, PKCE/state, secure cookies, cookie authentication/logout,
same-origin request protection, successful and duplicate delivery, bounded retries,
`EXHAUSTED`, and sanitized logs. The complete 43-check Bearer-token workflow also
still passes.

## Step 6 — Deployment preparation

- [ ] Fix release and rollback behavior in the deployment script.
- [ ] Remove the production PostgreSQL password fallback.
- [ ] Add database backup and migration safeguards.
- [ ] Make readiness failures stop deployment.
- [ ] Review Nginx, systemd, and log-retention configuration.
- [ ] Review the remaining Prisma toolchain security advisories without forcing
  a downgrade to Prisma 6.
- [ ] Review the complete Git diff.
- [ ] Check that no secrets are tracked.
- [ ] Remove temporary documentation after preserving useful information.

Pass condition: the backend deployment is clean, documented, and ready to commit.

## Step 7 — Azure integration

- [ ] Inspect Alex's existing VM before changing it.
- [ ] Reuse the VM if it is in a recoverable state.
- [ ] Back up the Azure PostgreSQL database.
- [ ] Confirm the required Key Vault secrets without displaying their values.
- [ ] Deploy the tested backend and apply migrations.
- [ ] Test real Microsoft Entra login.
- [ ] Promote the intended first administrator manually in PostgreSQL.
- [ ] Test Key Vault, Brevo, PostgreSQL, Nginx, and HTTPS.
- [ ] Confirm `/helpdesk/`, `/health`, `/ready`, restart, and reboot behavior.

Pass condition: the public backend works through Azure with its real integrations.

## Step 8 — Frontend readiness

- [ ] Freeze authentication behavior and API response formats.
- [ ] Write the required API or OpenAPI documentation.
- [ ] Confirm the endpoints required by the frontend.
- [ ] Declare the backend ready for frontend development.

Pass condition: the frontend can be built against a stable, documented backend.
