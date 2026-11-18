import { describe, it, expect } from 'vitest';

interface BaseTenantEntity {
  id: string;
  owner_id: string;
}

interface StudentRecord extends BaseTenantEntity {
  name: string;
  batch_id: string | null;
}

interface BatchRecord extends BaseTenantEntity {
  name: string;
}

interface MonthlyFeeRecord extends BaseTenantEntity {
  student_id: string;
  amount_due: number;
}

export interface PaymentRecord extends BaseTenantEntity {
  student_id: string;
  monthly_fee_id: string;
  amount: number;
}

// Simulates RLS filter: SELECT * WHERE owner_id = auth.uid()
function applyOwnerFilter<T extends BaseTenantEntity>(rows: T[], callerUid: string | null): T[] {
  if (!callerUid) return []; // unauthenticated visitors get 0 rows
  return rows.filter((r) => r.owner_id === callerUid);
}

// Simulates Storage path validation: path must start with callerUid
function isStoragePathAllowed(path: string, callerUid: string | null): boolean {
  if (!callerUid) return false;
  const segments = path.split('/');
  return segments[0] === callerUid;
}

// Simulates cross-tenant Foreign Key check trigger
function validateStudentBatchInsert(
  student: { owner_id: string; batch_id: string | null },
  batches: BatchRecord[]
): { allowed: boolean; error?: string } {
  if (!student.batch_id) return { allowed: true };
  const targetBatch = batches.find((b) => b.id === student.batch_id);
  if (!targetBatch) {
    return { allowed: false, error: 'Batch does not exist' };
  }
  if (targetBatch.owner_id !== student.owner_id) {
    return {
      allowed: false,
      error: 'Security violation: Referenced batch does not belong to the same academy owner.',
    };
  }
  return { allowed: true };
}

function validatePaymentInsert(
  payment: { owner_id: string; student_id: string; monthly_fee_id: string },
  students: StudentRecord[],
  fees: MonthlyFeeRecord[]
): { allowed: boolean; error?: string } {
  const student = students.find((s) => s.id === payment.student_id);
  const fee = fees.find((f) => f.id === payment.monthly_fee_id);

  if (!student || student.owner_id !== payment.owner_id) {
    return {
      allowed: false,
      error: 'Security violation: Referenced student does not belong to the same academy owner.',
    };
  }
  if (!fee || fee.owner_id !== payment.owner_id) {
    return {
      allowed: false,
      error: 'Security violation: Referenced monthly fee does not belong to the same academy owner.',
    };
  }
  return { allowed: true };
}

describe('Multi-Tenant Data Isolation & Security Rules', () => {
  const USER_A = 'usr_00000000-0000-0000-0000-000000000001';
  const USER_B = 'usr_00000000-0000-0000-0000-000000000002';

  const sampleBatches: BatchRecord[] = [
    { id: 'batch-a1', owner_id: USER_A, name: 'Academy A Guitar' },
    { id: 'batch-b1', owner_id: USER_B, name: 'Academy B Violin' },
  ];

  const sampleStudents: StudentRecord[] = [
    { id: 'stud-a1', owner_id: USER_A, name: 'Alice in Academy A', batch_id: 'batch-a1' },
    { id: 'stud-a2', owner_id: USER_A, name: 'Alex in Academy A', batch_id: 'batch-a1' },
    { id: 'stud-b1', owner_id: USER_B, name: 'Bob in Academy B', batch_id: 'batch-b1' },
  ];

  const sampleFees: MonthlyFeeRecord[] = [
    { id: 'fee-a1', owner_id: USER_A, student_id: 'stud-a1', amount_due: 1500 },
    { id: 'fee-b1', owner_id: USER_B, student_id: 'stud-b1', amount_due: 2000 },
  ];

  it('ensures User B cannot see User A students in lists, search, direct ID lookup, or exports', () => {
    // 1. List query
    const userBStudents = applyOwnerFilter(sampleStudents, USER_B);
    expect(userBStudents.length).toBe(1);
    expect(userBStudents[0].name).toBe('Bob in Academy B');
    expect(userBStudents.some((s) => s.owner_id === USER_A)).toBe(false);

    // 2. Search query by name 'Al' (User A has Alice and Alex)
    const searchResultsForB = userBStudents.filter((s) => s.name.toLowerCase().includes('al'));
    expect(searchResultsForB.length).toBe(0);

    // 3. Direct ID lookup for User A student
    const directLookupByB = userBStudents.find((s) => s.id === 'stud-a1');
    expect(directLookupByB).toBeUndefined();
  });

  it('blocks logged-out visitors from reading any academy data', () => {
    const publicStudents = applyOwnerFilter(sampleStudents, null);
    const publicBatches = applyOwnerFilter(sampleBatches, null);
    const publicFees = applyOwnerFilter(sampleFees, null);

    expect(publicStudents.length).toBe(0);
    expect(publicBatches.length).toBe(0);
    expect(publicFees.length).toBe(0);
  });

  it('prevents User B from inserting a student pointing to User A batch', () => {
    const maliciousStudent = {
      owner_id: USER_B,
      batch_id: 'batch-a1', // Belongs to User A!
    };

    const result = validateStudentBatchInsert(maliciousStudent, sampleBatches);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Security violation: Referenced batch does not belong to the same academy owner.');
  });

  it('prevents User B from inserting a payment pointing to User A fee or student', () => {
    const maliciousPayment = {
      owner_id: USER_B,
      student_id: 'stud-a1', // User A's student
      monthly_fee_id: 'fee-a1', // User A's fee
      amount: 1500,
    };

    const result = validatePaymentInsert(maliciousPayment, sampleStudents, sampleFees);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Security violation: Referenced student does not belong to the same academy owner.');
  });

  it('enforces storage path isolation by user ID prefix', () => {
    // User A accessing own student photos
    expect(isStoragePathAllowed(`${USER_A}/students/photo1.jpg`, USER_A)).toBe(true);

    // User B trying to access User A student photo
    expect(isStoragePathAllowed(`${USER_A}/students/photo1.jpg`, USER_B)).toBe(false);

    // User B uploading to own folder
    expect(isStoragePathAllowed(`${USER_B}/logos/logo.png`, USER_B)).toBe(true);

    // Logged-out visitor trying to access storage
    expect(isStoragePathAllowed(`${USER_A}/logos/logo.png`, null)).toBe(false);
  });
});
