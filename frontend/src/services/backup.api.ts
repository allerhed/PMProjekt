import api from './api';

export interface Backup {
  id: string;
  organization_id: string;
  name: string;
  status: 'in_progress' | 'completed' | 'failed';
  file_key: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  triggered_by: 'manual' | 'scheduled';
  initiated_by: string | null;
  initiated_by_name: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupSettings {
  schedule_enabled: boolean;
  schedule_cron: string;
  retention_days: number;
}

export interface UpdateBackupSettingsData {
  scheduleEnabled: boolean;
  scheduleCron?: string;
  retentionDays?: number;
}

export const backupApi = {
  async listBackups(): Promise<Backup[]> {
    const res = await api.get('/admin/backups');
    return res.data.data.backups;
  },

  async createBackup(name?: string): Promise<{ backupId: string; status: string }> {
    const res = await api.post('/admin/backups', { name });
    return res.data.data;
  },

  async getDownloadUrl(backupId: string): Promise<string> {
    const res = await api.get(`/admin/backups/${backupId}/download`);
    return res.data.data.downloadUrl;
  },

  async deleteBackup(backupId: string): Promise<void> {
    await api.delete(`/admin/backups/${backupId}`);
  },

  async restoreBackup(backupId: string, tables?: string[]): Promise<void> {
    await api.post(`/admin/backups/${backupId}/restore`, { confirmRestore: true, ...(tables ? { tables } : {}) });
  },

  async listBackupTables(backupId: string): Promise<string[]> {
    const res = await api.get(`/admin/backups/${backupId}/tables`);
    return res.data.data.tables;
  },

  async getSettings(): Promise<BackupSettings> {
    const res = await api.get('/admin/backups/settings');
    return res.data.data.settings;
  },

  async updateSettings(data: UpdateBackupSettingsData): Promise<BackupSettings> {
    const res = await api.put('/admin/backups/settings', data);
    return res.data.data.settings;
  },
};
