# Campus HelpDesk — deployment and operations

Deployment of the HelpDesk API to the project VM, served at
`https://<domain>/helpdesk/` behind Nginx, with production secrets loaded from
Azure Key Vault at runtime.

Owner: Alex. The files in this directory are the deployment source of truth.

---

## 1. How it runs on the VM

```
Internet
   | HTTPS 443
   v
Nginx  -- location /             -> existing application on 127.0.0.1:3000
       -- location /api          -> existing application on 127.0.0.1:3000
       -- location ^~ /helpdesk/ -> HelpDesk API on 127.0.0.1:3001  (prefix stripped)
                                        |
                                        +-- PostgreSQL container, 127.0.0.1:5433
                                        +-- Azure Key Vault (managed identity)
                                        +-- Brevo email API
```

Nothing but Nginx can reach port 3001 from outside the host, and the database
container publishes only to loopback.

| Component | Where |
|---|---|
| Application | systemd unit `helpdesk`, running as the non-root `helpdesk` account |
| Source | `/opt/campus-helpdesk`, owned `azureuser:helpdesk` |
| Database | Docker container from `compose.yaml` plus `deploy/alex/compose.postgres.override.yaml` |
| Reverse proxy | `deploy/alex/nginx/helpdesk.location.conf`, pasted into the HTTPS server block |
| Secrets | Azure Key Vault, read through the VM's system-assigned managed identity |

---

## 2. One-time setup

### 2.1 Host

Ubuntu 24.04, Node 22 or newer (the code uses ESM top-level `await`), Docker,
and Nginx with an existing Let's Encrypt certificate for the domain.

At least **2 GiB RAM**. The application and PostgreSQL together use roughly
250 MiB; a 1 GiB VM also running other workloads will be OOM-killed.

### 2.2 Service account and checkout

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin helpdesk
sudo mkdir -p /opt/campus-helpdesk
sudo chown azureuser:helpdesk /opt/campus-helpdesk
git clone <repository-url> /opt/campus-helpdesk
sudo chown -R azureuser:helpdesk /opt/campus-helpdesk
sudo chmod -R g+rX /opt/campus-helpdesk
```

`azureuser` owns the tree so deployment works without `sudo` on every file
operation, and the `helpdesk` group can read it so the service can run. The
service account deliberately has no shell; never try to log in as it.

### 2.3 Azure identity and Key Vault

1. **VM, Identity, System assigned, On.**
2. On the vault, under **Access control (IAM)**, add two role assignments:
   - your own account gets **Key Vault Secrets Officer**, to create secrets;
   - the VM's managed identity gets **Key Vault Secrets User**, to read them.

Owner and Contributor cover the control plane only. Reading and writing secrets
is a separate data-plane permission, so both assignments are required. Allow a
few minutes for propagation.

Vault secret names use dashes because Key Vault names cannot contain
underscores. The mapping from the application's logical names lives in
`src/alex/secrets/production-secret-provider.ts`.

| Vault secret | Consumed by | Required |
|---|---|---|
| `helpdesk-database-url` | Prisma, and the deploy script | Always |
| `helpdesk-jwt-secret` | Token service | Always |
| `helpdesk-brevo-api-key` | Brevo email provider | Production |
| `helpdesk-entra-client-secret` | Microsoft login | When Entra is enabled |
| `helpdesk-peer-inbound-api-key` | Peer API (Andrei) | When the peer API is enabled |
| `helpdesk-educore-outbound-api-key` | EduCore client (Andrei) | When the peer API is enabled |

`helpdesk-database-url` must point at **`localhost:5433`**, not at a Docker
service name. The application runs on the host under systemd rather than inside
the Compose network, so it reaches PostgreSQL through the published port.

### 2.4 Brevo

Create the account, then **authenticate the sending domain** using the DNS
records Brevo supplies. Validating a single sender address instead would require
a working mailbox at that address, which the domain does not have. Store the v3
API key as `helpdesk-brevo-api-key`.

### 2.5 Microsoft Entra ID

Register the application in the university tenant:

1. **Microsoft Entra ID, App registrations, New registration.**
2. Supported account types: **single tenant**. This makes Microsoft itself
   refuse accounts from other directories, which is stronger than checking in
   application code.
3. Redirect URI, platform **Web**, exactly:
   `https://<domain>/helpdesk/api/v1/auth/callback`
   This is the public URL. Nginx strips `/helpdesk` before the application sees
   the request, but Microsoft and the token exchange both use the public form,
   and the value must match the registration character for character.
4. From **Overview**, copy the **Application (client) ID** and the
   **Directory (tenant) ID**.
5. **Certificates & secrets, New client secret.** Copy the *Value*, which is
   shown once. Store it in Key Vault as `helpdesk-entra-client-secret`.

No API permissions or admin consent are needed. `openid`, `profile` and `email`
are sign-in scopes granted implicitly.

The client secret never leaves Key Vault. Only the three non-secret identifiers
go into `.env`.

### 2.6 The `.env` file on the VM

Non-secret settings only. In production it must contain no secret at all.

```
PORT=3001
NODE_ENV=production
KEY_VAULT_URL=https://<vault-name>.vault.azure.net
BREVO_SENDER_EMAIL=helpdesk@<domain>
BREVO_SENDER_NAME=Campus HelpDesk
EDUCORE_BASE_URL=<peer base url>
ENTRA_TENANT_ID=<directory-id>
ENTRA_CLIENT_ID=<application-id>
ENTRA_REDIRECT_URI=https://<domain>/helpdesk/api/v1/auth/callback
```

Set it to mode `640`, owned `azureuser:helpdesk`. `deploy.sh` refuses to deploy
if a production secret appears here while `NODE_ENV=production`.

### 2.7 systemd and Nginx

```bash
sudo cp deploy/alex/helpdesk.service /etc/systemd/system/helpdesk.service
sudo systemctl daemon-reload
sudo systemctl enable --now helpdesk
```

Paste the blocks from `deploy/alex/nginx/helpdesk.location.conf` inside the
existing HTTPS server block, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` only validates the file. Nothing takes effect until the reload.

### 2.8 First database setup

```bash
DATABASE_URL="postgresql://helpdesk:<password>@localhost:5433/helpdesk" npx prisma migrate deploy
DATABASE_URL="postgresql://helpdesk:<password>@localhost:5433/helpdesk" npm run db:seed
```

Seed only a development or demonstration database.

### 2.9 The first administrator

Microsoft sign-in creates users with the default role `STUDENT`, and promoting
anyone requires an existing administrator. The seeded `admin@helpdesk.local`
account is reachable only through the development login, which production
disables. **In a fresh production database there is therefore no administrator
and no API route to create one.**

Sign in once through Microsoft so the account exists, then promote it directly:

```bash
sudo docker exec -i $(sudo docker compose ps -q postgres) psql -U helpdesk -d helpdesk -c "UPDATE users SET role = 'ADMIN' WHERE email = '<your-university-address>';"
```

Every later role change can go through `PATCH /api/v1/users/:userId` as an
administrator. This bootstrap is an open design question for the backend owner,
recorded in `todo.md` section 5.6.1.

---

## 3. Routine deployment

```bash
cd /opt/campus-helpdesk
./deploy/alex/deploy.sh              # current branch
./deploy/alex/deploy.sh main         # a specific ref
```

The script updates the source, ensures PostgreSQL is running, installs
dependencies, builds, applies migrations, restarts the service, and verifies the
local and public health endpoints. It reads the database URL from Key Vault for
the build and migration steps only, because the Prisma CLI has no Key Vault
support of its own, and it never writes that value to disk.

---

## 4. Verification

```bash
curl https://<domain>/helpdesk/health
curl -o /dev/null -w "%{http_code}\n" https://<domain>/
journalctl -u helpdesk -n 20 --no-pager
```

Expect the health JSON, `200` from the pre-existing route, and a journal with no
database errors. `/health` does **not** test the database, so always read the
journal too. See section 6.3.

Reboot survival, which is part of the definition of done:

```bash
sudo reboot
# after about 40 seconds
systemctl is-active helpdesk
sudo docker ps --format '{{.Names}}\t{{.Status}}'
curl https://<domain>/helpdesk/health
```

---

## 5. Rollback

```bash
cd /opt/campus-helpdesk
git log --oneline -10
./deploy/alex/deploy.sh <previous-commit>
```

**Database migrations do not roll back automatically.** A release containing a
destructive migration cannot be undone by redeploying the previous commit. Take
a dump before any migration that drops or rewrites data:

```bash
sudo docker exec $(sudo docker compose ps -q postgres) pg_dump -U helpdesk helpdesk > ~/helpdesk-$(date +%F-%H%M).sql
```

---

## 6. Troubleshooting

Every item here was hit during the initial deployment.

### 6.1 The service restart-loops with exit code 1

Usually the port is already held by a manually started process:

```bash
ss -tlnp | grep :3001
pkill -f 'dist/src/server.js'
sudo systemctl restart helpdesk
```

`journalctl -u helpdesk -n 40 --no-pager` gives the real reason. If the unit
fails immediately with a filesystem error, relax `ProtectSystem=strict` in the
unit rather than guessing at the cause.

### 6.2 The database is unreachable after a reboot

The base `compose.yaml` sets no restart policy, so the container does not come
back while the service does. The override in this directory adds
`restart: unless-stopped`; always deploy with both files, as `deploy.sh` does.
The symptom is `Can't reach database server at 127.0.0.1:5433` in the journal.

### 6.3 `/health` reports ok but nothing works

`/health` answers without touching PostgreSQL, so it stays green while the
database is down. There is no readiness endpoint yet; this is an open request to
the backend owner recorded in `todo.md` section 5.7. Until it exists, verify the
journal rather than the status code alone.

### 6.4 Key Vault returns "operation is not allowed by RBAC"

Owner and Contributor do not grant data-plane access. Assign **Key Vault Secrets
Officer** to yourself and **Key Vault Secrets User** to the VM identity, then
wait a few minutes. Confirm the VM has an identity at all:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H Metadata:true \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net"
```

`200` means an identity is assigned, `400` means it is not.

### 6.5 Brevo accepts the message but nothing arrives

A returned `messageId` means accepted for processing, not delivered. Brevo
rejects asynchronously, so read its event log, where the failure appears as an
`error` event with a reason such as "the sender you used is not valid". Fix it by
authenticating the domain as in section 2.4.

Because acceptance and delivery are separate, `email_notifications.SENT` records
that Brevo accepted the request, not that the message was delivered. Brevo's
event log is the authority on delivery.

### 6.6 `prisma generate` cannot resolve `DATABASE_URL`

Expected once secrets leave `.env`. The Prisma CLI reads the environment and
knows nothing about Key Vault. Use `deploy.sh`, or supply the value for a single
command.

### 6.7 Unexplained failures right after `npm ci`

`npm ci` deletes and recreates `node_modules` underneath the running process.
Always restart the service afterwards; `deploy.sh` does this.

### 6.8 Microsoft shows an error page instead of returning to the application

The redirect URI sent by the application does not match the one registered.
It must be the public HTTPS URL, character for character, with no trailing
slash. Compare `ENTRA_REDIRECT_URI` in `.env` with the value under
Authentication in the app registration.

### 6.9 Microsoft login returns 502 MICROSOFT_LOGIN_FAILED

The application deliberately does not surface Microsoft or MSAL internals to
the caller, so read the journal:

```bash
journalctl -u helpdesk -n 30 --no-pager
```

If MSAL reports a scope problem, set `ENTRA_SCOPES=User.Read` in `.env` and
restart. Some tenants reject a token request carrying only reserved OpenID
Connect scopes.

If the failure is reading `helpdesk-entra-client-secret`, confirm the secret
exists and that the client secret was copied rather than the secret ID.

### 6.10 Microsoft login returns 503 MICROSOFT_LOGIN_UNAVAILABLE

Expected outside production: the message names the missing `ENTRA_*` settings.
The routes are mounted in every environment, and the provider is built lazily
so a missing configuration answers cleanly instead of preventing startup.

---

## 7. Operational notes

- **Development login.** The application disables it when `NODE_ENV=production`.
  While the VM runs in development mode, an exact-match Nginx location returns
  404 for `/helpdesk/api/v1/auth/dev-login`, so the public internet cannot obtain
  an administrator token using a seeded address. Remove that line once the
  deployment is permanently in production.
- **Branch on the VM.** Confirm the checkout is on the merged branch before any
  demonstration. `deploy.sh` prints the current commit.
- **Cost.** A stopped-deallocated VM bills only for storage. Deallocating between
  working sessions requires a **static** public IP; with a dynamic address the
  public IP changes and the DNS record and certificate stop matching.
- **Certificates.** Renewal is handled by `certbot.timer`; check it with
  `systemctl list-timers | grep certbot`.
- **Firewall.** `ufw` allows only OpenSSH and Nginx Full (22, 80, 443), default
  deny incoming. Ports 3001 and 5433 are unreachable from outside regardless,
  because both bind to loopback. Note that Docker writes its own iptables rules
  and can bypass `ufw` for published ports; that is harmless here only because
  the database container publishes to `127.0.0.1` rather than `0.0.0.0`. Always
  allow SSH before enabling `ufw`, and confirm a second session works before
  closing the first.

---

## 8. Design decisions

Recorded so the reasoning survives, and so the backend owner can see why the
integration looks the way it does.

**Secrets are fetched through the shared `SecretProvider`, not read from files.**
`configured-secret-provider.ts` selects the environment provider outside
production and the Key Vault provider inside it. Business code never learns
which is in use.

**Vault secret names are mapped, not passed through.** Key Vault names cannot
contain underscores, so `DATABASE_URL` cannot be a vault name. The map lives in
`src/alex/secrets/production-secret-provider.ts`; an unmapped name throws rather
than silently looking up something that does not exist.

**Provider factories are synchronous, and network work is deferred.** The
configured secret provider and the notification service both build their
providers at module load and cannot await. Clients are therefore constructed
synchronously and every secret is fetched on first use, with failed lookups
evicted from the cache so one transient error cannot disable a subsystem for the
lifetime of the process.

**The application runs under systemd rather than in a container.** Managed
identity reaches Azure IMDS natively on the host, which removes a class of
container networking problems from the most security-sensitive path. PostgreSQL
stays containerised because it has no such requirement.

**OAuth state is a signed token, not session data.** The application has no
session store and adding cookie middleware would mean changing core files owned
by the backend owner. A short-lived signed value is stateless, survives a
restart mid-login, and adds no dependency. A distinct audience keeps these
tokens from being usable as access tokens.

**Microsoft proves identity; PostgreSQL decides authorization.** No role or group
claim from Microsoft is trusted. The `tid` claim is still compared against the
configured tenant as defence in depth, so a registration accidentally switched to
multi-tenant does not quietly widen access.

**Email failures are thrown, not absorbed.** The notification service already
records `FAILED` and retries, so the provider surfaces errors rather than
swallowing them. Note that `SENT` means Brevo accepted the request; Brevo can
still reject asynchronously, and its event log is the authority on delivery.

**Dependencies added to `package.json`,** which is outside `src/alex/**` and
needs the backend owner's review: `@azure/identity` and
`@azure/keyvault-secrets` for Key Vault, and `@azure/msal-node` for the
authorization-code flow. Brevo needed none, since `fetch` is built in.
