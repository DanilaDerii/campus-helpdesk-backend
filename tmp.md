Recommendation
Do not mass-delete directories from src/. I would clean it in this order:
1. Remove comments/history from the normal ticket payload.
2. Add pagination.
3. Stop waiting for email delivery during HTTP requests.
4. Fix startup error handling.
5. Remove the confirmed dead exports and tiny aliases.
6. Split the 431-line ticket command file.




Actual application flow
1. User signs in through Microsoft Entra.
2. Microsoft proves the user’s identity.
3. The backend creates or updates a local PostgreSQL user.
4. The backend creates its own application JWT—not the Microsoft token.
5. The browser stores that JWT in an HTTP-only cookie.
6. Every API request verifies the JWT and reloads the user’s current role.
7. The user can then perform actions allowed by RBAC.




Work completed in this chat - 15 September 2026

Git and branch setup
1. Replaced the local main branch with the current GitHub main branch.
2. The resulting main commit was d271272.
3. Created the dan_final branch from that exact main commit and switched to it.
4. All later cleanup was done on dan_final.

Confirmed minimum project scope
1. Keep Express REST API, PostgreSQL, Prisma ORM and Prisma migrations.
2. Keep Microsoft Entra university login.
3. Keep the application's own JWT and RBAC after Entra confirms the identity.
4. Keep Azure Key Vault for production secrets.
5. Keep Brevo as the required third-party API and email provider.
6. Keep Azure/Linux deployment, Nginx, HTTPS and the /helpdesk URL path.
7. Peer API integration is no longer required and was not added.
8. The application roles are STUDENT, TECHNICIAN and ADMIN. FACULTY was removed.

Final simplified application logic
1. A user signs in through Microsoft Entra.
2. The backend creates or updates that person in PostgreSQL.
3. The backend issues its own JWT containing the HelpDesk identity.
4. A student creates tickets and adds comments.
5. A technician claims tickets, adds comments and changes ticket status.
6. An administrator sees all tickets, assigns technicians, changes ticket status and manages user roles.
7. Ticket categories are fixed database records. They cannot be created, edited or deleted through the API.
8. Creating a ticket, adding a comment, assigning a ticket or resolving/updating it sends a Brevo email on the deployed VM.

Removed unnecessary features
1. Deleted the tests directory because it is not a required deliverable.
2. Removed the npm test script.
3. Removed the FACULTY role from the Prisma schema, backend checks, frontend types and documentation.
4. Removed ticket history tables, repositories, services, routes and response data.
5. Removed stored email notification jobs, retry delays, leases, failure tracking and the background email worker.
6. Removed the DeliveryStatus enum and email_notifications table from Prisma.
7. Removed separate comment-history listing endpoints that duplicated ticket details.
8. Removed category create, edit and delete controllers, routes, frontend calls and the Categories management page.
9. Removed the special concurrent ticket-claim protection. Claiming now performs the straightforward assignment update.
10. Removed confirmed dead exports, aliases and code left behind by those features.

Database migration added
File: prisma/migrations/20260915000000_simplify_ticket_workflow/migration.sql

The migration:
1. Converts any existing FACULTY user to STUDENT.
2. Rebuilds the Role enum with only STUDENT, TECHNICIAN and ADMIN.
3. Drops ticket_history and email_notifications.
4. Drops DeliveryStatus.
5. Inserts or updates the four fixed categories: IT Support, Facilities, Registration and General.

The category records were removed from prisma/seed.ts. The seed now handles development users only. The migration has been written but was not executed during this chat.

Email simplification
1. Production still uses Alex's Brevo implementation.
2. Local development does not send email.
3. The local console email provider is now a small no-operation stub so the backend can run locally without Brevo.
4. The removed background worker was an internal email retry worker. It was not PM2.
5. This repository does not use PM2; the documented VM process is managed by systemd as helpdesk.service.

Service directory reorganization
The old loose service files were grouped by purpose:

src/services/auth/
- cookie.ts: reads and writes the JWT cookie.
- login.ts: handles local/external login and local user creation/update.
- token.ts: creates and verifies the application's JWT.
- users.ts: administrator user and role operations.
- index.ts: exports the auth functions.

src/services/ticket/
- access.ts: RBAC rules for tickets.
- categories.ts: returns the fixed category list.
- commands.ts: creates, claims, assigns and updates tickets.
- comments.ts: adds ticket comments.
- email.ts: asks the configured email provider to send ticket emails.
- errors.ts: ticket error codes.
- queries.ts: gets one ticket or lists tickets visible to the current user.
- index.ts: exports the ticket functions.

Database access directory
1. Renamed src/repositories/ to src/data_access/.
2. Updated every affected source import.
3. A repository/data-access function is a readable wrapper around a Prisma CRUD call.
4. The actual application CRUD calls are the prisma.*.create(), findUnique(), findMany() and update() calls inside src/data_access/.
5. src/database/prisma.ts creates the Prisma connection; it does not contain the ticket/user CRUD operations.

Current data-access files
- category.repository.ts: category reads.
- comment.repository.ts: comment creation.
- ticket.repository.ts: ticket creation, reads, role-filtered lists and updates.
- user.repository.ts: user reads and updates.
- user-selection.ts: shared list of user fields returned inside ticket and comment responses.
- index.ts: exports the data-access functions.

Small CRUD review decisions
1. Removed findTicketCommentById(). It reloaded a comment immediately after creating it.
2. createTicketComment() now creates the comment and returns its author in one Prisma query.
3. Loading a ticket still returns all comments related to that ticket through findTicketById().
4. Kept findCategoryById(). It checks that a submitted category ID exists and returns a clear CATEGORY_NOT_FOUND response before ticket creation.
5. Kept the three ticket-list behaviours because they enforce RBAC: students see their tickets, technicians see assigned plus open unassigned tickets, and administrators see all tickets.
6. Those three list functions are selected by listTicketsForUser() in src/services/ticket/queries.ts. They all support the single GET /tickets endpoint.
7. user-selection.ts is not dead code. It prevents fields such as microsoftOid and timestamps from being included when a ticket or comment includes user information.

Verification performed
1. Repeated source searches were used to check callers and remove stale imports.
2. A repository-wide search found no remaining imports of src/repositories or repositories/index.
3. git diff --check passed after the edits.
4. No build, automated test, database test or migration execution was run because permission was not given.
