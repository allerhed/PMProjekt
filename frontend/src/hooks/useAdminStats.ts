import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/admin.api';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
    staleTime: 60 * 1000,
  });
}

export function useAdminActivity() {
  return useQuery({
    queryKey: ['admin', 'activity'],
    queryFn: () => adminApi.getActivity(),
    staleTime: 30 * 1000,
  });
}
