import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Card, Modal } from '@/components/common';
import { useFolderStore } from '@/stores/folderStore';
import { useTaskStore } from '@/stores/taskStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/types';
import {
  pickDirectory,
  isFileSystemAccessSupported,
  readProjectStateFile,
  writeProjectStateFile,
  deleteProjectStateFile,
  verifyDirectoryPermission,
  type ProjectStateFile,
  type SyncStatus,
  type FileSystemDirectoryHandle,
} from '@/utils/fileSystem';
import { formatRelativeTime } from '@/utils';

interface FolderSyncProps {
  project: Project;
  onSyncComplete?: () => void;
}

export function FolderSync({ project, onSyncComplete }: FolderSyncProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const {
    getFolderConfig,
    setProjectFolder,
    removeProjectFolder,
    updateSyncStatus,
    updateLastSyncedAt,
  } = useFolderStore();

  const { getTasksByProject } = useTaskStore();
  const { updateProject } = useProjectStore();

  const folderConfig = getFolderConfig(project.id);
  const isSupported = isFileSystemAccessSupported();

  // 加载目录句柄（用于持续访问）
  const loadDirectoryHandle = useCallback(async () => {
    if (!folderConfig) return null;

    try {
      // 尝试重新获取目录权限
      const storedHandles = await navigator.storage?.persist?.();
      if (!storedHandles) {
        // 如果没有持久化权限，需要用户重新选择
        setPermissionError('需要重新选择文件夹以获取访问权限');
        return null;
      }
      return directoryHandleRef.current;
    } catch {
      setPermissionError('无法恢复文件夹访问权限');
      return null;
    }
  }, [folderConfig]);

  // 验证并获取目录句柄
  const getValidDirectoryHandle = useCallback(async () => {
    if (directoryHandleRef.current) {
      const hasPermission = await verifyDirectoryPermission(directoryHandleRef.current);
      if (hasPermission) {
        return directoryHandleRef.current;
      }
    }
    return loadDirectoryHandle();
  }, [loadDirectoryHandle]);

  // 同步项目状态到文件夹
  const syncToFolder = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const tasks = getTasksByProject(project.id);

    const stateFile: ProjectStateFile = {
      version: '1.0',
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      goal: project.goal,
      lastSyncedAt: new Date().toISOString(),
    };

    await writeProjectStateFile(handle, stateFile);
    updateSyncStatus(project.id, 'synced');
    updateLastSyncedAt(project.id);
    onSyncComplete?.();
  }, [project, getTasksByProject, updateSyncStatus, updateLastSyncedAt, onSyncComplete]);

  // 从文件夹加载状态
  const syncFromFolder = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const stateFile = await readProjectStateFile(handle);
    if (!stateFile) {
      setError('文件夹中未找到状态文件');
      return;
    }

    if (stateFile.projectId !== project.id) {
      setError('状态文件不属于当前项目');
      updateSyncStatus(project.id, 'error', '状态文件不属于当前项目');
      return;
    }

    // 更新项目状态
    updateProject(project.id, {
      status: stateFile.projectStatus as Project['status'],
      goal: stateFile.goal,
    });

    updateSyncStatus(project.id, 'synced');
    updateLastSyncedAt(project.id);
    onSyncComplete?.();
  }, [project.id, updateProject, updateSyncStatus, updateLastSyncedAt, onSyncComplete]);

  // 链接文件夹
  const handleLinkFolder = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const handle = await pickDirectory();
      if (!handle) {
        setIsLoading(false);
        return;
      }

      // 验证权限
      const hasPermission = await verifyDirectoryPermission(handle);
      if (!hasPermission) {
        setError('无法获取文件夹写入权限');
        setIsLoading(false);
        return;
      }

      directoryHandleRef.current = handle;
      setProjectFolder(project.id, handle.name);
      setShowLinkModal(false);

      // 立即同步到新文件夹
      await syncToFolder(handle);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [project.id, setProjectFolder, syncToFolder]);

  // 取消链接
  const handleUnlinkFolder = useCallback(() => {
    directoryHandleRef.current = null;
    removeProjectFolder(project.id);
  }, [project.id, removeProjectFolder]);

  // 手动同步
  const handleManualSync = useCallback(async (direction: 'to' | 'from') => {
    setError(null);
    setIsLoading(true);

    try {
      const handle = await getValidDirectoryHandle();
      if (!handle) {
        setPermissionError('无法访问文件夹，请重新链接');
        setShowSyncModal(false);
        return;
      }

      if (direction === 'to') {
        await syncToFolder(handle);
      } else {
        await syncFromFolder(handle);
      }
      setShowSyncModal(false);
    } catch (err) {
      setError((err as Error).message);
      updateSyncStatus(project.id, 'error', (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [getValidDirectoryHandle, syncToFolder, syncFromFolder, project.id, updateSyncStatus]);

  // 删除文件夹中的状态文件
  const handleRemoveRemoteState = useCallback(async () => {
    if (!directoryHandleRef.current) return;

    setIsLoading(true);
    try {
      await deleteProjectStateFile(directoryHandleRef.current);
      handleUnlinkFolder();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [handleUnlinkFolder]);

  // 清理错误
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // 清理权限错误
  useEffect(() => {
    if (permissionError) {
      const timer = setTimeout(() => setPermissionError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [permissionError]);

  // 获取同步状态显示
  const getSyncStatusDisplay = (status: SyncStatus | undefined) => {
    switch (status) {
      case 'synced':
        return { label: '已同步', color: 'text-green-600 bg-green-50' };
      case 'pending':
        return { label: '待同步', color: 'text-yellow-600 bg-yellow-50' };
      case 'error':
        return { label: '同步失败', color: 'text-red-600 bg-red-50' };
      case 'not_linked':
      default:
        return { label: '未关联', color: 'text-gray-600 bg-gray-50' };
    }
  };

  const statusDisplay = getSyncStatusDisplay(folderConfig?.syncStatus);

  if (!isSupported) {
    return (
      <Card className="bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm">当前浏览器不支持文件夹同步功能</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {permissionError && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{permissionError}</span>
          <Button variant="secondary" size="xs" onClick={() => setShowLinkModal(true)}>
            重新选择
          </Button>
        </div>
      )}

      {/* 文件夹状态卡片 */}
      <Card hover={!!folderConfig} onClick={() => folderConfig && setShowSyncModal(true)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              folderConfig ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <svg className={`w-5 h-5 ${folderConfig ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {folderConfig ? folderConfig.folderName : '关联文件夹'}
                </span>
                {folderConfig && (
                  <span className={`px-2 py-0.5 text-xs rounded-full ${statusDisplay.color}`}>
                    {statusDisplay.label}
                  </span>
                )}
              </div>
              {folderConfig && (
                <p className="text-sm text-gray-500">
                  最后同步: {formatRelativeTime(folderConfig.lastSyncedAt)}
                </p>
              )}
              {!folderConfig && (
                <p className="text-sm text-gray-400">点击关联项目文件夹</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {folderConfig ? (
              <>
                <Button variant="secondary" size="xs" onClick={(e) => { e.stopPropagation(); setShowSyncModal(true); }}>
                  同步
                </Button>
                <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); handleUnlinkFolder(); }}>
                  取消关联
                </Button>
              </>
            ) : (
              <Button size="xs" onClick={() => setShowLinkModal(true)}>
                关联
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 关联文件夹弹窗 */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="关联项目文件夹"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            选择一个文件夹来存储项目状态文件 <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">.task-manager.json</code>。
            该文件夹将用于项目状态的备份和同步。
          </p>
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">注意事项</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 需要浏览器授权才能访问文件夹</li>
              <li>• 每次打开项目时可能需要重新授权</li>
              <li>• 状态文件会同步任务和目标信息</li>
            </ul>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowLinkModal(false)}>
              取消
            </Button>
            <Button onClick={handleLinkFolder} disabled={isLoading}>
              {isLoading ? '处理中...' : '选择文件夹'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 同步选项弹窗 */}
      <Modal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        title="同步选项"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-1">
              {folderConfig?.folderName}
            </h3>
            <p className="text-sm text-gray-500">
              最后同步: {folderConfig ? formatRelativeTime(folderConfig.lastSyncedAt) : '从未'}
            </p>
          </div>

          {folderConfig?.errorMessage && (
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">
              上次同步失败: {folderConfig.errorMessage}
            </div>
          )}

          <div className="space-y-2">
            <Button className="w-full justify-center" variant="secondary" onClick={() => handleManualSync('to')}>
              上传到文件夹
            </Button>
            <Button className="w-full justify-center" variant="secondary" onClick={() => handleManualSync('from')}>
              从文件夹下载
            </Button>
          </div>

          <hr className="border-gray-200" />

          <Button className="w-full justify-center text-red-600 hover:bg-red-50" variant="ghost" onClick={handleRemoveRemoteState}>
            删除远程状态并取消关联
          </Button>
        </div>
      </Modal>
    </div>
  );
}
