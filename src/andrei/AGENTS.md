# Andrei integration scope

This directory is owned by Andrei.

Implement and maintain:

- the inbound EduCore peer route under `peer/`;
- peer `x-api-key` authentication;
- the outbound EduCore enrollment provider under `educore/`;
- the final request, response, identifier, and failure contract agreed with the
  EduCore team.

Use the shared enrollment contract in `src/providers/educore/`. Inbound peer
code must call the public backend services rather than Prisma or repositories
directly. Export integration points through the nearest `index.ts` file and
never commit real API keys.
