# Team ownership

The repository is divided by responsibility while keeping shared contracts in
the backend.

| Owner | Paths | Responsibility |
| --- | --- | --- |
| Backend owner | `src/**` except the member paths below | Express, Prisma, PostgreSQL, business rules, RBAC, tickets, administration, validation, and local providers |
| Alex | `src/alex/**`, `deploy/alex/**` | Microsoft Entra ID, Azure Key Vault, Brevo, hosting, Nginx, HTTPS, and deployment automation |
| Andrei | `src/andrei/**` | EduCore client, inbound peer API, peer API-key authentication, and the final peer contract |

Shared provider contracts stay under `src/providers/**`. Alex and Andrei
implement those contracts but should not change them without coordination.

The backend connects member code through the member-owned `index.ts` entry
points. This keeps imports explicit and limits merge conflicts.
