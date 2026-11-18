# MIX with Me Classes

> A multi-tenant music academy management web application for independent teachers and music schools to run their academy operations smoothly and efficiently.

---

## 🎵 Overview

**MIX with Me Classes** is a full-featured music academy management platform. Anyone can register to launch their own private academy workspace with complete multi-tenant data isolation. Each academy owner has complete control over student enrollments, batches, smart timetable scheduling, attendance recording, tuition fee tracking, payment receipts with PDF export, automated WhatsApp reminders, data backups, and reports.

---

## ✨ Features by Module

### 1. Landing & Public Experience
- **Modern Landing Page**: High-conversion landing page featuring Hero, interactive Feature modules showcase, Smart Timetable spotlight, Security architecture, and FAQ accordion.
- **Brand Navigation**: Accessible logo navigation linking to `/` when unauthenticated and `/dashboard` when authenticated.
- **Theme Support**: Seamless Dark Mode and Light Mode with persistent local storage theme toggle and zero color contrast issues.
- **Mobile Responsive**: Fully responsive layout with minimum 44px touch targets, sticky bottom navigation on mobile, and zero horizontal overflow at 320px viewport width.

### 2. Authentication & Multi-Tenancy
- **Open Registration**: Instant user registration with automated email confirmation.
- **Multi-Tenant Data Isolation**: Every academy database table enforces `owner_id uuid DEFAULT auth.uid() NOT NULL` with strict PostgreSQL Row Level Security (RLS) policies (`owner_id = (select auth.uid()) WITH CHECK`).
- **Cross-Tenant Foreign Key Triggers**: Database triggers prevent referencing batches, students, classes, or fee records belonging to another academy owner.
- **Isolated Storage Sandboxes**: Storage files partitioned by `{auth.uid()}/...` in both `student-photos` and `academy-assets` buckets.
- **Session Security**: 60-minute inactivity auto-logout, automatic token refresh, and brute-force protection.
- **Onboarding Setup Wizard**: 3-step setup wizard on first login (Academy Info, Logo, Working Days & Fees) with an interactive Dashboard checklist for incomplete setups.

### 3. Dashboard
- **Consolidated Analytics**: Real-time summary of active students, batches, today's classes, monthly revenue collected, and pending dues.
- **Today's Schedule**: Quick overview of upcoming and completed classes for the current day with direct attendance status.
- **Needs Attention**: Highlights students with consecutive absences (2+ missed classes).
- **Pending Dues Spotlight**: Top 5 students with overdue or pending fees for rapid follow-up.
- **14-Day Backup Alert**: Visual reminder banner notifying the teacher if no database backup has been downloaded in over 14 days.

### 4. Students
- **Student Directory**: Searchable and filterable student roster with batch, status (Active / Inactive), and fee filters.
- **Student Profile**: Detailed view showing enrollment details, emergency contact, batch history, attendance percentage, and full fee payment history.
- **Photo Upload**: Drag-and-drop student photo upload to Supabase Storage with client-side image compression, MIME validation, and 2 MB file size limit.
- **Batch Transfer**: Safe batch transfers with automated batch capacity checks to prevent overfilling.
- **Custom Tuition Fee**: Per-student monthly fee assignment with an option to retroactively apply changes to the current billing month.

### 5. Batches
- **Capacity Management**: Configurable batch capacity limits with visual occupancy indicators and full-batch warnings.
- **Flexible Scheduling**: Assignment of recurring weekly days of the week, start times, and end times.
- **Batch Roster**: Detailed student list per batch with quick enrollment links.

### 6. Smart Timetable
- **Dual Mode**: "Auto-Generate" and "Manual Editing" modes.
- **In-Browser Drafts**: Timetable drafts generate in `< 10ms` in memory; zero database writes until explicitly confirmed.
- **Optimization Algorithm**: Auto-generator schedules all batches while minimizing active teaching days and idle gap time between sessions.
- **Working Days & Hours**: Configurable teaching days (Mon–Fri default; Sat–Sun toggleable), custom daily teaching windows, and minimum buffer breaks between classes.
- **Conflict & Overlap Guard**: Collision detection engine highlighting overlapping slots and unplaced batches.
- **Safe Persistence**: Confirmation modal showing total classes generated. Classes with existing recorded attendance are preserved safely during updates.

### 7. Attendance
- **Daily Class Attendance**: Simple bulk attendance marking (Present / Absent) for scheduled classes.
- **Attendance History & Calendar**: Filterable attendance logs by batch, student, and date range.
- **Attendance Rate Analytics**: Automated calculation of student attendance percentages with badge indicators (Good, Average, Needs Attention).
- **Consecutive Absence Alerts**: Automatic identification of students missing multiple classes in a row.

### 8. Fees & Payments
- **Monthly Fee Generation**: One-click idempotent monthly fee generation for active students (`generate_monthly_fees` PostgreSQL RPC function).
- **Flexible Payments**: Record full or partial payments across multiple methods: Cash, UPI, Bank Transfer, Card, or Other.
- **Overpayment Guard**: Postgres trigger `validate_payment_amount()` and client validation preventing payments exceeding outstanding balances.
- **Duplicate Payment Warning**: Real-time 60-second warning banner if an identical payment is recorded for the same student.
- **Overdue Tracking**: Dedicated Overdue tab tracking late fees with days-overdue counters and direct follow-up actions.
- **Financial Analytics**: Interactive Recharts graphs showing 6-month expected vs. collected revenue and 12-month financial tables.

### 9. Receipts
- **Sequential Receipt Numbers**: Per-academy, per-year sequential numbering (`MWM-YYYY-000001`) enforced via atomic database sequence counters.
- **PDF Generation**: High-quality downloadable A5 receipts generated with `jsPDF`.
- **Branded Invoicing**: Embedded academy logo, teacher details, student info, payment method, amount paid, and remaining balance.

### 10. WhatsApp Reminders
- **One-Click Links**: Pre-formatted `https://wa.me/` direct messaging links for pending and overdue tuition fees.
- **Customizable Message**: In-app editable reminder template preview with character count and phone number sanitization (standard 10/12-digit Indian format).
- **Guardian Prioritization**: Automatically targets guardian/parent phone numbers before student numbers.

### 11. Academy Settings
- **Profile Configuration**: Academy name, teacher email, 10-digit contact number, and physical address.
- **Logo Management**: Logo upload to `academy-assets` storage bucket with live preview, update, and remove options.
- **Default Fee Rules**: Configurable default tuition fee (₹ INR) and billing due day (1st to 28th) with confirmation safeguards.

### 12. Backups & Restore
- **Full Database Backup**: One-click download of all 7 database tables as a timestamped JSON file (`MIX-with-Me-backup-YYYY-MM-DD.json`).
- **Individual Table Exports**: Standalone JSON export for `students`, `attendance`, and `payments`.
- **Atomic Database Restore**: Validation engine checks metadata, table structure, and primary keys, followed by an atomic transactional PostgreSQL RPC (`restore_database_backup`) with complete rollback on error.
- **Restore Safety Guard**: Pre-restore preview table of records and required `"RESTORE"` confirmation input.

### 13. Data Exports
- **Student Roster (Excel)**: Multi-column `.xlsx` file generated with SheetJS.
- **Payment Ledger (Excel)**: Date-filtered transaction ledger with receipt numbers and payment methods.
- **Batch Attendance (Excel)**: Multi-sheet workbook with a high-level attendance summary worksheet and raw record worksheet.
- **Revenue Statement (Excel & PDF)**: 12-month financial summary available in both spreadsheet format and formatted printable A4 PDF.
- **Outstanding Dues (PDF)**: Printable A4 report of all students with pending fees and contact numbers.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript |
| **Build Tool & Bundler** | Vite 8 |
| **Styling & Icons** | Tailwind CSS 3, Lucide React |
| **Backend & Database** | Supabase (PostgreSQL 15+, Row Level Security, RPC Functions) |
| **Authentication & Storage** | Supabase Auth, Supabase Storage |
| **State & Data Fetching** | TanStack Query (React Query) |
| **Charts & Visualizations** | Recharts |
| **Documents & Spreadsheets**| jsPDF, SheetJS (xlsx) |
| **Testing** | Vitest, Playwright, k6 |

---

## 💻 Local Setup Instructions

### 1. Prerequisites
- **Node.js**: v18.0.0 or later (Node 20+ recommended)
- **npm**: v9.0.0 or later
- A free **Supabase** project ([https://supabase.com](https://supabase.com))

### 2. Clone & Install
```bash
git clone https://github.com/KenithKaras/mix-with-me-classes.git
cd mix-with-me-classes
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Run Unit Tests
```bash
npm test
```

### 6. Production Build
```bash
npm run build
```
The compiled output is created in the `dist/` directory.

---

## 🗄️ Supabase Database & Storage Setup

Follow these steps in your Supabase Project Dashboard:

### 1. Apply Database Migrations (In Exact Order)
Go to **SQL Editor** &rarr; **New Query** and execute the migration files located in `supabase/migrations/` sequentially:

1. `001_phase1.sql`: Core schema, `academy_settings`, `admin_users`, and initial RLS policies.
2. `002_phase2.sql`: `batches`, `students`, student photos storage configuration.
3. `003_phase3.sql`: `classes` timetable table, overlap prevention trigger, and indices.
4. `004_phase3_attendance.sql`: `attendance` table, attendance status constraint, and batch integrity triggers.
5. `005_phase4_fees.sql`: `monthly_fees`, `payments`, receipt sequence table, and overpayment trigger.
6. `006_phase5_settings_backups.sql`: `academy-assets` storage bucket and atomic `restore_database_backup` RPC function.
7. `008_open_signup_multitenant.sql`: Multi-tenant architecture (`owner_id`), open signup triggers, receipt sequence isolation, and cross-tenant foreign key integrity triggers.
8. `009_fix_missing_columns.sql`: Schema integrity updates and column alignments.
9. `010_scale_and_performance.sql`: Production indices, composite query indices, and optimized `get_dashboard_summary` RPC function.

### 2. Configure Storage Buckets
Ensure the following two storage buckets exist under **Storage** &rarr; **Buckets**:
- `student-photos`: Public bucket for student profile pictures (max 2 MB per file).
- `academy-assets`: Public bucket for academy branding and logos (max 2 MB per file).

*(Storage policies for tenant isolation `{auth.uid()}/...` are created automatically by migrations 006 and 008).*

### 3. Configure Supabase Authentication
1. Go to **Authentication** &rarr; **Providers** &rarr; **Email**:
   - Ensure **"Confirm email"** is turned **ON**.
2. Go to **Authentication** &rarr; **URL Configuration**:
   - Set **Site URL** to your production domain (e.g. `https://mix-with-me-classes.vercel.app`).
   - In **Redirect URLs**, add:
     - `http://localhost:5173/**`
     - `https://your-production-domain.vercel.app/**`
3. Go to **Authentication** &rarr; **Rate Limits**:
   - Verify standard email rate limits are enabled to prevent registration spam.

---

## 🚀 Deployment Instructions (Vercel)

The application is pre-configured for one-click deployment on **Vercel** with SPA route rewrites and security headers defined in `vercel.json`.

### 1. Deploy via Vercel Dashboard
1. Import your GitHub repository (`mix-with-me-classes`) into Vercel.
2. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. Add Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://your-project-ref.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase public Anon key
4. Click **Deploy**.

### 2. Security Headers & CSP
The included `vercel.json` provides strict security headers and Content Security Policy:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: Permits script and style execution for the app, Google Fonts, and secure API/WebSocket communication to Supabase (`*.supabase.co`).

---

## 🧪 Testing Suite

### 1. Vitest Unit & Integration Tests
Runs the test suites covering utilities, calculations, multi-tenant isolation, timetable generation, and backup validation:
```bash
npm test
```
To run tests once with code coverage:
```bash
npx vitest run --coverage
```

### 2. Playwright End-to-End (E2E) Tests
Runs end-to-end user workflows (authentication, student creation, attendance marking, fee recording, timetable draft generation, and mobile navigation):
```bash
# Run all Playwright tests in headless mode
npx playwright test

# Run tests in interactive UI mode
npx playwright test --ui
```

### 3. k6 Concurrency & Load Tests
Validates API response times and tenant data isolation under concurrency:
```bash
k6 run loadtests/k6-load-test.js
```

---

## 📄 License

All rights reserved.
