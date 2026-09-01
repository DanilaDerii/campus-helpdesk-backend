# Alex integration scope

This directory is owned by Alex.

Implement and maintain:

- Microsoft Entra ID authentication under `identity/`;
- Azure Key Vault access under `secrets/`;
- Brevo email delivery under `email/`.

Hosting, Nginx, HTTPS, and deployment files belong under `deploy/alex/`, not
inside `src`.

Use the contracts in `src/providers/**`. Do not move or change those contracts
without coordinating with the backend owner. Export integration points through
the nearest `index.ts` file, preserve existing routes, and never commit real
credentials.
