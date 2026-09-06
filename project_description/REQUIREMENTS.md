# Current project requirements

Working transcription of the saved course material, adjusted to the scope
confirmed by the user on 6 September 2026. This is a project planning document,
not an unchanged copy of an instructor handout. Final deliverables await confirmation.

## System

- Hardened Linux VPS on Azure or Oracle Cloud; this project targets Azure.
- Nginx reverse proxy with Let's Encrypt HTTPS under a distinct `/helpdesk/` path.
  Preserve the shared server's existing `/content` and `/api` routes.
- Node.js/Express or Go REST API; this project uses TypeScript/Express.
- Relational database with Prisma ORM and committed migrations; this project uses PostgreSQL.
- JWT authentication and role-based access control (RBAC).
- University Microsoft Active Directory / Entra ID authentication through MSAL/OAuth/OIDC.
- Production secrets retrieved at runtime from the approved class Azure Key Vault;
  no production secrets in `.env` files or Git.
- At least one third-party public API; this project uses Brevo email delivery.
- Source code hosted in GitHub and deployment automated through a script or Compose.
- Basic frontend, requested by the user, built against the backend API.

## Delivery

- Team of at most three students.
- Proposal: domain, database ERD, intended roles and external API design.
- Professional README: architecture, setup and live-system testing instructions.
- A live HTTPS system that the instructor can test.
- Video of at most ten minutes demonstrating live features, code structure,
  Prisma schema/migrations and Key Vault integration; submit through the designated Teams assignment.

Saved grading breakdown: proposal 5%, presentation 5%, project quality 10%
(repository/README 5%, live system 5%). Saved dates: proposal 22 July 2026;
finished project 23 September 2026. Confirm dates and grading against the final instructions.
