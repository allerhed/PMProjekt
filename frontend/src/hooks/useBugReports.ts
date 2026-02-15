import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bugReportApi, type CreateBugReportData, type UpdateBugReportData } from '../services/bugReport.api';

export function useBugReports(filters?: { page?: number; limit?: number; status?: string; priority?: string; search?: string }) {
  return useQuery({
    queryKey: ['bugReports', filters],
    queryFn: () => bugReportApi.list(filters),
  });
}

export function useBugReport(reportId: string) {
  return useQuery({
    queryKey: ['bugReport', reportId],
    queryFn: () => bugReportApi.getById(reportId),
    enabled: !!reportId,
  });
}

export function useBugReportOpenCount() {
  return useQuery({
    queryKey: ['bugReportCount'],
    queryFn: () => bugReportApi.getOpenCount(),
    staleTime: 60 * 1000,
  });
}

export function useCreateBugReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBugReportData) => bugReportApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugReports'] });
      queryClient.invalidateQueries({ queryKey: ['bugReportCount'] });
    },
  });
}

export function useUpdateBugReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, data }: { reportId: string; data: UpdateBugReportData }) =>
      bugReportApi.update(reportId, data),
    onSuccess: (_, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['bugReports'] });
      queryClient.invalidateQueries({ queryKey: ['bugReport', reportId] });
      queryClient.invalidateQueries({ queryKey: ['bugReportCount'] });
    },
  });
}

export function useDeleteBugReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => bugReportApi.remove(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugReports'] });
      queryClient.invalidateQueries({ queryKey: ['bugReportCount'] });
    },
  });
}
