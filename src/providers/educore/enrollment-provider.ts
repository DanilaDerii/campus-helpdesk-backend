export interface Enrollment {
  studentId: string;
  courseCode: string;
  status: string;
}

/** Fixture and real EduCore implementations will follow this contract. */
export interface EnrollmentProvider {
  getByStudentId(studentId: string): Promise<Enrollment[]>;
}
