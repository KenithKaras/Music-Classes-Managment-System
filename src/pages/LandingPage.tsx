import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Music2,
  Calendar,
  Users,
  CreditCard,
  ClipboardCheck,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  PhoneCall,
  Check,
} from 'lucide-react';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  const faqs = [
    {
      q: 'Can anyone sign up and start using the app immediately?',
      a: 'Yes. Anyone can register right away. As soon as you confirm your email, you have instant access to your music academy portal with no waiting period or manual approval step.',
    },
    {
      q: 'How is my academy data protected from other users?',
      a: 'MIX with Me Classes uses strict per-academy data isolation. Every record—from student profiles and attendance to fee ledgers and timetable slots—is tied directly to your authenticated account. No other teacher or user can ever see or query your data.',
    },
    {
      q: 'How does the Draft-First Timetable work?',
      a: 'You can auto-generate or manually edit a draft timetable entirely in your browser. Nothing touches the database until you click "Confirm and save". You can inspect clashes, test different breaks, and discard drafts risk-free.',
    },
    {
      q: 'Does it support Indian Rupee (₹) fee tracking and WhatsApp reminders?',
      a: 'Yes. All tuition amounts use Indian Rupee currency formatting (e.g. ₹1,50,000). You can send 1-click WhatsApp payment reminders with priority given to parent/guardian contact numbers.',
    },
    {
      q: 'Can I export my data or take database backups?',
      a: 'Yes. You can download complete database backups as JSON at any time, export student rosters and payment ledgers to formatted Word (.docx) documents, and generate formatted printable PDF receipts.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-[#f1f5f9] font-sans transition-colors selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#26324a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to={user ? '/dashboard' : '/'}
            aria-label={user ? 'Go to dashboard' : 'Go to home'}
            className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-sm">
              <Music2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 dark:text-[#f1f5f9] text-base sm:text-lg tracking-tight">
              MIX with Me
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-[#a9b4c7]">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-[#f1f5f9] transition-colors">
              Modules
            </a>
            <a href="#timetable" className="hover:text-indigo-600 dark:hover:text-[#f1f5f9] transition-colors">
              Timetable
            </a>
            <a href="#security" className="hover:text-indigo-600 dark:hover:text-[#f1f5f9] transition-colors">
              Data Privacy
            </a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-[#f1f5f9] transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {user ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                icon={ArrowRight}
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-[#a9b4c7] hover:text-indigo-600 dark:hover:text-[#f1f5f9] transition-colors min-h-[40px] inline-flex items-center"
                >
                  Log in
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm" icon={ArrowRight}>
                    Start free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-medium mb-6"
          >
            <span>Open Access &bull; 100% Private Music Academy Management</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-[#f1f5f9] tracking-tight max-w-4xl mx-auto leading-tight"
          >
            Music Academy Management, Made Calm and Dependable.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-5 text-base sm:text-lg text-slate-600 dark:text-[#a9b4c7] max-w-2xl mx-auto leading-relaxed"
          >
            Manage students, conflict-free weekly timetables, attendance, and Indian Rupee (₹) tuition fees with instant WhatsApp reminders. Simple, focused, and entirely private to your academy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto"
          >
            <Link to="/register" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto px-7 py-3"
                icon={ArrowRight}
              >
                Start free now
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto px-7 py-3"
              >
                Log in
              </Button>
            </Link>
          </motion.div>

          {/* Value Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm font-medium text-slate-600 dark:text-[#a9b4c7]">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Instant activation
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Complete data privacy
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Mobile &amp; desktop ready
            </span>
          </div>

          {/* Hero UI Mockup Card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-12 max-w-4xl mx-auto rounded-2xl border border-slate-200 dark:border-[#26324a] bg-white dark:bg-[#131c2e] p-4 sm:p-6 text-left shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 dark:border-[#26324a] gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-[#f1f5f9]">
                  MIX with Me Classes &bull; Weekly Schedule Preview
                </span>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 self-start sm:self-auto">
                0 Clashes &bull; Optimized Breaks
              </span>
            </div>

            {/* Standardized Neutral Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a]">
                <p className="text-xs font-semibold text-slate-600 dark:text-[#a9b4c7]">Teaching Schedule</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-[#f1f5f9] mt-1">18.5 hrs/wk</p>
                <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-1">4 teaching days</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a]">
                <p className="text-xs font-semibold text-slate-600 dark:text-[#a9b4c7]">Monthly Fees</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-[#f1f5f9] mt-1">₹48,000</p>
                <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-1">92% collected this month</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a]">
                <p className="text-xs font-semibold text-slate-600 dark:text-[#a9b4c7]">Enrolled Students</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-[#f1f5f9] mt-1">32 Students</p>
                <p className="text-xs text-slate-500 dark:text-[#a9b4c7] mt-1">Across 6 music batches</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modules & Capabilities Section */}
      <section id="features" className="py-16 sm:py-20 bg-white dark:bg-[#131c2e] border-y border-slate-200 dark:border-[#26324a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Core Modules
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#f1f5f9] mt-2 tracking-tight">
              Everything Needed to Run a Music Studio
            </p>
            <p className="text-slate-600 dark:text-[#a9b4c7] text-sm sm:text-base mt-2">
              Designed specifically for solo music teachers and independent academies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Timetable Draft */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#26324a] bg-slate-50 dark:bg-[#1a2540] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Draft-First Timetable</h3>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Auto-generate clash-free weekly schedules or adjust slots manually. Changes stay in a draft until you confirm and save.
              </p>
            </div>

            {/* 2. Students & Batches */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#26324a] bg-slate-50 dark:bg-[#1a2540] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Students &amp; Batches</h3>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Track batch capacities, student photos, guardian contact details, and monthly fees. Transfer students with capacity checks.
              </p>
            </div>

            {/* 3. Fast Attendance */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#26324a] bg-slate-50 dark:bg-[#1a2540] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Attendance Tracking</h3>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Mark class presence in seconds on your mobile phone or laptop. Automatically highlights students absent 3+ times consecutively.
              </p>
            </div>

            {/* 4. Fees & Receipts */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#26324a] bg-slate-50 dark:bg-[#1a2540] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Fees &amp; Receipts</h3>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Indian Rupee (₹) fee tracking, partial payment recording, overpayment safety, and sequential printable PDF receipts.
              </p>
            </div>

            {/* 5. WhatsApp Reminders */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#26324a] bg-slate-50 dark:bg-[#1a2540] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
                <PhoneCall className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">WhatsApp Reminders</h3>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Send polite, pre-formatted payment reminder messages via WhatsApp to parents and students with a single click.
              </p>
            </div>

            {/* 6. Backups & Document Reports */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#26324a] bg-slate-50 dark:bg-[#1a2540] hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f5f9]">Backups &amp; Exports</h3>
              <p className="text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Export clean Word (.docx) documents and PDF summaries for attendance and fee ledgers. Download atomic JSON backups anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Timetable Spotlight */}
      <section id="timetable" className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-3">
                <Clock className="w-3.5 h-3.5" />
                <span>Smart Scheduling</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#f1f5f9] tracking-tight">
                Fewer Teaching Days. Clearer Focus.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-[#a9b4c7] leading-relaxed">
                The smart timetable auto-generator builds your weekly batch schedule while respecting teacher availability, minimum rest breaks between classes, and preferred teaching days.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700 dark:text-[#a9b4c7]">
                    <strong className="text-slate-900 dark:text-[#f1f5f9]">Draft-first safety:</strong> Nothing is committed until you inspect and confirm the schedule.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700 dark:text-[#a9b4c7]">
                    <strong className="text-slate-900 dark:text-[#f1f5f9]">Rest breaks respected:</strong> Configurable buffers between sessions so you never rush between batches.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700 dark:text-[#a9b4c7]">
                    <strong className="text-slate-900 dark:text-[#f1f5f9]">Weekend controls:</strong> Choose whether weekend batches are scheduled or reserved for personal practice.
                  </p>
                </div>
              </div>
            </div>

            {/* Clean Schedule Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-[#26324a] shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#26324a] text-sm">
                <span className="font-semibold text-slate-900 dark:text-[#f1f5f9]">Sample Schedule Summary</span>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                  Valid &amp; Clash-Free
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#26324a]">
                  <span className="text-slate-600 dark:text-[#a9b4c7]">Teaching Window</span>
                  <span className="font-medium text-slate-900 dark:text-[#f1f5f9]">Mon &ndash; Thu (14:00 &ndash; 18:30)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#26324a]">
                  <span className="text-slate-600 dark:text-[#a9b4c7]">Minimum Buffer Between Classes</span>
                  <span className="font-medium text-slate-900 dark:text-[#f1f5f9]">10 minutes</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-[#26324a]">
                  <span className="text-slate-600 dark:text-[#a9b4c7]">Weekly Teaching Time</span>
                  <span className="font-medium text-slate-900 dark:text-[#f1f5f9]">18.5 hours total</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-600 dark:text-[#a9b4c7]">Schedule Status</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">0 Overlaps</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Data Privacy Section */}
      <section id="security" className="py-16 sm:py-20 bg-slate-100/70 dark:bg-[#131c2e] border-y border-slate-200 dark:border-[#26324a] text-slate-900 dark:text-[#f1f5f9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Private and Isolated Data
          </h2>
          <p className="text-slate-600 dark:text-[#a9b4c7] text-sm sm:text-base max-w-2xl mx-auto mt-2">
            Each teacher receives an isolated academy workspace. Your students, fees, and records can never be viewed or accessed by any other user.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mt-8 text-left">
            <div className="p-5 rounded-xl bg-white dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a]">
              <p className="font-bold text-sm text-slate-900 dark:text-[#f1f5f9]">Row-Level Isolation</p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Database queries are always bound to your authenticated account ID, preventing cross-tenant access.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a]">
              <p className="font-bold text-sm text-slate-900 dark:text-[#f1f5f9]">Data Integrity Verification</p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Payments, classes, and student enrollments are strictly linked to verify no mismatched foreign keys.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-[#1a2540] border border-slate-200 dark:border-[#26324a]">
              <p className="font-bold text-sm text-slate-900 dark:text-[#f1f5f9]">Protected File Storage</p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#a9b4c7] mt-1.5 leading-relaxed">
                Student photos and academy assets are stored in user-scoped folders accessible only to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-20 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#f1f5f9] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 dark:text-[#a9b4c7] text-sm mt-2">
            Answers to common questions about setting up and managing your academy.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 dark:border-[#26324a] bg-white dark:bg-[#131c2e] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 dark:text-[#f1f5f9] text-sm sm:text-base min-h-[44px]"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 text-sm text-slate-600 dark:text-[#a9b4c7] leading-relaxed border-t border-slate-100 dark:border-[#26324a] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-slate-100 dark:bg-[#131c2e] border-t border-slate-200 dark:border-[#26324a] text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[#f1f5f9] tracking-tight">
            Ready to Organize Your Music Classes?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-[#a9b4c7]">
            Set up in minutes. Your data stays private to your academy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/register">
              <Button variant="primary" size="lg" icon={ArrowRight}>
                Start free now
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Log in to academy
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-[#26324a] text-center text-xs sm:text-sm text-slate-500 dark:text-[#a9b4c7]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            to={user ? '/dashboard' : '/'}
            aria-label={user ? 'Go to dashboard' : 'Go to home'}
            className="flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white">
              <Music2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-900 dark:text-[#f1f5f9]">MIX with Me Classes</span>
          </Link>
          <p>&copy; {new Date().getFullYear()} MIX with Me Classes. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#features" className="hover:underline">Modules</a>
            <a href="#timetable" className="hover:underline">Timetable</a>
            <a href="#security" className="hover:underline">Privacy</a>
            <a href="#faq" className="hover:underline">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
