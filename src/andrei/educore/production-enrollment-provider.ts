import type { EnrollmentProvider } from "../../providers/educore/enrollment-provider.js";

/** Andrei replaces this boundary with the real EduCore API provider. */
export function createEduCoreEnrollmentProvider(): EnrollmentProvider {
  throw new Error(
    "EduCore enrollment provider must be implemented in src/andrei/educore",
  );
}
