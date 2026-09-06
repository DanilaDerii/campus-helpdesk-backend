# Campus HelpDesk deployment and operations

Owner: Alex. Target: Azure Linux VM with Nginx, systemd and PostgreSQL in Compose.
These are repository instructions, not proof of the current VM state.
Remaining release blockers: [todo.md](../../todo.md).

## Runtime layout

`HTTPS /helpdesk/* -> Nginx -> host Express :3001 -> PostgreSQL 127.0.0.1:5433`

- Nginx strips `/helpdesk/` and preserves the shared server's existing routes.
- Source/build: `/opt/campus-helpdesk`; service: `helpdesk`, non-root account `helpdesk`.
- Use root `compose.yaml` plus `deploy/alex/compose.postgres.override.yaml`; retain the
  same Compose project name and database volume across releases.
- Production secrets load through Key Vault using the VM's managed identity.
- PostgreSQL publishes to loopback. Express currently omits its bind host; loopback
  binding and effective network isolation still need correction/verification.

## Host and configuration

Use Ubuntu 24.04, a supported Node release compatible with the lockfile (Node 22
requires at least 22.12), npm, Docker Compose, Nginx, Python 3, curl and logrotate.
Allow SSH/HTTP/HTTPS only through the VM firewall and Azure NSG. Use SSH keys,
disable root/password login, and configure Let's Encrypt renewal. Size RAM for
all shared workloads; the service and PostgreSQL each have a 512 MiB runtime cap.

Create a `helpdesk` system account without a login shell. Own the checkout as
`azureuser:helpdesk`, readable by the service group; the deploy account owns writes.
Store only non-secret settings in `/opt/campus-helpdesk/.env` (mode 640):

```dotenv
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
KEY_VAULT_URL=https://<vault-name>.vault.azure.net
BREVO_SENDER_EMAIL=helpdesk@<domain>
BREVO_SENDER_NAME=Campus HelpDesk
ENTRA_TENANT_ID=<directory-id>
ENTRA_CLIENT_ID=<application-id>
ENTRA_REDIRECT_URI=https://<domain>/helpdesk/api/v1/auth/callback
```

Enable the VM's system-assigned identity and grant it **Key Vault Secrets User**
on the approved vault. Secret administrators need separate data-plane permission.
Verify that the chosen vault meets the course's class-vault requirement.

| Logical secret | Key Vault name |
| --- | --- |
| `DATABASE_URL` | `helpdesk-database-url` |
| `JWT_SECRET` | `helpdesk-jwt-secret` |
| `BREVO_API_KEY` | `helpdesk-brevo-api-key` |
| `ENTRA_CLIENT_SECRET` | `helpdesk-entra-client-secret` |

For this host layout the database URL uses `localhost:5433`, not a Docker service
name. Secret values never belong in Git or the production `.env`. Cached secrets
currently require an application restart after rotation.

Register Entra as a single-tenant Web application with the exact public callback
URL above; put the client-secret **value**, not its identifier, in Key Vault.
Configure tenant consent as required. Authenticate the Brevo sender/domain.
Microsoft callback-to-local-user/JWT provisioning is implemented but still needs
approved live verification. The first real administrator needs controlled
provisioning; do not seed development users into production or enable public
development login.

## Installation and release

Commands below are for an approved deployment; they have not been run for this cleanup.

1. Supply production PostgreSQL credentials before initializing a fresh volume.
   The current Compose override still falls back to a development password: this
   is a release blocker. Changing `POSTGRES_PASSWORD` does not rotate an existing DB.
2. Start PostgreSQL with both Compose files. Install dependencies, generate Prisma,
   compile, and apply committed migrations using a database URL retrieved securely
   from Key Vault. Prisma CLI reads `DATABASE_URL`; it cannot use the runtime provider.
3. Install the logging files and service unit below, then the Nginx locations inside
   the existing HTTPS server block. Install the format in the HTTP context first.
4. Obtain verification approval before service/config checks, migrations or live requests.

From the checkout, install the scoped logging configuration:

```bash
sudo install -d -m 0755 /etc/systemd/journald@helpdesk.conf.d
sudo install -m 0644 deploy/alex/journald/retention.conf /etc/systemd/journald@helpdesk.conf.d/retention.conf
sudo install -m 0644 deploy/alex/helpdesk.service /etc/systemd/system/helpdesk.service
sudo install -d -m 0750 -o www-data -g adm /var/log/helpdesk-nginx
sudo install -m 0644 deploy/alex/nginx/helpdesk.logging.conf /etc/nginx/conf.d/helpdesk.logging.conf
sudo install -m 0644 deploy/alex/logrotate/helpdesk /etc/logrotate.d/helpdesk
```

Use `deploy/alex/nginx/helpdesk.location.conf` for the `/helpdesk/` locations.
After approved validation, reload Nginx, reload systemd units, and restart the
HelpDesk journal namespace and service. Enable the service for reboot recovery.
Recreate the PostgreSQL container with both Compose files to activate its new log
limits; preserve its volume. Existing containers retain their old logging options.

Routine release entry point:

```bash
cd /opt/campus-helpdesk
./deploy/alex/deploy.sh main
```

The script retrieves the migration URL through VM managed identity, starts the
DB, installs/builds, migrates and restarts. Review before production use:

- It replaces dependencies beneath the running process; separate release directories
  are still needed. Build failure must leave the previous release usable.
- Public health failure is currently printed but does not fail deployment.
- `/health` does not check PostgreSQL; `/ready` remains unfinished.
- Apply both new migrations before running the updated application. The ticket
  schema cleanup removes the obsolete `source` field; ticket records are preserved.
  Existing pending/failed records start with a fresh five-attempt budget; sent
  records remain sent. No ticket, history, or notification rows are deleted.

## Logs and retention

| Stream | Policy |
| --- | --- |
| Application stdout/stderr | JSON events; dedicated `helpdesk` journal namespace; 100 MiB disk / 25 MiB runtime target, maximum age 14 days, daily file rotation |
| Nginx HelpDesk access | Query-free JSON in `/var/log/helpdesk-nginx/access.log`; daily rotation, at most 14 rotated files, max age 14 days, 10 MiB rotation threshold |
| PostgreSQL container | Docker `local` driver, 3 files of 10 MB, compressed rotation; size-based retention |

Journal limits reclaim archived files; logrotate evaluates its thresholds when
scheduled. These settings are retention policies, not instantaneous hard disk caps.
The Nginx file is outside the distro's `/var/log/nginx/*.log` rule to avoid duplicate
rotation. Existing logs and database business records are not purged by this change.

- `LOG_LEVEL` accepts `debug`, `info`, `warn`, `error`; default is `info`.
- The app generates `X-Request-Id`; request-related events and Nginx's upstream ID
  let operators correlate failures. No raw SDK errors, ticket text, recipients,
  request headers or query strings are included in first-party application events.
- Successful `/health` and `/ready` requests are omitted from the HelpDesk access log.
- Native Nginx request-error dumps are disabled for the HelpDesk location because
  they can include OAuth query strings. Use access status/upstream status/timing
  and application events; other shared-server locations keep their own logs.
- Brevo rejection bodies are discarded. Failures retain safe type/code/status data.
  Five attempts use delays of 5/15/60/360 minutes; the worker scans at most 25 due rows
  per five-minute pass. `EXHAUSTED` requires deliberate future recovery tooling.
- A provider acceptance followed by an unsuccessful database write may cause duplicate
  mail. `SENT` records provider acceptance, not actual mailbox delivery.

Read logs after installation:

```bash
journalctl --namespace=helpdesk -u helpdesk -n 50 --no-pager
sudo tail -n 50 /var/log/helpdesk-nginx/access.log
sudo docker compose -f compose.yaml -f deploy/alex/compose.postgres.override.yaml logs --tail 50 postgres
```

For older application logs, omit `--namespace=helpdesk`. Never paste credentials or
old raw provider errors into tickets or commits. Verify retention and redaction on
the deployed host before calling this configuration complete.

## Recovery and troubleshooting

| Symptom | First action |
| --- | --- |
| Startup failure | Read the namespaced journal; check port conflicts, required settings and Key Vault access. Diagnose filesystem errors before weakening service hardening. |
| DB missing after reboot | Check both Compose files were used and the existing volume is attached. |
| Key Vault 403 | Check VM identity, network access, vault data-plane RBAC and propagation. |
| Microsoft 503 / 501 | 503: missing Entra settings. 501: external-login service still unfinished. |
| Microsoft 502 | Correlate request ID and safe error metadata; check registration, callback URI, consent/scopes and secret expiry. |
| Email exhausted / accepted but absent | Check Brevo's delivery events, sender verification, API status and credentials. Do not reset retries blindly. |

Rollback is not yet reliable through `deploy.sh <commit>`: its unconditional pull
fails on a detached commit. Preserve the previous release before deployment; a
controlled rollback must stop/repoint the service to that built commit and confirm
its compatibility with the current database. Fix automation before relying on it.

Take restricted-access PostgreSQL backups before destructive migrations and keep
them outside the repository. Restore first into a separate database to verify the
backup; do not assume checking out older code reverses database migrations.

References: [Nginx logging](https://nginx.org/en/docs/http/ngx_http_log_module.html),
[systemd journal namespaces](https://github.com/systemd/systemd/blob/main/man/journald.conf.xml),
[Docker local logging](https://docs.docker.com/engine/logging/drivers/local/).
