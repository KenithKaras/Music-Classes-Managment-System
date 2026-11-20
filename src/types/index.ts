export interface TimeWindow {
  startTime: string; // "14:00"
  endTime: string;   // "21:00"
}

export interface WorkingHoursConfig {
  workingDays: DayOfWeek[];
  weekdayWindow: TimeWindow;
  weekendWindow: TimeWindow;
  minBreakMinutes: number;
  maxClassesPerDay?: number | null;
}

export interface AcademySettings {
  id: string;
  owner_id?: string;
  academy_name: string;
  logo_url: string | null;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  default_monthly_fee: number;
  payment_due_day: number;
  working_hours_config?: WorkingHoursConfig;
  is_onboarding_completed?: boolean;
  upi_id?: string | null;
  upi_payee_name?: string | null;
  upi_qr_path?: string | null;
  created_at?: string;
  updated_at: string;
}

export interface DraftClassSession {
  tempId: string;
  batch_id: string;
  batch_name: string;
  day_of_week: DayOfWeek;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  duration_minutes: number;
  is_weekend?: boolean;
}

export interface TimetableDraftResult {
  classes: DraftClassSession[];
  unplacedBatches: Array<{
    batch_id: string;
    batch_name: string;
    reason: string;
  }>;
  stats: {
    totalTeachingHours: number;
    teachingDaysCount: number;
    longestIdleGapMinutes: number;
    usedWeekend: boolean;
  };
  isValid: boolean;
  validationError?: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Batch {
  id: string;
  name: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
  capacity: number | null;
  created_at: string;
  updated_at: string;
  student_count?: number;
}

export interface BatchFormData {
  name: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
  capacity: number | null;
}

export interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  enrollment_date: string;
  batch_id: string | null;
  status: 'active' | 'inactive';
  monthly_fee: number;
  created_at: string;
  updated_at: string;
  batch?: {
    id: string;
    name: string;
    days_of_week: string[];
    start_time: string;
    end_time: string;
  } | null;
}

export interface StudentFormData {
  full_name: string;
  phone: string;
  email: string;
  photo_url: string | null;
  guardian_name: string;
  guardian_phone: string;
  address: string;
  enrollment_date: string;
  batch_id: string | null;
  status: 'active' | 'inactive';
  monthly_fee: number;
}

export type ClassStatus = 'scheduled' | 'cancelled';

export interface ClassSession {
  id: string;
  batch_id: string;
  class_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS or HH:MM
  end_time: string; // HH:MM:SS or HH:MM
  status: ClassStatus;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  batch?: {
    id: string;
    name: string;
    days_of_week: string[];
    start_time: string;
    end_time: string;
  } | null;
  attendance_summary?: {
    present: number;
    absent: number;
    total: number;
    marked: boolean;
  };
}

export interface RescheduleClassFormData {
  class_date: string;
  start_time: string;
  end_time: string;
  batch_id?: string;
}

export type AttendanceStatus = 'present' | 'absent';

export interface AttendanceRecord {
  id: string;
  class_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string;
  updated_at: string;
  student?: {
    id: string;
    full_name: string;
    photo_url: string | null;
    phone: string | null;
  } | null;
}

export interface StudentMonthlyAttendance {
  student_id: string;
  student_name: string;
  photo_url: string | null;
  present_count: number;
  absent_count: number;
  total_classes: number;
  percentage: number;
}

export interface ConsecutiveAbsenceStudent {
  student_id: string;
  student_name: string;
  photo_url: string | null;
  phone: string | null;
  batch_id: string;
  batch_name: string;
  consecutive_absences: number;
  last_absence_date: string;
}

// ==============================================================================
// Fees, Payments, and Receipts Types
// ==============================================================================

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other';

export type FeeStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export interface MonthlyFee {
  id: string;
  student_id: string;
  billing_month: string; // YYYY-MM-01
  amount_due: number; // Integer (Rupees)
  due_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
  amount_paid?: number;
  balance?: number;
  status?: FeeStatus;
  days_overdue?: number;
  student?: Student | null;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  student_id: string;
  monthly_fee_id: string;
  amount: number; // Integer (Rupees)
  payment_date: string; // YYYY-MM-DD
  method: PaymentMethod;
  receipt_number: string;
  upi_txn_id?: string | null;
  notes: string | null;
  created_at: string;
  student?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
  } | null;
  monthly_fee?: {
    id: string;
    billing_month: string;
    amount_due: number;
    due_date: string;
  } | null;
}

export interface RecordPaymentFormData {
  student_id: string;
  monthly_fee_id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  upi_txn_id?: string;
  notes?: string;
}

export interface MonthlyFinancialSummary {
  billing_month: string;
  total_expected: number;
  total_collected: number;
  total_pending: number;
  paid_students_count: number;
  pending_students_count: number;
}

export interface MonthlyIncomeDataPoint {
  monthStr: string; // e.g. "Nov 2026"
  billingMonth: string; // "2026-11-01"
  collected: number;
  expected: number;
}

export interface StudentFeeSummary {
  totalPaid: number;
  totalDue: number;
  totalBalance: number;
  fees: MonthlyFee[];
  payments: Payment[];
}

export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  feesCollectedThisMonth: number;
  feesPendingThisMonth: number;
  totalExpectedThisMonth: number;
}

export interface NavItem {
  title: string;
  path: string;
  icon: string;
  badge?: string;
}

// ==============================================================================
// Settings, Data Backups & Exports Types
// ==============================================================================

export interface AcademySettingsFormData {
  academy_name: string;
  logo_url: string | null;
  contact_number: string;
  email: string;
  address: string;
  default_monthly_fee: number;
  payment_due_day: number;
}

export interface BackupMetadata {
  version: string;
  appName: string;
  exportDate: string;
  tables: Record<string, number>;
}

export interface BackupTablesData {
  academy_settings: Record<string, any>[];
  batches: Record<string, any>[];
  students: Record<string, any>[];
  classes: Record<string, any>[];
  monthly_fees: Record<string, any>[];
  attendance: Record<string, any>[];
  payments: Record<string, any>[];
}

export interface BackupPayload {
  metadata: BackupMetadata;
  tables: BackupTablesData;
}

export interface BackupPreview {
  version: string;
  appName: string;
  exportDate: string;
  tableCounts: Record<string, number>;
  totalRecords: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface StudentExportRow {
  'Student Name': string;
  'Phone Number': string;
  'Email Address': string;
  'Guardian Name': string;
  'Guardian Phone': string;
  'Batch Name': string;
  'Status': string;
  'Monthly Fee (₹)': number;
  'Enrollment Date': string;
  'Address': string;
}

export interface PaymentExportRow {
  'Receipt Number': string;
  'Student Name': string;
  'Payment Date': string;
  'Amount (₹)': number;
  'Payment Method': string;
  'Billing Month': string;
  'Notes': string;
}

export interface AttendanceExportSummaryRow {
  'Student Name': string;
  'Present Classes': number;
  'Absent Classes': number;
  'Total Classes': number;
  'Attendance Rate (%)': number;
}

export interface MonthlyIncomeExportRow {
  'Billing Month': string;
  'Month': string;
  'Expected Revenue (₹)': number;
  'Collected Revenue (₹)': number;
  'Pending Dues (₹)': number;
  'Collection Rate (%)': number;
}

// ==============================================================================
// Payment Screenshots & Enrollment Types
// ==============================================================================

export interface PaymentScreenshot {
  id: string;
  owner_id: string;
  payment_link_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: 'pending' | 'reviewed' | 'deleted';
  reviewed_at: string | null;
  created_at: string;
  payment_link?: {
    id: string;
    monthly_fee_id: string;
    monthly_fee?: {
      id: string;
      student_id: string;
      billing_month: string;
      amount_due: number;
      student?: {
        id: string;
        full_name: string;
        phone: string | null;
      };
    };
  };
}

export interface EnrollmentLink {
  id: string;
  owner_id: string;
  token_hash: string;
  status: 'active' | 'revoked';
  expires_at: string;
  max_submissions: number;
  submissions_count: number;
  created_at: string;
}

export interface EnrollmentSubmission {
  id: string;
  owner_id: string;
  enrollment_link_id: string;
  child_name: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string | null;
  address: string | null;
  preferred_batch: string | null;
  photo_path: string | null;
  consent_at: string;
  status: 'pending' | 'approved' | 'rejected';
  student_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

