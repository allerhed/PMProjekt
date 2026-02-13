import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useProjects } from '../../hooks/useProjects';
import { useUsers } from '../../hooks/useUsers';
import Button from '../../components/ui/Button';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

export default function TaskReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: projectsData } = useProjects({ limit: 200 });
  const { data: usersData } = useUsers({ limit: 200 });

  const projects = projectsData?.data?.projects || [];
  const users = usersData?.data?.users || [];

  const projectOptions = projects.map((p: any) => ({ value: p.id, label: p.name }));
  const userOptions = users.map((u: any) => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name}`,
  }));

  const queryParams: Record<string, string> = {};
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;
  if (projectId) queryParams.projectId = projectId;
  if (userId) queryParams.userId = userId;

  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['admin', 'task-report', queryParams],
    queryFn: async () => {
      const res = await api.get('/admin/reports/tasks', { params: queryParams });
      return res.data;
    },
    enabled: submitted && !!startDate && !!endDate,
  });

  const tasks = reportData?.data?.tasks || [];
  const count = reportData?.data?.count || 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (startDate && endDate) {
      setSubmitted(true);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Task Report</h1>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setSubmitted(false); }}
                required
              />
              <Input
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setSubmitted(false); }}
                required
              />
              <Select
                label="Project"
                options={projectOptions}
                placeholder="All projects"
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setSubmitted(false); }}
              />
              <Select
                label="User"
                options={userOptions}
                placeholder="All users"
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setSubmitted(false); }}
              />
            </div>
            <Button type="submit">Generate Report</Button>
          </form>
        </CardBody>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm mb-4">
          Failed to load report.
        </div>
      )}

      {submitted && !isLoading && !error && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Results</h2>
              <span className="text-sm text-gray-500">{count} task{count !== 1 ? 's' : ''}</span>
            </div>
          </CardHeader>
          <CardBody>
            {tasks.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No tasks found for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trade</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((task: any) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-500 font-mono">{task.task_number}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{task.project_name}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{task.title}</td>
                        <td className="px-3 py-2">
                          <Badge variant={priorityBadge[task.priority] || 'gray'}>{task.priority}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadge[task.status] || 'gray'}>{task.status.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">{task.trade || '-'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {task.assignee_first_name
                            ? `${task.assignee_first_name} ${task.assignee_last_name || ''}`
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">{formatDate(task.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
