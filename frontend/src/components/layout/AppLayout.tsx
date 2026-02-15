import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { BugReporterProvider } from '../../lib/bug-reporter';
import type { BugReportPayload } from '../../lib/bug-reporter';
import { useCreateBugReport } from '../../hooks/useBugReports';
import { useAuthStore } from '../../stores/authStore';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const createBugReport = useCreateBugReport();
  const user = useAuthStore((s) => s.user);

  const handleBugSubmit = useCallback(async (payload: BugReportPayload) => {
    await createBugReport.mutateAsync({
      title: payload.title,
      description: payload.description || undefined,
      stepsToReproduce: payload.stepsToReproduce || undefined,
      priority: payload.priority,
      screenshotBase64: payload.screenshotBase64,
      consoleLogs: payload.consoleLogs,
      metadata: payload.metadata as unknown as Record<string, unknown>,
    });
  }, [createBugReport]);

  const bugUser = user ? { id: user.userId, name: `${user.firstName} ${user.lastName}`, email: user.email } : null;

  return (
    <BugReporterProvider onSubmit={handleBugSubmit} user={bugUser}>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </BugReporterProvider>
  );
}
