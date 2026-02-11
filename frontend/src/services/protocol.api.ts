import api from './api';

export interface ProtocolFilters {
  status?: string;
  trade?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface GenerateProtocolData {
  name: string;
  filters?: ProtocolFilters;
}

export interface Protocol {
  id: string;
  name: string;
  status: 'generating' | 'completed' | 'failed';
  download_url?: string;
  created_at: string;
  updated_at: string;
}

export const protocolApi = {
  async generateProtocol(projectId: string, data: GenerateProtocolData) {
    const res = await api.post(`/projects/${projectId}/protocols/generate`, data);
    return res.data.data;
  },

  async listProtocols(projectId: string): Promise<Protocol[]> {
    const res = await api.get(`/projects/${projectId}/protocols`);
    return res.data.data.protocols;
  },

  async getProtocol(projectId: string, protocolId: string): Promise<Protocol> {
    const res = await api.get(`/projects/${projectId}/protocols/${protocolId}`);
    return res.data.data;
  },
};
