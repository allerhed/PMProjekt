import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useUpdateProject } from '../../hooks/useProjects';
import { useTasks, useCreateTask } from '../../hooks/useTasks';
import { useUsers } from '../../hooks/useUsers';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types';
import { projectApi } from '../../services/project.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardBody } from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import BlueprintList from '../../components/blueprints/BlueprintList';
import NoteList from '../../components/notes/NoteList';
import ProtocolPage from '../protocols/ProtocolPage';
import CustomFieldsRenderer from '../../components/common/CustomFieldsRenderer';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'verified', label: 'Verified' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const SORT_OPTIONS = [
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'user', label: 'User' },
];

const PROJECT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const statusBadge: Record<string, 'red' | 'yellow' | 'green' | 'blue'> = {
  open: 'red',
  in_progress: 'yellow',
  completed: 'green',
  verified: 'blue',
};

const priorityBadge: Record<string, 'gray' | 'yellow' | 'red' | 'purple'> = {
  low: 'gray',
  normal: 'gray',
  high: 'yellow',
  critical: 'red',
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(projectId!);
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ORG_ADMIN || user?.role === UserRole.PROJECT_MANAGER;

  const [filters, setFilters] = useState<{ status?: string; search?: string }>({});
  const [sortBy, setSortBy] = useState<string>('number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { data: taskData, isLoading: tasksLoading } = useTasks(projectId!, filters);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  if (projectLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-500">Project not found</div>;
  }

  const rawTasks = taskData?.data?.tasks || [];
  const taskCount = taskData?.meta?.pagination?.total || rawTasks.length;

  const tasks = [...rawTasks].sort((a: any, b: any) => {
    let cmp = 0;
    switch (sortBy) {
      case 'date': {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        cmp = da - db;
        break;
      }
      case 'user': {
        const na = (a.assignee_first_name || '').toLowerCase();
        const nb = (b.assignee_first_name || '').toLowerCase();
        cmp = na.localeCompare(nb);
        break;
      }
      default:
        cmp = (a.task_number || 0) - (b.task_number || 0);
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/projects')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
          &larr; Back to Projects
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Project Image */}
            {project.thumbnail_download_url || project.image_download_url ? (
              <img
                src={project.thumbnail_download_url || project.image_download_url}
                alt={project.name}
                className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-600 text-xl font-bold">{project.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.address && <p className="text-gray-500 mt-0.5">{project.address}</p>}
              {project.description && <p className="text-sm text-gray-600 mt-1">{project.description}</p>}
              {project.responsible_user_name && (
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium">Responsible:</span> {project.responsible_user_name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={project.status === 'active' ? 'green' : 'gray'} size="md">
              {project.status}
            </Badge>
            {canEdit && (
              <Button variant="secondary" onClick={() => setShowEditProject(true)}>
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open" value={project.open_tasks || 0} color="text-red-600" />
        <StatCard label="In Progress" value={project.in_progress_tasks || 0} color="text-yellow-600" />
        <StatCard label="Completed" value={project.completed_tasks || 0} color="text-green-600" />
        <StatCard label="Verified" value={project.verified_tasks || 0} color="text-blue-600" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4">
          {['tasks', 'blueprints', 'protocols', 'notes'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'tasks' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Input
              placeholder="Search tasks..."
              value={filters.search || ''}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
              className="max-w-xs"
            />
            <Select
              options={STATUS_OPTIONS}
              value={filters.status || ''}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
              placeholder="Status"
              className="max-w-[150px]"
            />
            <Select
              options={SORT_OPTIONS}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="max-w-[140px]"
            />
            <button
              type="button"
              onClick={() => setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 5a.75.75 0 01.75.75v6.638l1.96-2.158a.75.75 0 111.08 1.04l-3.25 3.5a.75.75 0 01-1.08 0l-3.25-3.5a.75.75 0 111.08-1.04l1.96 2.158V5.75A.75.75 0 0110 5z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 15a.75.75 0 01-.75-.75V7.612L7.29 9.77a.75.75 0 01-1.08-1.04l3.25-3.5a.75.75 0 011.08 0l3.25 3.5a.75.75 0 11-1.08 1.04l-1.96-2.158v6.638A.75.75 0 0110 15z" clipRule="evenodd" />
                </svg>
              )}
              {sortOrder === 'asc' ? 'Asc' : 'Desc'}
            </button>
            <div className="flex-1" />
            <Button onClick={() => setShowCreateTask(true)}>Add Task</Button>
          </div>

          {/* Task list */}
          {tasksLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : tasks.length === 0 ? (
            <EmptyState
              title="No tasks"
              description="Create your first task for this project."
              action={<Button onClick={() => setShowCreateTask(true)}>Add Task</Button>}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-2">{taskCount} tasks</p>
              {tasks.map((task: any) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                />
              ))}
            </div>
          )}

          <CreateTaskModal
            isOpen={showCreateTask}
            onClose={() => setShowCreateTask(false)}
            projectId={projectId!}
          />
        </>
      )}

      {activeTab === 'blueprints' && (
        <BlueprintList projectId={projectId!} />
      )}

      {activeTab === 'protocols' && (
        <ProtocolPage projectId={projectId!} />
      )}

      {activeTab === 'notes' && (
        <NoteList projectId={projectId!} />
      )}

      {showEditProject && (
        <EditProjectModal
          isOpen={showEditProject}
          onClose={() => setShowEditProject(false)}
          project={project}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardBody className="text-center py-3">
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </CardBody>
    </Card>
  );
}

function TaskRow({ task, onClick }: { task: any; onClick: () => void }) {
  const date = task.created_at ? new Date(task.created_at).toLocaleDateString() : '';
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-gray-500 font-mono text-sm w-8 text-right flex-shrink-0">{task.task_number}</span>
        <span className="text-gray-400 text-xs w-20 flex-shrink-0">{date}</span>
        <p className="font-medium text-gray-900 truncate">{task.title}</p>
      </div>
      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        <Badge variant={priorityBadge[task.priority] || 'gray'}>{task.priority}</Badge>
        {task.trade && <span className="text-xs text-gray-500">{task.trade}</span>}
      </div>
    </div>
  );
}

function CreateTaskModal({ isOpen, onClose, projectId }: { isOpen: boolean; onClose: () => void; projectId: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: usersData } = useUsers({ limit: 200 });
  const users = usersData?.data?.users || [];
  const userOptions = users.map((u: any) => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name}`,
  }));

  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', trade: '', assignedToUser: currentUser?.userId || '' });
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const createTask = useCreateTask(projectId);
  const { data: cfDefinitions = [] } = useCustomFieldDefinitions('task');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createTask.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        trade: form.trade || undefined,
        assignedToUser: form.assignedToUser || undefined,
        ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
      });
      onClose();
      setForm({ title: '', description: '', priority: 'normal', trade: '', assignedToUser: currentUser?.userId || '' });
      setCustomFields({});
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          required
          placeholder="Describe the issue or task"
        />
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Additional details"
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
          />
          <Input
            label="Trade"
            value={form.trade}
            onChange={(e) => setForm((p) => ({ ...p, trade: e.target.value }))}
            placeholder="e.g., Electrical"
          />
        </div>
        <Select
          label="Contractor"
          options={userOptions}
          placeholder="Select user"
          value={form.assignedToUser}
          onChange={(e) => setForm((p) => ({ ...p, assignedToUser: e.target.value }))}
        />
        <CustomFieldsRenderer
          definitions={cfDefinitions}
          values={customFields}
          onChange={(key, value) => setCustomFields((prev) => ({ ...prev, [key]: value }))}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createTask.isPending}>Create Task</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditProjectModal({ isOpen, onClose, project }: { isOpen: boolean; onClose: () => void; project: any }) {
  const [form, setForm] = useState({
    name: project.name || '',
    description: project.description || '',
    address: project.address || '',
    status: project.status || 'active',
    startDate: project.start_date || '',
    targetCompletionDate: project.target_completion_date || '',
    responsibleUserId: project.responsible_user_id || '',
  });
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(project.custom_fields || {});

  const updateProject = useUpdateProject();
  const { data: usersData } = useUsers({ limit: 100 });
  const { data: cfDefinitions = [] } = useCustomFieldDefinitions('project');
  const users = usersData?.data?.users || [];
  const userOptions = [
    { value: '', label: 'None' },
    ...users.map((u: any) => ({
      value: u.id,
      label: `${u.first_name} ${u.last_name}`,
    })),
  ];

  const handleRequestUrl = useCallback(async (file: File) => {
    const result = await projectApi.requestImageUpload(project.id, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    return { uploadUrl: result.uploadUrl, resourceId: result.projectId };
  }, [project.id]);

  const handleConfirm = useCallback(async () => {
    await projectApi.confirmImage(project.id);
  }, [project.id]);

  const { state: uploadState, progress, error: uploadError, upload } = useFileUpload({
    onRequestUrl: handleRequestUrl,
    onConfirm: handleConfirm,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          name: form.name,
          description: form.description || null,
          address: form.address || null,
          status: form.status,
          startDate: form.startDate || null,
          targetCompletionDate: form.targetCompletionDate || null,
          responsibleUserId: form.responsibleUserId || null,
          ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        },
      });
      onClose();
    } catch {
      // Error handled by mutation
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      upload(file);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Project Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Image</label>
          <div className="flex items-center gap-4">
            {(project.thumbnail_download_url || project.image_download_url) && uploadState !== 'done' ? (
              <img
                src={project.thumbnail_download_url || project.image_download_url}
                alt="Project"
                className="w-16 h-16 rounded-lg object-cover border border-gray-200"
              />
            ) : uploadState === 'done' ? (
              <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-xs font-medium">Uploaded</span>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400 text-xl font-bold">{project.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                disabled={uploadState === 'uploading' || uploadState === 'confirming'}
              />
              {uploadState === 'uploading' && (
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-primary-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Uploading... {progress}%</p>
                </div>
              )}
              {uploadState === 'confirming' && <p className="text-xs text-gray-500 mt-1">Processing...</p>}
              {uploadState === 'done' && <p className="text-xs text-green-600 mt-1">Image uploaded successfully</p>}
              {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
            </div>
          </div>
        </div>

        <Input
          label="Project Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Project description"
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
        <Input
          label="Address"
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          placeholder="Project location"
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            options={PROJECT_STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          />
          <Select
            label="Responsible"
            options={userOptions}
            value={form.responsibleUserId}
            onChange={(e) => setForm((p) => ({ ...p, responsibleUserId: e.target.value }))}
            placeholder="Select user"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
          />
          <Input
            label="Target Completion"
            type="date"
            value={form.targetCompletionDate}
            onChange={(e) => setForm((p) => ({ ...p, targetCompletionDate: e.target.value }))}
          />
        </div>
        <CustomFieldsRenderer
          definitions={cfDefinitions}
          values={customFields}
          onChange={(key, value) => setCustomFields((prev) => ({ ...prev, [key]: value }))}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={updateProject.isPending}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
