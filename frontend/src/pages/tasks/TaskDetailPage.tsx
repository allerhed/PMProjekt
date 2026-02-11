import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTask, useUpdateTask } from '../../hooks/useTasks';
import { useComments, useCreateComment } from '../../hooks/useComments';
import { uploadApi } from '../../services/upload.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Select from '../../components/ui/Select';
import PhotoUploader from '../../components/uploads/PhotoUploader';
import PhotoGallery from '../../components/photos/PhotoGallery';
import PdfAnnotationViewer from '../../components/blueprints/PdfAnnotationViewer';
import type { Annotation } from '../../components/blueprints/PdfAnnotationViewer';
import { format } from 'date-fns';

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress'],
  in_progress: ['completed', 'open'],
  completed: ['verified', 'in_progress'],
  verified: [],
};

const statusBadge: Record<string, 'red' | 'yellow' | 'green' | 'blue'> = {
  open: 'red',
  in_progress: 'yellow',
  completed: 'green',
  verified: 'blue',
};

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const navigate = useNavigate();
  const { data: task, isLoading } = useTask(projectId!, taskId!);
  const updateTask = useUpdateTask(projectId!);
  const { data: comments = [], isLoading: commentsLoading } = useComments(projectId!, taskId!);
  const createComment = useCreateComment(projectId!, taskId!);
  const [commentText, setCommentText] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('');

  // Fetch blueprints for the project
  const { data: blueprints = [] } = useQuery({
    queryKey: ['blueprints', projectId],
    queryFn: () => uploadApi.listBlueprints(projectId!),
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!task) {
    return <div className="text-center py-12 text-gray-500">Task not found</div>;
  }

  const validTransitions = VALID_TRANSITIONS[task.status] || [];

  // Determine which blueprint to show
  const activeBlueprintId = task.blueprint_id || selectedBlueprintId;
  const activeBlueprint = blueprints.find((bp: any) => bp.id === activeBlueprintId);

  // Build annotation for this task if it has one
  const taskAnnotation: Annotation | null = (task.annotation_x != null && task.annotation_y != null &&
    task.annotation_width != null && task.annotation_height != null && task.annotation_page != null)
    ? {
        taskId: task.id,
        taskNumber: task.task_number,
        status: task.status,
        x: task.annotation_x,
        y: task.annotation_y,
        width: task.annotation_width,
        height: task.annotation_height,
        page: task.annotation_page,
      }
    : null;

  async function handleStatusChange(newStatus: string) {
    await updateTask.mutateAsync({ taskId: taskId!, data: { status: newStatus } });
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    await createComment.mutateAsync(commentText);
    setCommentText('');
  }

  async function handleBlueprintSelect(blueprintId: string) {
    setSelectedBlueprintId(blueprintId);
    if (blueprintId && !task.blueprint_id) {
      await updateTask.mutateAsync({ taskId: taskId!, data: { blueprintId } });
    }
  }

  async function handleAnnotationDraw(rect: { x: number; y: number; width: number; height: number; page: number }) {
    setDrawMode(false);
    await updateTask.mutateAsync({
      taskId: taskId!,
      data: {
        blueprintId: activeBlueprintId,
        annotationX: rect.x,
        annotationY: rect.y,
        annotationWidth: rect.width,
        annotationHeight: rect.height,
        annotationPage: rect.page,
      },
    });
  }

  async function handleClearAnnotation() {
    await updateTask.mutateAsync({
      taskId: taskId!,
      data: {
        annotationX: null,
        annotationY: null,
        annotationWidth: null,
        annotationHeight: null,
        annotationPage: null,
      },
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back nav */}
      <button
        onClick={() => navigate(`/projects/${projectId}`)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Tasks
      </button>

      {/* Task detail card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                <span className="text-gray-400 font-mono">#{task.task_number}</span> {task.title}
              </h1>
              {task.project_name && (
                <p className="text-sm text-gray-500 mt-1">Project: {task.project_name}</p>
              )}
            </div>
            <Badge variant={statusBadge[task.status]} size="md">
              {task.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {task.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                <p className="text-gray-600">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Priority:</span>{' '}
                <Badge variant={task.priority === 'critical' ? 'red' : task.priority === 'high' ? 'yellow' : 'gray'}>
                  {task.priority}
                </Badge>
              </div>
              {task.trade && (
                <div>
                  <span className="text-gray-500">Trade:</span>{' '}
                  <span className="text-gray-900">{task.trade}</span>
                </div>
              )}
              {task.assigned_to_contractor_email && (
                <div>
                  <span className="text-gray-500">Contractor:</span>{' '}
                  <span className="text-gray-900">{task.assigned_to_contractor_email}</span>
                </div>
              )}
              {task.creator_first_name && (
                <div>
                  <span className="text-gray-500">Created by:</span>{' '}
                  <span className="text-gray-900">{task.creator_first_name} {task.creator_last_name}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Created:</span>{' '}
                <span className="text-gray-900">{format(new Date(task.created_at), 'MMM d, yyyy')}</span>
              </div>
              {task.completed_at && (
                <div>
                  <span className="text-gray-500">Completed:</span>{' '}
                  <span className="text-gray-900">{format(new Date(task.completed_at), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>

            {/* Status transition buttons */}
            {validTransitions.length > 0 && (
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-500 self-center mr-2">Move to:</span>
                {validTransitions.map((status) => (
                  <Button
                    key={status}
                    variant="secondary"
                    size="sm"
                    loading={updateTask.isPending}
                    onClick={() => handleStatusChange(status)}
                  >
                    {status.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Blueprint Annotation */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Blueprint Annotation</h2>
            <div className="flex gap-2">
              {activeBlueprint && !drawMode && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDrawMode(true)}
                >
                  {taskAnnotation ? 'Redraw' : 'Draw Annotation'}
                </Button>
              )}
              {activeBlueprint && drawMode && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDrawMode(false)}
                >
                  Cancel
                </Button>
              )}
              {taskAnnotation && !drawMode && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClearAnnotation}
                  loading={updateTask.isPending}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {blueprints.length === 0 ? (
            <p className="text-sm text-gray-500">No blueprints uploaded for this project. Upload a blueprint in the Blueprints tab.</p>
          ) : !activeBlueprintId ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Select a blueprint to annotate:</p>
              <Select
                options={blueprints.map((bp: any) => ({ value: bp.id, label: bp.name }))}
                value=""
                onChange={(e) => handleBlueprintSelect(e.target.value)}
                placeholder="Choose blueprint..."
              />
            </div>
          ) : activeBlueprint ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-500">Blueprint:</span>
                <span className="text-sm font-medium text-gray-900">{activeBlueprint.name}</span>
                {task.blueprint_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await updateTask.mutateAsync({
                        taskId: taskId!,
                        data: {
                          blueprintId: null,
                          annotationX: null,
                          annotationY: null,
                          annotationWidth: null,
                          annotationHeight: null,
                          annotationPage: null,
                        },
                      });
                      setSelectedBlueprintId('');
                    }}
                  >
                    Change
                  </Button>
                )}
              </div>
              <PdfAnnotationViewer
                pdfUrl={activeBlueprint.download_url}
                annotations={taskAnnotation ? [taskAnnotation] : []}
                drawMode={drawMode}
                onAnnotationDraw={handleAnnotationDraw}
                initialPage={taskAnnotation?.page || 1}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Blueprint not found.</p>
          )}
        </CardBody>
      </Card>

      {/* Photos */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Photos</h2>
        </CardHeader>
        <CardBody>
          <PhotoUploader projectId={projectId!} taskId={taskId!} />
          <div className="mt-4">
            <PhotoGallery projectId={projectId!} taskId={taskId!} />
          </div>
        </CardBody>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Comments ({Array.isArray(comments) ? comments.length : 0})</h2>
        </CardHeader>
        <CardBody>
          {commentsLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : Array.isArray(comments) && comments.length > 0 ? (
            <div className="space-y-4 mb-4">
              {comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                    {comment.user_first_name?.[0] || comment.external_email?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.user_first_name
                          ? `${comment.user_first_name} ${comment.user_last_name}`
                          : comment.external_email || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{comment.comment_text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">No comments yet</p>
          )}

          {/* Add comment form */}
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <Button type="submit" size="sm" loading={createComment.isPending} disabled={!commentText.trim()}>
              Send
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
