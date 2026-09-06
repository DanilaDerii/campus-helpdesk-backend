# Campus HelpDesk proposal

Updated working proposal, reflecting the project scope confirmed by the user on
6 September 2026. Current requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

Team: Alexandr Romanov, Andrei Filip, Danila Derii.
Domain: campus ticketing and support.

Students and faculty report university problems. Technicians claim, comment on,
update and resolve tickets. Administrators manage tickets, users, categories
and technician assignments.

## Main functions

- University Microsoft login, followed by a HelpDesk JWT for API authentication.
- Role-based access control (RBAC) with student, faculty, technician and admin roles.
- Ticket creation, listing, detail, assignment, status changes, comments and history.
- Brevo notifications when tickets are created, assigned, updated or resolved.
  Email failure does not undo a successful ticket operation.
- A basic frontend using the existing backend endpoints.

## Technology and data

TypeScript/Express, PostgreSQL and Prisma migrations. Azure Linux VM hosting uses
Nginx and HTTPS under `/helpdesk/`. Production secrets load from Azure Key Vault.

The six tables are `users`, `ticket_categories`, `tickets`, `ticket_comments`,
`ticket_history` and `email_notifications`. See [ERD.md](ERD.md) and
[schema.prisma](../prisma/schema.prisma) for the current design.

The current implementation and access rules are documented in
[DEVELOPMENT_LOGIC.md](DEVELOPMENT_LOGIC.md). Remaining work is in [todo.md](../todo.md).
