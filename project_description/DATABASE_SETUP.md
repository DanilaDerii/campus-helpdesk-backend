# Local Database Setup

The project uses PostgreSQL through Prisma. Docker Compose keeps the local database separate from the host system.

The container is exposed on local port `5433` because port `5432` is already used on the development machine.

## Files

- `compose.yaml` defines the local PostgreSQL service.
- `prisma/schema.prisma` defines the database structure.
- `.env` will hold local development settings and is ignored by Git.
- `.env.example` contains safe example settings.

## First local setup

These commands are intentionally documented but have not yet been run:

```bash
cp .env.example .env
npm run db:start
npm run db:migrate -- --name init
npm run db:generate
npm run db:seed
```

The migration command will create the initial SQL migration from `prisma/schema.prisma` and apply it to the local database. Prisma 7 generates the application client in a separate step.

## Normal commands

```bash
npm run db:start
npm run db:stop
npm run db:generate
npm run db:seed
npm run db:studio
```

`npm run db:stop` stops the database without deleting its Docker volume. Local data remains available for the next start.

The username and password in `compose.yaml` are development-only values. Production will use credentials retrieved from Azure Key Vault.
