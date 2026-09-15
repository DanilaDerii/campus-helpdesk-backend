# Campus HelpDesk architecture and rules

This file describes the current application. Deployment instructions are in
[DEPLOYMENT.md](../deploy/alex/DEPLOYMENT.md).

## Request flow

The backend uses TypeScript, Express, Prisma and PostgreSQL:

`route -> authentication -> controller -> service -> repository -> database`

- Routes connect HTTP methods and URLs to controllers.
- Controllers validate request data.
- Services apply permissions and ticket rules.
- Repositories contain Prisma database queries.
- Providers choose the local or production implementation for identity,
  secrets and email.

Production uses Microsoft Entra, Azure Key Vault and Brevo. Development uses
seeded users, environment variables and a console email provider.

## Data and authentication

The four tables are users, ticket categories, tickets and comments. The source
of truth is [schema.prisma](../prisma/schema.prisma), with committed migrations.

Microsoft proves the user's identity. PostgreSQL stores the user's local role
and active state. The backend then creates its own one-hour JWT containing the
local user ID. Protected requests accept that JWT from a Bearer header or a
secure browser cookie.

Cookie-authenticated changes require the same website origin. First-time Entra
users become `STUDENT`. An administrator can later change local roles.

| Action | Student | Technician | Administrator |
| --- | --- | --- | --- |
| Create tickets | Yes | No | Yes |
| View tickets | Own | Assigned or open/unassigned | All |
| Add comments | Own tickets | Accessible tickets | All |
| Claim an open ticket | No | Yes | No |
| Change status | No | Assigned tickets | All |
| Assign technicians and manage users | No | No | Yes |

## Ticket rules

- New tickets start as `OPEN` and unassigned.
- A technician can claim an open, unassigned ticket.
- An administrator can assign an active technician.
- Status can move from `OPEN` to `IN_PROGRESS` or `RESOLVED`, and from
  `IN_PROGRESS` to `RESOLVED`.
- Resolved tickets cannot be reopened.
- Users can comment only on tickets they may view.
- Categories are fixed by Prisma migrations and are read-only through the API.
- Administrators cannot deactivate or demote themselves.

## Email

Ticket creation, assignment, status changes and comments call the configured
email provider once. Production sends through Brevo. Email is sent after the
database change, and a sending failure is logged without undoing the ticket.
There is no retry worker or email-job table.

## API and deployment

The backend uses `/api/v1`. Nginx exposes it publicly below `/helpdesk/` while
preserving the server's existing `/content` and `/api` routes.

| Area | Endpoints |
| --- | --- |
| System/auth | `GET /health`, `GET /ready`, `GET /api/v1/me`, login and logout routes |
| Tickets | `GET/POST /api/v1/tickets`, `GET /api/v1/tickets/:ticketId` |
| Ticket actions | claim, status and assignment endpoints below `/:ticketId` |
| Comments | `POST /api/v1/tickets/:ticketId/comments` |
| Administration | user endpoints below `/api/v1/users` |

The Microsoft callback creates the application JWT cookie and redirects to the
frontend. `/health` checks the process. `/ready` checks PostgreSQL.
