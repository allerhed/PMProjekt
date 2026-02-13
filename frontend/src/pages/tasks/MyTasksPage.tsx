import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import Card, { CardBody } from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

const priorityBadge: Record<string, 'gray' | 'red' | 'yellow' | 'green' | 'blue'> = {
  low: 'gray',
  medium: 'blue',
  high: 'yellow',
  critical: 'red',
};

const statusBadge: Record<string, 'gray' | 'red' | 'yellow' | 'green' | 'blue' | 'purple'> = {
  open: 'blue',
  in_progress: 'yellow',
  completed: 'green',
  verified: 'purple',
};

interface TaskItem {
  id: string;
  project_id: string;
  project_name: string;
  task_number: number;
  title: string;
  status: string;
  priority: string;
  trade: string | null;
  created_at: string;
}

export default function MyTasksPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const res = await api.get('/users/me/tasks');
      return res.data;
    },
  });

  const tasks: TaskItem[] = data?.data?.tasks || [];

  // Group tasks by project
  const grouped = tasks.reduce<Record<string, { projectName: string; projectId: string; tasks: TaskItem[] }>>(
    (acc, task) => {
      if (!acc[task.project_id]) {
        acc[task.project_id] = {
          projectName: task.project_name,
          projectId: task.project_id,
          tasks: [],
        };
      }
      acc[task.project_id].tasks.push(task);
      return acc;
    },
    {},
  );

  const projectGroups = Object.values(grouped);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <span className="text-sm text-gray-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks assigned"
          description="You don't have any tasks assigned to you yet."
        />
      ) : (
        <div className="space-y-6">
          {projectGroups.map((group) => (
            <Card key={group.projectId}>
              <CardBody>
                <h2
                  className="text-base font-semibold text-gray-900 mb-3 cursor-pointer hover:text-primary-700"
                  onClick={() => navigate(`/projects/${group.projectId}`)}
                >
                  {group.projectName}
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    ({group.tasks.length})
                  </span>
                </h2>
                <div className="space-y-2">
                  {group.tasks.map((task) => {
                    const date = task.created_at ? new Date(task.created_at).toLocaleDateString() : '';
                    return (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/projects/${task.project_id}/tasks/${task.id}`)}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-gray-500 font-mono text-sm w-8 text-right flex-shrink-0">{task.task_number}</span>
                          <span className="text-gray-400 text-xs w-20 flex-shrink-0">{date}</span>
                          <p className="font-medium text-gray-900 truncate">{task.title}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                          <Badge variant={priorityBadge[task.priority] || 'gray'}>{task.priority}</Badge>
                          <Badge variant={statusBadge[task.status] || 'gray'}>{task.status.replace('_', ' ')}</Badge>
                          {task.trade && <span className="text-xs text-gray-500">{task.trade}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
