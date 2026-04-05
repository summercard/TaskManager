/**
 * File System Access API utilities
 * Provides directory picker and file read/write operations
 */

// 定义 File System Access API 类型
export interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | ArrayBuffer | Blob): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

export type SyncStatus = 'synced' | 'pending' | 'error' | 'not_linked';

/**
 * 检查浏览器是否支持 File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

/**
 * 打开目录选择器
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('当前浏览器不支持 File System Access API');
  }

  try {
    const handle = await window.showDirectoryPicker!({ mode: 'readwrite' });
    return handle;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return null; // 用户取消选择
    }
    throw err;
  }
}

/**
 * 状态文件名
 */
export const STATE_FILE_NAME = '.task-manager.json';

/**
 * 项目状态文件结构
 */
export interface ProjectStateFile {
  version: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    dueDate?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  goal?: {
    targetCount: number;
    currentCount: number;
    description: string;
  };
  lastSyncedAt: string;
}

/**
 * 读取项目状态文件
 */
export async function readProjectStateFile(
  directoryHandle: FileSystemDirectoryHandle
): Promise<ProjectStateFile | null> {
  try {
    const fileHandle = await directoryHandle.getFileHandle(STATE_FILE_NAME);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return JSON.parse(content) as ProjectStateFile;
  } catch (err) {
    if ((err as Error).name === 'NotFoundError') {
      return null; // 文件不存在
    }
    throw err;
  }
}

/**
 * 写入项目状态文件
 */
export async function writeProjectStateFile(
  directoryHandle: FileSystemDirectoryHandle,
  state: ProjectStateFile
): Promise<void> {
  try {
    const fileHandle = await directoryHandle.getFileHandle(STATE_FILE_NAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
  } catch (err) {
    throw new Error(`写入状态文件失败: ${(err as Error).message}`);
  }
}

/**
 * 删除项目状态文件
 */
export async function deleteProjectStateFile(
  directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    await directoryHandle.removeEntry(STATE_FILE_NAME);
  } catch (err) {
    if ((err as Error).name !== 'NotFoundError') {
      throw err;
    }
  }
}

/**
 * 获取文件夹同步状态
 */
export async function checkFolderSyncStatus(
  directoryHandle: FileSystemDirectoryHandle,
  projectId: string
): Promise<SyncStatus> {
  try {
    const state = await readProjectStateFile(directoryHandle);
    if (!state) {
      return 'not_linked';
    }
    if (state.projectId === projectId) {
      return 'synced';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

/**
 * 验证目录权限
 */
export async function verifyDirectoryPermission(
  directoryHandle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    // 尝试获取文件句柄来验证权限
    await directoryHandle.getFileHandle('.permission_check', { create: true });
    await directoryHandle.removeEntry('.permission_check');
    return true;
  } catch {
    return false;
  }
}
