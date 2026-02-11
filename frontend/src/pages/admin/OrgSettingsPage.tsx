import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';

interface OrgData {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  primary_color: string | null;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  created_at: string;
  updated_at: string;
}

interface OrgFormState {
  name: string;
  primaryColor: string;
  logoUrl: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function OrgSettingsPage() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<OrgFormState>({
    name: '',
    primaryColor: '',
    logoUrl: '',
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['organization', 'current'],
    queryFn: async () => {
      const res = await api.get<{ data: { organization: OrgData } }>('/organizations/current');
      return res.data.data.organization;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        primaryColor: data.primary_color || '',
        logoUrl: data.logo_url || '',
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: { name?: string; primaryColor?: string; logoUrl?: string }) => {
      const res = await api.patch('/organizations/current', payload);
      return res.data;
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Organization settings saved successfully.' });
      queryClient.invalidateQueries({ queryKey: ['organization', 'current'] });
    },
    onError: (err: Error) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to save settings.' });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    mutation.mutate({
      name: form.name || undefined,
      primaryColor: form.primaryColor || undefined,
      logoUrl: form.logoUrl || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return <p className="text-gray-500">Failed to load organization settings.</p>;
  }

  const storagePercent = data.storage_limit_bytes > 0
    ? (data.storage_used_bytes / data.storage_limit_bytes) * 100
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Organization Settings</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editable Settings */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">General Settings</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Organization Name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <Input
                label="Primary Color"
                value={form.primaryColor}
                onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                placeholder="#3B82F6"
                helpText="Hex color code (e.g. #3B82F6)"
              />
              {form.primaryColor && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: form.primaryColor }}
                  />
                  <span className="text-sm text-gray-500">{form.primaryColor}</span>
                </div>
              )}
              <Input
                label="Logo URL"
                value={form.logoUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                placeholder="https://example.com/logo.png"
                helpText="URL to your organization logo"
              />

              {feedback && (
                <div
                  className={
                    feedback.type === 'success'
                      ? 'rounded-lg bg-green-50 border border-green-200 text-green-800 px-4 py-3 text-sm'
                      : 'rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm'
                  }
                >
                  {feedback.message}
                </div>
              )}

              <div className="pt-2">
                <Button type="submit" loading={mutation.isPending}>
                  Save Settings
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Read-only Info */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Organization Info</h2>
          </CardHeader>
          <CardBody>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Subdomain</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.subdomain}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Storage</dt>
                <dd className="mt-1">
                  <p className="text-sm text-gray-900">
                    {formatBytes(data.storage_used_bytes)} of {formatBytes(data.storage_limit_bytes)} used
                  </p>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        storagePercent > 90
                          ? 'bg-red-500'
                          : storagePercent > 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(storagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{Math.round(storagePercent)}% used</p>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(data.created_at)}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(data.updated_at)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
