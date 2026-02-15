import api from './api';

export interface CreateBugReportData {
  title: string;
  description?: string;
  stepsToReproduce?: string;
  priority?: string;
  screenshotBase64?: string | null;
  consoleLogs?: Array<{ level: string; message: string; timestamp: string }>;
  metadata?: Record<string, unknown>;
}

export interface UpdateBugReportData {
  title?: string;
  description?: string | null;
  stepsToReproduce?: string | null;
  status?: string;
  priority?: string;
  assignedTo?: string | null;
  resolutionNotes?: string | null;
}

export const bugReportApi = {
  async list(params?: { page?: number; limit?: number; status?: string; priority?: string; search?: string }) {
    const res = await api.get('/bug-reports', { params });
    return res.data;
  },

  async getById(reportId: string) {
    const res = await api.get(`/bug-reports/${reportId}`);
    return res.data.data;
  },

  async create(data: CreateBugReportData) {
    const res = await api.post('/bug-reports', data);
    return res.data.data;
  },

  async update(reportId: string, data: UpdateBugReportData) {
    const res = await api.patch(`/bug-reports/${reportId}`, data);
    return res.data.data;
  },

  async remove(reportId: string) {
    const res = await api.delete(`/bug-reports/${reportId}`);
    return res.data;
  },

  async getOpenCount() {
    const res = await api.get('/bug-reports/count');
    return res.data.data.count as number;
  },
};
