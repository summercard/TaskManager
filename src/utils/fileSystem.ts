/**
 * File System Access API utilities
 * Provides directory picker and file read/write operations
 */

import type { Project, Task } from '@/types';
import {
  buildTaskManagerUsageGuide,
  buildVersionGoalDocument,
  buildVersionImplementationDocument,
  getVersionFolderName,
} from './taskManagerDocs';
import {
  TASK_MANAGER_TASK_FILE_NAME,
  buildVersionTaskFile,
} from './taskManagerTaskFile';
import { getDesktopBridge, isDesktopApp } from './desktop';

// 定义 File System Access API 类型
export interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>;
}

export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  queryPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: FileSystemPermissionMode }) => Promise<PermissionState>;
}

export interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream {
  write(data: string | ArrayBuffer | Blob): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

export type SyncStatus = 'synced' | 'pending' | 'error' | 'not_linked';
export type FileSystemPermissionMode = 'read' | 'readwrite';
export type FileSystemPermissionState = PermissionState | 'unknown';

function createFileSystemError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

async function normalizeWritableContent(data: string | ArrayBuffer | Blob): Promise<string> {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Blob) {
    return data.text();
  }

  return new TextDecoder().decode(data);
}

class DesktopWritableFileStream implements FileSystemWritableFileStream {
  private readonly filePath: string;

  private pendingContent = '';

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async write(data: string | ArrayBuffer | Blob): Promise<void> {
    this.pendingContent = await normalizeWritableContent(data);
  }

  async close(): Promise<void> {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      throw new Error('桌面文件系统不可用');
    }

    await desktopBridge.fs.writeTextFile(this.filePath, this.pendingContent);
  }
}

class DesktopFileHandle implements FileSystemFileHandle, FileSystemHandle {
  readonly kind = 'file' as const;

  readonly name: string;

  readonly path: string;

  constructor(filePath: string, name: string) {
    this.path = filePath;
    this.name = name;
  }

  async getFile(): Promise<File> {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      throw new Error('桌面文件系统不可用');
    }

    const content = await desktopBridge.fs.readTextFile(this.path);
    return new File([content], this.name, { type: 'text/plain' });
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return new DesktopWritableFileStream(this.path);
  }

  async queryPermission(): Promise<PermissionState> {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      return 'denied';
    }

    return (await desktopBridge.fs.pathExists(this.path)) ? 'granted' : 'denied';
  }

  async requestPermission(): Promise<PermissionState> {
    return this.queryPermission();
  }
}

class DesktopDirectoryHandle implements FileSystemDirectoryHandle, FileSystemHandle {
  readonly kind = 'directory' as const;

  readonly path: string;

  readonly name: string;

  constructor(directoryPath: string, directoryName?: string) {
    this.path = directoryPath;
    this.name = directoryName ?? directoryPath.split(/[\\/]/).filter(Boolean).pop() ?? directoryPath;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      throw new Error('桌面文件系统不可用');
    }

    const filePath = desktopBridge.fs.joinPath(this.path, name);
    const exists = await desktopBridge.fs.pathExists(filePath);

    if (!exists && options?.create) {
      await desktopBridge.fs.ensureFile(filePath);
    } else if (!exists) {
      throw createFileSystemError('NotFoundError', `未找到文件：${name}`);
    }

    return new DesktopFileHandle(filePath, name);
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      throw new Error('桌面文件系统不可用');
    }

    const directoryPath = desktopBridge.fs.joinPath(this.path, name);
    const exists = await desktopBridge.fs.pathExists(directoryPath);

    if (!exists && options?.create) {
      await desktopBridge.fs.ensureDirectory(directoryPath);
    } else if (!exists) {
      throw createFileSystemError('NotFoundError', `未找到目录：${name}`);
    }

    return new DesktopDirectoryHandle(directoryPath, name);
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      throw new Error('桌面文件系统不可用');
    }

    const targetPath = desktopBridge.fs.joinPath(this.path, name);
    const exists = await desktopBridge.fs.pathExists(targetPath);
    if (!exists) {
      throw createFileSystemError('NotFoundError', `未找到条目：${name}`);
    }

    await desktopBridge.fs.removeEntry(targetPath, options?.recursive);
  }

  async resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null> {
    const descendantPath = getHandlePath(possibleDescendant);
    if (!descendantPath) {
      return null;
    }

    const normalizedBase = this.path.replace(/[\\/]+$/, '');
    const normalizedDescendant = descendantPath.replace(/[\\/]+$/, '');

    if (normalizedDescendant === normalizedBase) {
      return [];
    }

    if (!normalizedDescendant.startsWith(`${normalizedBase}/`) && !normalizedDescendant.startsWith(`${normalizedBase}\\`)) {
      return null;
    }

    return normalizedDescendant.slice(normalizedBase.length + 1).split(/[\\/]/).filter(Boolean);
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return getHandlePath(other) === this.path;
  }

  async queryPermission(): Promise<PermissionState> {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      return 'denied';
    }

    return (await desktopBridge.fs.pathExists(this.path)) ? 'granted' : 'denied';
  }

  async requestPermission(): Promise<PermissionState> {
    return this.queryPermission();
  }
}

function getHandlePath(handle: FileSystemHandle): string | null {
  if (handle instanceof DesktopDirectoryHandle || handle instanceof DesktopFileHandle) {
    return handle.path;
  }

  return null;
}

export function createDirectoryHandleFromPath(directoryPath: string): FileSystemDirectoryHandle {
  const desktopBridge = getDesktopBridge();
  const directoryName = desktopBridge?.fs.basename(directoryPath);
  return new DesktopDirectoryHandle(directoryPath, directoryName);
}

export function getDirectoryHandlePath(directoryHandle: FileSystemDirectoryHandle): string | null {
  if (directoryHandle instanceof DesktopDirectoryHandle) {
    return directoryHandle.path;
  }

  return null;
}

/**
 * 检查浏览器是否支持 File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return isDesktopApp() || 'showDirectoryPicker' in window;
}

/**
 * 打开目录选择器
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('当前浏览器不支持 File System Access API');
  }

  if (isDesktopApp()) {
    const desktopBridge = getDesktopBridge();
    if (!desktopBridge) {
      throw new Error('桌面文件系统不可用');
    }

    const selection = await desktopBridge.fs.selectDirectory();
    if (!selection) {
      return null;
    }

    return new DesktopDirectoryHandle(selection.path, selection.name);
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
export const TASK_MANAGER_FOLDER_NAME = '.task-manager';
export const TASK_MANAGER_GUIDE_FILE_NAME = 'README.md';

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

async function writeTextFile(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string
): Promise<void> {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function fileExists(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<boolean> {
  try {
    await directoryHandle.getFileHandle(fileName);
    return true;
  } catch (err) {
    if ((err as Error).name === 'NotFoundError') {
      return false;
    }
    throw err;
  }
}

async function writeTextFileIfMissing(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string
): Promise<void> {
  if (await fileExists(directoryHandle, fileName)) {
    return;
  }

  await writeTextFile(directoryHandle, fileName, content);
}

export async function readTextFileByPath(
  directoryHandle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<string> {
  const normalizedPath = relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    throw new Error('无效的文件路径');
  }

  let currentDirectory = directoryHandle;
  const fileName = segments[segments.length - 1];

  for (const segment of segments.slice(0, -1)) {
    currentDirectory = await currentDirectory.getDirectoryHandle(segment);
  }

  const fileHandle = await currentDirectory.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.text();
}

export async function syncTaskManagerWorkspaceFiles(
  directoryHandle: FileSystemDirectoryHandle,
  project: Project,
  tasks: Task[]
): Promise<void> {
  const taskManagerDirectory = await directoryHandle.getDirectoryHandle(TASK_MANAGER_FOLDER_NAME, {
    create: true,
  });

  await writeTextFile(
    taskManagerDirectory,
    TASK_MANAGER_GUIDE_FILE_NAME,
    buildTaskManagerUsageGuide(project)
  );

  for (const version of project.versions ?? []) {
    const versionDirectory = await taskManagerDirectory.getDirectoryHandle(getVersionFolderName(version), {
      create: true,
    });

    await writeTextFileIfMissing(
      versionDirectory,
      'TargetDocument.md',
      buildVersionGoalDocument(project, version)
    );
    await writeTextFileIfMissing(
      versionDirectory,
      'ImplementationDocument.md',
      buildVersionImplementationDocument(project, version, tasks)
    );
    await writeTextFile(
      versionDirectory,
      TASK_MANAGER_TASK_FILE_NAME,
      buildVersionTaskFile(project, version, tasks)
    );
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

export async function getDirectoryPermissionState(
  directoryHandle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite'
): Promise<FileSystemPermissionState> {
  try {
    if (typeof directoryHandle.queryPermission === 'function') {
      return directoryHandle.queryPermission({ mode });
    }

    return (await verifyDirectoryPermission(directoryHandle)) ? 'granted' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function ensureDirectoryPermission(
  directoryHandle: FileSystemDirectoryHandle,
  options?: {
    mode?: FileSystemPermissionMode;
    request?: boolean;
  }
): Promise<boolean> {
  const mode = options?.mode ?? 'readwrite';
  const permissionState = await getDirectoryPermissionState(directoryHandle, mode);

  if (permissionState === 'granted') {
    return true;
  }

  if (permissionState === 'prompt') {
    if (!options?.request || typeof directoryHandle.requestPermission !== 'function') {
      return false;
    }

    try {
      return (await directoryHandle.requestPermission({ mode })) === 'granted';
    } catch {
      return false;
    }
  }

  if (permissionState === 'denied') {
    return false;
  }

  if (options?.request) {
    return verifyDirectoryPermission(directoryHandle);
  }

  return false;
}
