import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
  useBackupSettings,
  useUpdateBackupSettings,
  useBackupTables,
} from '../../hooks/useBackups';
import { backupApi } from '../../services/backup.api';
import type { Backup } from '../../services/backup.api';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function StatusBadge({ status }: { status: Backup['status'] }) {
  switch (status) {
    case 'in_progress':
      return (
        <Badge variant="blue">
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            In Progress
          </span>
        </Badge>
      );
    case 'completed':
      return <Badge variant="green">Completed</Badge>;
    case 'failed':
      return <Badge variant="red">Failed</Badge>;
  }
}

function formatCronExpression(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [minute, hour] = parts;
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  const dayPart = parts[4]; // day of week
  if (dayPart === '*') return `Daily at ${time}`;
  return `${cron} (${time})`;
}

export default function BackupPage() {
  const { data: backups, isLoading: backupsLoading } = useBackups();
  const { data: settings, isLoading: settingsLoading } = useBackupSettings();
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const restoreBackup = useRestoreBackup();
  const updateSettings = useUpdateBackupSettings();

  const [backupName, setBackupName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoreStep, setRestoreStep] = useState<1 | 2>(1);
  const [restoreMode, setRestoreMode] = useState<'full' | 'selective'>('full');
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean | null>(null);
  const [scheduleCron, setScheduleCron] = useState('');
  const [retentionDays, setRetentionDays] = useState('');

  const { data: backupTables, isLoading: tablesLoading } = useBackupTables(
    restoreMode === 'selective' ? showRestoreConfirm : null,
  );
  const effectiveEnabled = scheduleEnabled ?? settings?.schedule_enabled ?? false;
  const effectiveCron = scheduleCron || settings?.schedule_cron || '0 3 * * *';
  const effectiveRetention = retentionDays || String(settings?.retention_days ?? 30);

  const hasSettingsChanges =
    scheduleEnabled !== null ||
    (scheduleCron !== '' && scheduleCron !== settings?.schedule_cron) ||
    (retentionDays !== '' && retentionDays !== String(settings?.retention_days));

  function handleCreateBackup() {
    createBackup.mutate(backupName || undefined, {
      onSuccess: () => setBackupName(''),
    });
  }

  async function handleDownload(backupId: string) {
    try {
      const url = await backupApi.getDownloadUrl(backupId);
      window.open(url, '_blank');
    } catch {
      // Error handled by API interceptor
    }
  }

  function handleDelete(backupId: string) {
    deleteBackup.mutate(backupId, {
      onSuccess: () => setShowDeleteConfirm(null),
    });
  }

  function handleRestore(backupId: string) {
    const tables = restoreMode === 'selective' ? Array.from(selectedTables) : undefined;
    restoreBackup.mutate({ backupId, tables }, {
      onSuccess: () => {
        setShowRestoreConfirm(null);
        setRestoreInput('');
        setRestoreStep(1);
        setRestoreMode('full');
        setSelectedTables(new Set());
      },
    });
  }

  function openRestoreModal(backupId: string) {
    setShowRestoreConfirm(backupId);
    setRestoreStep(1);
    setRestoreMode('full');
    setSelectedTables(new Set());
    setRestoreInput('');
  }

  function closeRestoreModal() {
    setShowRestoreConfirm(null);
    setRestoreInput('');
    setRestoreStep(1);
    setRestoreMode('full');
    setSelectedTables(new Set());
  }

  function toggleTable(table: string) {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  }

  function toggleAllTables() {
    if (!backupTables) return;
    if (selectedTables.size === backupTables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(backupTables));
    }
  }

  function handleSaveSettings() {
    updateSettings.mutate(
      {
        scheduleEnabled: effectiveEnabled,
        scheduleCron: effectiveCron,
        retentionDays: parseInt(effectiveRetention, 10),
      },
      {
        onSuccess: () => {
          setScheduleEnabled(null);
          setScheduleCron('');
          setRetentionDays('');
        },
      },
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Backups</h1>

      {/* Settings Card */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Backup Settings</h2>
        </CardHeader>
        <CardBody>
          {settingsLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Scheduled Backups</p>
                  <p className="text-sm text-gray-500">
                    {effectiveEnabled
                      ? formatCronExpression(effectiveCron)
                      : 'Disabled'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleEnabled(!effectiveEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    effectiveEnabled ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      effectiveEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {effectiveEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cron Schedule
                    </label>
                    <input
                      type="text"
                      value={effectiveCron}
                      onChange={(e) => setScheduleCron(e.target.value)}
                      placeholder="0 3 * * *"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: 0 3 * * * (daily at 03:00)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Retention (days)
                    </label>
                    <input
                      type="number"
                      value={effectiveRetention}
                      onChange={(e) => setRetentionDays(e.target.value)}
                      min={1}
                      max={365}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {hasSettingsChanges && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={updateSettings.isPending}
                    className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create Backup */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="Backup name (optional)"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
            <button
              onClick={handleCreateBackup}
              disabled={createBackup.isPending}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
            >
              {createBackup.isPending ? 'Starting...' : 'Create Backup'}
            </button>
          </div>
          {createBackup.isError && (
            <p className="text-sm text-red-600 mt-2">{createBackup.error.message}</p>
          )}
        </CardBody>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Backup History</h2>
        </CardHeader>
        <CardBody className="p-0">
          {backupsLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !backups || backups.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No backups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{backup.name}</div>
                        {backup.initiated_by_name && (
                          <div className="text-xs text-gray-500">by {backup.initiated_by_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={backup.status} />
                        {backup.error_message && (
                          <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={backup.error_message}>
                            {backup.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {backup.file_size_bytes ? formatBytes(backup.file_size_bytes) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={backup.triggered_by === 'scheduled' ? 'purple' : 'gray'}>
                          {backup.triggered_by}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDistanceToNow(new Date(backup.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {backup.status === 'completed' && (
                            <>
                              <button
                                onClick={() => handleDownload(backup.id)}
                                className="text-primary-600 hover:text-primary-800 font-medium"
                              >
                                Download
                              </button>
                              <button
                                onClick={() => openRestoreModal(backup.id)}
                                className="text-yellow-600 hover:text-yellow-800 font-medium"
                              >
                                Restore
                              </button>
                            </>
                          )}
                          {backup.status !== 'in_progress' && (
                            <button
                              onClick={() => setShowDeleteConfirm(backup.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Backup</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this backup? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleteBackup.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteBackup.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal — Two-Step */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            {restoreStep === 1 ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Restore Database</h3>

                <div className="space-y-3 mb-4">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'full'}
                      onChange={() => setRestoreMode('full')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Full Restore</p>
                      <p className="text-xs text-gray-500">Replace the entire database with this backup</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="restoreMode"
                      checked={restoreMode === 'selective'}
                      onChange={() => setRestoreMode('selective')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Selective Restore</p>
                      <p className="text-xs text-gray-500">Choose specific tables to restore</p>
                    </div>
                  </label>
                </div>

                {restoreMode === 'selective' && (
                  <div className="mb-4">
                    {tablesLoading ? (
                      <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                    ) : backupTables && backupTables.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            Select tables ({selectedTables.size} of {backupTables.length})
                          </p>
                          <button
                            type="button"
                            onClick={toggleAllTables}
                            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                          >
                            {selectedTables.size === backupTables.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                          {backupTables.map((table) => (
                            <label key={table} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedTables.has(table)}
                                onChange={() => toggleTable(table)}
                                className="rounded text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-sm text-gray-700 font-mono">{table}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">No tables found in backup.</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeRestoreModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setRestoreStep(2)}
                    disabled={restoreMode === 'selective' && selectedTables.size === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Restore</h3>

                {restoreMode === 'full' ? (
                  <p className="text-sm text-gray-600 mb-2">
                    This will replace the <span className="font-semibold">entire database</span> with the backup. All data created after this backup will be lost.
                  </p>
                ) : (
                  <div className="mb-2">
                    <p className="text-sm text-gray-600 mb-2">
                      Restoring <span className="font-semibold">{selectedTables.size} table{selectedTables.size !== 1 ? 's' : ''}</span> from the backup:
                    </p>
                    <div className="max-h-24 overflow-y-auto bg-gray-50 rounded-lg p-2 mb-2">
                      <p className="text-xs font-mono text-gray-700">
                        {Array.from(selectedTables).sort().join(', ')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">
                      Data in these tables will be replaced with the backup version.
                    </p>
                  </div>
                )}

                <p className="text-sm font-medium text-gray-900 mb-3">
                  Type <span className="font-mono text-red-600">RESTORE</span> to confirm.
                </p>
                <input
                  type="text"
                  value={restoreInput}
                  onChange={(e) => setRestoreInput(e.target.value)}
                  placeholder="Type RESTORE"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
                <div className="flex justify-between">
                  <button
                    onClick={() => { setRestoreStep(1); setRestoreInput(''); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleRestore(showRestoreConfirm)}
                    disabled={restoreInput !== 'RESTORE' || restoreBackup.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {restoreBackup.isPending ? 'Restoring...' : 'Restore Database'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
