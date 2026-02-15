import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTask, useUpdateTask } from '../../hooks/useTasks';
import { useComments, useCreateComment } from '../../hooks/useComments';
import { useProducts, useTaskProducts, useAddProductToTask, useRemoveProductFromTask } from '../../hooks/useProducts';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields';
import { useUsers } from '../../hooks/useUsers';
import { uploadApi } from '../../services/upload.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import Select from '../../components/ui/Select';
import PhotoUploader from '../../components/uploads/PhotoUploader';
import PhotoGallery from '../../components/photos/PhotoGallery';
import PdfAnnotationViewer from '../../components/blueprints/PdfAnnotationViewer';
import CustomFieldsRenderer from '../../components/common/CustomFieldsRenderer';
import type { Annotation, Marker } from '../../components/blueprints/PdfAnnotationViewer';
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
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [removeProductTarget, setRemoveProductTarget] = useState<{ taskId: string; productId: string; productName: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: '', trade: '' });
  const [markerPlaceMode, setMarkerPlaceMode] = useState(false);
  const [deleteMarkerTarget, setDeleteMarkerTarget] = useState<string | null>(null);

  // Task products
  const { data: taskProducts = [], isLoading: taskProductsLoading } = useTaskProducts(projectId!, taskId!);
  const addProductToTask = useAddProductToTask(projectId!);
  const removeProductFromTask = useRemoveProductFromTask(projectId!);
  const { data: allProductsData } = useProducts({ search: productSearch || undefined, limit: 50 });
  const { data: usersData } = useUsers({ limit: 200 });
  const users = usersData?.data?.users || [];
  const userOptions = users.map((u: any) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }));

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

  function openEdit() {
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      trade: task.trade || '',
    });
    setEditing(true);
  }

  async function handleEditSave() {
    await updateTask.mutateAsync({
      taskId: taskId!,
      data: {
        title: editForm.title,
        description: editForm.description || null,
        priority: editForm.priority,
        trade: editForm.trade || null,
      },
    });
    setEditing(false);
  }

  // Marker data and handlers
  const markers: Marker[] = task.annotation_markers || [];

  async function handleMarkerPlace(point: { x: number; y: number; page: number }) {
    const newMarker: Marker = {
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      page: point.page,
    };
    await updateTask.mutateAsync({
      taskId: taskId!,
      data: { annotationMarkers: [...markers, newMarker] },
    });
    setMarkerPlaceMode(false);
  }

  async function handleMarkerMove(id: string, x: number, y: number) {
    const updated = markers.map((m) => (m.id === id ? { ...m, x, y } : m));
    await updateTask.mutateAsync({
      taskId: taskId!,
      data: { annotationMarkers: updated },
    });
  }

  async function confirmMarkerDelete() {
    if (!deleteMarkerTarget) return;
    const remaining = markers.filter((m) => m.id !== deleteMarkerTarget);
    await updateTask.mutateAsync({
      taskId: taskId!,
      data: { annotationMarkers: remaining.length > 0 ? remaining : null },
    });
    setDeleteMarkerTarget(null);
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
            <div className="flex items-center gap-2">
              {!editing && (
                <Button variant="secondary" size="sm" onClick={openEdit}>Edit</Button>
              )}
              <Badge variant={statusBadge[task.status]} size="md">
                {task.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {editing ? (
              <>
                <Input
                  label="Title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  error={!editForm.title.trim() ? 'Title is required' : undefined}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y"
                    placeholder="Task description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Priority"
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'high', label: 'High' },
                      { value: 'critical', label: 'Critical' },
                    ]}
                    value={editForm.priority}
                    onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                  />
                  <Input
                    label="Trade"
                    value={editForm.trade}
                    onChange={(e) => setEditForm((f) => ({ ...f, trade: e.target.value }))}
                    placeholder="e.g. Electrical, Plumbing..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={handleEditSave}
                    loading={updateTask.isPending}
                    disabled={!editForm.title.trim()}
                  >
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}

            {/* Contractor */}
            <div className="pt-2 border-t border-gray-200">
              <Select
                label="Contractor"
                options={userOptions}
                placeholder="Not assigned"
                value={task.assigned_to_user || ''}
                onChange={async (e) => {
                  await updateTask.mutateAsync({
                    taskId: taskId!,
                    data: { assignedToUser: e.target.value || null },
                  });
                }}
              />
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

      {/* Custom Fields */}
      <TaskCustomFields
        projectId={projectId!}
        taskId={taskId!}
        customFields={task.custom_fields || {}}
      />

      {/* Blueprint Annotation */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Blueprint Annotation</h2>
            <div className="flex gap-2">
              {activeBlueprint && !drawMode && !markerPlaceMode && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDrawMode(true)}
                  >
                    {taskAnnotation ? 'Redraw' : 'Draw Annotation'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMarkerPlaceMode(true)}
                  >
                    Add Marker
                  </Button>
                </>
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
              {activeBlueprint && markerPlaceMode && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMarkerPlaceMode(false)}
                >
                  Cancel
                </Button>
              )}
              {taskAnnotation && !drawMode && !markerPlaceMode && (
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
                markers={markers}
                markerPlaceMode={markerPlaceMode}
                onMarkerPlace={handleMarkerPlace}
                onMarkerMove={handleMarkerMove}
                onMarkerDelete={(id) => setDeleteMarkerTarget(id)}
                taskNumber={task.task_number}
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

      {/* Products Used */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Products Used ({Array.isArray(taskProducts) ? taskProducts.length : 0})
            </h2>
            <Button size="sm" onClick={() => { setShowProductPicker(true); setProductSearch(''); }}>
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {taskProductsLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : Array.isArray(taskProducts) && taskProducts.length > 0 ? (
            <div className="space-y-3">
              {taskProducts.map((tp: any) => (
                <div key={tp.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group">
                  {tp.thumbnail_download_url || tp.image_download_url ? (
                    <img
                      src={tp.thumbnail_download_url || tp.image_download_url}
                      alt={tp.product_name}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{tp.product_name}</div>
                    {tp.product_product_id && (
                      <div className="text-xs text-gray-500">ID: {tp.product_product_id}</div>
                    )}
                  </div>
                  {tp.product_link && (
                    <a
                      href={tp.product_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline shrink-0"
                    >
                      Link
                    </a>
                  )}
                  <button
                    onClick={() => setRemoveProductTarget({ taskId: taskId!, productId: tp.product_id, productName: tp.product_name })}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity shrink-0"
                    title="Remove product"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No products linked to this task.</p>
          )}
        </CardBody>
      </Card>

      {/* Product Picker Modal */}
      <Modal isOpen={showProductPicker} onClose={() => setShowProductPicker(false)} title="Add Product to Task" size="md">
        <div className="mb-4">
          <Input
            placeholder="Search products..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(() => {
            const allProducts = allProductsData?.data?.products ?? [];
            const linkedIds = new Set((Array.isArray(taskProducts) ? taskProducts : []).map((tp: any) => tp.product_id));
            const available = allProducts.filter((p: any) => !linkedIds.has(p.id));

            if (available.length === 0) {
              return (
                <p className="text-sm text-gray-500 text-center py-4">
                  {allProducts.length === 0 ? 'No products in catalog. Add products first.' : 'All products are already linked.'}
                </p>
              );
            }

            return available.map((product: any) => (
              <button
                key={product.id}
                onClick={async () => {
                  await addProductToTask.mutateAsync({ taskId: taskId!, productId: product.id });
                  setShowProductPicker(false);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left"
              >
                {product.thumbnail_download_url || product.image_download_url ? (
                  <img
                    src={product.thumbnail_download_url || product.image_download_url}
                    alt={product.name}
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{product.name}</div>
                  {product.product_id && <div className="text-xs text-gray-500">ID: {product.product_id}</div>}
                  {product.description && <div className="text-xs text-gray-500 truncate">{product.description}</div>}
                </div>
              </button>
            ));
          })()}
        </div>
      </Modal>

      {/* Remove Product Confirmation Modal */}
      <Modal isOpen={!!removeProductTarget} onClose={() => setRemoveProductTarget(null)} title="Remove Product" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to remove <strong>{removeProductTarget?.productName}</strong> from this task?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRemoveProductTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={removeProductFromTask.isPending}
            onClick={async () => {
              if (!removeProductTarget) return;
              await removeProductFromTask.mutateAsync({ taskId: removeProductTarget.taskId, productId: removeProductTarget.productId });
              setRemoveProductTarget(null);
            }}
          >
            Remove
          </Button>
        </div>
      </Modal>

      {/* Delete Marker Confirmation Modal */}
      <Modal isOpen={!!deleteMarkerTarget} onClose={() => setDeleteMarkerTarget(null)} title="Remove Marker" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to remove this marker from the blueprint?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteMarkerTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={updateTask.isPending}
            onClick={confirmMarkerDelete}
          >
            Remove
          </Button>
        </div>
      </Modal>

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

function TaskCustomFields({
  projectId,
  taskId,
  customFields: initialCustomFields,
}: {
  projectId: string;
  taskId: string;
  customFields: Record<string, unknown>;
}) {
  const { data: cfDefinitions = [] } = useCustomFieldDefinitions('task');
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(initialCustomFields);
  const [editing, setEditing] = useState(false);
  const updateTask = useUpdateTask(projectId);

  if (cfDefinitions.length === 0) return null;

  async function handleSave() {
    await updateTask.mutateAsync({
      taskId,
      data: { customFields },
    });
    setEditing(false);
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Custom Fields</h2>
          {!editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setCustomFields(initialCustomFields); }}>Cancel</Button>
              <Button size="sm" onClick={handleSave} loading={updateTask.isPending}>Save</Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardBody>
        {editing ? (
          <CustomFieldsRenderer
            definitions={cfDefinitions}
            values={customFields}
            onChange={(key, value) => setCustomFields((prev) => ({ ...prev, [key]: value }))}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {cfDefinitions.map((def: any) => (
              <div key={def.id}>
                <span className="text-gray-500">{def.label}:</span>{' '}
                <span className="text-gray-900">
                  {customFields[def.fieldKey] !== undefined && customFields[def.fieldKey] !== null && customFields[def.fieldKey] !== ''
                    ? def.fieldType === 'checkbox'
                      ? customFields[def.fieldKey] ? 'Yes' : 'No'
                      : String(customFields[def.fieldKey])
                    : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
