# Campus HelpDesk

Campus support ticketing. Students report problems, technicians claim and resolve
them, and administrators manage tickets, assignments and users.

Team: Alexandr Romanov, Andrei Filip, Danila Derii. Live: https://jesoas.org/helpdesk/

- **Stack:** TypeScript, Express 5, Prisma 7, PostgreSQL 17, React with Vite.
- **Production:** Azure VM with Nginx and systemd, Microsoft Entra ID sign-in,
  Azure Key Vault secrets, Brevo email.

## Repository

| Path | Contents |
| --- | --- |
| `src/routes`, `controllers`, `services`, `data_access` | Request flow: route, authentication, controller, service, Prisma |
| `src/providers` | Secrets (env or Key Vault), identity (development or Entra), email (console or Brevo). Production implementations are used when `NODE_ENV=production`. |
| `prisma/` | Schema, migrations, development seed |
| `frontend/` | Single-page application |
| `deploy/` | Release script, Nginx and systemd files, [deployment guide](deploy/DEPLOYMENT.md), [demo script](deploy/DEMO.md) |
| `docs/` | [Proposal](docs/PROPOSAL.md), [ERD](docs/ERD.md) |

## Run locally

Requires Node 22.12+ and Docker.

```bash
cp .env.example .env
npm install
npm run db:start
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Then, in `frontend/`, run `npm install` and `npm run dev`, and open
http://localhost:5173/helpdesk/. Microsoft sign-in is not configured locally.
Sign in as a seeded user (`student@`, `technician@` or `admin@helpdesk.local`)
from the browser console:

```js
await fetch("/helpdesk/api/v1/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@helpdesk.local" }) }); location.reload();
```

## Access rules

| Action | Student | Technician | Admin |
| --- | --- | --- | --- |
| Create tickets | Yes | No | Yes |
| View tickets | Own | Assigned, or open and unassigned | All |
| Comment | Own tickets | Visible tickets | All |
| Claim a ticket | No | Yes | No |
| Change status | No | Assigned tickets | All |
| Assign technicians, manage users | No | No | Yes |

- Status moves `OPEN` to `IN_PROGRESS` or `RESOLVED`, and `IN_PROGRESS` to
  `RESOLVED`. Resolved tickets cannot be reopened.
- Categories are fixed by migration. New Microsoft users start as `STUDENT`.
  Administrators cannot demote or deactivate themselves.
- Ticket changes send one email. A failed email is logged and never undoes the change.

## API

In production every path below is served under `/helpdesk`.

| Endpoint | Purpose |
| --- | --- |
| `GET /health`, `GET /ready` | Process check; database check |
| `GET /api/v1/auth/login`, `/callback` | Microsoft sign-in |
| `POST /api/v1/auth/dev-login` | Development sign-in (disabled in production) |
| `GET /api/v1/me`, `POST /api/v1/auth/logout` | Current user; sign out |
| `GET`, `POST /api/v1/tickets`; `GET /api/v1/tickets/:id` | List by role, create, detail with comments |
| `POST /api/v1/tickets/:id/claim` | Technician claims an open ticket |
| `PATCH /api/v1/tickets/:id/status`, `/assignment` | Change status; assign a technician |
| `POST /api/v1/tickets/:id/comments` | Add a comment |
| `GET /api/v1/categories` | List categories |
| `GET /api/v1/users`, `PATCH /api/v1/users/:id` | List users; change role or active flag |

## Testing the live system

1. Open https://jesoas.org/helpdesk/ and sign in with a university Microsoft account.
2. Create a ticket. The requester receives an email.
3. As an administrator, open **Users** and make a second account `TECHNICIAN`.
4. As that technician, claim the ticket, comment, and resolve it. Each change
   sends an email.
5. `curl https://jesoas.org/helpdesk/health` and `.../ready` should both return OK.
