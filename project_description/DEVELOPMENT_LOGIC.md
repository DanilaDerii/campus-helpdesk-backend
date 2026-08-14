# Campus HelpDesk Development Logic

## 1. Purpose

This document converts the course guidelines, the Campus HelpDesk proposal, and the development discussion into one implementation plan.

The project is a small but complete REST backend. It should be developed locally first, with cloud services hidden behind replaceable modules. After the local features work, the production modules can be connected and the same application can be deployed to a Linux VPS.

**Development priority:** the team will first implement and stabilize its own Campus HelpDesk application. Integration with the other group's EduCore project will be done later, after the core database, authentication, RBAC, ticket workflow, comments, history, and administration features work locally. During initial development, EduCore will be represented only by an interface and local fixture/mock data so that the other group cannot block HelpDesk development.

The required result is a live backend, not necessarily a large frontend application. A simple Swagger/OpenAPI page, Postman collection, or small demo client is enough to demonstrate the API unless the instructor later asks for a frontend.

## 2. Source requirements

The course requires:

- A hardened Linux VPS on Azure or Oracle Cloud.
- A public route under a new path, such as `/helpdesk`, without breaking existing `/content` or `/api` routes.
- Nginx as a reverse proxy and HTTPS from Let's Encrypt.
- A Node.js/Express or Go REST API.
- MySQL or PostgreSQL, Prisma ORM, and Prisma migrations.
- JWT authentication, role-based access control (RBAC), and university Microsoft Active Directory integration through MSAL, OAuth 2.0, or OIDC.
- Production secrets loaded at runtime from the class Azure Key Vault. Production secrets must not be kept in a local `.env` file.
- At least one public third-party API. This project uses Brevo Email API.
- A two-way peer-team integration: expose an API to the peer and consume an API from the peer. Both directions use an `x-api-key` header.
- All source code in GitHub.
- Automated deployment through a deployment script or Docker Compose.
- A professional README with architecture, setup instructions, and peer API documentation.
- A live system for grading and a video of no more than 10 minutes.

The grading images contain two dates with different meanings:

- Proposal due date: **22 July 2026**.
- Overall project due date: **23 September 2026**.

This should be confirmed with the instructor, but it is reasonable to treat the July date as the proposal deadline and the September date as the finished-system deadline.

## 3. Working technology choices

These choices fit the proposal and keep Prisma simple:

- Language: TypeScript.
- Backend: Node.js and Express.
- Database: PostgreSQL.
- ORM and migrations: Prisma.
- Development runtime: local Node.js plus local PostgreSQL, or Docker Compose.
- Production host: Azure Linux VM is preferred because managed identity makes Azure Key Vault access easier. Oracle Cloud is still allowed.
- Production proxy: Nginx.
- TLS: Certbot and Let's Encrypt.
- Authentication: Microsoft Entra ID/Active Directory in production, with application JWTs used by the API.
- Email: Brevo.
- Secrets: Azure Key Vault.

These are implementation decisions, not extra course requirements. PostgreSQL can be replaced by MySQL before development starts without changing the business design.

## 4. Main design rule

Business code must not directly know whether it is running locally or in Azure.

```text
HTTP route
    -> authentication and RBAC middleware
    -> controller
    -> application service
    -> repository or provider interface
    -> local implementation OR production implementation
```

The application service contains HelpDesk rules. Provider modules contain external details.

| Concern | Interface used by application | Local implementation | Production implementation |
|---|---|---|---|
| Secrets | `SecretProvider` | Reads development environment variables | Reads Azure Key Vault |
| Authentication | `IdentityProvider` | Development-only local login | Microsoft Entra ID through OIDC/MSAL |
| Token handling | `TokenService` | Signs and verifies development JWTs | Signs and verifies JWTs with a Key Vault secret |
| Database | Prisma repositories | Local PostgreSQL | PostgreSQL reachable from the VM |
| Email | `EmailProvider` | Logs email or uses a fake provider | Brevo API |
| EduCore peer API | `EnrollmentProvider` | Returns fixture data | Calls the peer team's API |
| Time/IDs where useful | `Clock` or normal helpers | Predictable values in tests | Real system values |

Only the application composition/bootstrap layer chooses implementations. Ticket controllers and ticket services must not import Azure, Brevo, or MSAL SDKs.

## 5. Proposed project structure

```text
src/
  app.ts                     Express application assembly
  server.ts                  Process startup
  config/                    Non-secret settings and validation
  domain/                    Roles, statuses, errors, and core types
  middleware/                JWT, RBAC, validation, error handling
  modules/
    auth/                    Login, callback, identity sync, JWT
    users/                   User administration
    categories/              Ticket-category administration
    tickets/                 Tickets, claiming, status rules
    comments/                Ticket comments
    history/                 Audit history
    notifications/           Notification records and email sending
    peer/                    Inbound peer route and outbound EduCore client
  providers/
    secrets/
      secret-provider.ts
      env-secret-provider.ts
      azure-key-vault-secret-provider.ts
    identity/
      identity-provider.ts
      development-identity-provider.ts
      entra-identity-provider.ts
    email/
      email-provider.ts
      console-email-provider.ts
      brevo-email-provider.ts
    educore/
      enrollment-provider.ts
      fixture-enrollment-provider.ts
      educore-api-provider.ts
  repositories/              Prisma-backed data access
  routes/                    Route registration
  jobs/                      Optional notification retry worker
prisma/
  schema.prisma
  migrations/
  seed.ts
deploy/
  nginx/
  scripts/
docker-compose.yml
.env.example                 Names and safe examples only; no real secrets
README.md
```

The exact folder names may change. The important rule is that business rules, database access, and external providers remain separate.

## 6. Application startup logic

1. Read non-secret configuration such as environment name, port, public base path, Entra tenant ID, and Key Vault URL.
2. Choose `EnvSecretProvider` in development or `AzureKeyVaultSecretProvider` in production.
3. Load required secrets through `SecretProvider`:
   - database connection string;
   - application JWT signing secret;
   - Brevo API key;
   - inbound peer API key;
   - outbound EduCore API key;
   - any required Entra client secret.
4. Validate settings and fail startup with a clear error if a critical secret is missing.
5. Connect Prisma to the database.
6. Build the selected identity, email, and peer providers.
7. Build application services and register Express routes.
8. Start the HTTP server.

Brevo can be marked temporarily unavailable without stopping the API. The database, JWT service, and inbound peer-key verification are critical and should stop startup if they are unavailable.

In production, Key Vault access itself should use the Azure VM's managed identity where possible. This avoids the problem of needing a stored secret to retrieve other secrets. On Oracle Cloud, use the secure authentication method provided by the class for Azure Key Vault.

## 7. Data model

### 7.1 Tables from the proposal

#### `users`

- `id`: primary key.
- `microsoft_oid`: unique Microsoft identity object ID.
- `email`: unique.
- `display_name`.
- `role`: `STUDENT`, `FACULTY`, `TECHNICIAN`, or `ADMIN`.
- `is_active`.
- `created_at` and `updated_at`.

Authentication proves identity, but the local `users.role` field controls HelpDesk permission. A user disabled with `is_active = false` cannot use protected routes even if Microsoft login succeeds.

#### `ticket_categories`

- `id`: primary key.
- `name`: unique.
- `description`.

#### `tickets`

- `id`: primary key.
- `requester_id`: required foreign key to `users`.
- `assigned_technician_id`: optional foreign key to `users`.
- `category_id`: foreign key to `ticket_categories`.
- `title`.
- `description`.
- `location`.
- `status`.
- `priority`.
- `source`.
- `created_at`, `updated_at`, and optional `resolved_at`.

Suggested controlled values:

- Status: `OPEN`, `IN_PROGRESS`, `RESOLVED`.
- Priority: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- Source: `HELPDESK`, `EDUCORE`.

The final values must be Prisma enums, not arbitrary strings.

#### `ticket_comments`

- `id`: primary key.
- `ticket_id`: foreign key to `tickets`.
- `message`.
- `created_at`.

#### `ticket_history`

- `id`: primary key.
- `ticket_id`: foreign key to `tickets`.
- `changed_by`: optional foreign key to `users`; null means a system or peer action.
- `action`.
- `old_value`.
- `new_value`.
- `created_at`.

#### `email_notifications`

- `id`: primary key.
- `ticket_id`: foreign key to `tickets`.
- `recipient_email`.
- `notification_type`.
- `delivery_status`.
- `provider_message_id`.
- `error_message`.
- `created_at` and optional `sent_at`.

### 7.2 Agreed schema adjustment

The proposal ERD is the starting point, with one agreed adjustment:

- Add a required `author_id` to `ticket_comments`. A ticket belongs to one requester, but its comments may be written by the requester, a technician, or an administrator.

Peer duplicate protection and an `external_reference` field are deliberately deferred.

Useful database indexes should cover ticket requester, assigned technician, status, category, and creation date.

## 8. Authentication and authorization logic

### 8.1 Local development

- A development-only login route accepts a known seeded user or a safe local identity fixture.
- The development identity provider returns the same normalized identity shape as Entra ID.
- The application looks up the user and issues a short-lived application JWT.
- This route must be disabled when the production environment is selected.

This allows ticket and RBAC development to finish before university Microsoft credentials are available.

### 8.2 Production login

1. The client starts the Microsoft authorization-code flow through MSAL/OIDC.
2. Microsoft authenticates the university user.
3. The backend validates the callback/token, including signature, issuer, audience, tenant, expiry, and state/nonce where applicable.
4. The backend normalizes `oid`, email, and display name.
5. It finds or creates the local `users` record. A safe default role is `STUDENT`; privileged roles are assigned only by an administrator.
6. It rejects inactive local users.
7. It issues a short-lived HelpDesk JWT containing the local user ID and minimal identity claims.
8. On every protected request, JWT middleware verifies the token and loads the current local user and role from the database.

Loading the current role from the database prevents an old token from keeping administrator rights after a role change.

### 8.3 RBAC matrix

| Action | Student / Faculty | Technician | Administrator |
|---|---:|---:|---:|
| Create a normal ticket | Yes | Optional | Yes |
| View own tickets | Yes | Yes | Yes |
| View available/assigned operational tickets | No | Yes | Yes |
| View every ticket | No | Only if course rules allow | Yes |
| Comment on an accessible ticket | Yes | Yes | Yes |
| Claim an unassigned ticket | No | Yes | Yes |
| Change status or resolve | No | Yes, when assigned | Yes |
| Assign or reassign a technician | No | No | Yes |
| Manage categories | No | No | Yes |
| Manage user roles and active state | No | No | Yes |
| View ticket history | Own ticket only | Accessible ticket | All |

Every object-level operation must check both role and ownership/assignment. Checking only the URL role is not enough.

## 9. Core ticket rules

### 9.1 Create a ticket

1. Authenticate the requester.
2. Validate title, category, priority, and location. Description may be empty.
3. Confirm that the category exists.
4. Create the ticket as `OPEN`, unassigned, with source `HELPDESK`.
5. Create a `CREATED` history record in the same database transaction.
6. Create a pending email-notification record in the same transaction.
7. Commit the transaction.
8. Ask the email provider to send confirmation.
9. Save the Brevo message ID on success or the error on failure.
10. Return the created ticket whether or not email delivery succeeds.

### 9.2 Claim a ticket

1. Require `TECHNICIAN` or `ADMIN`.
2. Confirm the ticket is open and unassigned.
3. Atomically set `assigned_technician_id` so two technicians cannot claim the same ticket.
4. Move status from `OPEN` to `IN_PROGRESS` if that is the agreed workflow.
5. Add assignment and status history records.
6. Commit, then notify the requester by email.

### 9.3 Update status and resolve

Suggested transitions:

```text
OPEN -> IN_PROGRESS -> RESOLVED
  |          |
  +----------+-----> RESOLVED
```

- A technician normally changes only a ticket assigned to that technician.
- Setting `RESOLVED` also sets `resolved_at`.
- Reopening a resolved ticket is outside the first version and may be added later.
- Each change writes a history row with old and new values.
- Notification failure never reverses a successful ticket update.

### 9.4 Add a comment

1. Confirm the user may view the ticket.
2. Validate a non-empty message and length limit.
3. Store the ticket, author, message, and timestamp.
4. Add a history entry if comments are part of the required audit view.
5. Notify the other relevant party after commit.

## 10. REST API outline

All normal routes are versioned below `/api/v1` inside the application. Nginx exposes them publicly below `/helpdesk`, producing URLs such as `/helpdesk/api/v1/tickets`.

### Authentication and system

- `GET /health` — process health; does not expose secrets.
- `GET /ready` — optional database readiness check.
- `GET /api/v1/auth/login` — begin production Microsoft login.
- `GET /api/v1/auth/callback` — finish Microsoft login.
- `POST /api/v1/auth/dev-login` — local development only.
- `GET /api/v1/me` — current local user and role.

### Tickets

- `POST /api/v1/tickets` — create a ticket.
- `GET /api/v1/tickets` — role-filtered list.
- `GET /api/v1/tickets/:ticketId` — ownership/assignment-aware detail.
- `POST /api/v1/tickets/:ticketId/claim` — claim an open ticket.
- `PATCH /api/v1/tickets/:ticketId/status` — update status.
- `PATCH /api/v1/tickets/:ticketId/assignment` — administrator assignment.
- `POST /api/v1/tickets/:ticketId/comments` — add a comment.
- `GET /api/v1/tickets/:ticketId/comments` — list allowed comments.
- `GET /api/v1/tickets/:ticketId/history` — view allowed audit history.

### Administration

- `GET/POST/PATCH /api/v1/categories` — list or administer categories.
- `GET /api/v1/users` — administrator user list.
- `PATCH /api/v1/users/:userId` — change role or active state.

Request validation should use one consistent validation library. Errors should use a stable JSON shape and suitable HTTP codes: `400`, `401`, `403`, `404`, `409`, `422`, and `500`.

## 11. Brevo integration logic

Brevo is an extra service, not part of the ticket transaction.

Events that create notifications:

- ticket created;
- ticket assigned;
- ticket updated;
- ticket resolved.

The application first writes a `PENDING` record to `email_notifications`. After the main transaction commits, `EmailProvider.send(...)` is called. The record becomes `SENT` with `provider_message_id`, or `FAILED` with `error_message`.

A small retry job or administrator retry action can resend failed records. This is useful but can be implemented after the required core flow works.

No controller should contain Brevo-specific HTTP code.

## 12. Peer API logic

Peer-team integration is a required final feature, but it is deliberately deferred until the standalone HelpDesk is working. The first implementation should define the provider boundary and may use mock data; it should not depend on the other group's live service. The real request format, keys, URLs, and end-to-end connection will be completed later with the EduCore team.

### 12.1 Endpoint exposed to EduCore

`POST /peer/tickets`

This route uses peer API-key middleware, not user JWT middleware.

Provisional request:

```json
{
  "studentId": "student-123",
  "studentEmail": "student@university.edu",
  "title": "Course registration failed",
  "description": "Registration failed for COURSE101",
  "courseCode": "COURSE101"
}
```

Logic:

1. Read `x-api-key` and compare it safely with the inbound key from Key Vault.
2. Reject a missing or invalid key with `401`.
3. Validate the agreed request schema.
4. Resolve the requester from the agreed student identifier/email. The teams must decide what happens if the student does not yet exist locally.
5. Create an `OPEN` ticket with source `EDUCORE` and a suitable registration category.
6. Write history and attempt the normal notification flow.
7. Return `201` with the created ticket ID.

The exact payload, response, error format, and requester-resolution rule must be agreed with EduCore and documented in the README.

### 12.2 Endpoint consumed from EduCore

`GET {EDUCORE_BASE_URL}/peer/enrollments/:studentId`

Logic:

1. `EnrollmentProvider.getByStudentId(studentId)` builds the peer request.
2. It sends the outbound EduCore key from Key Vault in `x-api-key`.
3. It uses a short timeout and validates the response before returning it to business code.
4. Enrollment details can enrich or validate a registration-related ticket.
5. If EduCore is unavailable, the HelpDesk should return a clear integration error or continue ticket creation without enrichment, according to the final agreed user flow.

Inbound and outbound API keys should be separate secrets so either direction can be rotated independently. Never log an API key.

## 13. Public deployment shape

```text
Internet
   |
   | HTTPS :443
   v
Nginx on Linux VM
   |-- existing /content       unchanged
   |-- existing /api           unchanged
   `-- /helpdesk/*             Campus HelpDesk only
            |
            v
      Express application
            |
            +--> Prisma --> PostgreSQL
            +--> Azure Key Vault
            +--> Microsoft Entra ID
            +--> Brevo
            `--> EduCore peer API
```

Nginx should add proxy headers and forward only the new `/helpdesk/` location to the application. The application/database port must not be publicly exposed.

Basic server hardening includes:

- SSH keys instead of passwords;
- root SSH login disabled;
- firewall allowing only required ports, normally SSH, HTTP, and HTTPS;
- database bound privately and protected with a dedicated user;
- application run as a non-root user/container;
- security updates installed;
- Nginx TLS configured and renewed automatically;
- logs enabled without tokens, keys, passwords, or sensitive ticket text;
- services configured to restart after failure or reboot.

## 14. Configuration and secret rules

Local `.env` usage is acceptable for development if it is ignored by Git. Commit only `.env.example` with placeholder values.

Production secrets must come from Azure Key Vault at runtime. Non-secret values may be supplied through normal deployment configuration.

Suggested Key Vault secret names:

- `helpdesk-database-url`;
- `helpdesk-jwt-secret`;
- `helpdesk-brevo-api-key`;
- `helpdesk-peer-inbound-api-key`;
- `helpdesk-educore-outbound-api-key`;
- `helpdesk-entra-client-secret`, only if the chosen Entra flow needs it.

The repository and logs must never contain the real values.

## 15. Development order

### Phase 1: Freeze contracts

- Confirm TypeScript/Express and PostgreSQL.
- Confirm ticket status and priority values.
- Add the agreed required comment author relationship.
- Define only an internal `EnrollmentProvider` interface and a provisional peer-ticket shape. Final agreement with EduCore is deferred until the core HelpDesk works.

### Phase 2: Create the local foundation

- Create the Express/TypeScript project.
- Add configuration validation and a shared error format.
- Define provider interfaces and local implementations.
- Add Docker Compose or simple local database instructions.

### Phase 3: Build the database

- Convert the ERD into `schema.prisma`.
- Create and commit migrations.
- Seed categories and users for each role.
- Build repositories without cloud dependencies.

### Phase 4: Build local auth and RBAC

- Add development login and application JWT handling.
- Add authentication, role, ownership, and assignment middleware/rules.
- Keep production Entra code behind `IdentityProvider`.

### Phase 5: Build core HelpDesk features

- Ticket create/list/detail.
- Claim and assignment.
- Status transitions and resolution.
- Comments and ticket history.
- User/category administration.

The team should complete and stabilize this phase before starting real integration with the other group.

### Phase 6: Prepare integrations locally

- Console/fake email provider plus persistent notification attempts.
- Fixture EduCore provider.
- Local draft of inbound `/peer/tickets` with API-key middleware.
- OpenAPI documentation and example requests.

At this point the full business application should work locally without requiring Azure, Brevo, or the peer team to be online.

### Phase 7: Connect real providers and the other group

- Azure Key Vault provider.
- Microsoft Entra identity provider.
- Brevo email provider.
- Agree the final payload, response, student identifier, URLs, API-key exchange, and failure behavior with the EduCore team.
- Replace the fixture provider with the real EduCore API provider.
- Test both directions: EduCore calling `POST /peer/tickets` and HelpDesk calling `GET /peer/enrollments/:studentId`.
- Keep all local providers for development and automated checks.

### Phase 8: Deploy

- Prepare the Linux VM and managed identity/access.
- Deploy with Docker Compose or an automated script.
- Run `prisma migrate deploy` as part of a controlled release.
- Configure Nginx at `/helpdesk` without modifying existing route behavior.
- Configure HTTPS and the firewall.
- Check restart and secret-loading behavior.

### Phase 9: Finish evidence and submission

- Put all source and migrations in GitHub.
- Complete README architecture, setup, deployment, and peer API sections.
- Provide an `.env.example`, OpenAPI document, and safe test users/instructions.
- Test the live URL as each role and from the peer service.
- Record a maximum 10-minute video showing the live features, code structure, Prisma schema/migrations, Key Vault integration, and peer integration.

## 16. Verification checklist

### Core behavior

- A student/faculty user can create and view their own ticket.
- That user cannot read another user's ticket by changing an ID.
- A technician can view available tickets, claim one atomically, update it, comment, and resolve it.
- A technician cannot update a ticket assigned to another technician unless the final rules allow it.
- An administrator can manage all tickets, roles, active users, categories, and assignments.
- Every important change produces history.
- Email failure is recorded but does not fail a ticket operation.

### Integrations

- Production Microsoft login works and disabled users are rejected.
- The application starts with secrets loaded from Azure Key Vault and no production `.env` secrets.
- Brevo sends and records a real message.
- Invalid inbound `x-api-key` is rejected.
- Valid `POST /peer/tickets` creates a HelpDesk ticket.
- HelpDesk fetches and uses enrollment data from EduCore with the outbound key.

### Deployment

- The public URL uses HTTPS.
- `/helpdesk` reaches this application.
- Existing `/content` and `/api` still behave as before.
- Database and application ports are not public.
- The application returns after VM reboot.
- No secret appears in Git history, responses, or logs.

### Submission

- GitHub contains source, migrations, deployment automation, and documentation.
- README clearly names the peer team, consumed data/endpoint, exposed endpoint, authentication, examples, and error responses.
- The instructor has working live-system test instructions.
- The video is no longer than 10 minutes and shows the deployed system rather than only slides.

## 17. Definition of done

The project is complete when the live HTTPS API on the Linux VPS supports the proposal's ticket workflow; applies JWT authentication and RBAC; uses Prisma migrations and a relational database; authenticates university users through Microsoft; reads production secrets from Azure Key Vault; sends Brevo notifications without coupling email success to ticket success; securely exposes and consumes the agreed peer APIs; preserves existing server routes; can be deployed automatically; and is documented and demonstrated as required by the grading guide.
