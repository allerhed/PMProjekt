import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupApi } from '../services/backup.api';
import type { UpdateBackupSettingsData } from '../services/backup.api';

export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: () => backupApi.listBackups(),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasInProgress = data?.some((b) => b.status === 'in_progress');
      return hasInProgress ? 3000 : false;
    },
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) => backupApi.createBackup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (backupId: string) => backupApi.deleteBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ backupId, tables }: { backupId: string; tables?: string[] }) =>
      backupApi.restoreBackup(backupId, tables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useBackupTables(backupId: string | null) {
  return useQuery({
    queryKey: ['backupTables', backupId],
    queryFn: () => backupApi.listBackupTables(backupId!),
    enabled: !!backupId,
  });
}

export function useBackupSettings() {
  return useQuery({
    queryKey: ['backupSettings'],
    queryFn: () => backupApi.getSettings(),
  });
}

export function useUpdateBackupSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateBackupSettingsData) => backupApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backupSettings'] });
    },
  });
}
