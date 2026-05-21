/**
 * Data Backup & Export
 * Allows users to export their vault data as JSON for safekeeping
 */

import { AppState } from '../types';

export interface BackupData {
  version: string;
  exportedAt: string;
  vaultId: string;
  identity: 'Batman' | 'Princess';
  data: Partial<AppState>;
}

/**
 * Generate a complete backup of vault data
 */
export function createBackup(state: AppState): BackupData {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    vaultId: state.vaultId || 'unknown',
    identity: state.identity || 'Batman',
    data: {
      messages: state.messages,
      aiMemory: state.aiMemory,
      events: state.events,
      moods: state.moods,
      letters: state.letters,
      sanctuaryChat: state.sanctuaryChat,
      batmanName: state.batmanName,
      princessName: state.princessName,
      daysTogether: state.daysTogether,
      relationshipStartDate: state.relationshipStartDate,
      theme: state.theme,
      font: state.font,
    },
  };
}

/**
 * Export backup as JSON file
 */
export function downloadBackupFile(backup: BackupData): void {
  try {
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sanctuary-backup-${backup.vaultId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('[Backup] Backup downloaded successfully');
  } catch (e) {
    console.error('[Backup] Failed to download backup:', e);
    throw e;
  }
}

/**
 * Validate backup file format
 */
export function validateBackup(data: any): data is BackupData {
  return (
    data &&
    typeof data === 'object' &&
    data.version &&
    data.exportedAt &&
    data.vaultId &&
    data.identity &&
    data.data
  );
}

/**
 * Import backup data (returns the parsed data, doesn't modify state)
 */
export function importBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content);
        if (!validateBackup(backup)) {
          throw new Error('Invalid backup format');
        }
        console.log('[Backup] Backup imported successfully');
        resolve(backup);
      } catch (err) {
        console.error('[Backup] Failed to import backup:', err);
        reject(new Error('Failed to parse backup file'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read backup file'));
    };
    reader.readAsText(file);
  });
}

/**
 * Restore backup data to state (use with caution)
 * Only restores messages and memories, not settings
 */
export function restoreBackupToState(
  backup: BackupData,
  currentState: AppState
): Partial<AppState> {
  return {
    messages: backup.data.messages || currentState.messages,
    aiMemory: backup.data.aiMemory || currentState.aiMemory,
    events: backup.data.events || currentState.events,
    moods: backup.data.moods || currentState.moods,
    letters: backup.data.letters || currentState.letters,
    sanctuaryChat: backup.data.sanctuaryChat || currentState.sanctuaryChat,
  };
}
