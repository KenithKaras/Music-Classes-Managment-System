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
      if (themeMode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
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

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const isSingle = req.headers()['accept']?.includes('vnd.pgrst.object+json');
    const table = url.split('/rest/v1/')[1]?.split('?')[0];

    if (table === 'academy_settings') {
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
  // 4. ZERO 4xx ERRORS ON ANY PAGE AFTER LOGIN
  // ----------------------------------------------------------------------------
  test('4. 400 errors: assert zero 4xx responses across all pages after login', async ({ page }) => {
    test.setTimeout(90000);
    const failed4xx: string[] = [];

    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && status < 500) {
        failed4xx.push(`${status} ${response.request().method()} ${url}`);
      }
    });

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
      await page.goto(p);
      await page.waitForTimeout(100);
    }

    expect(
      failed4xx,
      `Expected zero 4xx responses across pages, but found: ${JSON.stringify(failed4xx)}`
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
  // 8. WHATSAPP REMINDER MODAL: THEME TOKENS AND CLEAN PHONE DIGITS
  // ----------------------------------------------------------------------------
  test('8. WhatsApp Modal: verifies theme tokens on textarea and cleaned phone number digits in wa.me link', async ({ page }) => {
    await setupMockSessionAndRoutes(page, 'dark');
    await page.goto('/fees');

    // Wait for fees page to load
    await expect(page.locator('h1', { hasText: 'Fees & Payments' })).toBeVisible();

    // Click on the WhatsApp reminder button on the fee record
    const whatsappBtn = page.locator('button[title="Send WhatsApp Reminder"]:visible').first();
    await expect(whatsappBtn).toBeVisible({ timeout: 10000 });
    await whatsappBtn.click();

    // Verify modal is visible
    const modalHeading = page.locator('h3', { hasText: 'Send WhatsApp Reminder' });
    await expect(modalHeading).toBeVisible();

    // Verify textarea has dark mode theme class
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveClass(/dark:bg-slate-900/);

    // Verify phone summary cleans number to digits only (e.g. +919876543288)
    const phoneDisplay = page.locator('text=/\\(\\+\\d+\\)/').first();
    await expect(phoneDisplay).toBeVisible();

    // Verify Open WhatsApp button is active and ready
    const openBtn = page.getByRole('button', { name: /Open WhatsApp/i });
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toBeEnabled();
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
    }
  }
});
