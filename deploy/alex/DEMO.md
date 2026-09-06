# Campus HelpDesk live demonstration script

Running order for the graded demonstration and the recorded video, written from
what has actually been verified on the deployed VM. Substitute `<domain>` for the
live host throughout.

The course video is capped at **10 minutes**, so the timings below are a budget,
not a suggestion. Rehearse once end to end before recording: several steps depend
on a browser session and a one-hour token, and re-recording because a token
expired is the most likely way to lose time.

---

## 1. Before you start recording

Do all of this in advance. None of it is worth filming, and each item has broken
a run-through at least once.

- [ ] Service is up and the database is reachable:
      `systemctl is-active helpdesk` and `curl -s https://<domain>/helpdesk/ready`
- [ ] The pre-existing route still answers: `curl -s -o /dev/null -w "%{http_code}" https://<domain>/`
- [ ] `NODE_ENV=production` in `/opt/campus-helpdesk/.env`, and that file holds
      **no** secret. `./deploy/alex/deploy.sh` refuses to deploy otherwise.
- [ ] A **second** university account is available for the role comparison, or you
      have accepted the fallback in section 5.
- [ ] Your own account is already `ADMIN` (see section 5) so no database editing
      happens on camera.
- [ ] Browser signed out, cookies for `<domain>` cleared, so the sign-in is real.
- [ ] Terminal font size raised; the JSON responses need to be readable.
- [ ] Email client open on the university inbox, on screen, before you create the
      ticket. The message arrives within seconds and is easy to miss.

---

## 2. Infrastructure and the reverse proxy (about 1 minute)

Show that the new application was added to an existing server without disturbing
it, which is the point of the `/helpdesk/` path requirement.

```bash
curl -s -o /dev/null -w "existing root : %{http_code}\n" https://<domain>/
curl -s https://<domain>/helpdesk/health; echo
curl -s https://<domain>/helpdesk/ready; echo
```

Talking points: HTTPS via Let's Encrypt with automatic renewal; Nginx strips the
`/helpdesk/` prefix and routes only that path to this application; `/health`
reports the process while `/ready` runs a real database query, which is why both
exist.

Then the hardening, briefly:

```bash
systemctl show helpdesk -p User -p Restart -p MemoryMax
sudo ufw status | head -6
ss -tlnp | grep -E ':(3001|5433)'
```

Talking points: the service runs as the non-root `helpdesk` account, restarts
automatically and survives reboot; the firewall allows only SSH, HTTP and HTTPS;
the application and PostgreSQL bind to loopback, so neither is reachable from the
internet except through Nginx.

---

## 3. Secrets from Azure Key Vault (about 1 minute)

The strongest single demonstration in the whole run: the application is serving
traffic while its configuration file contains no secret at all.

```bash
cat /opt/campus-helpdesk/.env
```

Talking point: no database URL, no JWT secret, no API keys. Everything sensitive
is fetched at runtime from Key Vault using the VM's system-assigned managed
identity, so there is no bootstrap credential stored anywhere either.

```bash
curl -s -o /dev/null -w "IMDS token endpoint: %{http_code}\n" -H Metadata:true \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fvault.azure.net"
```

`200` proves the VM has an identity. Mention that the mapping from logical names
to vault names lives in `src/alex/secrets/production-secret-provider.ts`, because
Key Vault names cannot contain underscores.

---

## 4. Microsoft Entra ID sign-in (about 1.5 minutes)

Do this in a browser, live.

1. Navigate to `https://<domain>/helpdesk/api/v1/auth/login`
2. Sign in with the university account
3. You land on `https://<domain>/helpdesk/api/v1/me` showing the local user

Talking points while it redirects: single-tenant registration, so only university
accounts are accepted; PKCE plus a browser-bound state cookie protect the
exchange; the client secret comes from Key Vault, not from a file; Microsoft
proves **identity**, while the role in the response comes from PostgreSQL, which
is why a first-time user appears as `STUDENT` regardless of anything Microsoft
says.

---

## 5. Role-based access control (about 2 minutes)

**Preparation decision.** A first-time Microsoft user is always created as
`STUDENT`, and promoting anyone needs an existing administrator, so the first
administrator has to be promoted directly in the database. Do that **before**
recording:

```bash
sudo docker exec -i $(sudo docker compose ps -q postgres) \
  psql -U helpdesk -d helpdesk -c "UPDATE users SET role='ADMIN' WHERE email='<your-address>';"
```

The cleanest demonstration uses **two accounts**: a classmate signs in once with
their university account, which provisions them as `STUDENT` automatically, and
you are the administrator. If only one account is available, show the student
side using the ticket created in section 6 before the promotion, and say plainly
that the account was promoted beforehand.

Show, as administrator:

```bash
curl -s https://<domain>/helpdesk/api/v1/users -H "Cookie: helpdesk_access=$C"
curl -s https://<domain>/helpdesk/api/v1/tickets -H "Cookie: helpdesk_access=$C"
```

Then the same list from the student session: a student sees only their own
tickets, and `GET /api/v1/users` is refused. Talking point: the role check and
the ownership check are separate, so changing a URL does not grant access.

---

## 6. Ticket workflow and the Brevo notification (about 2.5 minutes)

The notification is the part worth filming carefully, because it involves a real
third-party service.

Have the university inbox visible on screen first. Then create a ticket. The
request body goes in a file: PowerShell mangles inline JSON escaping (see
section 8).

```powershell
$C = '<helpdesk_access cookie value>'
Set-Content -Path "$env:TEMP\ticket.json" -Encoding ascii -NoNewline -Value '{"categoryId":1,"title":"Projector not working","description":"Room 402 projector shows no signal","location":"Room 402"}'
curl.exe -s -X POST https://<domain>/helpdesk/api/v1/tickets -H "Cookie: helpdesk_access=$C" -H "Origin: https://<domain>" -H "Content-Type: application/json" --data-binary "@$env:TEMP\ticket.json"
```

The email arrives at the requester's university address within seconds. Show it.

Then show that delivery is recorded, not assumed:

```bash
sudo docker exec -i $(sudo docker compose ps -q postgres) psql -U helpdesk -d helpdesk \
  -c "select id, ticket_id, recipient_email, notification_type, delivery_status, provider_message_id from email_notifications order by id desc limit 3;"
```

Talking points: the notification row is written inside the same transaction as
the ticket, then sent after the commit, so a failing email can never roll back a
ticket; a failure is recorded as `FAILED` and retried by a background worker; the
`provider_message_id` ending `@smtp-relay.mailin.fr` is Brevo's own identifier.

Be precise about one thing if asked: `SENT` means Brevo **accepted** the message.
Brevo can still reject asynchronously, and its event log is the authority on
delivery. That distinction was found the hard way during integration.

Then, as an administrator, walk the ticket through its lifecycle: claim it,
change status, add a comment, and show the history. **Rehearse this sequence
before recording** — it is the one part of the workflow that has not been
exercised against the production deployment.

---

## 7. Code, schema and migrations (about 1.5 minutes)

Screen-share the repository rather than the server.

- `prisma/schema.prisma` — the models, enums and indexes, and the committed
  migrations under `prisma/migrations/`.
- `src/providers/**` — the shared contracts for secrets, identity and email.
- `src/alex/**` — the production implementations behind those contracts.
- Talking point: no business service imports an Azure, Brevo or Microsoft SDK.
  Swapping a provider is a configuration change, which is what let the whole
  application be built and tested locally before any cloud service existed.
- `deploy/alex/deploy.sh` — one repeatable release: update, migrate, restart,
  verify, and fail loudly rather than reporting a false success.

---

## 8. Things that will trip you up

Every one of these has already happened.

| Symptom | Cause and fix |
|---|---|
| `INVALID_ACCESS_TOKEN` right after signing in | The session token lasts one hour. Sign in again and copy a fresh `helpdesk_access` cookie. |
| `INVALID_JSON` from a PowerShell `curl.exe -d '{\"a\":1}'` | PowerShell 5.1 passes the backslashes through literally. Put the body in a file and use `--data-binary "@file"`. |
| `INVALID_ACCESS_TOKEN` from `Invoke-RestMethod -Headers @{Cookie=...}` | PowerShell 5.1 treats `Cookie` as a restricted header and drops it silently. Use `curl.exe`. |
| Browser console `fetch` blocked by `default-src 'none'` | Firefox's JSON viewer applies its own CSP to the rendered document. Use `curl.exe`, or run the fetch from a normal HTML page on the same origin. |
| `403 INVALID_REQUEST_ORIGIN` on a POST | A cookie-authenticated state change requires a matching `Origin` header. Add `-H "Origin: https://<domain>"`. |
| `503 MICROSOFT_LOGIN_UNAVAILABLE` | The `ENTRA_*` settings are missing or empty in `.env`. The message names which. |
| Service will not start after an `.env` change | Configuration is validated at startup. `journalctl --namespace=helpdesk -u helpdesk -n 30` names the offending setting. `PUBLIC_BASE_PATH` is required in production. |

---

## 9. Evidence to capture regardless of the live run

Screenshot these before the recording session. If anything fails on the day,
they are the proof that the feature works.

- [ ] The Brevo email in the university inbox
- [ ] The `email_notifications` row showing `SENT` and the Brevo message id
- [ ] `/helpdesk/api/v1/me` showing the university identity and role
- [ ] `.env` on the production host containing no secret
- [ ] The IMDS token endpoint returning `200`
- [ ] The pre-existing route still returning `200` alongside `/helpdesk/`

---

## 10. Resetting between rehearsals

```bash
# Sign out in the browser, or just clear cookies for the domain.
# Remove demonstration tickets, keeping the seeded categories and users:
sudo docker exec -i $(sudo docker compose ps -q postgres) psql -U helpdesk -d helpdesk \
  -c "delete from email_notifications where ticket_id > 0; delete from ticket_history where ticket_id > 0; delete from ticket_comments where ticket_id > 0; delete from tickets;"
```

Deleting tickets requires removing the rows that reference them first, which is
the order above. Leave the `users` and `ticket_categories` tables alone: they
carry the seeded categories and your promoted administrator account.
