#!/usr/bin/env bash
#
# Repeatable release for the Campus HelpDesk API on the project VM.
#
#   ./deploy/alex/deploy.sh [git-ref]
#
# The database connection string is read from Azure Key Vault at deploy time
# using the VM's managed identity and is passed only to the commands that need
# it. It is never written to disk and never printed. The Prisma CLI cannot read
# Key Vault itself, which is why this indirection exists.
#
# See deploy/alex/DEPLOYMENT.md for one-time setup and troubleshooting.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/campus-helpdesk}"
VAULT_URL="${KEY_VAULT_URL:-https://jesoas-helpdesk-kv.vault.azure.net}"
SERVICE="${SERVICE:-helpdesk}"
PORT="${PORT:-3001}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://jesoas.org/helpdesk/health}"
GIT_REF="${1:-}"

log()  { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# --- Preconditions ---------------------------------------------------------
[ -d "$APP_DIR/.git" ] || fail "$APP_DIR is not a git checkout"
command -v node >/dev/null    || fail "node is not installed"
command -v python3 >/dev/null || fail "python3 is not installed (used to parse JSON)"
cd "$APP_DIR"

# --- Read a secret from Key Vault via the VM's managed identity -------------
vault_secret() {
  local name="$1" token
  token="$(curl -fsS -H Metadata:true --max-time 10 \
    "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')" \
    || fail "Could not obtain a managed-identity token. Is system-assigned identity enabled on the VM?"
  curl -fsS -H "Authorization: Bearer $token" --max-time 10 \
    "${VAULT_URL}/secrets/${name}?api-version=7.4" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["value"])' \
    || fail "Could not read \"$name\" from $VAULT_URL. Check the Key Vault Secrets User role assignment."
}

# --- Refuse to deploy with production secrets sitting in .env ---------------
if [ -f .env ] && grep -qE '^(DATABASE_URL|JWT_SECRET|BREVO_API_KEY|ENTRA_CLIENT_SECRET)=' .env; then
  if grep -qE '^NODE_ENV=production' .env; then
    fail ".env contains a production secret while NODE_ENV=production. Secrets must come from Key Vault; remove those lines."
  fi
  log "NOTE: .env holds development secrets. That is expected outside production."
fi

# --- Source ----------------------------------------------------------------
log "Updating source"
git fetch --prune
if [ -n "$GIT_REF" ]; then
  git checkout "$GIT_REF"
fi
git pull --ff-only
git --no-pager log --oneline -1

# --- Secrets ---------------------------------------------------------------
log "Reading the database URL from Key Vault"
DATABASE_URL="$(vault_secret helpdesk-database-url)"
[ -n "$DATABASE_URL" ] || fail "helpdesk-database-url is empty"
echo "ok (value not shown)"

# --- Database --------------------------------------------------------------
log "Ensuring PostgreSQL is running"
sudo docker compose -f compose.yaml -f deploy/alex/compose.postgres.override.yaml up -d postgres

# --- Build -----------------------------------------------------------------
log "Installing dependencies"
npm ci

log "Building (prisma generate needs DATABASE_URL in the environment)"
DATABASE_URL="$DATABASE_URL" npm run build

log "Applying database migrations"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

# --- Release ---------------------------------------------------------------
# npm ci replaces node_modules underneath the running process, so the restart
# is required rather than optional.
log "Restarting $SERVICE"
sudo systemctl restart "$SERVICE"

log "Verifying"
for attempt in $(seq 1 10); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  [ "$attempt" -eq 10 ] && fail "The service did not answer on port $PORT. Check: journalctl --namespace=helpdesk -u $SERVICE -n 50"
  sleep 1
done

echo "local  /health : $(curl -fsS "http://127.0.0.1:${PORT}/health")"
echo "public /health : $(curl -fsS --max-time 10 "$PUBLIC_HEALTH_URL" || echo 'UNREACHABLE - check nginx')"
echo "service        : $(systemctl is-active "$SERVICE")"
echo "database       : $(sudo docker inspect -f '{{.State.Status}}' "$(sudo docker compose ps -q postgres)")"

log "Deployment complete"
echo "Note: /health does not test the database. Confirm the journal is free of"
echo "connection errors:  journalctl --namespace=helpdesk -u $SERVICE -n 20 --no-pager"
