import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUsers, useCreateUser, useUpdateUser } from '../../hooks/useUsers';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields';
import { userApi } from '../../services/user.api';
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
  const [error, setError] = useState('');
  const createUser = useCreateUser();
  const { data: cfDefinitions = [] } = useCustomFieldDefinitions('user');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { password, ...rest } = form;
      await createUser.mutateAsync({
        ...rest,
        ...(password ? { password } : {}),
        ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
      });
      onClose();
      setForm({ email: '', firstName: '', lastName: '', role: 'field_user', password: '' });
      setCustomFields({});
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to create user');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite User">
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
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          helpText="Optional. Must have 8+ chars, uppercase, lowercase, number, and special character. Auto-generated if left empty."
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
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created?: number; errors?: { row: number; messages: string[] }[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const result = await userApi.importUsers(file);
      setImportResult({ created: result.created });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      const errors = err?.response?.data?.error?.details?.errors;
      if (errors) {
        setImportResult({ errors });
      } else {
        setImportResult({ errors: [{ row: 0, messages: ['Failed to import file. Make sure it is a valid .xlsx file.'] }] });
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => userApi.downloadTemplate()}>
            Template
          </Button>
          <Button variant="secondary" size="sm" onClick={() => importInputRef.current?.click()} loading={importing}>
            Import
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button onClick={() => setShowInvite(true)}>Invite User</Button>
        </div>
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

      {/* Import Result Modal */}
      <Modal isOpen={!!importResult} onClose={() => setImportResult(null)} title={importResult?.created ? 'Import Successful' : 'Import Errors'} size="md">
        {importResult?.created ? (
          <div className="text-center py-4">
            <div className="text-green-600 text-4xl font-bold mb-2">{importResult.created}</div>
            <p className="text-sm text-gray-600">users imported successfully</p>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setImportResult(null)}>Close</Button>
            </div>
          </div>
        ) : importResult?.errors ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              Fix the following errors in your spreadsheet and try again:
            </p>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Row</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {importResult.errors.map((err, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">{err.row || '-'}</td>
                      <td className="px-3 py-2 text-red-600">{err.messages.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setImportResult(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
