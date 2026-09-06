ALTER TYPE "DeliveryStatus" ADD VALUE 'EXHAUSTED';

ALTER TABLE "email_notifications"
    ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "next_attempt_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "email_notifications" SET "next_attempt_at" = NULL
WHERE "delivery_status" = 'SENT';

DROP INDEX "email_notifications_delivery_status_idx";
CREATE INDEX "email_notifications_delivery_status_next_attempt_at_idx"
    ON "email_notifications"("delivery_status", "next_attempt_at");
