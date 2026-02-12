import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser } from '../../hooks/useUsers';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import CustomFieldsRenderer from '../../components/common/CustomFieldsRenderer';

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

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  project_manager: 'Project Manager',
  field_user: 'Field User',
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getInitials(firstName: string, lastName: string) {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
}

// ─── User Card ───────────────────────────────────────────────────────
function UserCard({
  user,
  onEdit,
  onToggleActive,
  isToggling,
}: {
  user: any;
  onEdit: () => void;
  onToggleActive: () => void;
  isToggling: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-semibold">
          {getInitials(user.first_name, user.last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {user.first_name} {user.last_name}
          </h3>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={roleBadge[user.role] || 'gray'}>
          {roleLabel[user.role] || user.role}
        </Badge>
        <Badge variant={user.is_active ? 'green' : 'red'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Last login: {formatDate(user.last_login_at)}
      </p>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {user.is_active ? (
          <>
            {showConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Sure?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onToggleActive();
                    setShowConfirm(false);
                  }}
                  loading={isToggling}
                >
                  Yes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(true)}
              >
                Disable
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleActive}
            loading={isToggling}
          >
            Enable
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Edit User Modal ─────────────────────────────────────────────────
function EditUserModal({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}) {
  const [form, setForm] = useState({
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    email: user.email || '',
    role: user.role || 'field_user',
    newPassword: '',
  });
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    user.custom_fields || {},
  );
  const [error, setError] = useState('');
  const updateUser = useUpdateUser();
  const { data: cfDefinitions = [] } = useCustomFieldDefinitions('user');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const data: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
      };
      if (form.newPassword) {
        data.newPassword = form.newPassword;
      }
      if (Object.keys(customFields).length > 0) {
        data.customFields = customFields;
      }
      await updateUser.mutateAsync({ id: user.id, data });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to update user');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
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
          label="New Password"
          type="password"
          value={form.newPassword}
          onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
          helpText="Leave empty to keep current password"
        />
        <CustomFieldsRenderer
          definitions={cfDefinitions}
          values={customFields}
          onChange={(key, value) => setCustomFields((prev) => ({ ...prev, [key]: value }))}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={updateUser.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Invite User Modal ───────────────────────────────────────────────
function InviteUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', role: 'field_user', password: '',
  });
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const createUser = useCreateUser();
  const { data: cfDefinitions = [] } = useCustomFieldDefinitions('user');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createUser.mutateAsync({
        ...form,
        ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
      });
      onClose();
      setForm({ email: '', firstName: '', lastName: '', role: 'field_user', password: '' });
      setCustomFields({});
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
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          required
          helpText="The user should change this on first login."
        />
        <CustomFieldsRenderer
          definitions={cfDefinitions}
          values={customFields}
          onChange={(key, value) => setCustomFields((prev) => ({ ...prev, [key]: value }))}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createUser.isPending}>Invite User</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { data, isLoading } = useUsers();
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const updateUser = useUpdateUser();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const users = data?.data?.users || [];

  async function toggleActive(userId: string, currentActive: boolean) {
    setTogglingId(userId);
    try {
      await updateUser.mutateAsync({
        id: userId,
        data: { isActive: !currentActive },
      });
    } finally {
      setTogglingId(null);
    }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user: any) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={() => setEditingUser(user)}
              onToggleActive={() => toggleActive(user.id, user.is_active)}
              isToggling={togglingId === user.id}
            />
          ))}
        </div>
      )}

      <InviteUserModal isOpen={showInvite} onClose={() => setShowInvite(false)} />

      {editingUser && (
        <EditUserModal
          key={editingUser.id}
          isOpen
          onClose={() => setEditingUser(null)}
          user={editingUser}
        />
      )}
    </div>
  );
}
