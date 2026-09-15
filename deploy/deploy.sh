#!/usr/bin/env bash
#
# Release the Campus HelpDesk on the VM:  ./deploy/deploy.sh [git-ref]
#
# DATABASE_URL is read from Key Vault through the VM's managed identity and is
# passed only to the build and migration commands. It is never written or printed.

set -euo pipefail

log()  { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

APP_DIR="${APP_DIR:-/opt/campus-helpdesk}"
SERVICE="${SERVICE:-helpdesk}"
GIT_REF="${1:-}"

# Non-secret settings: exported variable, then the application's .env, then a default.
env_file_value() {
  [ -f "$APP_DIR/.env" ] || return 0
  sed -n "s/^[[:space:]]*$1=//p" "$APP_DIR/.env" | tail -n 1 | sed 's/^"//; s/"$//'
}

VAULT_URL="${KEY_VAULT_URL:-$(env_file_value KEY_VAULT_URL)}"
PORT="${PORT:-$(env_file_value PORT)}"
PORT="${PORT:-3001}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-$(env_file_value PUBLIC_HEALTH_URL)}"
PUBLIC_APP_URL="${PUBLIC_APP_URL:-$(env_file_value PUBLIC_APP_URL)}"
WEB_ROOT="${WEB_ROOT:-/var/www/helpdesk}"

[ -n "$VAULT_URL" ] || fail "KEY_VAULT_URL is set neither in the environment nor in $APP_DIR/.env"

# --- Preconditions ---------------------------------------------------------
[ -d "$APP_DIR/.git" ] || fail "$APP_DIR is not a git checkout"
command -v node >/dev/null    || fail "node is not installed"
command -v python3 >/dev/null || fail "python3 is not installed (used to parse JSON)"
cd "$APP_DIR"

# --- Key Vault -------------------------------------------------------------
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

# --- Host configuration files ----------------------------------------------
# Installed from deploy/ on every release. The HTTPS server block needs one
# manual line:  include snippets/helpdesk.locations.conf;

install_if_changed() {
  local source="$1" destination="$2" mode="${3:-0644}"

  if [ -f "$destination" ] && sudo cmp -s "$source" "$destination"; then
    return 1
  fi

  sudo install -m "$mode" "$source" "$destination"
  echo "  updated $destination"
  return 0
}

install_host_files() {
  local nginx_changed=0 systemd_changed=0

  sudo install -d -m 0755 /etc/nginx/snippets /var/www/helpdesk /etc/systemd/journald@helpdesk.conf.d
  sudo install -d -m 0750 -o www-data -g adm /var/log/helpdesk-nginx

  if install_if_changed deploy/nginx/helpdesk.logging.conf /etc/nginx/conf.d/helpdesk.logging.conf; then nginx_changed=1; fi
  if install_if_changed deploy/nginx/helpdesk.proxy.conf /etc/nginx/snippets/helpdesk.proxy.conf; then nginx_changed=1; fi
  if install_if_changed deploy/nginx/helpdesk.location.conf /etc/nginx/snippets/helpdesk.locations.conf; then nginx_changed=1; fi
  if install_if_changed deploy/journald/retention.conf /etc/systemd/journald@helpdesk.conf.d/retention.conf; then systemd_changed=1; fi
  if install_if_changed deploy/helpdesk.service /etc/systemd/system/helpdesk.service; then systemd_changed=1; fi
  install_if_changed deploy/logrotate/helpdesk /etc/logrotate.d/helpdesk || true

  # -R follows the sites-enabled symlink; -r would not.
  if ! sudo grep -Rqs "helpdesk.locations.conf" /etc/nginx/sites-enabled/ /etc/nginx/sites-available/ /etc/nginx/conf.d/ /etc/nginx/nginx.conf; then
    fail "No Nginx server block includes the HelpDesk locations. Add this line inside the HTTPS server block for this host, then run the deployment again:

    include snippets/helpdesk.locations.conf;"
  fi

  if [ "$systemd_changed" -eq 1 ]; then
    log "Reloading systemd units"
    sudo systemctl daemon-reload
  fi

  if [ "$nginx_changed" -eq 1 ]; then
    log "Reloading Nginx"
    sudo nginx -t
    sudo systemctl reload nginx
  else
    echo "  Nginx configuration unchanged"
  fi
}

# --- Refuse production secrets in .env -------------------------------------
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

# A pinned commit (rollback) leaves a detached HEAD, where pull would fail.
if git symbolic-ref -q HEAD >/dev/null; then
  git pull --ff-only
else
  echo "Detached HEAD: deploying a pinned commit, skipping pull."
fi
git --no-pager log --oneline -1

# --- Secrets ---------------------------------------------------------------
log "Reading the database URL from Key Vault"
DATABASE_URL="$(vault_secret helpdesk-database-url)"
[ -n "$DATABASE_URL" ] || fail "helpdesk-database-url is empty"
echo "ok (value not shown)"

# --- Database --------------------------------------------------------------
# The container password comes from the same URL the application uses. PostgreSQL
# applies it only when initialising an empty volume.
POSTGRES_PASSWORD="$(python3 -c 'import sys,urllib.parse as u; print(u.unquote(u.urlparse(sys.argv[1]).password or ""))' "$DATABASE_URL")"
[ -n "$POSTGRES_PASSWORD" ] || fail "helpdesk-database-url has no password component"
export POSTGRES_PASSWORD

log "Ensuring PostgreSQL is running"
sudo -E docker compose -f compose.yaml -f deploy/compose.postgres.override.yaml up -d postgres

# --- Build -----------------------------------------------------------------
log "Installing dependencies"
npm ci

log "Building"
DATABASE_URL="$DATABASE_URL" npm run build

log "Applying database migrations"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

# --- Frontend ---------------------------------------------------------------
if [ -d frontend ]; then
  log "Building the single-page application"
  ( cd frontend && npm ci && npm run build )
  [ -f frontend/dist/index.html ] || fail "The frontend build produced no dist/index.html"

  # Publish through a directory swap so a half-copied build is never served.
  log "Publishing the frontend to $WEB_ROOT"
  sudo rm -rf "${WEB_ROOT}.new" "${WEB_ROOT}.old"
  sudo install -d -m 0755 "${WEB_ROOT}.new"
  sudo cp -a frontend/dist/. "${WEB_ROOT}.new/"
  if [ -d "$WEB_ROOT" ]; then sudo mv "$WEB_ROOT" "${WEB_ROOT}.old"; fi
  sudo mv "${WEB_ROOT}.new" "$WEB_ROOT"
  sudo rm -rf "${WEB_ROOT}.old"
else
  log "No frontend directory in this checkout, skipping the application shell"
fi

log "Installing host configuration files"
install_host_files

# --- Release ---------------------------------------------------------------
# npm ci replaced node_modules under the running process, so a restart is required.
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
echo "service        : $(systemctl is-active "$SERVICE")"

# /health checks the process only; /ready also queries PostgreSQL.
if ! curl -fsS --max-time 10 "http://127.0.0.1:${PORT}/ready" >/dev/null; then
  fail "The service is up but /ready failed, so the database is not reachable. Check: journalctl --namespace=helpdesk -u $SERVICE -n 30 --no-pager"
fi
echo "local  /ready  : ok (database reachable)"

if [ -n "$PUBLIC_HEALTH_URL" ]; then
  if curl -fsS --max-time 10 "$PUBLIC_HEALTH_URL" >/dev/null; then
    echo "public /health : ok"
  else
    fail "Public health check failed at $PUBLIC_HEALTH_URL while the service is healthy locally. Check Nginx and DNS."
  fi
else
  echo "public /health : skipped (set PUBLIC_HEALTH_URL in the environment or .env)"
fi

# The shell is served by Nginx, so check it separately from the API.
if [ -n "$PUBLIC_APP_URL" ]; then
  if curl -fsS --max-time 10 "$PUBLIC_APP_URL" | grep -q '<script'; then
    echo "public shell  : ok"
  else
    fail "The application shell at $PUBLIC_APP_URL did not return a usable page. Check the Nginx static locations and $WEB_ROOT."
  fi
else
  echo "public shell  : skipped (set PUBLIC_APP_URL in the environment or .env)"
fi

log "Deployment complete"
