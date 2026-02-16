import api from './api';

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const userApi = {
  async list(params?: { role?: string; search?: string; page?: number; limit?: number }) {
    const res = await api.get('/users', { params });
    return res.data;
  },

  async create(data: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    password?: string;
    customFields?: Record<string, unknown>;
  }) {
    const res = await api.post('/users', data);
    return res.data.data.user;
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await api.patch(`/users/${id}`, data);
    return res.data.data.user;
  },

  async deactivate(id: string) {
    const res = await api.patch(`/users/${id}`, { isActive: false });
    return res.data.data.user;
  },

  async downloadTemplate() {
    const res = await api.get('/users/template', { responseType: 'blob' });
    triggerDownload(res.data, 'user-template.xlsx');
  },

  async importUsers(file: File): Promise<{ created: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/users/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};
