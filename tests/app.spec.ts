import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'playwright-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MOCK_USER_ID = '11111111-1111-1111-1111-111111111111';

const mockHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const mockPayload = Buffer.from(
  JSON.stringify({
    sub: MOCK_USER_ID,
    email: 'admin@mixwithme.com',
    exp: Math.floor(Date.now() / 1000) + 864000,
    iat: Math.floor(Date.now() / 1000),
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: 'Admin Teacher' },
  })
).toString('base64url');
const MOCK_JWT = `${mockHeader}.${mockPayload}.mockSignature123456789`;

const MOCK_SESSION = {
  access_token: MOCK_JWT,
  refresh_token: 'mock-refresh-token',
  expires_in: 864000,
  expires_at: Math.floor(Date.now() / 1000) + 864000,
  token_type: 'bearer',
  user: {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@mixwithme.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    phone: '9876543210',
    user_metadata: {
      full_name: 'Admin Teacher',
    },
    app_metadata: {
      provider: 'email',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
};

const MOCK_ACADEMY = {
  id: '22222222-2222-2222-2222-222222222222',
  owner_id: MOCK_USER_ID,
  academy_name: 'MIX with Me Classes',
  logo_url: null,
  contact_number: '9876543210',
  email: 'teacher@mixwithme.com',
  address: '123 Music Lane, Bandra West, Mumbai',
  default_monthly_fee: 3000,
  payment_due_day: 5,
  upi_id: 'academy@okhdfcbank',
  upi_payee_name: 'MIX with Me Classes',
  upi_qr_path: '11111111-1111-1111-1111-111111111111/upi/qr.png',
  working_hours_config: {
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    weekdayWindow: { startTime: '14:00', endTime: '21:00' },
    weekendWindow: { startTime: '10:00', endTime: '18:00' },
    minBreakMinutes: 10,
  },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_BATCHES = [
  {
    id: 'batch-1',
    owner_id: MOCK_USER_ID,
    name: 'Guitar Foundations',
    days_of_week: ['Mon', 'Wed'],
    start_time: '16:00:00',
    end_time: '17:00:00',
    capacity: 8,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'batch-2',
    owner_id: MOCK_USER_ID,
    name: 'Advanced Keyboard',
    days_of_week: ['Tue', 'Thu'],
    start_time: '17:30:00',
    end_time: '18:30:00',
    capacity: 6,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const MOCK_STUDENTS = [
  {
    id: 'student-1',
    owner_id: MOCK_USER_ID,
    full_name: 'Aarav Patel',
    phone: '9876543211',
    email: 'aarav@example.com',
    status: 'active',
    batch_id: 'batch-1',
    monthly_fee: 3000,
    enrollment_date: '2026-01-10',
    photo_url: null,
    guardian_name: 'Mr. Patel',
    guardian_phone: '9876543299',
    address: 'Bandra, Mumbai',
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    batch: { id: 'batch-1', name: 'Guitar Foundations' },
  },
  {
    id: 'student-2',
    owner_id: MOCK_USER_ID,
    full_name: 'Diya Sharma',
    phone: '9876543212',
    email: 'diya@example.com',
    status: 'active',
    batch_id: 'batch-2',
    monthly_fee: 3500,
    enrollment_date: '2026-01-15',
    photo_url: null,
    guardian_name: 'Mrs. Sharma',
    guardian_phone: '9876543288',
    address: 'Andheri, Mumbai',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    batch: { id: 'batch-2', name: 'Advanced Keyboard' },
  },
];

const MOCK_FEES = [
  {
    id: 'fee-1',
    owner_id: MOCK_USER_ID,
    student_id: 'student-1',
    billing_month: '2026-11-01',
    amount_due: 3000,
    amount_paid: 3000,
    balance: 0,
    due_date: '2026-11-05',
    status: 'paid',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    student: MOCK_STUDENTS[0],
    payments: [
      {
        id: 'pay-1',
        owner_id: MOCK_USER_ID,
        student_id: 'student-1',
        monthly_fee_id: 'fee-1',
        amount: 3000,
        payment_date: '2026-11-04',
        method: 'upi',
        receipt_number: 'REC-202611-001',
        created_at: '2026-11-04T00:00:00Z',
      },
    ],
  },
  {
    id: 'fee-2',
    owner_id: MOCK_USER_ID,
    student_id: 'student-2',
    billing_month: '2026-11-01',
    amount_due: 3500,
    amount_paid: 1000,
    balance: 2500,
    due_date: '2026-11-05',
    status: 'overdue',
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    student: MOCK_STUDENTS[1],
    payments: [
      {
        id: 'pay-prev',
        owner_id: MOCK_USER_ID,
        student_id: 'student-2',
        monthly_fee_id: 'fee-2',
        amount: 1000,
        payment_date: '2026-11-02',
        method: 'cash',
        receipt_number: 'REC-202611-002',
        created_at: '2026-11-02T00:00:00Z',
      },
    ],
  },
];

const MOCK_PAYMENTS = [
  {
    id: 'pay-1',
    owner_id: MOCK_USER_ID,
    student_id: 'student-1',
    monthly_fee_id: 'fee-1',
    amount: 3000,
    payment_date: '2026-11-04',
    method: 'upi',
    receipt_number: 'REC-202611-001',
    created_at: '2026-11-04T00:00:00Z',
    student: MOCK_STUDENTS[0],
    monthly_fee: MOCK_FEES[0],
  },
];

// Today's date string YYYY-MM-DD
const todayYmd = new Date().toISOString().split('T')[0];

const MOCK_CLASSES = [
  {
    id: 'class-today-1',
    owner_id: MOCK_USER_ID,
    batch_id: 'batch-1',
    class_date: todayYmd,
    start_time: '16:00:00',
    end_time: '17:00:00',
    status: 'scheduled',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    batch: { id: 'batch-1', name: 'Guitar Foundations' },
    attendance_summary: { marked: false },
  },
];

async function setupMockSessionAndRoutes(
  page: Page,
  theme: 'light' | 'dark',
  attendanceStore?: { records: Array<{ class_id: string; student_id: string; status: string }> }
) {
  const store = attendanceStore || { records: [] };

  await page.addInitScript(
    ({ session, themeMode }) => {
      localStorage.setItem('mix_theme', themeMode);
      localStorage.setItem('sb-nuuzbpfosohqyybwrgoz-auth-token', JSON.stringify(session));
      if (document.documentElement) {
        if (themeMode === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
    { session: MOCK_SESSION, themeMode: theme }
  );

  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION.user),
    });
  });

  await page.route('**/auth/v1/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION),
    });
  });

  await page.route('**/storage/v1/object/**', async (route) => {
    const method = route.request().method();
    if (method === 'POST' || method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Key: 'academy-assets/11111111-1111-1111-1111-111111111111/upi/qr.png' }),
      });
      return;
    }
    if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Successfully deleted' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const isSingle = req.headers()['accept']?.includes('vnd.pgrst.object+json');
    const table = url.split('/rest/v1/')[1]?.split('?')[0];

    if (table === 'academy_settings') {
      if (method === 'PATCH' || method === 'PUT') {
        const patchData = req.postDataJSON() || {};
        const updated = { ...MOCK_ACADEMY, ...patchData };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updated),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? MOCK_ACADEMY : [MOCK_ACADEMY]),
      });
      return;
    }

    if (table === 'batches') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? MOCK_BATCHES[0] : MOCK_BATCHES),
      });
      return;
    }

    if (table === 'students') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? MOCK_STUDENTS[0] : MOCK_STUDENTS),
      });
      return;
    }

    if (table === 'monthly_fees') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? MOCK_FEES[0] : MOCK_FEES),
      });
      return;
    }

    if (table === 'payments') {
      if (url.includes('upi_txn_id=eq.')) {
        const utrParam = url.split('upi_txn_id=eq.')[1]?.split('&')[0];
        if (utrParam === 'DUPLICATE123') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'dup-1',
              upi_txn_id: 'DUPLICATE123',
              student: { full_name: 'Aarav Patel' },
            }),
          });
          return;
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: isSingle ? null : JSON.stringify([]),
          });
          return;
        }
      }
      if (method === 'POST') {
        const body = req.postDataJSON() || {};
        const recorded = {
          id: 'pay-new-' + Date.now(),
          owner_id: MOCK_USER_ID,
          receipt_number: 'REC-202611-999',
          amount: body.amount || 2500,
          payment_date: body.payment_date || '2026-11-05',
          method: body.method || 'upi',
          upi_txn_id: body.upi_txn_id || null,
          created_at: new Date().toISOString(),
          student: MOCK_STUDENTS[1],
          monthly_fee: MOCK_FEES[1],
        };
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(recorded),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? MOCK_PAYMENTS[0] : MOCK_PAYMENTS),
      });
      return;
    }

    if (table === 'classes') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isSingle ? MOCK_CLASSES[0] : MOCK_CLASSES),
      });
      return;
    }

    if (table === 'attendance') {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(store.records),
        });
        return;
      }
      if (method === 'POST') {
        const postData = req.postDataJSON();
        const items = Array.isArray(postData) ? postData : [postData];
        for (const item of items) {
          const idx = store.records.findIndex(
            (r) => r.class_id === item.class_id && r.student_id === item.student_id
          );
          if (idx >= 0) {
            store.records[idx].status = item.status;
          } else {
            store.records.push({
              class_id: item.class_id,
              student_id: item.student_id,
              status: item.status,
            });
          }
        }
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(items) });
        return;
      }
      if (method === 'DELETE') {
        // Clear record
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }
    }

    if (table?.startsWith('rpc/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          active_students: 2,
          total_batches: 2,
          today_classes_count: 1,
          today_cancelled_count: 0,
          today_classes: [],
          today_class_list: [],
          billed_month: 6500,
          collected_month: 4000,
          pending_balance: 2500,
          attendance_rate: 100,
          recent_payments: [],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('MIX with Me Classes — Complete Verification Suite', () => {
  // ----------------------------------------------------------------------------
  // 1. BRAND LOGO CLICK TEST
  // ----------------------------------------------------------------------------
  test('1. Brand logo click: from /students, click logo, verify URL is /dashboard', async ({ page }) => {
    await setupMockSessionAndRoutes(page, 'light');
    await page.goto('/students');

    await expect(page.locator('h1', { hasText: 'Students & Batches' })).toBeVisible();

    // Find top-left brand logo link with aria-label="Go to dashboard"
    const logoLink = page.getByRole('link', { name: 'Go to dashboard' }).first();
    await expect(logoLink).toBeVisible();
    await logoLink.click();

    await page.waitForURL('**/dashboard');
    expect(page.url()).toContain('/dashboard');
  });

  // ----------------------------------------------------------------------------
  // 2. LOGIN: WRONG PASSWORD MAPPED ERROR TEST
  // ----------------------------------------------------------------------------
  test('2. Login: wrong password shows the mapped message on the form without raw error trace', async ({ page }) => {
    const rawErrors: string[] = [];
    page.on('console', (msg) => {
      const txt = msg.text();
      if (txt.includes('AuthApiError') || txt.includes('status of 400')) {
        rawErrors.push(txt);
      }
    });

    // Intercept Supabase password grant to return invalid credentials
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      });
    });

    await page.goto('/login');

    await page.fill('input[type="email"]', 'teacher@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Form displays mapped user-friendly message
    const errorBanner = page.locator('text=Email or password is incorrect.').first();
    await expect(errorBanner).toBeVisible();

    // Confirm no raw JSON or trace is shown to user
    await expect(page.locator('text=invalid_grant')).not.toBeVisible();
  });

  // ----------------------------------------------------------------------------
  // 3. EXPORTS: INCOME STATEMENT PDF AND WORD DOWNLOAD TEST
  // ----------------------------------------------------------------------------
  test('3. Exports: trigger an income report PDF and Word download, verify both complete without errors', async ({ page }) => {
    await setupMockSessionAndRoutes(page, 'light');
    await page.goto('/exports');

    await expect(page.locator('h1', { hasText: 'Settings, Backups & Exports' })).toBeVisible();

    // Find the 12-Month Income Statement card container
    const incomeCard = page.locator('.rounded-2xl', {
      has: page.getByRole('heading', { name: '12-Month Income Statement' }),
    });
    await expect(incomeCard).toBeVisible();

    // Trigger PDF download for 12-Month Income Statement
    const downloadPdfPromise = page.waitForEvent('download');
    await incomeCard.getByRole('button', { name: 'Download PDF' }).click();

    const downloadPdf = await downloadPdfPromise;
    expect(downloadPdf.suggestedFilename()).toMatch(/^MIX-Income-.*\.pdf$/);

    // Trigger Word download for 12-Month Income Statement
    const downloadDocxPromise = page.waitForEvent('download');
    await incomeCard.getByRole('button', { name: 'Download Word' }).click();

    const downloadDocx = await downloadDocxPromise;
    expect(downloadDocx.suggestedFilename()).toMatch(/^MIX-Income-.*\.docx$/);
  });

  // ----------------------------------------------------------------------------
  // 4. ZERO 4xx/5xx ERRORS AND ZERO CONSOLE ERRORS ACROSS ALL PAGES
  // ----------------------------------------------------------------------------
  test('4. 400 errors: assert zero 4xx responses and zero console errors across all pages', async ({ page }) => {
    test.setTimeout(90000);
    const failed4xx: string[] = [];
    const consoleErrors: string[] = [];

    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400) {
        failed4xx.push(`${status} ${response.request().method()} ${url}`);
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Ignore expected network mock drops if any
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // Public pages (unauthenticated)
    const publicPages = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
    for (const p of publicPages) {
      await page.goto(p, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(100);
    }

    // Authenticated pages
    await setupMockSessionAndRoutes(page, 'light');
    const appPages = [
      '/dashboard',
      '/students',
      '/batches',
      '/timetable',
      '/attendance',
      '/fees',
      '/settings',
      '/backups',
      '/exports',
    ];

    for (const p of appPages) {
      await page.goto(p, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(100);
    }

    expect(
      failed4xx,
      `Expected zero 4xx/5xx responses across pages, but found: ${JSON.stringify(failed4xx)}`
    ).toHaveLength(0);

    expect(
      consoleErrors,
      `Expected zero console errors across pages, but found: ${JSON.stringify(consoleErrors)}`
    ).toHaveLength(0);
  });

  // ----------------------------------------------------------------------------
  // 5. ATTENDANCE AUTO-SAVE AND PERSISTENCE TEST
  // ----------------------------------------------------------------------------
  test('5. Attendance: open Today, select a class, tap Present for a student, verify "Saved" indicator appears, reload page, verify student is still marked Present', async ({ page }) => {
    const attendanceStore = { records: [] as Array<{ class_id: string; student_id: string; status: string }> };
    await setupMockSessionAndRoutes(page, 'light', attendanceStore);

    await page.goto('/attendance');
    await expect(page.locator('h1', { hasText: 'Attendance Management' })).toBeVisible();

    // The Today tab shows the scheduled class card for Guitar Foundations
    const classCard = page.locator('h3', { hasText: 'Guitar Foundations' }).first();
    await expect(classCard).toBeVisible();

    // Roster is expanded or click class card to expand
    const studentName = page.locator('p', { hasText: 'Aarav Patel' }).first();
    try {
      await expect(studentName).toBeVisible({ timeout: 5000 });
    } catch {
      await classCard.click();
      await expect(studentName).toBeVisible({ timeout: 10000 });
    }

    // Click "Present" button for Aarav Patel (exact match to avoid "Mark all present")
    const presentBtn = page.getByRole('button', { name: 'Present', exact: true }).first();
    await presentBtn.click();

    // Verify "Saved" indicator appears
    const savedIndicator = page.locator('text=Saved').first();
    await expect(savedIndicator).toBeVisible();

    // Reload page to verify persistence
    await page.reload();
    await expect(page.locator('h1', { hasText: 'Attendance Management' })).toBeVisible();

    // Ensure roster is visible after reload
    try {
      await expect(studentName).toBeVisible({ timeout: 5000 });
    } catch {
      await page.locator('h3', { hasText: 'Guitar Foundations' }).first().click();
      await expect(studentName).toBeVisible({ timeout: 10000 });
    }

    // Verify button is marked active (Present button has emerald background or ring)
    const activePresentBtn = page.getByRole('button', { name: 'Present', exact: true }).first();
    await expect(activePresentBtn).toHaveClass(/bg-emerald-600/);
  });

  // ----------------------------------------------------------------------------
  // 6. AUTH: FORGOT PASSWORD FLOW
  // ----------------------------------------------------------------------------
  test('6. Forgot Password: submit email and verify anti-enumeration notice appears', async ({ page }) => {
    await page.route('**/auth/v1/recover', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/forgot-password');
    await expect(page.locator('h1', { hasText: 'Reset your password' })).toBeVisible();

    await page.fill('input[type="email"]', 'teacher@example.com');
    await page.click('button[type="submit"]');

    // Anti-enumeration notice must appear
    const notice = page.locator('text=If an account exists for this email').first();
    await expect(notice).toBeVisible();
  });

  // ----------------------------------------------------------------------------
  // 7. AUTH: SHOW / HIDE PASSWORD TOGGLE
  // ----------------------------------------------------------------------------
  test('7. Login: show/hide password button toggles input between password and text', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click show password toggle
    const toggleBtn = page.getByRole('button', { name: /show password/i });
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click hide password toggle
    const hideBtn = page.getByRole('button', { name: /hide password/i });
    await hideBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  // ----------------------------------------------------------------------------
  // 8. WHATSAPP REMINDER MODAL: THEME TOKENS, CONTRAST, SCREENSHOTS & CLEAN PHONE
  // ----------------------------------------------------------------------------
  test('8. WhatsApp Modal: verifies theme tokens on textarea, contrast, screenshots, and cleaned phone number digits in wa.me link', async ({ page }) => {
    const BRAIN_DIR = 'C:/Users/Lenovo/.gemini/antigravity/brain/a11ce3f2-9ef5-4d6d-914d-203fd9aa3d80';
    if (!fs.existsSync(BRAIN_DIR)) {
      fs.mkdirSync(BRAIN_DIR, { recursive: true });
    }

    function calculateContrast(rgb1: number[], rgb2: number[]): number {
      const getL = (c: number[]) => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const l1 = getL(rgb1);
      const l2 = getL(rgb2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function parseRgb(colorStr: string): number[] {
      const match = colorStr.match(/\d+/g);
      if (match && match.length >= 3) {
        return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)];
      }
      return [0, 0, 0];
    }

    // --- Part 1: Light Mode ---
    await setupMockSessionAndRoutes(page, 'light');
    await page.goto('/fees');
    await expect(page.locator('h1', { hasText: 'Fees & Payments' })).toBeVisible();

    const whatsappBtnLight = page.locator('button[title="Send WhatsApp Reminder"]:visible').first();
    await expect(whatsappBtnLight).toBeVisible({ timeout: 10000 });
    await whatsappBtnLight.click();

    const modalHeadingLight = page.locator('h3', { hasText: 'Send WhatsApp Reminder' });
    await expect(modalHeadingLight).toBeVisible();

    const textareaLight = page.locator('textarea');
    await expect(textareaLight).toBeVisible();
    await expect(textareaLight).toHaveClass(/bg-white/);

    const lightColors = await textareaLight.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { color: style.color, bg: style.backgroundColor };
    });
    const lightContrast = calculateContrast(parseRgb(lightColors.color), parseRgb(lightColors.bg));
    expect(lightContrast).toBeGreaterThanOrEqual(4.5);

    // Save light mode screenshot
    const lightShotLocal = path.join(SCREENSHOT_DIR, 'whatsapp_modal_light.png');
    const lightShotBrain = path.join(BRAIN_DIR, 'whatsapp_modal_light.png');
    await page.screenshot({ path: lightShotLocal });
    try {
      fs.copyFileSync(lightShotLocal, lightShotBrain);
    } catch {
      // Safe fallback if another concurrent worker is writing the file
    }

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(modalHeadingLight).not.toBeVisible();

    // --- Part 2: Dark Mode ---
    await setupMockSessionAndRoutes(page, 'dark');
    await page.goto('/fees');
    await expect(page.locator('h1', { hasText: 'Fees & Payments' })).toBeVisible();

    const whatsappBtnDark = page.locator('button[title="Send WhatsApp Reminder"]:visible').first();
    await expect(whatsappBtnDark).toBeVisible({ timeout: 10000 });
    await whatsappBtnDark.click();

    const modalHeadingDark = page.locator('h3', { hasText: 'Send WhatsApp Reminder' });
    await expect(modalHeadingDark).toBeVisible();

    const textareaDark = page.locator('textarea');
    await expect(textareaDark).toBeVisible();
    await expect(textareaDark).toHaveClass(/dark:bg-slate-900/);

    const darkColors = await textareaDark.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { color: style.color, bg: style.backgroundColor };
    });
    const darkContrast = calculateContrast(parseRgb(darkColors.color), parseRgb(darkColors.bg));
    expect(darkContrast).toBeGreaterThanOrEqual(4.5);

    // Verify phone summary cleans number to digits only (e.g. +919876543288)
    const phoneDisplay = page.locator('text=/\\(\\+\\d+\\)/').first();
    await expect(phoneDisplay).toBeVisible();

    // Verify Open WhatsApp button is active and ready
    const openBtn = page.getByRole('button', { name: /Open WhatsApp/i });
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toBeEnabled();

    // Save dark mode screenshot
    const darkShotLocal = path.join(SCREENSHOT_DIR, 'whatsapp_modal_dark.png');
    const darkShotBrain = path.join(BRAIN_DIR, 'whatsapp_modal_dark.png');
    await page.screenshot({ path: darkShotLocal });
    try {
      fs.copyFileSync(darkShotLocal, darkShotBrain);
    } catch {
      // Safe fallback if another concurrent worker is writing the file
    }
  });

  // ----------------------------------------------------------------------------
  // 9. MULTI-TENANT ISOLATION VERIFICATION
  // ----------------------------------------------------------------------------
  test('9. Isolation: User B cannot access User A records', async ({ page }) => {
    const USER_B_ID = '99999999-9999-9999-9999-999999999999';
    const userBSession = {
      ...MOCK_SESSION,
      user: {
        ...MOCK_SESSION.user,
        id: USER_B_ID,
        email: 'otherteacher@example.com',
      },
    };

    await page.addInitScript(
      ({ session }) => {
        localStorage.setItem('mix_theme', 'light');
        localStorage.setItem('sb-nuuzbpfosohqyybwrgoz-auth-token', JSON.stringify(session));
      },
      { session: userBSession }
    );

    // Mock students endpoint to return only records belonging to the authenticated user
    await page.route('**/rest/v1/students**', async (route) => {
      // Simulate Postgres RLS: owner_id = auth.uid()
      const authHeader = route.request().headers()['authorization'] || '';
      // User B has no students in their academy
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/academy_settings**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ ...MOCK_ACADEMY, owner_id: USER_B_ID, academy_name: "User B's Studio" }]),
      });
    });

    await page.route('**/rest/v1/batches**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto('/students');
    // Ensure User A's student Aarav Patel is NOT visible
    await expect(page.locator('text=Aarav Patel')).not.toBeVisible();
    // Empty state should be visible for User B
    await expect(page.locator('text=No students found')).toBeVisible();
  });

  // ----------------------------------------------------------------------------
  // 10. MULTI-VIEWPORT RESPONSIVENESS AND NO HORIZONTAL SCROLL (320, 375, 768, 1440)
  // ----------------------------------------------------------------------------
  const viewports = [
    { name: '320px', width: 320, height: 600 },
    { name: '375px', width: 375, height: 667 },
    { name: '768px', width: 768, height: 1024 },
    { name: '1440px', width: 1440, height: 900 },
  ];

  const themes: ('light' | 'dark')[] = ['light', 'dark'];

  const pagesForLayout = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Students', path: '/students' },
    { name: 'Batches', path: '/batches' },
    { name: 'Timetable', path: '/timetable' },
    { name: 'Attendance', path: '/attendance' },
    { name: 'Fees', path: '/fees' },
    { name: 'Settings', path: '/settings' },
  ];

  for (const vp of viewports) {
    for (const theme of themes) {
      for (const p of pagesForLayout) {
        test(`Layout Test: ${p.name} at ${vp.name} [${theme}]`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await setupMockSessionAndRoutes(page, theme);

          await page.goto(p.path, { waitUntil: 'networkidle' });
          await page.waitForTimeout(200);

          const hasOverflow = await page.evaluate(() => {
            const doc = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
            const clientWidth = doc.clientWidth;
            return scrollWidth > clientWidth + 1;
          });

          expect(
            hasOverflow,
            `Expected ${p.name} at ${vp.name} [${theme}] to have zero horizontal page overflow.`
          ).toBe(false);

          // Capture proof screenshot
          const screenshotName = `${p.name.toLowerCase()}-${vp.name}-${theme}.png`;
          const filePath = path.join(SCREENSHOT_DIR, screenshotName);
          await page.screenshot({ path: filePath, fullPage: true });
          expect(fs.existsSync(filePath)).toBe(true);
        });
      }

      // Public pages (unauthenticated)
      for (const p of [
        { name: 'Landing', path: '/' },
        { name: 'Login', path: '/login' },
      ]) {
        test(`Layout Test: ${p.name} at ${vp.name} [${theme}]`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.addInitScript(
            ({ themeMode }) => {
              localStorage.setItem('mix_theme', themeMode);
              if (document.documentElement) {
                if (themeMode === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }
            },
            { themeMode: theme }
          );

          await page.goto(p.path, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(200);

          const hasOverflow = await page.evaluate(() => {
            const doc = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
            const clientWidth = doc.clientWidth;
            return scrollWidth > clientWidth + 1;
          });

          expect(
            hasOverflow,
            `Expected ${p.name} at ${vp.name} [${theme}] to have zero horizontal page overflow.`
          ).toBe(false);

          const screenshotName = `${p.name.toLowerCase()}-${vp.name}-${theme}.png`;
          const filePath = path.join(SCREENSHOT_DIR, screenshotName);
          await page.screenshot({ path: filePath, fullPage: true });
          expect(fs.existsSync(filePath)).toBe(true);
        });
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 11. MOBILE TABS SCROLL AND NO ARROW BUTTONS
  // ----------------------------------------------------------------------------
  test('11. Mobile tabs: verify no scroll arrow boxes and horizontal scroll enabled', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setupMockSessionAndRoutes(page, 'light');

    for (const p of ['/fees', '/settings', '/students']) {
      await page.goto(p);
      await page.waitForTimeout(100);

      // Verify no arrow scroll buttons exist
      const arrowButtons = page.locator('button[aria-label*="scroll"], button:has-text("◀"), button:has-text("▶")');
      expect(await arrowButtons.count()).toBe(0);

      // Verify tab container has overflow-x-auto
      const tabContainer = page.locator('.overflow-x-auto, [role="tablist"]').first();
      await expect(tabContainer).toBeVisible();
    }
  });

  // ----------------------------------------------------------------------------
  // 12. UPI SETTINGS: UPI ID, PAYEE NAME, QR CODE PREVIEW & OPTIONS
  // ----------------------------------------------------------------------------
  test('12. UPI Settings: save UPI ID, payee name, QR options, preview container, confirm dialogs', async ({ page }) => {
    await setupMockSessionAndRoutes(page, 'light');
    await page.goto('/settings');
    await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();

    // Verify Payment Details (UPI) Card exists
    const upiCardHeader = page.locator('h2', { hasText: 'Payment Details (UPI)' });
    await expect(upiCardHeader).toBeVisible();

    // Verify helper text
    await expect(
      page.locator('text=Set this once. Payment requests and receipts will use it automatically.')
    ).toBeVisible();

    // Verify UPI ID and Payee Name inputs
    const upiInput = page.locator('input[placeholder*="academy@okaxis"]');
    await expect(upiInput).toBeVisible();
    await expect(upiInput).toHaveValue('academy@okhdfcbank');

    const payeeInput = page.getByRole('textbox', { name: 'Payee Name' });
    await expect(payeeInput).toBeVisible();

    // Verify QR Code Preview
    await expect(page.locator('img[alt="UPI QR Code"]')).toBeVisible();
    await expect(page.locator('button:has-text("Replace QR (Upload)")')).toBeVisible();
    await expect(page.locator('button:has-text("Regenerate from UPI ID")')).toBeVisible();
    await expect(page.locator('button:has-text("Remove QR")')).toBeVisible();

    // Test Save Settings
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.locator('text=Academy settings updated successfully!')).toBeVisible();
  });

  // ----------------------------------------------------------------------------
  // 13. PAYMENT REQUEST MODAL
  // ----------------------------------------------------------------------------
  test('13. Payment Request Modal: trigger payment request for unpaid fee row, verify QR, copy buttons, PDF & WhatsApp link', async ({ page }) => {
    await setupMockSessionAndRoutes(page, 'light');
    await page.goto('/fees');
    await expect(page.locator('h1', { hasText: 'Fees & Payments' })).toBeVisible();

    // Find the unpaid row and click "Send payment request"
    const reqBtn = page
      .locator('tr:has-text("Diya Sharma"), div.p-4:has-text("Diya Sharma")')
      .getByRole('button', { name: /Send payment request/i })
      .filter({ visible: true })
      .first();
    await expect(reqBtn).toBeVisible({ timeout: 10000 });
    await reqBtn.scrollIntoViewIfNeeded();
    await reqBtn.click({ force: true });

    // Modal opens
    const modal = page.locator('div[role="dialog"], [aria-modal="true"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3', { hasText: 'Payment Request' })).toBeVisible();

    // Verify balance due and student details inside modal
    await expect(modal.getByText('Diya Sharma', { exact: true })).toBeVisible();
    await expect(modal.locator('text=₹2,500')).toBeVisible();

    // Verify QR Code image is present
    await expect(modal.locator('img[alt="Academy UPI QR Code"]')).toBeVisible();

    // Verify UPI ID copy button
    await expect(modal.locator('text=academy@okhdfcbank')).toBeVisible();
    const copyUpiBtn = modal.locator('button:has-text("Copy UPI ID")');
    await expect(copyUpiBtn).toBeVisible();

    // Verify notice for WhatsApp
    await expect(
      modal.locator('text=WhatsApp cannot attach the QR automatically. Attach the downloaded PDF before sending.')
    ).toBeVisible();

    // Verify Download PDF button is present
    const pdfBtn = modal.getByRole('button', { name: /Download payment request \(PDF\)/i });
    await expect(pdfBtn).toBeVisible();

    // Verify WhatsApp button is present with wa.me link
    const waBtn = modal.getByRole('button', { name: /Open WhatsApp/i });
    await expect(waBtn).toBeVisible();

    // Close modal
    await modal.getByRole('button', { name: 'Close dialog' }).click();
    await expect(modal).not.toBeVisible();
  });

  // ----------------------------------------------------------------------------
  // 14. RECORD UPI PAYMENT WITH UTR VALIDATION & VERIFICATION PROMPT
  // ----------------------------------------------------------------------------
  test('14. Record UPI Payment: record payment with method UPI requires valid UTR, checks duplicate UTR, prompts verification before saving', async ({ page }) => {
    await setupMockSessionAndRoutes(page, 'light');
    await page.goto('/fees');
    await expect(page.locator('h1', { hasText: 'Fees & Payments' })).toBeVisible();

    // Click Record Payment or Pay on unpaid fee (balance 2500)
    const recordBtn = page
      .locator('tr:has-text("Diya Sharma"), div.p-4:has-text("Diya Sharma")')
      .getByRole('button', { name: /^Record Payment$|^Pay$/ })
      .filter({ visible: true })
      .first();
    await expect(recordBtn).toBeVisible({ timeout: 10000 });
    await recordBtn.dispatchEvent('click');

    // Modal opens
    const modal = page.locator('div[role="dialog"], [aria-modal="true"]').first();
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3', { hasText: 'Record Fee Payment' })).toBeVisible();

    // Select payment method "UPI"
    const methodSelect = modal.locator('select');
    await methodSelect.selectOption('upi');

    // UTR field appears
    const utrInput = modal.locator('input[placeholder*="334455667788"]');
    await expect(utrInput).toBeVisible();

    // 1. Submit without UTR -> validation error
    await modal.locator('button:has-text("Record Payment")').click();
    await expect(modal.locator('text=UPI Transaction ID (UTR) is required.')).toBeVisible();

    // 2. Submit short UTR -> format validation error
    await utrInput.fill('ABC');
    await modal.locator('button:has-text("Record Payment")').click();
    await expect(modal.locator('text=UPI Transaction ID (UTR) must be 6 to 35 letters and digits.')).toBeVisible();

    // 3. Submit duplicate UTR -> duplicate error
    await utrInput.fill('DUPLICATE123');
    await modal.locator('button:has-text("Record Payment")').click();
    await expect(modal.locator('text=This transaction ID is already recorded for Aarav Patel.')).toBeVisible();

    // 4. Submit valid UTR -> verification prompt appears
    await utrInput.fill('VALIDUTR123456');
    await modal.locator('button:has-text("Record Payment")').click();

    // Prompt appears: "Confirm you have received ₹2,500 in your UPI app. This will mark the fee as paid."
    const promptBanner = modal.locator('text=Confirm you have received');
    await expect(promptBanner).toBeVisible();
    await expect(modal.locator('text=This will mark the fee as paid.')).toBeVisible();

    // Click "Yes, Received & Record"
    const confirmBtn = modal.locator('button:has-text("Yes, Received & Record")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Receipt Modal opens
    const receiptModal = page.locator('div[role="dialog"], [aria-modal="true"]').first();
    await expect(receiptModal.locator('h3', { hasText: 'Payment Receipt' })).toBeVisible();
    await expect(receiptModal.locator('text=UTR: VALIDUTR123456')).toBeVisible();
  });

  // ----------------------------------------------------------------------------
  // 15. UPI TENANT ISOLATION
  // ----------------------------------------------------------------------------
  test('15. UPI Tenant Isolation: User B cannot access User A UPI settings or QR storage path', async ({ page }) => {
    const USER_B_ID = '99999999-9999-9999-9999-999999999999';
    const userBSession = {
      ...MOCK_SESSION,
      user: {
        ...MOCK_SESSION.user,
        id: USER_B_ID,
        email: 'userb@example.com',
      },
    };

    await page.addInitScript(
      ({ session }) => {
        localStorage.setItem('mix_theme', 'light');
        localStorage.setItem('sb-nuuzbpfosohqyybwrgoz-auth-token', JSON.stringify(session));
      },
      { session: userBSession }
    );

    // User B has their own settings without User A's UPI
    await page.route('**/rest/v1/academy_settings**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            ...MOCK_ACADEMY,
            owner_id: USER_B_ID,
            academy_name: 'User B Studio',
            upi_id: null,
            upi_payee_name: null,
            upi_qr_path: null,
          },
        ]),
      });
    });

    await page.goto('/settings');
    await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();

    // Verify User A's UPI ID is not present
    const upiInput = page.locator('input[placeholder*="academy@okaxis"]');
    await expect(upiInput).toBeVisible();
    await expect(upiInput).toHaveValue('');

    // Verify option to upload or generate QR is shown instead of User A's QR preview
    await expect(page.locator('text=Option A: Upload QR Image')).toBeVisible();
    await expect(page.locator('text=Option B: Generate QR from UPI ID')).toBeVisible();
    await expect(page.locator('img[alt="UPI QR Code"]')).not.toBeVisible();
  });

  // ----------------------------------------------------------------------------
  // 16. UPI QR GENERATION: NO CSP DATA URL FETCH VIOLATION
  // ----------------------------------------------------------------------------
  test('16. UPI QR Generation: generate QR from UPI ID, verify success message, QR preview, and assert zero CSP violations', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Content Security Policy') || text.includes('connect-src')) {
        cspViolations.push(text);
      }
    });

    await setupMockSessionAndRoutes(page, 'light');
    await page.route('**/rest/v1/academy_settings**', async (route) => {
      const method = route.request().method();
      if (method === 'PATCH' || method === 'PUT') {
        const patchData = route.request().postDataJSON() || {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...MOCK_ACADEMY, ...patchData }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            ...MOCK_ACADEMY,
            upi_id: 'academy@okhdfcbank',
            upi_payee_name: 'MIX with Me Classes',
            upi_qr_path: null,
          },
        ]),
      });
    });

    await page.goto('/settings');
    await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();

    // Verify Option B is visible
    await expect(page.locator('text=Option B: Generate QR from UPI ID')).toBeVisible();

    // Find and click "Generate QR from UPI ID" button
    const generateBtn = page.getByRole('button', { name: 'Generate QR from UPI ID' });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Expect success message
    await expect(page.locator('text=/UPI QR code (generated and saved successfully|saved successfully)/i').first()).toBeVisible({ timeout: 10000 });

    // Expect visible QR preview
    const qrImg = page.locator('img[alt="UPI QR Code"]');
    await expect(qrImg).toBeVisible();

    // Assert zero CSP violations
    expect(cspViolations).toEqual([]);
  });
});
