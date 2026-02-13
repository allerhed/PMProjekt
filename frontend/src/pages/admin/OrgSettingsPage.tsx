import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useFileUpload } from '../../hooks/useFileUpload';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card, { CardBody, CardHeader } from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';

interface OrgData {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  logo_download_url: string | null;
  logo_thumbnail_download_url: string | null;
  primary_color: string | null;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  created_at: string;
  updated_at: string;
}

interface OrgFormState {
  name: string;
  primaryColor: string;
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
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: { name?: string; primaryColor?: string }) => {
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

  const handleRequestUrl = useCallback(async (file: File) => {
    const res = await api.post('/organizations/current/upload-url', {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    return { uploadUrl: res.data.data.uploadUrl, resourceId: res.data.data.organizationId };
  }, []);

  const handleConfirmLogo = useCallback(async () => {
    await api.post('/organizations/current/confirm-logo');
    queryClient.invalidateQueries({ queryKey: ['organization', 'current'] });
  }, [queryClient]);

  const { state: uploadState, progress, error: uploadError, upload } = useFileUpload({
    onRequestUrl: handleRequestUrl,
    onConfirm: handleConfirmLogo,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    mutation.mutate({
      name: form.name || undefined,
      primaryColor: form.primaryColor || undefined,
    });
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      upload(file);
    }
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

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Logo</label>
                <div className="flex items-center gap-4">
                  {(data.logo_thumbnail_download_url || data.logo_download_url) && uploadState !== 'done' ? (
                    <img
                      src={data.logo_thumbnail_download_url || data.logo_download_url!}
                      alt="Organization logo"
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                    />
                  ) : uploadState === 'done' ? (
                    <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 text-xs font-medium">Uploaded</span>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-400 text-xl font-bold">{data.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleLogoSelect}
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
                    {uploadState === 'done' && <p className="text-xs text-green-600 mt-1">Logo uploaded successfully</p>}
                    {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
                  </div>
                </div>
              </div>

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
