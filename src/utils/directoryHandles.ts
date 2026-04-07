import {
  createDirectoryHandleFromPath,
  getDirectoryHandlePath,
  type FileSystemDirectoryHandle,
} from './fileSystem';
import { isDesktopApp } from './desktop';
import { getPersistentStorage } from './persistentStorage';

const DATABASE_NAME = 'task-manager-directory-handles';
const DATABASE_VERSION = 1;
const HANDLE_STORE_NAME = 'project-handles';
const REGISTRY_STORE_NAME = 'project-registry';
const DESKTOP_HANDLE_STORAGE_KEY = 'taskmanager_desktop_project_handles';
const DESKTOP_REGISTRY_STORAGE_KEY = 'taskmanager_desktop_project_registry';

interface StoredDirectoryHandle {
  projectId: string;
  handle: FileSystemDirectoryHandle;
  updatedAt: string;
}

export interface ProjectRegistryEntry {
  projectId: string;
  folderName: string;
  folderPath?: string;
  updatedAt: string;
}

interface DesktopHandleRecord {
  projectId: string;
  folderPath: string;
  updatedAt: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeParseDesktopRecordMap<T>(rawValue: string | null): Record<string, T> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!isObjectRecord(parsed)) {
      return {};
    }
    return parsed as Record<string, T>;
  } catch {
    return {};
  }
}

function readDesktopHandleRecords(): Record<string, DesktopHandleRecord> {
  const storage = getPersistentStorage();
  return safeParseDesktopRecordMap<DesktopHandleRecord>(storage.getItem(DESKTOP_HANDLE_STORAGE_KEY));
}

function writeDesktopHandleRecords(records: Record<string, DesktopHandleRecord>): void {
  const storage = getPersistentStorage();
  storage.setItem(DESKTOP_HANDLE_STORAGE_KEY, JSON.stringify(records));
}

function readDesktopRegistryEntries(): Record<string, ProjectRegistryEntry> {
  const storage = getPersistentStorage();
  return safeParseDesktopRecordMap<ProjectRegistryEntry>(storage.getItem(DESKTOP_REGISTRY_STORAGE_KEY));
}

function writeDesktopRegistryEntries(records: Record<string, ProjectRegistryEntry>): void {
  const storage = getPersistentStorage();
  storage.setItem(DESKTOP_REGISTRY_STORAGE_KEY, JSON.stringify(records));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        database.createObjectStore(HANDLE_STORE_NAME, { keyPath: 'projectId' });
      }
      if (!database.objectStoreNames.contains(REGISTRY_STORE_NAME)) {
        database.createObjectStore(REGISTRY_STORE_NAME, { keyPath: 'projectId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('打开目录句柄数据库失败'));
  });
}

export async function saveProjectDirectoryHandle(
  projectId: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  if (isDesktopApp()) {
    const folderPath = getDirectoryHandlePath(handle);
    if (!folderPath) {
      throw new Error('桌面模式下无法识别项目文件夹路径');
    }

    const records = readDesktopHandleRecords();
    records[projectId] = {
      projectId,
      folderPath,
      updatedAt: new Date().toISOString(),
    };
    writeDesktopHandleRecords(records);
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HANDLE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HANDLE_STORE_NAME);
    const record: StoredDirectoryHandle = {
      projectId,
      handle,
      updatedAt: new Date().toISOString(),
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('保存目录句柄失败'));
  });

  database.close();
}

export async function getProjectDirectoryHandle(
  projectId: string
): Promise<FileSystemDirectoryHandle | null> {
  if (isDesktopApp()) {
    const record = readDesktopHandleRecords()[projectId];
    return record ? createDirectoryHandleFromPath(record.folderPath) : null;
  }

  const database = await openDatabase();

  const record = await new Promise<StoredDirectoryHandle | undefined>((resolve, reject) => {
    const transaction = database.transaction(HANDLE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(HANDLE_STORE_NAME);
    const request = store.get(projectId);
    request.onsuccess = () => resolve(request.result as StoredDirectoryHandle | undefined);
    request.onerror = () => reject(request.error ?? new Error('读取目录句柄失败'));
  });

  database.close();
  return record?.handle ?? null;
}

export async function removeProjectDirectoryHandle(projectId: string): Promise<void> {
  if (isDesktopApp()) {
    const records = readDesktopHandleRecords();
    delete records[projectId];
    writeDesktopHandleRecords(records);
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(HANDLE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HANDLE_STORE_NAME);
    const request = store.delete(projectId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('删除目录句柄失败'));
  });

  database.close();
}

export async function saveProjectRegistryEntry(
  projectId: string,
  folderName: string,
  folderPath?: string
): Promise<void> {
  if (isDesktopApp()) {
    const records = readDesktopRegistryEntries();
    records[projectId] = {
      projectId,
      folderName,
      folderPath,
      updatedAt: new Date().toISOString(),
    };
    writeDesktopRegistryEntries(records);
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(REGISTRY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(REGISTRY_STORE_NAME);
    const record: ProjectRegistryEntry = {
      projectId,
      folderName,
      folderPath,
      updatedAt: new Date().toISOString(),
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('保存项目目录列表失败'));
  });

  database.close();
}

export async function getProjectRegistryEntries(): Promise<ProjectRegistryEntry[]> {
  if (isDesktopApp()) {
    return Object.values(readDesktopRegistryEntries()).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }

  const database = await openDatabase();

  const records = await new Promise<ProjectRegistryEntry[]>((resolve, reject) => {
    const transaction = database.transaction(REGISTRY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(REGISTRY_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as ProjectRegistryEntry[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error('读取项目目录列表失败'));
  });

  database.close();
  return records;
}

export async function removeProjectRegistryEntry(projectId: string): Promise<void> {
  if (isDesktopApp()) {
    const records = readDesktopRegistryEntries();
    delete records[projectId];
    writeDesktopRegistryEntries(records);
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(REGISTRY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(REGISTRY_STORE_NAME);
    const request = store.delete(projectId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('删除项目目录列表失败'));
  });

  database.close();
}
