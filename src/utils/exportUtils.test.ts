import { describe, it, expect } from 'vitest';
import {
  calculateIncomeSummary,
  calculateStudentSummary,
  calculatePaymentSummary,
  calculateAttendanceSummary,
  calculateOutstandingDuesSummary,
} from './exportUtils';
import type {
  MonthlyIncomeDataPoint,
  Student,
  Payment,
  StudentMonthlyAttendance,
  MonthlyFee,
} from '../types';

describe('exportUtils - Calculation and Aggregation Functions', () => {
  describe('calculateIncomeSummary', () => {
    const sampleIncomeData: MonthlyIncomeDataPoint[] = [
      {
        monthStr: 'Jan 2026',
        billingMonth: '2026-01-01',
        expected: 30000,
        collected: 30000,
      },
      {
        monthStr: 'Feb 2026',
        billingMonth: '2026-02-01',
        expected: 35000,
        collected: 20000,
      },
      {
        monthStr: 'Mar 2026',
        billingMonth: '2026-03-01',
        expected: 40000,
        collected: 0,
      },
    ];

    it('accurately computes row pending and collection rates', () => {
      const { rows } = calculateIncomeSummary(sampleIncomeData);

      // Jan: Expected 30k, Collected 30k -> Pending 0, Rate 100%
      expect(rows[0]['Expected Revenue (₹)']).toBe(30000);
      expect(rows[0]['Collected Revenue (₹)']).toBe(30000);
      expect(rows[0]['Pending Dues (₹)']).toBe(0);
      expect(rows[0]['Collection Rate (%)']).toBe(100);

      // Feb: Expected 35k, Collected 20k -> Pending 15k, Rate 57%
      expect(rows[1]['Expected Revenue (₹)']).toBe(35000);
      expect(rows[1]['Collected Revenue (₹)']).toBe(20000);
      expect(rows[1]['Pending Dues (₹)']).toBe(15000);
      expect(rows[1]['Collection Rate (%)']).toBe(Math.round((20000 / 35000) * 100)); // 57%

      // Mar: Expected 40k, Collected 0 -> Pending 40k, Rate 0%
      expect(rows[2]['Expected Revenue (₹)']).toBe(40000);
      expect(rows[2]['Collected Revenue (₹)']).toBe(0);
      expect(rows[2]['Pending Dues (₹)']).toBe(40000);
      expect(rows[2]['Collection Rate (%)']).toBe(0);
    });

    it('guarantees aggregated totals match screen calculations', () => {
      const { totalExpected, totalCollected, totalPending, overallRate } =
        calculateIncomeSummary(sampleIncomeData);

      const sumExpected = 30000 + 35000 + 40000; // 105,000
      const sumCollected = 30000 + 20000 + 0; // 50,000
      const expectedPending = 105000 - 50000; // 55,000
      const expectedRate = Math.round((50000 / 105000) * 100); // 48%

      expect(totalExpected).toBe(sumExpected);
      expect(totalCollected).toBe(sumCollected);
      expect(totalPending).toBe(expectedPending);
      expect(overallRate).toBe(expectedRate);
    });

    it('handles empty income data gracefully with zeros', () => {
      const { totalExpected, totalCollected, totalPending, overallRate, rows } =
        calculateIncomeSummary([]);

      expect(totalExpected).toBe(0);
      expect(totalCollected).toBe(0);
      expect(totalPending).toBe(0);
      expect(overallRate).toBe(0);
      expect(rows).toEqual([]);
    });
  });

  describe('calculateStudentSummary', () => {
    const sampleStudents: Partial<Student>[] = [
      { id: '1', full_name: 'Alice', status: 'active', monthly_fee: 2500 },
      { id: '2', full_name: 'Bob', status: 'active', monthly_fee: 3000 },
      { id: '3', full_name: 'Charlie', status: 'inactive', monthly_fee: 2000 },
    ];

    it('accurately computes active students, inactive students, and active revenue totals', () => {
      const summary = calculateStudentSummary(sampleStudents as Student[]);

      expect(summary.totalStudents).toBe(3);
      expect(summary.activeStudents).toBe(2);
      expect(summary.inactiveStudents).toBe(1);
      expect(summary.totalMonthlyRevenue).toBe(5500); // 2500 + 3000
    });

    it('handles empty student list', () => {
      const summary = calculateStudentSummary([]);
      expect(summary.totalStudents).toBe(0);
      expect(summary.activeStudents).toBe(0);
      expect(summary.inactiveStudents).toBe(0);
      expect(summary.totalMonthlyRevenue).toBe(0);
    });
  });

  describe('calculatePaymentSummary', () => {
    const samplePayments: Partial<Payment>[] = [
      { id: 'p1', amount: 2500, receipt_number: 'REC-001' },
      { id: 'p2', amount: 3000, receipt_number: 'REC-002' },
      { id: 'p3', amount: 1500, receipt_number: 'REC-003' },
    ];

    it('sums payment amounts and counts correctly', () => {
      const summary = calculatePaymentSummary(samplePayments as Payment[]);

      expect(summary.totalCount).toBe(3);
      expect(summary.totalAmount).toBe(7000);
    });

    it('handles empty payments list', () => {
      const summary = calculatePaymentSummary([]);
      expect(summary.totalCount).toBe(0);
      expect(summary.totalAmount).toBe(0);
    });
  });

  describe('calculateAttendanceSummary', () => {
    const sampleAttendance: StudentMonthlyAttendance[] = [
      {
        student_id: 's1',
        student_name: 'Alice',
        photo_url: null,
        present_count: 8,
        absent_count: 2,
        total_classes: 10,
        percentage: 80,
      },
      {
        student_id: 's2',
        student_name: 'Bob',
        photo_url: null,
        present_count: 10,
        absent_count: 0,
        total_classes: 10,
        percentage: 100,
      },
    ];

    it('calculates totals and overall attendance rate accurately', () => {
      const summary = calculateAttendanceSummary(sampleAttendance);

      expect(summary.totalStudents).toBe(2);
      expect(summary.totalPresent).toBe(18);
      expect(summary.totalAbsent).toBe(2);
      expect(summary.totalClasses).toBe(10);
      expect(summary.averageRate).toBe(90); // 18 / 20 = 90%
    });

    it('handles empty attendance records', () => {
      const summary = calculateAttendanceSummary([]);
      expect(summary.totalStudents).toBe(0);
      expect(summary.totalPresent).toBe(0);
      expect(summary.totalAbsent).toBe(0);
      expect(summary.totalClasses).toBe(0);
      expect(summary.averageRate).toBe(0);
    });
  });

  describe('calculateOutstandingDuesSummary', () => {
    const sampleFees: Partial<MonthlyFee>[] = [
      { id: 'f1', amount_due: 3000, amount_paid: 1000, balance: 2000 },
      { id: 'f2', amount_due: 2500, amount_paid: 0, balance: 2500 },
      { id: 'f3', amount_due: 4000, amount_paid: 3000, balance: 1000 },
    ];

    it('computes total due, total paid, and total outstanding balance correctly', () => {
      const summary = calculateOutstandingDuesSummary(sampleFees as MonthlyFee[]);

      expect(summary.totalRecords).toBe(3);
      expect(summary.totalAmountDue).toBe(9500);
      expect(summary.totalAmountPaid).toBe(4000);
      expect(summary.totalOutstanding).toBe(5500);
    });

    it('handles empty fees list', () => {
      const summary = calculateOutstandingDuesSummary([]);
      expect(summary.totalRecords).toBe(0);
      expect(summary.totalAmountDue).toBe(0);
      expect(summary.totalAmountPaid).toBe(0);
      expect(summary.totalOutstanding).toBe(0);
    });
  });
});
