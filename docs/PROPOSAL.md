# Campus HelpDesk proposal

Team: Alexandr Romanov, Andrei Filip, Danila Derii. Domain: campus ticketing and support.

Students report university problems. Technicians claim tickets, comment on them
and resolve them. Administrators manage tickets, users and technician assignments.

## Scope

- Sign-in with a university Microsoft account, then a HelpDesk JWT in an `HttpOnly` cookie.
- Role-based access for students, technicians and administrators.
- Tickets: create, list, view details, claim, assign, change status, comment.
- A Brevo email on each ticket change. A failed email never undoes the change.
- A React frontend over the same API.
- TypeScript/Express and PostgreSQL with Prisma migrations.
- Hosting on an Azure VM behind Nginx and HTTPS under `/helpdesk/`, with secrets in Azure Key Vault.

Data model: [ERD.md](ERD.md).
