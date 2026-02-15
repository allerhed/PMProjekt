import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { uploadApi } from '../../services/upload.api';
import { useTasksByBlueprint } from '../../hooks/useTasks';
import BlueprintUploader from '../uploads/BlueprintUploader';
import BlueprintViewer from './BlueprintViewer';
import type { Annotation, Marker } from './PdfAnnotationViewer';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

interface BlueprintListProps {
  projectId: string;
  onSelect?: (blueprint: any) => void;
}

export default function BlueprintList({ projectId, onSelect }: BlueprintListProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: blueprints = [], isLoading } = useQuery({
    queryKey: ['blueprints', projectId],
    queryFn: () => uploadApi.listBlueprints(projectId),
  });
  const [viewingBlueprint, setViewingBlueprint] = useState<any>(null);

  // Fetch tasks linked to the viewed blueprint
  const { data: blueprintTasks = [] } = useTasksByBlueprint(projectId, viewingBlueprint?.id);

  // Convert tasks to annotations
  const annotations: Annotation[] = blueprintTasks
    .filter((t: any) =>
      t.annotation_x != null && t.annotation_y != null &&
      t.annotation_width != null && t.annotation_height != null &&
      t.annotation_page != null
    )
    .map((t: any) => ({
      taskId: t.id,
      taskNumber: t.task_number,
      status: t.status,
      x: t.annotation_x,
      y: t.annotation_y,
      width: t.annotation_width,
      height: t.annotation_height,
      page: t.annotation_page,
    }));

  // Collect markers from all tasks on this blueprint (with pre-computed labels)
  const allMarkers: Marker[] = blueprintTasks
    .filter((t: any) => Array.isArray(t.annotation_markers) && t.annotation_markers.length > 0)
    .flatMap((t: any) =>
      (t.annotation_markers as Array<{ id: string; x: number; y: number; page: number }>).map((m, idx) => ({
        ...m,
        label: `${t.task_number}-${idx + 1}`,
      })),
    );

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function handleDelete(blueprintId: string) {
    setDeleteError(null);
    setDeleteTarget(null);
    try {
      await uploadApi.deleteBlueprint(projectId, blueprintId);
      queryClient.invalidateQueries({ queryKey: ['blueprints', projectId] });
      if (viewingBlueprint?.id === blueprintId) {
        setViewingBlueprint(null);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to delete blueprint';
      setDeleteError(msg);
    }
  }

  function handleClick(bp: any) {
    if (onSelect) {
      onSelect(bp);
    } else {
      setViewingBlueprint(viewingBlueprint?.id === bp.id ? null : bp);
    }
  }

  function handleAnnotationClick(taskId: string) {
    navigate(`/projects/${projectId}/tasks/${taskId}`);
  }

  if (isLoading) {
    return <div className="flex justify-center py-4"><Spinner size="sm" /></div>;
  }

  return (
    <div className="space-y-4">
      <BlueprintUploader projectId={projectId} />

      {deleteError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600 text-sm ml-3">Dismiss</button>
        </div>
      )}

      {blueprints.length === 0 ? (
        <EmptyState
          title="No blueprints"
          description="Upload a PDF blueprint to get started."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {blueprints.map((bp: any) => (
            <div
              key={bp.id}
              className={`relative group border rounded-lg overflow-hidden cursor-pointer hover:shadow-sm transition-all ${
                viewingBlueprint?.id === bp.id
                  ? 'border-primary-600 ring-2 ring-primary-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleClick(bp)}
            >
              {bp.thumbnail_download_url ? (
                <img
                  src={bp.thumbnail_download_url}
                  alt={bp.name}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                  {bp.mime_type === 'application/pdf' ? (
                    <div className="text-center">
                      <div className="text-3xl text-red-500 mb-1">PDF</div>
                      <div className="text-xs text-gray-400">Click to view</div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-xs">No preview</div>
                  )}
                </div>
              )}
              <div className="p-2">
                <p className="text-sm font-medium text-gray-900 truncate">{bp.name}</p>
                <p className="text-xs text-gray-500">{(bp.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(bp.id); }}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline viewer with annotations */}
      {viewingBlueprint && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900">{viewingBlueprint.name}</h3>
            <div className="flex items-center gap-3">
              {annotations.length > 0 && (
                <span className="text-sm text-gray-500">
                  {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewingBlueprint(null)}
              >
                Close
              </Button>
            </div>
          </div>
          <BlueprintViewer
            imageUrl={viewingBlueprint.download_url}
            mimeType={viewingBlueprint.mime_type}
            annotations={annotations}
            annotationMarkers={allMarkers}
            onAnnotationClick={handleAnnotationClick}
          />
        </div>
      )}
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Blueprint</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this blueprint? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
