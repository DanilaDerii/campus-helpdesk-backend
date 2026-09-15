UPDATE "users" SET "role" = 'STUDENT' WHERE "role" = 'FACULTY';

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TECHNICIAN', 'ADMIN');
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
DROP TYPE "Role_old";

DROP TABLE "email_notifications";
DROP TABLE "ticket_history";
DROP TYPE "DeliveryStatus";

INSERT INTO "ticket_categories" ("name", "description") VALUES
  ('IT Support', 'Computers, accounts, network, and software'),
  ('Facilities', 'Rooms, furniture, electricity, and campus facilities'),
  ('Registration', 'Course registration problems'),
  ('General', 'HelpDesk requests that do not match another category')
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description";
