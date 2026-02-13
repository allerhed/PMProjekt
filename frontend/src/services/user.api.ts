import api from './api';

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
};
