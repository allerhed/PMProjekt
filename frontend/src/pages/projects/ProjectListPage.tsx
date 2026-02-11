import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, useCreateProject } from '../../hooks/useProjects';
import Button from '../../components/ui/Button';
import Card, { CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export default function ProjectListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading, error } = useProjects(statusFilter ? { status: statusFilter } : undefined);
  const [showCreate, setShowCreate] = useState(false);

  const projects = data?.data?.projects || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <Button onClick={() => setShowCreate(true)}>New Project</Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6">
        {['', 'active', 'completed', 'archived'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 rounded-lg text-red-700 text-sm">
          Failed to load projects: {(error as Error).message}
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <EmptyState
          title="No projects"
          description="Create your first project to get started."
          action={<Button onClick={() => setShowCreate(true)}>New Project</Button>}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project: any) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      <CreateProjectModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

function ProjectCard({ project }: { project: any }) {
  const navigate = useNavigate();
  const totalTasks = project.total_tasks || 0;
  const completed = (project.completed_tasks || 0) + (project.verified_tasks || 0);
  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  const statusColors: Record<string, 'green' | 'blue' | 'gray'> = {
    active: 'green',
    completed: 'blue',
    archived: 'gray',
  };
  const statusVariant = statusColors[project.status as string] || 'gray';

  return (
    <Card hoverable onClick={() => navigate(`/projects/${project.id}`)}>
      <CardBody>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
          <Badge variant={statusVariant}>{project.status}</Badge>
        </div>

        {project.address && (
          <p className="text-sm text-gray-500 mb-3 truncate">{project.address}</p>
        )}

        {/* Task stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{totalTasks} tasks</span>
            <span>{completionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="text-red-600">{project.open_tasks || 0} open</span>
            <span className="text-yellow-600">{project.in_progress_tasks || 0} in progress</span>
            <span className="text-green-600">{project.completed_tasks || 0} done</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CreateProjectModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', address: '', startDate: '', targetCompletionDate: '' });
  const createProject = useCreateProject();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createProject.mutateAsync(form);
      onClose();
      setForm({ name: '', description: '', address: '', startDate: '', targetCompletionDate: '' });
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
          placeholder="e.g., Building Renovation"
        />
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Brief project description"
        />
        <Input
          label="Address"
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          placeholder="Project location"
        />
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
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createProject.isPending}>Create Project</Button>
        </div>
      </form>
    </Modal>
  );
}
