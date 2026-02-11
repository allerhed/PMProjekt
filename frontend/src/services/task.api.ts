import api from './api';

export interface TaskFilters {
  status?: string;
  priority?: string;
  trade?: string;
  assignedToMe?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const taskApi = {
  async list(projectId: string, filters?: TaskFilters) {
    const params: Record<string, unknown> = { ...filters };
    if (filters?.assignedToMe) params.assignedToMe = 'true';
    const res = await api.get(`/projects/${projectId}/tasks`, { params });
    return res.data;
  },

  async getById(projectId: string, taskId: string) {
    const res = await api.get(`/projects/${projectId}/tasks/${taskId}`);
    return res.data.data.task;
  },

  async create(projectId: string, data: {
    title: string;
    description?: string;
    priority?: string;
    trade?: string;
    assignedToUser?: string;
    assignedToContractorEmail?: string;
    blueprintId?: string;
    locationX?: number;
    locationY?: number;
  }) {
    const res = await api.post(`/projects/${projectId}/tasks`, data);
    return res.data.data.task;
  },

  async update(projectId: string, taskId: string, data: Record<string, unknown>) {
    const res = await api.patch(`/projects/${projectId}/tasks/${taskId}`, data);
    return res.data.data.task;
  },

  async remove(projectId: string, taskId: string) {
    const res = await api.delete(`/projects/${projectId}/tasks/${taskId}`);
    return res.data;
  },

  async listByBlueprint(projectId: string, blueprintId: string) {
    const res = await api.get(`/projects/${projectId}/tasks/by-blueprint/${blueprintId}`);
    return res.data.data.tasks;
  },
};
