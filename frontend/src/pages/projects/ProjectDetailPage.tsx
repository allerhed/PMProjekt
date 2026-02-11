import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../hooks/useProjects';
import { useTasks, useCreateTask } from '../../hooks/useTasks';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card, { CardBody } from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import BlueprintList from '../../components/blueprints/BlueprintList';
import ProtocolPage from '../protocols/ProtocolPage';

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

  const [filters, setFilters] = useState<{ status?: string; search?: string }>({});
  const { data: taskData, isLoading: tasksLoading } = useTasks(projectId!, filters);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  if (projectLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-500">Project not found</div>;
  }

  const tasks = taskData?.data?.tasks || [];
  const taskCount = taskData?.meta?.pagination?.total || tasks.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/projects')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
          &larr; Back to Projects
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.address && <p className="text-gray-500 mt-1">{project.address}</p>}
          </div>
          <Badge variant={project.status === 'active' ? 'green' : 'gray'} size="md">
            {project.status}
          </Badge>
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
          {['tasks', 'blueprints', 'protocols'].map((tab) => (
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
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant={statusBadge[task.status] || 'gray'}>{task.status.replace('_', ' ')}</Badge>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">
            <span className="text-gray-400 font-mono text-sm mr-1">#{task.task_number}</span>
            {task.title}
          </p>
          {task.trade && <p className="text-xs text-gray-500">{task.trade}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <Badge variant={priorityBadge[task.priority] || 'gray'}>{task.priority}</Badge>
        {task.photo_count > 0 && (
          <span className="text-xs text-gray-400">{task.photo_count} photos</span>
        )}
        {task.comment_count > 0 && (
          <span className="text-xs text-gray-400">{task.comment_count} comments</span>
        )}
      </div>
    </div>
  );
}

function CreateTaskModal({ isOpen, onClose, projectId }: { isOpen: boolean; onClose: () => void; projectId: string }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', trade: '', assignedToContractorEmail: '' });
  const createTask = useCreateTask(projectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createTask.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        trade: form.trade || undefined,
        assignedToContractorEmail: form.assignedToContractorEmail || undefined,
      });
      onClose();
      setForm({ title: '', description: '', priority: 'normal', trade: '', assignedToContractorEmail: '' });
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
        <Input
          label="Contractor Email"
          type="email"
          value={form.assignedToContractorEmail}
          onChange={(e) => setForm((p) => ({ ...p, assignedToContractorEmail: e.target.value }))}
          placeholder="contractor@example.com"
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createTask.isPending}>Create Task</Button>
        </div>
      </form>
    </Modal>
  );
}
