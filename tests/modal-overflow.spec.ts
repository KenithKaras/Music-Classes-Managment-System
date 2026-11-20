import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

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
  footer_credit: 'Made by Kenith Karas',
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
];

const MOCK_STUDENTS = [
  {
    id: 'student-1',
    owner_id: MOCK_USER_ID,
    full_name: 'Diya Sharma',
    phone: '9876543212',
    email: 'diya@example.com',
    status: 'active',
    batch_id: 'batch-1',
    monthly_fee: 3500,
    enrollment_date: '2026-01-15',
    photo_url: '11111111-1111-1111-1111-111111111111/students/student-1.png',
    guardian_name: 'Mrs. Sharma',
    guardian_phone: '9876543288',
    address: 'Andheri, Mumbai',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    batch: { id: 'batch-1', name: 'Guitar Foundations' },
  },
];

async function setupMock(page: Page, theme: 'light' | 'dark') {
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
    const req = route.request();
    const method = req.method();
    const url = req.url();

    if (method === 'POST' && url.includes('/sign/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          signedURL: '/object/sign/mock-signed-avatar.png',
          signedUrl: '/object/sign/mock-signed-avatar.png',
        }),
      });
      return;
    }
    // Return a 600x600 SVG image to prove that large photos are strictly contained
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#4f46e5"/></svg>`;
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: svg,
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

const VIEWPORTS = [320, 360, 375, 430];
const THEMES = ['light', 'dark'] as const;

test.describe('Edit Student Modal Overflow and Avatar Bounds', () => {
  for (const width of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`Viewport ${width}px (${theme}) - No horizontal scroll, avatar <= 96px, buttons visible, nav hidden`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await setupMock(page, theme);
        await page.goto('/students');

        // Locate mobile student card
        const mobileCard = page.locator('.md\\:hidden').filter({ hasText: 'Diya Sharma' }).first();
        await expect(mobileCard).toBeVisible();

        // Click Edit
        const editBtn = mobileCard.getByRole('button', { name: 'Edit' }).first();
        await editBtn.click();

        // Modal title visible
        await expect(page.locator('text=Edit Student Details')).toBeVisible();
        await page.waitForTimeout(300);

        // Verification Measurements
        const m = await page.evaluate(() => {
          const docScrollWidth = document.documentElement.scrollWidth;
          const winInnerWidth = window.innerWidth;
          const winInnerHeight = window.innerHeight;

          // Avatar inside dialog
          const avatar = document.querySelector('[role="dialog"] img')?.parentElement;
          const avatarBox = avatar ? avatar.getBoundingClientRect() : null;

          // Bottom nav visibility
          const nav = document.querySelector('nav[aria-label="Mobile Navigation Bar"]');
          let navVisible = false;
          if (nav) {
            const style = window.getComputedStyle(nav);
            navVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          }

          // Buttons
          const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
          const cancelBtn = buttons.find((b) => b.textContent?.trim().includes('Cancel'));
          const saveBtn = buttons.find((b) => b.textContent?.trim().includes('Save Changes'));

          const cancelRect = cancelBtn ? cancelBtn.getBoundingClientRect() : null;
          const saveRect = saveBtn ? saveBtn.getBoundingClientRect() : null;

          return {
            docScrollWidth,
            winInnerWidth,
            winInnerHeight,
            avatarBox: avatarBox ? { width: avatarBox.width, height: avatarBox.height } : null,
            navVisible,
            cancelRect: cancelRect ? { x: cancelRect.x, y: cancelRect.y, width: cancelRect.width, height: cancelRect.height } : null,
            saveRect: saveRect ? { x: saveRect.x, y: saveRect.y, width: saveRect.width, height: saveRect.height } : null,
          };
        });

        console.log(`[MEASUREMENT ${width}px ${theme}]`, JSON.stringify(m));

        // 1. document.documentElement.scrollWidth equals window.innerWidth
        expect(m.docScrollWidth).toBe(m.winInnerWidth);

        // 2. Avatar width is 96px or less (expected ~56px)
        expect(m.avatarBox).not.toBeNull();
        expect(m.avatarBox!.width).toBeLessThanOrEqual(96);
        expect(m.avatarBox!.width).toBeGreaterThanOrEqual(40);

        // 3. Bottom navigation is hidden
        expect(m.navVisible).toBe(false);

        // 4. Save and Cancel are inside viewport
        expect(m.cancelRect).not.toBeNull();
        expect(m.saveRect).not.toBeNull();
        expect(m.cancelRect!.x).toBeGreaterThanOrEqual(0);
        expect(m.cancelRect!.x + m.cancelRect!.width).toBeLessThanOrEqual(width);
        expect(m.saveRect!.x).toBeGreaterThanOrEqual(0);
        expect(m.saveRect!.x + m.saveRect!.width).toBeLessThanOrEqual(width);

        // Save screenshot at 360x800
        if (width === 360) {
          const screenshotPath = path.join(SCREENSHOT_DIR, `edit-modal-360-${theme}.png`);
          await page.screenshot({ path: screenshotPath });
        }
      });
    }
  }
});
