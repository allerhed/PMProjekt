import api from './api';

export const uploadApi = {
  async requestBlueprintUpload(projectId: string, data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    name: string;
  }) {
    const res = await api.post(`/projects/${projectId}/blueprints/upload-url`, data);
    return res.data.data;
  },

  async confirmBlueprint(projectId: string, blueprintId: string) {
    const res = await api.post(`/projects/${projectId}/blueprints/${blueprintId}/confirm`);
    return res.data.data;
  },

  async deleteBlueprint(projectId: string, blueprintId: string) {
    const res = await api.delete(`/projects/${projectId}/blueprints/${blueprintId}`);
    return res.data;
  },

  async listBlueprints(projectId: string) {
    const res = await api.get(`/projects/${projectId}/blueprints`);
    return res.data.data.blueprints;
  },

  async requestPhotoUpload(projectId: string, taskId: string, data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    caption?: string;
  }) {
    const res = await api.post(`/projects/${projectId}/tasks/${taskId}/photos/upload-url`, data);
    return res.data.data;
  },

  async confirmPhoto(projectId: string, taskId: string, photoId: string) {
    const res = await api.post(`/projects/${projectId}/tasks/${taskId}/photos/${photoId}/confirm`);
    return res.data.data;
  },

  async deletePhoto(projectId: string, taskId: string, photoId: string) {
    const res = await api.delete(`/projects/${projectId}/tasks/${taskId}/photos/${photoId}`);
    return res.data;
  },

  async listPhotos(projectId: string, taskId: string) {
    const res = await api.get(`/projects/${projectId}/tasks/${taskId}/photos`);
    return res.data.data.photos;
  },
};
