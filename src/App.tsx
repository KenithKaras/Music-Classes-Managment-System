import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { SetupErrorScreen } from './components/SetupErrorScreen';
import { SchemaErrorScreen } from './components/SchemaErrorScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InactivityWarningModal } from './components/InactivityWarningModal';
import { Skeleton } from './components/Skeleton';
import { missingEnvVars } from './lib/supabase';
import { validateDatabaseSchema, type SchemaValidationResult } from './utils/schemaChecker';

// Route-level lazy loading (Performance target)
const LandingPage = React.lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const LoginPage = React.lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const StudentsPage = React.lazy(() => import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const StudentProfilePage = React.lazy(() => import('./pages/StudentProfilePage').then((m) => ({ default: m.StudentProfilePage })));
const BatchesPage = React.lazy(() => import('./pages/BatchesPage').then((m) => ({ default: m.BatchesPage })));
const BatchDetailPage = React.lazy(() => import('./pages/BatchDetailPage').then((m) => ({ default: m.BatchDetailPage })));
const TimetablePage = React.lazy(() => import('./pages/TimetablePage').then((m) => ({ default: m.TimetablePage })));
const AttendancePage = React.lazy(() => import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const FeesPage = React.lazy(() => import('./pages/FeesPage').then((m) => ({ default: m.FeesPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BackupsPage = React.lazy(() => import('./pages/BackupsPage').then((m) => ({ default: m.BackupsPage })));
const ExportsPage = React.lazy(() => import('./pages/ExportsPage').then((m) => ({ default: m.ExportsPage })));
const PayPage = React.lazy(() => import('./pages/PayPage').then((m) => ({ default: m.PayPage })));
const EnrollPage = React.lazy(() => import('./pages/EnrollPage').then((m) => ({ default: m.EnrollPage })));

const PageFallback: React.FC = () => (
  <div className="p-6 max-w-7xl mx-auto space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-72" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
    <Skeleton className="h-64 mt-6" />
  </div>
);

// Decides whether root / serves LandingPage (logged out) or redirects to /dashboard (logged in)
const RootRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return <PageFallback />;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
};

// Authenticated layout wrapper for app routes (includes AuthProvider, ToastProvider, and InactivityModal)
const AuthAppLayout: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <InactivityWarningModal />
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </ToastProvider>
  </AuthProvider>
);

export const App: React.FC = () => {
  const isPublicPath =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/pay' || window.location.pathname.startsWith('/enroll/'));

  // Missing environment variables screen on startup (bypassed on public /pay and /enroll routes)
  if (!isPublicPath && missingEnvVars.length > 0) {
    return <SetupErrorScreen missingVars={missingEnvVars} />;
  }

  const [schemaResult, setSchemaResult] = useState<SchemaValidationResult | null>(null);

  const runSchemaCheck = async () => {
    if (import.meta.env.DEV && !isPublicPath) {
      const res = await validateDatabaseSchema();
      if (!res.isValid) {
        setSchemaResult(res);
      } else {
        setSchemaResult(null);
      }
    }
  };

  useEffect(() => {
    if (!isPublicPath) {
      runSchemaCheck();
    }
  }, [isPublicPath]);

  if (import.meta.env.DEV && !isPublicPath && schemaResult && !schemaResult.isValid) {
    return <SchemaErrorScreen schemaResult={schemaResult} onRetry={runSchemaCheck} />;
  }

  return (
    <ErrorBoundary fallbackTitle="Application Failed to Load">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <Routes>
              {/* Public Standalone /pay Route: completely outside AuthProvider, no Supabase auth, no storage */}
              <Route
                path="/pay"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <PayPage />
                  </Suspense>
                }
              />

              {/* Public Standalone /enroll/:token Route: completely outside AuthProvider, no Supabase auth, no storage */}
              <Route
                path="/enroll/:token"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <EnrollPage />
                  </Suspense>
                }
              />

              {/* Application routes wrapped in AuthAppLayout */}
              <Route element={<AuthAppLayout />}>
                {/* Public Root: Landing page when logged out, redirects to /dashboard when logged in */}
                <Route path="/" element={<RootRoute />} />

                {/* Open Signup & Authentication */}
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Protected Multi-Tenant Dashboard Shell & Academy Modules */}
                <Route
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary fallbackTitle="Dashboard Error">
                        <DashboardLayout />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/students" element={<StudentsPage />} />
                  <Route path="/students/:id" element={<StudentProfilePage />} />
                  <Route path="/batches" element={<BatchesPage />} />
                  <Route path="/batches/:id" element={<BatchDetailPage />} />
                  <Route path="/timetable" element={<TimetablePage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/fees" element={<FeesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/backups" element={<BackupsPage />} />
                  <Route path="/exports" element={<ExportsPage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
