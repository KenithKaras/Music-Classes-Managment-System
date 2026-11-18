import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardCheck,
  CreditCard,
  Settings,
  LogOut,
  X,
  Music2,
  User as UserIcon,
  MoreHorizontal,
  Moon,
  Sun,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme } from '../hooks/useTheme';

interface NavItemConfig {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainNavItems: NavItemConfig[] = [
  { title: 'Dashboard', path: '/', icon: LayoutDashboard },
  { title: 'Students', path: '/students', icon: Users },
  { title: 'Timetable', path: '/timetable', icon: Calendar },
  { title: 'Attendance', path: '/attendance', icon: ClipboardCheck },
];

const allNavItems: NavItemConfig[] = [
  { title: 'Dashboard', path: '/', icon: LayoutDashboard },
  { title: 'Students & Batches', path: '/students', icon: Users },
  { title: 'Timetable', path: '/timetable', icon: Calendar },
  { title: 'Attendance', path: '/attendance', icon: ClipboardCheck },
  { title: 'Fees & Payments', path: '/fees', icon: CreditCard },
  { title: 'Settings, Backups & Exports', path: '/settings', icon: Settings },
];

export const DashboardLayout: React.FC = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const location = useLocation();

  const isNavItemActive = (itemPath: string) => {
    if (itemPath === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    if (itemPath === '/students') {
      return location.pathname.startsWith('/students') || location.pathname.startsWith('/batches');
    }
    if (itemPath === '/settings') {
      return (
        location.pathname.startsWith('/settings') ||
        location.pathname.startsWith('/backups') ||
        location.pathname.startsWith('/exports')
      );
    }
    return location.pathname.startsWith(itemPath);
  };

  const currentNav = allNavItems.find((item) => isNavItemActive(item.path));
  const pageTitle = currentNav ? currentNav.title : 'Admin';

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] flex flex-col md:flex-row text-slate-900 dark:text-[#f1f5f9] font-sans antialiased transition-colors overflow-x-hidden max-w-full">
      {/* Mobile Top App Bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-[#131c2e] border-b border-slate-200 dark:border-[#26324a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link to="/dashboard" aria-label="Go to dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 dark:text-[#f1f5f9] text-sm tracking-tight truncate">
              MIX with Me
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 rounded-xl text-slate-600 dark:text-[#a9b4c7] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-[#131c2e] border-r border-slate-200 dark:border-[#26324a] z-20">
        {/* Brand */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-[#26324a] flex items-center justify-between">
          <Link to="/dashboard" aria-label="Go to dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Music2 className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h1 className="font-bold text-slate-900 dark:text-[#f1f5f9] text-base leading-tight tracking-tight truncate">
                MIX with Me
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#a9b4c7] font-medium">Music Academy</p>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5" aria-label="Sidebar Navigation">
          <div className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#a9b4c7]">
            Academy Management
          </div>
          {allNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-600/20 dark:text-indigo-300 dark:border dark:border-indigo-500/30'
                    : 'text-slate-600 dark:text-[#a9b4c7] hover:bg-slate-100 dark:hover:bg-[#1a2540] hover:text-slate-900 dark:hover:text-[#f1f5f9]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white dark:text-indigo-300' : 'text-slate-400 dark:text-[#a9b4c7]'}`} />
                <span className="truncate">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Teacher Account & Logout Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#26324a] bg-slate-50/70 dark:bg-[#0f172a]/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-400 shrink-0 font-bold text-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-900 dark:text-[#f1f5f9] truncate">Teacher / Owner</p>
              <p className="text-xs text-slate-500 dark:text-[#a9b4c7] truncate" title={user?.email || 'Teacher'}>
                {user?.email || 'Authenticated User'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#26324a] bg-white dark:bg-[#131c2e] text-slate-700 dark:text-[#f1f5f9] hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 text-xs font-semibold transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-w-0 max-w-full pb-20 md:pb-6 overflow-x-hidden">
        {/* Desktop Topbar */}
        <header className="hidden md:flex h-16 bg-white dark:bg-[#131c2e] border-b border-slate-200 dark:border-[#26324a] px-6 lg:px-8 items-center justify-between sticky top-0 z-10 transition-colors">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-[#f1f5f9]">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Academy Isolated
            </span>
            <div className="h-4 w-px bg-slate-200 dark:bg-[#26324a]" />
            <span
              className="text-xs text-slate-500 dark:text-[#a9b4c7] font-medium truncate max-w-[220px]"
              title={user?.email || ''}
            >
              {user?.email}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full min-w-0 mx-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#131c2e]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#26324a] flex items-center justify-around px-2 py-1.5 shadow-lg"
        aria-label="Mobile Navigation Bar"
      >
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl min-h-[44px] text-xs font-semibold transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-[#a9b4c7] hover:text-slate-900 dark:hover:text-[#f1f5f9]'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.title}</span>
            </NavLink>
          );
        })}

        {/* More Button */}
        <button
          type="button"
          onClick={() => setMoreSheetOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl min-h-[44px] text-xs font-semibold transition-colors ${
            moreSheetOpen || isNavItemActive('/fees') || isNavItemActive('/settings')
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 dark:text-[#a9b4c7] hover:text-slate-900 dark:hover:text-[#f1f5f9]'
          }`}
          aria-label="More navigation options"
        >
          <MoreHorizontal className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Bottom Sheet */}
      <AnimatePresence>
        {moreSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs"
              onClick={() => setMoreSheetOpen(false)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 bg-white dark:bg-[#131c2e] z-50 rounded-t-3xl border-t border-slate-200 dark:border-[#26324a] p-5 md:hidden shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#26324a]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white">
                    <Music2 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-900 dark:text-[#f1f5f9]">More Options</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreSheetOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Extended navigation links */}
              <div className="space-y-1.5">
                <NavLink
                  to="/fees"
                  onClick={() => setMoreSheetOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors min-h-[44px] ${
                    isNavItemActive('/fees')
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-50 dark:bg-[#1a2540] text-slate-800 dark:text-[#f1f5f9]'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Fees &amp; Payments</span>
                </NavLink>

                <NavLink
                  to="/settings"
                  onClick={() => setMoreSheetOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors min-h-[44px] ${
                    isNavItemActive('/settings')
                      ? 'bg-indigo-600 text-white dark:bg-indigo-600/20 dark:text-indigo-300 dark:border dark:border-indigo-500/30'
                      : 'bg-slate-50 dark:bg-[#1a2540] text-slate-800 dark:text-[#f1f5f9]'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings, Backups &amp; Exports</span>
                </NavLink>
              </div>

              {/* Theme toggle & Sign out */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#26324a] space-y-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 dark:bg-[#1a2540] text-sm font-semibold text-slate-800 dark:text-[#f1f5f9] min-h-[44px]"
                >
                  <span className="flex items-center gap-3">
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
                    <span>Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                  </span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Switch</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMoreSheetOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-sm font-bold min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
