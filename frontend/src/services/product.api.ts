import api from './api';

export const productApi = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const res = await api.get('/products', { params });
    return res.data;
  },

  async getById(id: string) {
    const res = await api.get(`/products/${id}`);
    return res.data.data.product;
  },

  async create(data: { name: string; productId?: string; description?: string; link?: string; comment?: string }) {
    const res = await api.post('/products', data);
    return res.data.data.product;
  },

  async update(id: string, data: Record<string, unknown>) {
    const res = await api.patch(`/products/${id}`, data);
    return res.data.data.product;
  },

  async remove(id: string) {
    const res = await api.delete(`/products/${id}`);
    return res.data;
  },

  async requestImageUpload(productId: string, data: { fileName: string; fileSize: number; mimeType: string }) {
    const res = await api.post(`/products/${productId}/upload-url`, data);
    return res.data.data;
  },

  async confirmImage(productId: string) {
    const res = await api.post(`/products/${productId}/confirm-image`);
    return res.data.data.product;
  },

  // Task-product linking
  async listByTask(projectId: string, taskId: string) {
    const res = await api.get(`/projects/${projectId}/tasks/${taskId}/products`);
    return res.data.data.products;
  },

  async addToTask(projectId: string, taskId: string, productId: string) {
    const res = await api.post(`/projects/${projectId}/tasks/${taskId}/products`, { productId });
    return res.data.data.taskProduct;
  },

  async removeFromTask(projectId: string, taskId: string, productId: string) {
    const res = await api.delete(`/projects/${projectId}/tasks/${taskId}/products/${productId}`);
    return res.data;
  },

  async downloadTemplate() {
    const res = await api.get('/products/template', { responseType: 'blob' });
    triggerDownload(res.data, 'product-template.xlsx');
  },

  async exportProducts() {
    const res = await api.get('/products/export', { responseType: 'blob' });
    triggerDownload(res.data, 'products-export.xlsx');
  },

  async importProducts(file: File): Promise<{ created: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};

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
