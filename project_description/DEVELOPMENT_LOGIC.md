# Campus HelpDesk architecture and rules

Current design only. Remaining work: [todo.md](../todo.md).
Operations: [DEPLOYMENT.md](../deploy/alex/DEPLOYMENT.md).
Ownership and integration boundaries: [TEAM_OWNERSHIP.md](TEAM_OWNERSHIP.md).

## Architecture

TypeScript, Express 5, Prisma 7, PostgreSQL. Requests follow:

`route -> authentication -> controller/validation -> service -> repository/provider`

- `src/app.ts` assembles HTTP middleware; `src/server.ts` starts the process and worker.
- Controllers parse requests; services enforce business rules and transactions.
- Repositories own Prisma queries. The database uses one shared connection pool.
- `src/services/ticket.service.ts` exposes the ticket modules through one entry point.
- Shared provider contracts live in `src/providers/`; member implementations are
  imported through their nearest `index.ts`. Member routes call core services.

| Concern | Development | Production |
| --- | --- | --- |
| Identity | Seeded local login | Microsoft Entra followed by an application JWT |
| Secrets | Ignored local `.env` | Azure Key Vault through VM managed identity |
| Email | Console provider; debug event only | Brevo |

Production is selected by `NODE_ENV=production`. It disables development login
and selects Key Vault/Brevo. Settings and secrets still initialize partly during
module imports; explicit validated startup remains a task.

## Data and access

The source of truth is [schema.prisma](../prisma/schema.prisma), with committed
migrations. The six tables are users, categories, tickets, comments, ticket history,
and email notifications. Comments have a required author. The current diagram is
[ERD.md](ERD.md).

Microsoft proves identity; PostgreSQL controls local role and active state.
Application JWTs contain the local user ID and expire after one hour. Each
protected request reloads the user, so deactivation and role changes take effect.
First-time external users default to `STUDENT`. Controlled first-administrator
provisioning remains unfinished.

| Action | Student / Faculty | Technician | Administrator |
| --- | --- | --- | --- |
| Create tickets | Yes | No | Yes |
| View tickets | Own | Assigned or open/unassigned; own detail access | All |
| Comment / read history | Accessible ticket | Accessible ticket | All |
| Claim an open, unassigned ticket | No | Yes | No |
| Change status | No | Assigned tickets | All |
| Assign technicians / manage users and categories | No | No | Yes |

This matrix records current behavior. Admin claiming is a pending product decision.
A technician who previously created tickets under another role can access their
own ticket detail, but the technician list currently shows only operational tickets.

## Ticket rules

- Creation writes an `OPEN`, unassigned ticket, history, and pending
  notification in one transaction. Categories must exist.
- Claiming atomically assigns an open/unassigned ticket and changes it to `IN_PROGRESS`.
- Admin assignment requires an active technician and rejects resolved tickets.
  Assigning the same technician again produces no history entry or email.
- Allowed changes: `OPEN -> IN_PROGRESS`, `OPEN -> RESOLVED`, `IN_PROGRESS -> RESOLVED`.
  Resolution sets `resolvedAt`; reopening is unsupported. An unchanged status is a no-op.
- Comments require ticket access. Notify the assigned technician when the requester
  comments; otherwise notify the requester. Record the comment author and history.
- Ticket history and notification records are business data, not disposable debug logs.
- Category names are unique; categories used by tickets cannot be deleted.
  Administrators cannot deactivate or demote themselves.

## Notifications and operational logs

Ticket changes commit before email delivery. Delivery failure never rolls them back;
the request still waits for its initial delivery attempt.

- The worker polls every five minutes and reads at most 25 due notification IDs.
- Five total attempts; retry delays after failures are 5, 15, 60, and 360 minutes.
- `attemptCount` and `nextAttemptAt` persist the budget and schedule. A conditional
  database update reserves each attempt for five minutes; interrupted attempts
  become eligible again. Old attempts cannot overwrite a newer attempt's result.
- `FAILED` with a future retry is retryable. `EXHAUSTED` is terminal and has no next
  attempt. `SENT` means accepted by the provider, not confirmed mailbox delivery.
- Delivery is not exactly once: a send followed by a lost database acknowledgement
  can be repeated. Exhausted rows need an explicit, future admin recovery workflow.
- Application events are structured JSON with generated request IDs and safe error
  metadata. No raw SDK error objects, recipient addresses, or message text are logged
  by the application logger. Development email events require `LOG_LEVEL=debug`.
- Rotation, retention, and query-free proxy logging are defined in the deployment guide.

## API and deployment boundaries

Application endpoints use `/api/v1`. Nginx strips `/helpdesk/`, exposing
`/helpdesk/api/v1/...` publicly.
Existing server routes such as `/content` and `/api` must remain available.

| Area | Current endpoints |
| --- | --- |
| System/auth | `GET /health`, `GET /api/v1/me`, `POST /api/v1/auth/dev-login`, `GET /api/v1/auth/login`, `GET /api/v1/auth/callback` |
| Tickets | `GET/POST /api/v1/tickets`, `GET /api/v1/tickets/:ticketId` |
| Ticket actions | `POST .../:ticketId/claim`, `PATCH .../:ticketId/status`, `PATCH .../:ticketId/assignment` |
| Discussion | `GET/POST .../:ticketId/comments`, `GET .../:ticketId/history` |
| Administration | `GET /api/v1/users`, `PATCH /api/v1/users/:userId`, `GET/POST /api/v1/categories`, `PATCH/DELETE /api/v1/categories/:categoryId` |

The Microsoft callback resolves or creates the local user, rejects inactive users
and identity conflicts, then returns the same JWT response as development login.
Its state is bound to an HTTP-only browser cookie and the code exchange uses PKCE.
The frontend login handoff/logout contract is still unfinished. `/health` only
checks the process; `/ready` and OpenAPI are also unfinished.
