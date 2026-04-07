import { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Card, Modal } from '@/components/common';
import { useFolderStore } from '@/stores/folderStore';
import { useTaskStore } from '@/stores/taskStore';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/types';
import {
  getDirectoryHandlePath,
  pickDirectory,
  isFileSystemAccessSupported,
  deleteProjectStateFile,
  ensureDirectoryPermission,
  getDirectoryPermissionState,
  verifyDirectoryPermission,
  type SyncStatus,
  type FileSystemDirectoryHandle,
} from '@/utils/fileSystem';
import {
  getProjectDirectoryHandle,
  removeProjectDirectoryHandle,
  removeProjectRegistryEntry,
  saveProjectDirectoryHandle,
  saveProjectRegistryEntry,
} from '@/utils/directoryHandles';
import {
  deleteProjectArchive,
  readProjectArchive,
  syncProjectArchive,
} from '@/utils/projectArchive';
import { formatRelativeTime } from '@/utils';
import { getCurrentProjectVersion } from '@/utils/projectVersion';

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
  const lastAutoSyncSignatureRef = useRef<string>('');

  const {
    getFolderConfig,
    setProjectFolder,
    removeProjectFolder,
    updateSyncStatus,
    updateLastSyncedAt,
  } = useFolderStore();

  const { tasks, comments, getTasksByProject, replaceProjectSnapshot } = useTaskStore();
  const { hydrateProject, updateProject } = useProjectStore();

  const folderConfig = getFolderConfig(project.id);
  const isSupported = isFileSystemAccessSupported();
  const projectTasksSnapshot = getTasksByProject(project.id);
  const projectTaskIds = new Set(projectTasksSnapshot.map((task) => task.id));
  const projectComments = comments.filter((comment) => projectTaskIds.has(comment.taskId));
  const autoSyncSignature = JSON.stringify({
    projectUpdatedAt: project.updatedAt,
    currentVersionId: project.currentVersionId ?? null,
    currentVersionUpdatedAt: getCurrentProjectVersion(project)?.updatedAt ?? null,
    versionCount: project.versions?.length ?? 0,
    taskSnapshot: projectTasksSnapshot.map((task) => ({
      id: task.id,
      versionId: task.versionId ?? null,
      status: task.status,
      progress: task.progress ?? 0,
      updatedAt: task.updatedAt,
    })),
    commentSnapshot: projectComments.map((comment) => ({
      id: comment.id,
      updatedAt: comment.updatedAt,
    })),
  });

  const loadDirectoryHandle = useCallback(async (requestPermission = false) => {
    if (!folderConfig) {
      return null;
    }

    try {
      const storedHandle = await getProjectDirectoryHandle(project.id);
      if (!storedHandle) {
        setPermissionError('未找到已保存的项目文件夹授权，请重新关联。');
        return null;
      }

      const permissionState = await getDirectoryPermissionState(storedHandle);
      const hasPermission = await ensureDirectoryPermission(storedHandle, {
        mode: 'readwrite',
        request: requestPermission,
      });
      if (!hasPermission) {
        if (permissionState === 'prompt') {
          setPermissionError('浏览器需要你重新确认这个项目文件夹的权限，点“同步”即可恢复。');
        } else {
          setPermissionError('项目文件夹权限已失效，请重新关联。');
        }
        return null;
      }

      directoryHandleRef.current = storedHandle;
      return storedHandle;
    } catch {
      setPermissionError('无法恢复项目文件夹访问权限，请重新关联。');
      return null;
    }
  }, [folderConfig, project.id]);

  const getValidDirectoryHandle = useCallback(async (requestPermission = false) => {
    if (directoryHandleRef.current) {
      const hasPermission = await ensureDirectoryPermission(directoryHandleRef.current, {
        mode: 'readwrite',
        request: requestPermission,
      });
      if (hasPermission) {
        return directoryHandleRef.current;
      }
    }

    return loadDirectoryHandle(requestPermission);
  }, [loadDirectoryHandle]);

  const syncToFolder = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const nextTasks = getTasksByProject(project.id);
    const nextTaskIds = new Set(nextTasks.map((task) => task.id));
    const nextComments = comments.filter((comment) => nextTaskIds.has(comment.taskId));

    await syncProjectArchive(handle, project, nextTasks, nextComments);
    updateSyncStatus(project.id, 'synced');
    updateLastSyncedAt(project.id);
    onSyncComplete?.();
  }, [comments, getTasksByProject, onSyncComplete, project, updateLastSyncedAt, updateSyncStatus]);

  const syncFromFolder = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const archive = await readProjectArchive(handle);

    if (!archive) {
      setError('文件夹里还没有项目存档，请先执行一次上传。');
      return;
    }

    if (archive.project.id !== project.id) {
      setError('这个文件夹里的存档不属于当前项目。');
      updateSyncStatus(project.id, 'error', '本地存档不属于当前项目');
      return;
    }

    hydrateProject(archive.project);
    replaceProjectSnapshot(project.id, archive.tasks, archive.comments);
    updateSyncStatus(project.id, 'synced');
    updateLastSyncedAt(project.id);
    onSyncComplete?.();
  }, [hydrateProject, onSyncComplete, project.id, replaceProjectSnapshot, updateLastSyncedAt, updateSyncStatus]);

  const handleLinkFolder = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const handle = await pickDirectory();
      if (!handle) {
        setIsLoading(false);
        return;
      }

      const hasPermission = await verifyDirectoryPermission(handle);
      if (!hasPermission) {
        setError('无法获取项目文件夹写入权限。');
        setIsLoading(false);
        return;
      }

      directoryHandleRef.current = handle;
      await saveProjectDirectoryHandle(project.id, handle);
      await saveProjectRegistryEntry(project.id, handle.name, getDirectoryHandlePath(handle) ?? undefined);
      setProjectFolder(project.id, handle.name, {
        folderPath: getDirectoryHandlePath(handle) ?? undefined,
      });
      updateProject(project.id, {
        path: getDirectoryHandlePath(handle) ?? handle.name,
        tracking: project.tracking
          ? {
              ...project.tracking,
              childWorkspaceName: handle.name,
              childWorkspacePath: getDirectoryHandlePath(handle) ?? handle.name,
            }
          : project.tracking,
      });
      setShowLinkModal(false);
      await syncToFolder(handle);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [project.id, project.tracking, setProjectFolder, syncToFolder, updateProject]);

  const handleUnlinkFolder = useCallback(async () => {
    directoryHandleRef.current = null;
    await removeProjectDirectoryHandle(project.id);
    await removeProjectRegistryEntry(project.id);
    removeProjectFolder(project.id);
  }, [project.id, removeProjectFolder]);

  const handleManualSync = useCallback(async (direction: 'to' | 'from') => {
    setError(null);
    setIsLoading(true);

    try {
      const handle = await getValidDirectoryHandle(true);
      if (!handle) {
        setPermissionError('无法访问项目文件夹，请重新关联。');
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
      const message = (err as Error).message;
      setError(message);
      updateSyncStatus(project.id, 'error', message);
    } finally {
      setIsLoading(false);
    }
  }, [getValidDirectoryHandle, project.id, syncFromFolder, syncToFolder, updateSyncStatus]);

  const handleRemoveRemoteState = useCallback(async () => {
    const handle = await getValidDirectoryHandle(true);
    if (!handle) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteProjectStateFile(handle);
      await deleteProjectArchive(handle);
      await handleUnlinkFolder();
      setShowSyncModal(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [getValidDirectoryHandle, handleUnlinkFolder]);

  useEffect(() => {
    if (!folderConfig) {
      directoryHandleRef.current = null;
      return;
    }

    if (directoryHandleRef.current) {
      return;
    }

    void loadDirectoryHandle();
  }, [folderConfig, loadDirectoryHandle]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (permissionError) {
      const timer = setTimeout(() => setPermissionError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [permissionError]);

  useEffect(() => {
    if (!folderConfig) {
      return;
    }

    if (lastAutoSyncSignatureRef.current === autoSyncSignature) {
      return;
    }

    let isCancelled = false;

    const runAutoSync = async () => {
      const handle = await getValidDirectoryHandle(false);
      if (!handle || isCancelled) {
        return;
      }

      await syncToFolder(handle);

      if (!isCancelled) {
        lastAutoSyncSignatureRef.current = autoSyncSignature;
      }
    };

    void runAutoSync();

    return () => {
      isCancelled = true;
    };
  }, [autoSyncSignature, folderConfig, getValidDirectoryHandle, syncToFolder, tasks.length]);

  const getSyncStatusDisplay = (status: SyncStatus | undefined) => {
    switch (status) {
      case 'synced':
        return { label: '已写入本地存档', color: 'text-green-600 bg-green-50' };
      case 'pending':
        return { label: '等待补全授权', color: 'text-yellow-600 bg-yellow-50' };
      case 'error':
        return { label: '存档失败', color: 'text-red-600 bg-red-50' };
      case 'not_linked':
      default:
        return { label: '未关联项目文件夹', color: 'text-gray-600 bg-gray-50' };
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
          <span className="text-sm">当前浏览器不支持本地项目文件夹存档。</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
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
                  {folderConfig ? folderConfig.folderName : '关联项目文件夹'}
                </span>
                {folderConfig && (
                  <span className={`px-2 py-0.5 text-xs rounded-full ${statusDisplay.color}`}>
                    {statusDisplay.label}
                  </span>
                )}
              </div>
              {folderConfig ? (
                <p className="text-sm text-gray-500">
                  最近写入: {formatRelativeTime(folderConfig.lastSyncedAt)}
                </p>
              ) : (
                <p className="text-sm text-gray-400">把当前项目的内容存进它自己的本地文件夹。</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {folderConfig ? (
              <>
                <Button variant="secondary" size="xs" onClick={(event) => { event.stopPropagation(); setShowSyncModal(true); }}>
                  存档
                </Button>
                <Button variant="ghost" size="xs" onClick={(event) => {
                  event.stopPropagation();
                  void handleUnlinkFolder();
                }}>
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

      <Modal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="关联项目文件夹"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
              选择这个项目自己的本地文件夹。系统会把项目完整存档写到
              <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">.task-manager/project-archive.json</code>
              ，并继续生成版本文档与任务文件镜像。
          </p>
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">会写入的内容</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 项目主体信息、版本信息、接口对接信息</li>
              <li>• 该项目的任务和评论</li>
                  <li>• 版本文档镜像、任务文件与状态文件</li>
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

      <Modal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        title="项目存档"
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
              最近写入: {folderConfig ? formatRelativeTime(folderConfig.lastSyncedAt) : '从未'}
            </p>
          </div>

          {folderConfig?.errorMessage && (
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">
              上次写入失败: {folderConfig.errorMessage}
            </div>
          )}

          <div className="space-y-2">
            <Button className="w-full justify-center" variant="secondary" onClick={() => void handleManualSync('to')}>
              上传当前项目到文件夹
            </Button>
            <Button className="w-full justify-center" variant="secondary" onClick={() => void handleManualSync('from')}>
              从文件夹恢复当前项目
            </Button>
          </div>

          <hr className="border-gray-200" />

          <Button className="w-full justify-center text-red-600 hover:bg-red-50" variant="ghost" onClick={() => void handleRemoveRemoteState()}>
            删除本地存档并取消关联
          </Button>
        </div>
      </Modal>
    </div>
  );
}
