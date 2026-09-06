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

- [ ] Inspect the existing local database without resetting it.
- [ ] Start PostgreSQL through Docker Compose.
- [ ] Use a separate local test database where practical.
- [ ] Apply the committed migrations.
- [ ] Run the development seed.
- [ ] Confirm the expected tables, columns, and migration history.

Pass condition: PostgreSQL starts, migrations apply, and the seed succeeds.

## Step 3 — Core backend workflow

- [ ] Start the backend and check `/health`.
- [ ] Test development login, JWT validation, and `/api/v1/me`.
- [ ] Test student, faculty, technician, and administrator RBAC.
- [ ] Test category management.
- [ ] Test ticket creation, listing, and detail.
- [ ] Test claiming, assignment, and status changes.
- [ ] Test comments and history.
- [ ] Test inactive-user rejection.

Pass condition: the complete local workflow behaves correctly for every role.

## Step 4 — Backend hardening

- [ ] Return suitable `4xx` errors for malformed or oversized JSON.
- [ ] Return stable errors for database constraint conflicts.
- [ ] Protect ticket reassignment from concurrent duplicate changes.
- [ ] Validate startup configuration and ports.
- [ ] Bind the backend to the intended private interface.
- [ ] Add `/ready` to check PostgreSQL readiness.
- [ ] Confirm graceful shutdown.
- [ ] Rebuild and run focused regression checks.

Pass condition: the hardened backend passes its focused checks after a clean build.

## Step 5 — Authentication and notifications

- [ ] Test external login for a new user and an existing user.
- [ ] Test inactive-user rejection and identity conflicts.
- [ ] Test OAuth state, browser binding, and PKCE.
- [ ] Finalize the secure `HttpOnly` authentication cookie.
- [ ] Implement and test logout.
- [ ] Test notification success, retries, attempt limits, and terminal failure.
- [ ] Confirm logs do not expose secrets or sensitive ticket information.

Pass condition: authentication and notification checks pass locally without Azure.

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
