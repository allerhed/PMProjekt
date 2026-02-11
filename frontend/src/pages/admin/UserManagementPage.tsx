import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser } from '../../hooks/useUsers';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const ROLE_OPTIONS = [
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'field_user', label: 'Field User' },
];

const roleBadge: Record<string, 'purple' | 'blue' | 'green' | 'red'> = {
  super_admin: 'red',
  org_admin: 'purple',
  project_manager: 'blue',
  field_user: 'green',
};

export default function UserManagementPage() {
  const { data, isLoading } = useUsers();
  const [showInvite, setShowInvite] = useState(false);
  const updateUser = useUpdateUser();

  const users = data?.data?.users || [];

  async function toggleActive(userId: string, currentActive: boolean) {
    await updateUser.mutateAsync({
      id: userId,
      data: { isActive: !currentActive },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <Button onClick={() => setShowInvite(true)}>Invite User</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users"
          description="Invite team members to get started."
          action={<Button onClick={() => setShowInvite(true)}>Invite User</Button>}
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={roleBadge[user.role] || 'gray'}>
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.is_active ? 'green' : 'red'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(user.id, user.is_active)}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteUserModal isOpen={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}

function InviteUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', role: 'field_user', password: '',
  });
  const createUser = useCreateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createUser.mutateAsync(form);
      onClose();
      setForm({ email: '', firstName: '', lastName: '', role: 'field_user', password: '' });
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={form.firstName}
            onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            required
          />
          <Input
            label="Last Name"
            value={form.lastName}
            onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            required
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
        />
        <Select
          label="Role"
          options={ROLE_OPTIONS}
          value={form.role}
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
        />
        <Input
          label="Temporary Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          required
          helpText="The user should change this on first login."
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createUser.isPending}>Invite User</Button>
        </div>
      </form>
    </Modal>
  );
}
