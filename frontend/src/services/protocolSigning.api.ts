import api from './api';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export interface SigningLink {
  signingUrl: string;
  token: string;
}

export interface ProtocolSignature {
  id: string;
  protocol_id: string;
  signer_name: string | null;
  signer_email: string | null;
  signed_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface PublicSigningInfo {
  protocolName: string;
  generatedAt: string;
  downloadUrl: string;
}

export const protocolSigningApi = {
  async createSigningLink(projectId: string, protocolId: string, email?: string): Promise<SigningLink> {
    const res = await api.post(
      `/projects/${projectId}/protocols/${protocolId}/signing-links`,
      email ? { email } : {},
    );
    return res.data.data;
  },

  async getSignatures(projectId: string, protocolId: string): Promise<ProtocolSignature[]> {
    const res = await api.get(`/projects/${projectId}/protocols/${protocolId}/signatures`);
    return res.data.data.signatures;
  },

  // Public endpoints (no auth required)
  async getPublicSigningInfo(token: string): Promise<PublicSigningInfo> {
    const res = await axios.get(`${API_BASE_URL}/public/sign/${token}`);
    return res.data.data;
  },

  async submitPublicSignature(
    token: string,
    data: { signerName: string; signerEmail: string; signatureData: string },
  ): Promise<void> {
    await axios.post(`${API_BASE_URL}/public/sign/${token}`, data);
  },
};
