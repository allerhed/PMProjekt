import api from './api';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  organizationName: string;
  subdomain: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthUser {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
}

export const authApi = {
  async login(data: LoginData): Promise<AuthUser> {
    const res = await api.post('/auth/login', data);
    return res.data.data.user;
  },

  async register(data: RegisterData): Promise<AuthUser> {
    const res = await api.post('/auth/register', data);
    return res.data.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<AuthUser> {
    const res = await api.get('/auth/me');
    return res.data.data.user;
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await api.post('/auth/reset-password', { token, password });
  },
};
