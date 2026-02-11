import { formatDistanceToNow } from 'date-fns';
import { useAdminStats, useAdminActivity } from '../../hooks/useAdminStats';
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

function getStorageColor(percent: number): string {
  if (percent > 90) return 'bg-red-500';
  if (percent > 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function formatAction(action: string, resourceType: string): string {
  // Audit log stores compound actions like 'task.created', 'user.login', 'blueprint.uploaded'
  const parts = action.split('.');
  const verb = parts.length > 1 ? parts[parts.length - 1] : action;

  const verbMap: Record<string, string> = {
    created: 'created',
    updated: 'updated',
    deleted: 'deleted',
    archived: 'archived',
    login: 'logged in',
    logout: 'logged out',
    status_changed: 'changed status of',
    assigned: 'assigned',
    uploaded: 'uploaded',
    invited: 'invited',
  };

  const resourceMap: Record<string, string> = {
    project: 'project',
    task: 'task',
    user: 'user',
    blueprint: 'blueprint',
    protocol: 'protocol',
    comment: 'comment',
    photo: 'photo',
    organization: 'organization',
  };

  const formattedVerb = verbMap[verb] || verb;
  const formattedResource = resourceMap[resourceType] || resourceType;

  if (verb === 'login' || verb === 'logout') {
    return formattedVerb;
  }

  return `${formattedVerb} ${formattedResource}`;
}

interface ActivityEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
}

interface AdminStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  openTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  verifiedTasks: number;
  totalUsers: number;
  activeUsers: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  storageUsedPercent: number;
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: activity, isLoading: activityLoading } = useAdminActivity();

  const s = stats as AdminStats | undefined;
  const activityEntries = (activity as ActivityEntry[] | undefined) || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {statsLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : s ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Projects Card */}
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-gray-500">Projects</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{s.activeProjects}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {s.activeProjects} active of {s.totalProjects} total
                </p>
                <div className="mt-2">
                  <Badge variant="green">{s.completedProjects} completed</Badge>
                </div>
              </CardBody>
            </Card>

            {/* Tasks Card */}
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-gray-500">Tasks</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{s.totalTasks}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="yellow">{s.openTasks} open</Badge>
                  <Badge variant="blue">{s.inProgressTasks} in progress</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="green">{s.completedTasks} done</Badge>
                  <Badge variant="purple">{s.verifiedTasks} verified</Badge>
                </div>
              </CardBody>
            </Card>

            {/* Users Card */}
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-gray-500">Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{s.activeUsers}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {s.activeUsers} active of {s.totalUsers} total
                </p>
              </CardBody>
            </Card>

            {/* Storage Card */}
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-gray-500">Storage</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {Math.round(s.storageUsedPercent)}%
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {formatBytes(s.storageUsedBytes)} of {formatBytes(s.storageLimitBytes)}
                </p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${getStorageColor(s.storageUsedPercent)}`}
                    style={{ width: `${Math.min(s.storageUsedPercent, 100)}%` }}
                  />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </CardHeader>
            <CardBody className="p-0">
              {activityLoading ? (
                <div className="flex justify-center py-8"><Spinner size="sm" /></div>
              ) : activityEntries.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No recent activity.</p>
              ) : (
                <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {activityEntries.map((entry) => (
                    <li key={entry.id} className="px-6 py-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">
                              {entry.user_first_name} {entry.user_last_name}
                            </span>{' '}
                            {formatAction(entry.action, entry.resource_type)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{entry.user_email}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        <p className="text-gray-500">Failed to load dashboard data.</p>
      )}
    </div>
  );
}
