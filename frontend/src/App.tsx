import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastProvider } from './components/common/Toast';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGuard from './components/auth/RoleGuard';
import AppLayout from './components/layout/AppLayout';
import NetworkStatus from './components/common/NetworkStatus';
import { FullPageSpinner } from './components/ui/Spinner';

// Lazy-loaded page components
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const ProjectListPage = lazy(() => import('./pages/projects/ProjectListPage'));
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'));
const TaskDetailPage = lazy(() => import('./pages/tasks/TaskDetailPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const OrgSettingsPage = lazy(() => import('./pages/admin/OrgSettingsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const ProductListPage = lazy(() => import('./pages/products/ProductListPage'));
const FormBuilderPage = lazy(() => import('./pages/admin/FormBuilderPage'));
const TaskReportPage = lazy(() => import('./pages/admin/TaskReportPage'));
const BackupPage = lazy(() => import('./pages/admin/BackupPage'));
const BugReportsPage = lazy(() => import('./pages/admin/BugReportsPage'));
const MyTasksPage = lazy(() => import('./pages/tasks/MyTasksPage'));
const PublicSigningPage = lazy(() => import('./pages/protocols/PublicSigningPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { isLoading, isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        {/* Auth routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/projects" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/projects" replace /> : <RegisterPage />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/sign/:token" element={<PublicSigningPage />} />

        {/* Protected app routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/products" element={<ProductListPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/users" element={<RoleGuard roles={['org_admin', 'super_admin']} fallback={<Navigate to="/projects" replace />}><UserManagementPage /></RoleGuard>} />
          <Route path="/admin/dashboard" element={<RoleGuard roles={['org_admin', 'super_admin']} fallback={<Navigate to="/projects" replace />}><AdminDashboardPage /></RoleGuard>} />
          <Route path="/admin/settings" element={<RoleGuard roles={['org_admin', 'super_admin']} fallback={<Navigate to="/projects" replace />}><OrgSettingsPage /></RoleGuard>} />
          <Route path="/admin/form-builder" element={<RoleGuard roles={['org_admin', 'super_admin']} fallback={<Navigate to="/projects" replace />}><FormBuilderPage /></RoleGuard>} />
          <Route path="/admin/task-report" element={<RoleGuard roles={['org_admin', 'super_admin']} fallback={<Navigate to="/projects" replace />}><TaskReportPage /></RoleGuard>} />
          <Route path="/admin/backups" element={<RoleGuard roles={['org_admin', 'super_admin']} fallback={<Navigate to="/projects" replace />}><BackupPage /></RoleGuard>} />
          <Route path="/admin/bug-reports" element={<RoleGuard roles={['org_admin', 'super_admin']} fallback={<Navigate to="/projects" replace />}><BugReportsPage /></RoleGuard>} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={isAuthenticated ? '/projects' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <NetworkStatus />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
