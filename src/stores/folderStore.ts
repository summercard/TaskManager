import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SyncStatus } from '../utils/fileSystem';
import { getPersistentStorage } from '../utils/persistentStorage';

// 文件夹配置
export interface FolderConfig {
  projectId: string;
  folderName: string; // 文件夹名称（不是完整路径，因为使用 File System Access API）
  folderPath?: string;
  lastSyncedAt: string;
  syncStatus: SyncStatus;
  errorMessage?: string;
}

interface FolderState {
  configs: Record<string, FolderConfig>; // key: projectId
  syncQueue: Set<string>; // 待同步的项目ID集合

  // 设置项目文件夹
  setProjectFolder: (
    projectId: string,
    folderName: string,
    options?: {
      folderPath?: string;
      lastSyncedAt?: string;
      syncStatus?: SyncStatus;
      errorMessage?: string;
    }
  ) => void;

  // 移除项目文件夹
  removeProjectFolder: (projectId: string) => void;

  // 获取项目文件夹配置
  getFolderConfig: (projectId: string) => FolderConfig | undefined;

  // 更新同步状态
  updateSyncStatus: (projectId: string, status: SyncStatus, errorMessage?: string) => void;

  // 添加到同步队列
  addToSyncQueue: (projectId: string) => void;

  // 从同步队列移除
  removeFromSyncQueue: (projectId: string) => void;

  // 检查是否在同步队列中
  isInSyncQueue: (projectId: string) => boolean;

  // 更新最后同步时间
  updateLastSyncedAt: (projectId: string) => void;

  // 清除错误
  clearError: (projectId: string) => void;
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set, get) => ({
      configs: {},
      syncQueue: new Set<string>(),

      setProjectFolder: (projectId: string, folderName: string, options) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [projectId]: {
              projectId,
              folderName,
              folderPath: options?.folderPath ?? state.configs[projectId]?.folderPath,
              lastSyncedAt: options?.lastSyncedAt ?? state.configs[projectId]?.lastSyncedAt ?? new Date().toISOString(),
              syncStatus: options?.syncStatus ?? state.configs[projectId]?.syncStatus ?? 'not_linked',
              errorMessage: options?.errorMessage,
            },
          },
        }));
      },

      removeProjectFolder: (projectId: string) => {
        set((state) => {
          const newConfigs = { ...state.configs };
          delete newConfigs[projectId];
          const newQueue = new Set(state.syncQueue);
          newQueue.delete(projectId);
          return { configs: newConfigs, syncQueue: newQueue };
        });
      },

      getFolderConfig: (projectId: string) => {
        return get().configs[projectId];
      },

      updateSyncStatus: (projectId: string, status: SyncStatus, errorMessage?: string) => {
        set((state) => {
          if (!state.configs[projectId]) return state;
          return {
            configs: {
              ...state.configs,
              [projectId]: {
                ...state.configs[projectId],
                syncStatus: status,
                errorMessage,
              },
            },
          };
        });
      },

      addToSyncQueue: (projectId: string) => {
        set((state) => ({
          syncQueue: new Set(state.syncQueue).add(projectId),
        }));
      },

      removeFromSyncQueue: (projectId: string) => {
        set((state) => {
          const newQueue = new Set(state.syncQueue);
          newQueue.delete(projectId);
          return { syncQueue: newQueue };
        });
      },

      isInSyncQueue: (projectId: string) => {
        return get().syncQueue.has(projectId);
      },

      updateLastSyncedAt: (projectId: string) => {
        set((state) => {
          if (!state.configs[projectId]) return state;
          return {
            configs: {
              ...state.configs,
              [projectId]: {
                ...state.configs[projectId],
                lastSyncedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      clearError: (projectId: string) => {
        set((state) => {
          if (!state.configs[projectId]) return state;
          return {
            configs: {
              ...state.configs,
              [projectId]: {
                ...state.configs[projectId],
                errorMessage: undefined,
              },
            },
          };
        });
      },
    }),
    {
      name: 'taskmanager-folders',
      storage: createJSONStorage(() => getPersistentStorage()),
      partialize: (state) => ({
        configs: state.configs,
        // syncQueue 需要转换为数组以便持久化
        syncQueue: Array.from(state.syncQueue),
      }),
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as { configs?: Record<string, FolderConfig>; syncQueue?: string[] } | undefined;
        return {
          ...currentState,
          configs: persisted?.configs || {},
          syncQueue: new Set(persisted?.syncQueue || []),
        };
      },
    }
  )
);
