import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useProject } from '../../hooks/useProjects';
import { useTasks } from '../../hooks/useTasks';
import { useGenerateProtocol, useProtocols } from '../../hooks/useProtocols';
import { useProtocolSignatures } from '../../hooks/useProtocolSigning';
import { uploadApi } from '../../services/upload.api';
import type { Annotation } from '../../components/blueprints/PdfAnnotationViewer';
import BlueprintReportView from '../../components/reports/BlueprintReportView';
import SendForSigningModal from '../../components/protocols/SendForSigningModal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

const statusBadge: Record<string, 'red' | 'yellow' | 'green' | 'blue' | 'gray'> = {
  open: 'red',
  in_progress: 'yellow',
  completed: 'green',
  verified: 'blue',
};

const priorityBadge: Record<string, 'red' | 'yellow' | 'green' | 'gray'> = {
  critical: 'red',
  high: 'yellow',
  normal: 'gray',
  low: 'green',
};

interface ProtocolPageProps {
  projectId: string;
}

export default function ProtocolPage({ projectId }: ProtocolPageProps) {
  const [showSigningModal, setShowSigningModal] = useState(false);
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: taskData, isLoading: tasksLoading } = useTasks(projectId, { limit: 10000 });
  const tasks: any[] = taskData?.data?.tasks || [];

  // Protocol generation
  const generateProtocol = useGenerateProtocol(projectId);
  const { data: protocols = [] } = useProtocols(projectId);
  const latestProtocol = protocols.find((p: any) => p.status === 'completed');
  const isGenerating = generateProtocol.isPending || protocols.some((p: any) => p.status === 'generating');

  // Signatures for the latest completed protocol
  const { data: signatures = [] } = useProtocolSignatures(
    projectId,
    latestProtocol?.id || '',
  );

  const { data: blueprints = [], isLoading: blueprintsLoading } = useQuery({
    queryKey: ['blueprints', projectId],
    queryFn: () => uploadApi.listBlueprints(projectId),
    enabled: !!projectId,
  });

  // Derive annotations from tasks grouped by blueprint
  const blueprintsWithAnnotations = (blueprints as any[]).map((bp: any) => {
    const bpTasks = tasks.filter(
      (t: any) =>
        t.blueprint_id === bp.id &&
        t.annotation_x != null &&
        t.annotation_y != null &&
        t.annotation_width != null &&
        t.annotation_height != null &&
        t.annotation_page != null,
    );
    const annotations: Annotation[] = bpTasks.map((t: any) => ({
      taskId: t.id,
      taskNumber: t.task_number,
      status: t.status,
      x: t.annotation_x,
      y: t.annotation_y,
      width: t.annotation_width,
      height: t.annotation_height,
      page: t.annotation_page,
    }));
    return { blueprint: bp, annotations };
  });

  // Photos for tasks that have them
  const tasksWithPhotos = tasks.filter((t: any) => t.photo_count > 0);
  const photoQueries = useQueries({
    queries: tasksWithPhotos.map((task: any) => ({
      queryKey: ['photos', projectId, task.id],
      queryFn: () => uploadApi.listPhotos(projectId, task.id),
      enabled: !!projectId,
    })),
  });

  const allPhotosLoaded = photoQueries.length === 0 || photoQueries.every((q) => !q.isLoading);
  const isReady = !projectLoading && !tasksLoading && !blueprintsLoading && allPhotosLoaded;

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner />
        <p className="mt-4 text-sm text-gray-500">Loading report data...</p>
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-500">Project not found</div>;
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* ================================================================ */}
      {/* SECTION 1: Project Description                                   */}
      {/* ================================================================ */}
      <div className="print-avoid-break mb-10">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Project Protocol</h2>
        <div className="border-b-2 border-gray-900 mb-6" />

        <h3 className="text-lg font-semibold text-gray-900 mb-3">{project.name}</h3>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
          {project.address && (
            <>
              <span className="font-medium text-gray-500">Address</span>
              <span className="text-gray-900">{project.address}</span>
            </>
          )}
          <span className="font-medium text-gray-500">Status</span>
          <span className="text-gray-900 capitalize">{project.status}</span>
          <span className="font-medium text-gray-500">Start Date</span>
          <span className="text-gray-900">{formatDate(project.start_date)}</span>
          <span className="font-medium text-gray-500">Target Completion</span>
          <span className="text-gray-900">{formatDate(project.target_completion_date)}</span>
          {project.responsible_user_name && (
            <>
              <span className="font-medium text-gray-500">Responsible</span>
              <span className="text-gray-900">{project.responsible_user_name}</span>
            </>
          )}
        </div>

        {project.description && (
          <div className="mb-4">
            <span className="text-sm font-medium text-gray-500 block mb-1">Description</span>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>
          </div>
        )}

        {/* Task summary stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-700">{project.open_tasks || 0}</div>
            <div className="text-xs text-red-600">Open</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-yellow-700">{project.in_progress_tasks || 0}</div>
            <div className="text-xs text-yellow-600">In Progress</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-green-700">{project.completed_tasks || 0}</div>
            <div className="text-xs text-green-600">Completed</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-700">{project.verified_tasks || 0}</div>
            <div className="text-xs text-blue-600">Verified</div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SECTION 2: Blueprints                                            */}
      {/* ================================================================ */}
      {(blueprints as any[]).length > 0 && (
        <div className="print-page-break mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Blueprints</h2>
          <div className="border-b border-gray-300 mb-6" />

          {blueprintsWithAnnotations.map(({ blueprint, annotations }) => (
            <div key={blueprint.id} className="mb-8">
              <BlueprintReportView
                blueprintName={blueprint.name}
                pdfUrl={blueprint.download_url}
                annotations={annotations}
              />
            </div>
          ))}
        </div>
      )}

      {/* ================================================================ */}
      {/* SECTION 3: Tasks List                                            */}
      {/* ================================================================ */}
      <div className="print-page-break mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tasks ({tasks.length})</h2>
        <div className="border-b border-gray-300 mb-4" />

        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">No tasks in this project.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 pr-2 font-semibold text-gray-700 w-10">#</th>
                <th className="text-left py-2 pr-2 font-semibold text-gray-700">Title</th>
                <th className="text-left py-2 pr-2 font-semibold text-gray-700 w-24">Status</th>
                <th className="text-left py-2 pr-2 font-semibold text-gray-700 w-20">Priority</th>
                <th className="text-left py-2 pr-2 font-semibold text-gray-700 w-28">Trade</th>
                <th className="text-left py-2 font-semibold text-gray-700 w-32">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task: any) => {
                const assignee = task.assignee_first_name
                  ? `${task.assignee_first_name} ${task.assignee_last_name}`
                  : task.assigned_to_contractor_email || '—';

                return (
                  <tr key={task.id} className="border-b border-gray-100 print-avoid-break">
                    <td className="py-1.5 pr-2 font-mono text-gray-500">{task.task_number}</td>
                    <td className="py-1.5 pr-2 text-gray-900">{task.title}</td>
                    <td className="py-1.5 pr-2">
                      <Badge variant={statusBadge[task.status] || 'gray'}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge variant={priorityBadge[task.priority] || 'gray'}>
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2 text-gray-600">{task.trade || '—'}</td>
                    <td className="py-1.5 text-gray-600 truncate">{assignee}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ================================================================ */}
      {/* SECTION 4: Task Photos                                           */}
      {/* ================================================================ */}
      {tasksWithPhotos.length > 0 && (
        <div className="print-page-break mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Task Photos</h2>
          <div className="border-b border-gray-300 mb-6" />

          {tasksWithPhotos.map((task: any, index: number) => {
            const photos: any[] = photoQueries[index]?.data || [];
            if (photos.length === 0) return null;

            return (
              <div key={task.id} className="print-avoid-break mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  <span className="font-mono text-gray-400">#{task.task_number}</span>{' '}
                  {task.title}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo: any) => (
                    <div key={photo.id} className="relative">
                      <img
                        src={photo.download_url || photo.thumbnail_download_url}
                        alt={photo.caption || `Photo from task #${task.task_number}`}
                        className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      />
                      {photo.caption && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{photo.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-400 text-center">
        Generated {new Date().toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      {/* Create PDF for Signing (hidden when printing) */}
      <div className="no-print mt-8 mb-4 space-y-4">
        <div className="flex justify-center gap-3">
          <Button
            loading={isGenerating}
            onClick={() => {
              generateProtocol.mutate({
                name: `Protocol - ${project?.name || 'Project'} - ${new Date().toLocaleDateString()}`,
              });
            }}
          >
            Create PDF for Signing
          </Button>
        </div>

        {isGenerating && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Spinner />
            <span>Generating PDF...</span>
          </div>
        )}

        {latestProtocol && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Generated Protocol PDF</h3>
            <div className="flex items-center gap-3 mb-4">
              <a
                href={latestProtocol.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700 underline"
              >
                Download PDF
              </a>
              <span className="text-xs text-gray-400">
                {new Date(latestProtocol.created_at).toLocaleDateString()}
              </span>
              <Button
                size="sm"
                onClick={() => setShowSigningModal(true)}
              >
                Send for Signing
              </Button>
            </div>

            {/* Signatures list */}
            {(signatures as any[]).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Signatures</h4>
                <div className="space-y-2">
                  {(signatures as any[]).map((sig: any) => (
                    <div
                      key={sig.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      {sig.signed_at ? (
                        <Badge variant="green">Signed</Badge>
                      ) : (
                        <Badge variant="yellow">Pending</Badge>
                      )}
                      <span className="text-gray-700">
                        {sig.signer_name || sig.signer_email || 'Awaiting signature'}
                      </span>
                      {sig.signed_at && (
                        <span className="text-xs text-gray-400">
                          {new Date(sig.signed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Signing Modal */}
      {latestProtocol && (
        <SendForSigningModal
          isOpen={showSigningModal}
          onClose={() => setShowSigningModal(false)}
          projectId={projectId}
          protocolId={latestProtocol.id}
          protocolName={latestProtocol.name}
        />
      )}
    </div>
  );
}
