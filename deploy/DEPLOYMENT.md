# Deployment

The app runs on an Azure Ubuntu 24.04 VM. The VM also hosts other sites, so the
HelpDesk lives under `/helpdesk/`.

```
/helpdesk/health, /ready, /api/*  -> Nginx -> Express 127.0.0.1:3001 -> PostgreSQL 127.0.0.1:5433
/helpdesk/*                       -> Nginx -> static build in /var/www/helpdesk
```

- The checkout is `/opt/campus-helpdesk`, owned by `azureuser:helpdesk`. The
  `helpdesk` service runs as the non-root `helpdesk` account.
- PostgreSQL runs from `compose.yaml` plus `deploy/compose.postgres.override.yaml`.
- Secrets come from Key Vault through the VM's system-assigned managed identity.

## One-time setup

1. Install Node 22.12+, Docker Compose, Nginx, Python 3 and curl.
   Allow only SSH, HTTP and HTTPS. Set up HTTPS with Let's Encrypt.
2. Create the service account:
   `sudo useradd --system --no-create-home --shell /usr/sbin/nologin helpdesk`.
3. Enable the VM's managed identity and grant it **Key Vault Secrets User** on the vault.

   | Logical name | Key Vault secret |
   | --- | --- |
   | `DATABASE_URL` (uses `localhost:5433`) | `helpdesk-database-url` |
   | `JWT_SECRET` | `helpdesk-jwt-secret` |
   | `BREVO_API_KEY` | `helpdesk-brevo-api-key` |
   | `ENTRA_CLIENT_SECRET` (the secret value) | `helpdesk-entra-client-secret` |

4. Register a single-tenant Entra web app with the callback URL below, and
   verify the Brevo sender.
5. Create `/opt/campus-helpdesk/.env` with mode 640. It holds non-secret settings only:

   ```dotenv
   PORT=3001
   HOST=127.0.0.1
   NODE_ENV=production
   PUBLIC_BASE_PATH=/helpdesk
   PUBLIC_HEALTH_URL=https://<domain>/helpdesk/health
   PUBLIC_APP_URL=https://<domain>/helpdesk/
   KEY_VAULT_URL=https://<vault-name>.vault.azure.net
   BREVO_SENDER_EMAIL=helpdesk@<domain>
   BREVO_SENDER_NAME=Campus HelpDesk
   ENTRA_TENANT_ID=<directory-id>
   ENTRA_CLIENT_ID=<application-id>
   ENTRA_REDIRECT_URI=https://<domain>/helpdesk/api/v1/auth/callback
   ```

6. Add this line once, inside the host's HTTPS `server { }` block:
   `include snippets/helpdesk.locations.conf;`

## Release

```bash
cd /opt/campus-helpdesk
./deploy/deploy.sh main
```

The script:

1. Reads the database URL from Key Vault and starts PostgreSQL.
2. Builds the app and runs `prisma migrate deploy`.
3. Publishes the frontend.
4. Installs the Nginx and systemd files from `deploy/`.
5. Restarts the service and checks `/health`, `/ready` and the public URLs.

Any failed check stops the release.

To roll back, run `./deploy/deploy.sh <commit>`. Migrations are not reverted, so
back up the database before a destructive migration.

The first administrator has to be promoted in the database:

```bash
sudo docker exec -i $(sudo docker compose ps -q postgres) psql -U helpdesk -d helpdesk \
  -c "UPDATE users SET role='ADMIN' WHERE email='<address>';"
```

## Logs

```bash
journalctl -u helpdesk -n 50 --no-pager
sudo docker compose -f compose.yaml -f deploy/compose.postgres.override.yaml logs --tail 50 postgres
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Service fails to start | The journal names the missing setting. Fix it, then run `sudo systemctl reset-failed helpdesk`. |
| Service stuck "activating" | `.env` may be missing. Check `journalctl -u helpdesk`, then recreate the file from the block above. |
| `/ready` fails | Check the PostgreSQL container and the password in the database URL. |
| Key Vault 403 | Check the managed identity and its role assignment. |
| Microsoft 503 or 502 | 503: an `ENTRA_*` setting is missing. 502: check the redirect URI, consent and client-secret expiry. |
| `403 INVALID_REQUEST_ORIGIN` | Cookie-authenticated writes need a matching `Origin` header. |
