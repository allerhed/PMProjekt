import api from './api';

export const commentApi = {
  async list(projectId: string, taskId: string) {
    const res = await api.get(`/projects/${projectId}/tasks/${taskId}/comments`);
    return res.data.data.comments;
  },

  async create(projectId: string, taskId: string, commentText: string) {
    const res = await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { commentText });
    return res.data.data.comment;
  },
};
