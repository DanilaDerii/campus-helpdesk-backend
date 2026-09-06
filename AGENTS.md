# Campus HelpDesk ownership rules

Keep the standalone backend independent from production service providers.

## Ownership

- The backend owner maintains the application core outside the member-owned
  paths listed below.
- Alex owns `src/alex/**` and `deploy/alex/**`.
- Shared contracts remain under `src/providers/**` and are changed only after
  agreeing the contract with the backend owner.

## Integration rules

- Member implementations must satisfy the shared provider interfaces.
- Core backend code imports member code only through an `index.ts` entry point.
- Member code must use services for business operations and must not query
  repositories or Prisma directly unless the shared contract explicitly
  requires it.
- Never commit real secrets, access tokens, API keys, or production credentials.
- Preserve the existing public API paths when replacing placeholders.

## Verification

- Ask the user before running builds, automated tests, database tests, or other
  executable verification. Reading `git diff` and running `git diff --check`
  do not require prior permission.
