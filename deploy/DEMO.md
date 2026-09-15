# Demo script

This script fits a 10-minute video. Replace `<domain>` with the live host and
rehearse once before recording.

## Before recording

- [ ] `systemctl is-active helpdesk` and `curl -s https://<domain>/helpdesk/ready` both succeed.
- [ ] Your account is `ADMIN` (see [DEPLOYMENT.md](DEPLOYMENT.md#release)), and a
      second university account is available.
- [ ] Cookies for `<domain>` are cleared and the university inbox is open.
- [ ] Backup screenshots are taken: a Brevo email, `/helpdesk/api/v1/me`, and `.env` with no secrets.

## Running order

1. **Infrastructure (1 min).** Show that the existing site still works next to `/helpdesk/`:

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/
   curl -s https://<domain>/helpdesk/health; curl -s https://<domain>/helpdesk/ready
   systemctl show helpdesk -p User -p Restart -p MemoryMax
   ```

   Points to make: HTTPS, a non-root service, and the app and database bound to loopback.
2. **Secrets (1 min).** Run `cat /opt/campus-helpdesk/.env` to show it holds no
   secrets. They load from Key Vault through the managed identity.
3. **Sign-in (1.5 min).** Open `https://<domain>/helpdesk/` and sign in with
   Microsoft. New users start as `STUDENT`, because roles come from the database.
4. **Student (1.5 min).** From the second account, create a ticket and show the
   email arriving. Students see only their own tickets.
5. **Admin and technician (2.5 min).**
   1. As admin, open **Users** and make the second account `TECHNICIAN`.
   2. From that account, claim the ticket and comment.
   3. Resolve the ticket. Each change sends an email, and a resolved ticket cannot be reopened.
6. **Code (1.5 min).**
   - `prisma/schema.prisma` and its migrations.
   - `src/providers/`: local and Azure/Brevo implementations behind one interface.
   - `deploy/deploy.sh`.

## Pitfalls

| Symptom | Fix |
| --- | --- |
| `INVALID_ACCESS_TOKEN` | The session lasts one hour. Sign in again. |
| `403 INVALID_REQUEST_ORIGIN` from curl | Add `-H "Origin: https://<domain>"`. |
| PowerShell `INVALID_JSON` or a dropped cookie | Use `curl.exe --data-binary "@file"`, not inline JSON or `Invoke-RestMethod`. |

## Reset between rehearsals

```bash
cd /opt/campus-helpdesk
sudo docker exec -i $(sudo docker compose ps -q postgres) psql -U helpdesk -d helpdesk \
  -c "delete from ticket_comments; delete from tickets;"
```
