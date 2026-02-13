import api from './api';

export interface ProjectNote {
  id: string;
  project_id: string;
  content: string;
  created_by: string;
  author_first_name: string;
  author_last_name: string;
  created_at: string;
  updated_at: string;
}

export const projectNoteApi = {
  async list(projectId: string, params?: { sortBy?: string; sortOrder?: string }) {
    const res = await api.get(`/projects/${projectId}/notes`, { params });
    return res.data.data.notes as ProjectNote[];
  },

  async create(projectId: string, data: { content: string }) {
    const res = await api.post(`/projects/${projectId}/notes`, data);
    return res.data.data.note as ProjectNote;
  },

  async update(projectId: string, noteId: string, data: { content: string }) {
    const res = await api.put(`/projects/${projectId}/notes/${noteId}`, data);
    return res.data.data.note as ProjectNote;
  },

  async remove(projectId: string, noteId: string) {
    const res = await api.delete(`/projects/${projectId}/notes/${noteId}`);
    return res.data;
  },
};
