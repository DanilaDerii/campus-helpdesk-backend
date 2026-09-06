-- Preserve ticket records while removing obsolete origin metadata.
ALTER TABLE "tickets" DROP COLUMN "source";
DROP TYPE "TicketSource";
