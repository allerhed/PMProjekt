import { useState } from 'react';
import { useBugReports, useUpdateBugReport, useDeleteBugReport } from '../../hooks/useBugReports';
import { useUsers } from '../../hooks/useUsers';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardBody } from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import { format } from 'date-fns';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const statusBadge: Record<string, 'blue' | 'yellow' | 'green' | 'red'> = {
  open: 'blue',
  in_progress: 'yellow',
  resolved: 'green',
  closed: 'red',
};

const priorityBadge: Record<string, 'green' | 'yellow' | 'red'> = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
  critical: 'red',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BugReportData = any;

export default function BugReportsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedReport, setSelectedReport] = useState<BugReportData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BugReportData | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editResolutionNotes, setEditResolutionNotes] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showMeta, setShowMeta] = useState(false);

  const { data, isLoading } = useBugReports({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
  });
  const updateBugReport = useUpdateBugReport();
  const deleteBugReport = useDeleteBugReport();
  const { data: usersData } = useUsers({ limit: 200 });
  const users = usersData?.data?.users || [];

  const bugReports = data?.data?.bugReports || [];
  const pagination = data?.meta?.pagination;

  function openDetail(report: BugReportData) {
    setSelectedReport(report);
    setEditStatus(report.status);
    setEditPriority(report.priority);
    setEditAssignee(report.assigned_to || '');
    setEditResolutionNotes(report.resolution_notes || '');
    setShowLogs(false);
    setShowMeta(false);
  }

  async function handleUpdate() {
    if (!selectedReport) return;
    const data: Record<string, unknown> = {
      status: editStatus,
      priority: editPriority,
      assignedTo: editAssignee || null,
    };
    if (editStatus === 'resolved' || editStatus === 'closed') {
      data.resolutionNotes = editResolutionNotes || null;
    }
    await updateBugReport.mutateAsync({ reportId: selectedReport.id, data });
    setSelectedReport(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteBugReport.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedReport(null);
  }

  const levelColors: Record<string, string> = {
    error: 'text-red-400',
    warn: 'text-yellow-400',
    info: 'text-blue-400',
    log: 'text-gray-300',
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bug Reports</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Input
          placeholder="Search by title or description..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <Select
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        />
        <Select
          options={PRIORITY_OPTIONS}
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : bugReports.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-center text-gray-500 py-8">
              {search || statusFilter || priorityFilter
                ? 'No bug reports match your filters.'
                : 'No bug reports yet. Users can submit reports using the beetle button in the sidebar.'}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {bugReports.map((report: BugReportData) => (
            <Card key={report.id}>
              <button
                onClick={() => openDetail(report)}
                className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Screenshot thumbnail */}
                  {report.screenshot_download_url && (
                    <img
                      src={report.screenshot_download_url}
                      alt=""
                      className="w-20 h-14 object-cover rounded border border-gray-200 flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        #BUG-{report.report_number}
                      </span>
                      <Badge variant={statusBadge[report.status] || 'blue'}>
                        {statusLabel[report.status] || report.status}
                      </Badge>
                      <Badge variant={priorityBadge[report.priority] || 'yellow'}>
                        {report.priority}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {report.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Reported by {report.reporter_first_name} {report.reporter_last_name}
                      {' · '}
                      {format(new Date(report.created_at), 'MMM d, yyyy HH:mm')}
                      {report.assignee_first_name && (
                        <> · Assigned to {report.assignee_first_name} {report.assignee_last_name}</>
                      )}
                    </p>
                  </div>
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? `#BUG-${selectedReport.report_number}: ${selectedReport.title}` : ''}
        size="lg"
      >
        {selectedReport && (
          <div className="space-y-4">
            {/* Screenshot */}
            {selectedReport.screenshot_download_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot</label>
                <a href={selectedReport.screenshot_download_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={selectedReport.screenshot_download_url}
                    alt="Bug screenshot"
                    className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </a>
              </div>
            )}

            {/* Description */}
            {selectedReport.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedReport.description}</p>
              </div>
            )}

            {/* Steps to Reproduce */}
            {selectedReport.steps_to_reproduce && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Steps to Reproduce</label>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedReport.steps_to_reproduce}</p>
              </div>
            )}

            {/* Reporter info */}
            <div className="text-xs text-gray-500">
              Reported by {selectedReport.reporter_first_name} {selectedReport.reporter_last_name} ({selectedReport.reporter_email})
              {' · '}
              {format(new Date(selectedReport.created_at), 'MMM d, yyyy HH:mm')}
            </div>

            {/* Console Logs */}
            {selectedReport.console_logs && selectedReport.console_logs.length > 0 && (
              <div className="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span>Console Logs ({selectedReport.console_logs.length})</span>
                  <svg className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showLogs && (
                  <div className="max-h-48 overflow-y-auto bg-gray-900 rounded-b-lg p-3 font-mono text-xs">
                    {selectedReport.console_logs.map((log: { level: string; message: string; timestamp: string }, i: number) => (
                      <div key={i} className={`${levelColors[log.level] || 'text-gray-300'} break-all`}>
                        <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        {' '}
                        <span className="font-semibold">[{log.level.toUpperCase()}]</span>
                        {' '}
                        {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Metadata */}
            {selectedReport.metadata && (
              <div className="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setShowMeta(!showMeta)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span>Environment Info</span>
                  <svg className={`w-4 h-4 transition-transform ${showMeta ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showMeta && (
                  <div className="px-3 py-2 text-xs text-gray-600 space-y-1 border-t border-gray-200">
                    {Object.entries(selectedReport.metadata).map(([key, value]) => (
                      <div key={key}>
                        <strong>{key}:</strong>{' '}
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Management controls */}
            <div className="border-t border-gray-200 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Status"
                  options={STATUS_OPTIONS.filter((o) => o.value !== '')}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                />
                <Select
                  label="Priority"
                  options={PRIORITY_OPTIONS.filter((o) => o.value !== '')}
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                />
              </div>
              <Select
                label="Assigned To"
                options={[
                  { value: '', label: 'Unassigned' },
                  ...users.map((u: { id: string; first_name: string; last_name: string }) => ({
                    value: u.id,
                    label: `${u.first_name} ${u.last_name}`,
                  })),
                ]}
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
              />
              {(editStatus === 'resolved' || editStatus === 'closed') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                  <textarea
                    value={editResolutionNotes}
                    onChange={(e) => setEditResolutionNotes(e.target.value)}
                    placeholder="How was this resolved?"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y"
                  />
                </div>
              )}
              <div className="flex justify-between">
                <Button
                  variant="danger"
                  onClick={() => setDeleteTarget(selectedReport)}
                >
                  Delete
                </Button>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setSelectedReport(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdate}
                    loading={updateBugReport.isPending}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Bug Report" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>#{deleteTarget?.report_number}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteBugReport.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
