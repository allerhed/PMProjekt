import api from './api';

export const adminApi = {
  async getStats() {
    const res = await api.get('/admin/stats');
    return res.data.data;
  },
  async getActivity(limit = 50) {
    const res = await api.get(`/admin/activity?limit=${limit}`);
    return res.data.data;
  },
  async recalculateStorage() {
    const res = await api.post('/admin/storage/recalculate');
    return res.data.data;
  },
};
