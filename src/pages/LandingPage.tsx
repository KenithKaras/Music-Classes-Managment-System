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
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Clock,
  PhoneCall,
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
      a: 'Yes! Anyone can register right away. As soon as you confirm your email, you have full instant access to your music academy portal with no waiting or approval step.',
    },
    {
      q: 'How is my academy data protected from other users?',
      a: 'MIX with Me Classes is built on strict multi-tenant Row Level Security (RLS) in PostgreSQL. Every single table and storage file enforces owner_id = auth.uid(). No other teacher or user can ever query, search, view, or modify your students, fees, or classes.',
    },
    {
      q: 'How does the Draft-First Timetable work?',
      a: 'You can auto-generate or manually edit a draft timetable entirely in your browser. Nothing touches the database until you click "Confirm and save". You can inspect clashes, test different breaks, and discard drafts risk-free.',
    },
    {
      q: 'Does it support Indian Rupee (₹) fee tracking and WhatsApp reminders?',
      a: 'Yes! All tuition amounts use Indian Rupee currency formatting (e.g. ₹1,50,000). You can send 1-click WhatsApp reminders using clean 12-digit Indian phone numbers with priority given to parent/guardian contact numbers.',
    },
    {
      q: 'Can I export my data or take database backups?',
      a: 'Yes. You can download complete database backups as JSON at any time, export student rosters and payment ledgers to formatted Word (.docx) documents, and generate formatted printable PDF income statements and receipts.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1220] text-slate-900 dark:text-[#f1f5f9] font-sans transition-colors selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b1220]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-[#1f2a3d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to={user ? '/dashboard' : '/'}
            aria-label={user ? 'Go to dashboard' : 'Go to home'}
            className="flex items-center gap-2.5"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Music2 className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight">
              MIX with Me
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Modules
            </a>
            <a href="#timetable" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Smart Timetable
            </a>
            <a href="#how-it-works" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              How it Works
            </a>
            <a href="#security" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Data Privacy
            </a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
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
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white transition-colors min-h-[44px] inline-flex items-center"
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
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Open Signup &bull; Per-Academy Data Isolation</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl mx-auto leading-tight sm:leading-tight"
          >
            Music Academy Management, Made Effortless &amp; Truly Private.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-base sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Set up in minutes. Your data stays private to your academy. Automated conflict-free timetables, instant WhatsApp fee reminders, attendance, and bulletproof security.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto"
          >
            <Link to="/register" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base px-8 py-3.5"
                icon={ArrowRight}
              >
                Start free
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base px-8 py-3.5"
              >
                Log in
              </Button>
            </Link>
          </motion.div>

          {/* Value Badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Instant Activation (No Approval Wait)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 100% Private Database
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Phone &amp; Desktop Optimized
            </span>
          </div>

          {/* Hero UI Mockup Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-14 max-w-5xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl shadow-indigo-600/10 text-left"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-mono text-slate-400 dark:text-slate-500 ml-2">
                  MIX with Me Classes &bull; Weekly Timetable Draft
                </span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                Optimized: 0 Clashes &bull; Minimum Idle Time
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Total Teaching Hours</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">18.5 hrs/wk</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Across 4 teaching days</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Monthly Fees Collected</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹48,000</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">92% collection rate</p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50">
                <p className="text-xs font-bold text-purple-700 dark:text-purple-400">Active Students</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">32 Students</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Across 6 music batches</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modules & Capabilities Section */}
      <section id="features" className="py-16 sm:py-24 bg-white dark:bg-[#0b1220] border-y border-slate-200 dark:border-[#1f2a3d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
              Comprehensive Platform
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-2 tracking-tight">
              Everything a Solo Music Teacher Needs
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-3">
              Designed from the ground up to replace chaotic spreadsheets, manual paper registers, and lost fee payments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Timetable Draft */}
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-[#1f2a3d] bg-slate-50/50 dark:bg-[#111a2b] hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Smart Timetable Drafts</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Auto-generate conflict-free weekly schedules or edit visually in the browser. Test changes risk-free on a draft before confirming.
              </p>
            </div>

            {/* 2. Students & Batches */}
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-[#1f2a3d] bg-slate-50/50 dark:bg-[#111a2b] hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Students &amp; Batch Rosters</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Track batch capacity, student photos, contact numbers, and parent guardians. Transfer students across batches with capacity safety checks.
              </p>
            </div>

            {/* 3. Fast Attendance */}
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-[#1f2a3d] bg-slate-50/50 dark:bg-[#111a2b] hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">1-Click Attendance</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Mark class presence in seconds on your phone. Automated flags identify students absent 3+ times in a row for immediate follow-up.
              </p>
            </div>

            {/* 4. Fees & Receipts */}
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-[#1f2a3d] bg-slate-50/50 dark:bg-[#111a2b] hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Fees &amp; Instant PDF Receipts</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Indian Rupee (₹) fee tracking, partial payment support, overpayment prevention, and sequential receipts (MWM-YYYY-000001) with your academy logo.
              </p>
            </div>

            {/* 5. WhatsApp Reminders */}
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-[#1f2a3d] bg-slate-50/50 dark:bg-[#111a2b] hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Direct WhatsApp Reminders</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Send professional tuition payment reminders directly via WhatsApp links to parents and students with one tap.
              </p>
            </div>

            {/* 6. Backups & Document Reports */}
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-[#1f2a3d] bg-slate-50/50 dark:bg-[#111a2b] hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Backups &amp; Reports</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Export official PDF and Word reports for student rosters, payment ledgers, and attendance. Download atomic JSON backups with transactional restore.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Timetable Spotlight */}
      <section id="timetable" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-xs font-bold mb-4">
                <Clock className="w-3.5 h-3.5" />
                <span>Optimized Scheduling</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Minimize Your Campus Days. Maximize Your Focus.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                The smart auto-generator solves your weekly timetable in milliseconds. It minimizes the teacher&apos;s days on campus, keeps your required minimum breaks (e.g. 10 minutes between sessions), and avoids unwanted idle gaps.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <strong>Draft-first safety:</strong> Nothing writes to your database until you review and confirm.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <strong>Weekdays first:</strong> Weekend slots are protected and only utilized when toggled on.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <strong>Interactive visual editing:</strong> Drag and drop classes with instant conflict detection.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                <span className="font-bold text-indigo-400">Timetable Optimization Engine</span>
                <span className="font-mono text-emerald-400">&lt; 10ms execution</span>
              </div>
              <p className="text-xs text-slate-300 font-mono leading-relaxed">
                &bull; Active Batches: 6<br />
                &bull; Working Days: Mon &bull; Tue &bull; Wed &bull; Thu &bull; Fri<br />
                &bull; Min Break: 10 mins<br />
                &bull; Working Window: 14:00 - 21:00<br />
                &bull; Status: Timetable is 100% valid with 0 overlaps
              </p>
              <div className="p-3 rounded-xl bg-slate-800/80 text-xs text-slate-300 border border-slate-700">
                &quot;Optimized for: fewest teaching days and shortest idle time.&quot;
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Data Privacy Section */}
      <section id="security" className="py-16 sm:py-24 bg-indigo-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-800 flex items-center justify-center text-indigo-300 mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-indigo-300" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Multi-Tenant Data Isolation
          </h2>
          <p className="text-indigo-200 text-sm sm:text-base max-w-2xl mx-auto mt-3">
            Every academy is completely segregated at the PostgreSQL kernel level. No user or teacher can ever view or leak another academy&apos;s records.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-10 text-left">
            <div className="p-5 rounded-2xl bg-indigo-950/60 border border-indigo-700/50">
              <p className="font-bold text-sm text-indigo-300">Row Level Security (RLS)</p>
              <p className="text-xs text-indigo-200 mt-2">
                Enforced by Postgres on SELECT, INSERT, UPDATE, and DELETE. Queries always filter strictly by <code className="bg-indigo-900 px-1 py-0.5 rounded">owner_id = auth.uid()</code>.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-indigo-950/60 border border-indigo-700/50">
              <p className="font-bold text-sm text-indigo-300">Cross-Tenant Foreign Key Triggers</p>
              <p className="text-xs text-indigo-200 mt-2">
                Database triggers block any attempt to assign a student, payment, or class to another user&apos;s batch or monthly fee.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-indigo-950/60 border border-indigo-700/50">
              <p className="font-bold text-sm text-indigo-300">Isolated Storage Buckets</p>
              <p className="text-xs text-indigo-200 mt-2">
                Photos and assets are sandboxed in folders matching your UUID: <code className="bg-indigo-900 px-1 py-0.5 rounded">&#123;auth.uid&#125;/...</code>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
            Everything you need to know about starting your music academy with MIX with Me.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-[#1f2a3d] bg-white dark:bg-[#111a2b] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 dark:text-white text-sm sm:text-base min-h-[44px]"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-indigo-600' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-slate-100 dark:bg-[#111a2b] border-t border-slate-200 dark:border-[#1f2a3d] text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ready to Run Your Music Classes with Peace of Mind?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
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
      <footer className="py-8 bg-white dark:bg-[#0b1220] border-t border-slate-200 dark:border-[#1f2a3d] text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            to={user ? '/dashboard' : '/'}
            aria-label={user ? 'Go to dashboard' : 'Go to home'}
            className="flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Music2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">MIX with Me Classes</span>
          </Link>
          <p>&copy; {new Date().getFullYear()} MIX with Me Classes. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#features" className="hover:underline">Modules</a>
            <a href="#security" className="hover:underline">Security</a>
            <a href="#faq" className="hover:underline">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
