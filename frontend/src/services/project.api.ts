import api from './api';

export const projectApi = {
  async list(params?: { status?: string; page?: number; limit?: number }) {
    const res = await api.get('/projects', { params });
    return res.data;
  },

  async getById(id: string) {
    const res = await api.get(`/projects/${id}`);
    return res.data.data.project;
  },

  async create(data: { name: string; description?: string; address?: string; startDate?: string; targetCompletionDate?: string }) {
    const res = await api.post('/projects', data);
    return res.data.data.project;
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await api.patch(`/projects/${id}`, data);
    return res.data.data.project;
  },

  async archive(id: string) {
    const res = await api.delete(`/projects/${id}`);
    return res.data;
  },
};
