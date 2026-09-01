# Campus HelpDesk Implementation Checklist

This file tracks the route skeletons. A route currently returns HTTP `501 Not Implemented` until its real controller and service are added.

The first priority is our own application. Peer-team integration remains mocked until the HelpDesk core works.

## Foundation

- [x] Express route skeleton
- [x] Health endpoint
- [x] Placeholder provider interfaces
- [x] Local PostgreSQL Docker Compose configuration
- [x] Prisma PostgreSQL dependencies
- [x] Shared Prisma database client
- [x] Focused Prisma repositories
- [ ] Configuration validation
- [x] Shared request validation
- [x] Shared error handling
- [x] Prisma schema
- [x] Initial Prisma migration
- [x] Local database seed

## Authentication

- [ ] `GET /api/v1/auth/login`
- [ ] `GET /api/v1/auth/callback`
- [x] `POST /api/v1/auth/dev-login`
- [x] `GET /api/v1/me`
- [x] JWT creation and verification service
- [x] Development authentication service
- [ ] Microsoft identity provider
- [x] Active-user check in authentication service
- [x] Role and ownership checks

## Tickets

- [x] `POST /api/v1/tickets`
- [x] `GET /api/v1/tickets`
- [x] `GET /api/v1/tickets/:ticketId`
- [x] `POST /api/v1/tickets/:ticketId/claim`
- [x] `PATCH /api/v1/tickets/:ticketId/status`
- [x] `PATCH /api/v1/tickets/:ticketId/assignment`
- [x] `POST /api/v1/tickets/:ticketId/comments`
- [x] `GET /api/v1/tickets/:ticketId/comments`
- [x] `GET /api/v1/tickets/:ticketId/history`

## Administration

- [x] `GET /api/v1/categories`
- [x] `POST /api/v1/categories`
- [x] `PATCH /api/v1/categories/:categoryId`
- [x] `DELETE /api/v1/categories/:categoryId`
- [x] `GET /api/v1/users`
- [x] `PATCH /api/v1/users/:userId`

## Notifications

- [x] Store pending email notifications
- [x] Console email provider for local development
- [ ] Brevo email provider
- [x] Record sent and failed attempts
- [x] Ensure email failure does not reverse ticket changes

## Deferred peer integration

- [x] Define `EnrollmentProvider` boundary
- [ ] Add a fixture enrollment provider
- [ ] `POST /peer/tickets`
- [ ] Inbound `x-api-key` check
- [ ] Agree final API contract with the EduCore group
- [ ] Add the real EduCore enrollment provider
- [ ] Test both API directions with the other group

## Deployment later

- [ ] Azure Key Vault provider
- [ ] Docker Compose or deployment script
- [ ] Nginx `/helpdesk` route
- [ ] HTTPS with Let's Encrypt
- [ ] Linux server hardening
- [ ] Live-system instructions
