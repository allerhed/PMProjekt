import axios from 'axios';
import type { AxiosError, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
  meta: { timestamp: string; requestId: string; pagination?: unknown };
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: unwrap envelope
api.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    // Return the full envelope for paginated responses, just data for others
    return response;
  },
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    if (error.response?.status === 401) {
      // Redirect to login on auth failure (unless already on auth page)
      if (!window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/register') &&
          !window.location.pathname.startsWith('/forgot-password') &&
          !window.location.pathname.startsWith('/reset-password')) {
        window.location.href = '/login';
      }
    }

    const apiError = error.response?.data?.error;
    const message = apiError?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  },
);

export default api;
