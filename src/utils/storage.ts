import { isDesktopApp } from './desktop';
import { getPersistentStorage } from './persistentStorage';

const STORAGE_PREFIX = 'taskmanager_';

type StorageManagerWithPersistence = StorageManager & {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

export interface StorageAdapter<T> {
  getAll(): T[];
  getById(id: string): T | undefined;
  save(item: T): void;
  update(id: string, item: Partial<T>): void;
  delete(id: string): void;
}

export interface ProjectIndexRecord {
  id: string;
  name: string;
  description: string;
  status: string;
  goal?: { targetCount: number; currentCount: number; description: string };
  path?: string;
  workspaceId?: string;
  currentVersionId?: string;
  tracking?: {
    interfaceName: string;
    currentVersionId?: string;
    currentVersionLabel?: string;
    statusLabel: string;
    progress: number;
    currentFocus: string;
    childWorkspaceName: string;
    childWorkspacePath?: string;
    lastUpdatedAt: string;
  };
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

type Storable = Record<string, unknown> & { id: string };

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStorable(value: unknown): value is Storable {
  return isObjectRecord(value) && typeof value.id === 'string';
}

function parseStorableArray(rawValue: string | null): Storable[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isStorable);
  } catch {
    return [];
  }
}

function createStorageBase(
  storageKey: string
): StorageAdapter<Storable> {
  const fullKey = `${STORAGE_PREFIX}${storageKey}`;
  const storage = getPersistentStorage();

  function getData(): Storable[] {
    return parseStorableArray(storage.getItem(fullKey));
  }

  function setData(data: Storable[]): void {
    storage.setItem(fullKey, JSON.stringify(data));
  }

  return {
    getAll(): Storable[] {
      return getData();
    },

    getById(id: string): Storable | undefined {
      const data = getData();
      return data.find((item) => item.id === id);
    },

    save(item: Storable): void {
      const data = getData();
      data.push(item);
      setData(data);
    },

    update(id: string, updates: Partial<Storable>): void {
      const data = getData();
      const index = data.findIndex((item) => item.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        setData(data);
      }
    },

    delete(id: string): void {
      const data = getData();
      const filtered = data.filter((item) => item.id !== id);
      setData(filtered);
    },
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (isDesktopApp()) {
    return true;
  }

  if (typeof navigator === 'undefined' || !('storage' in navigator)) {
    return false;
  }

  const storageManager = navigator.storage as StorageManagerWithPersistence;

  if (typeof storageManager.persisted === 'function') {
    const isPersisted = await storageManager.persisted();
    if (isPersisted) {
      return true;
    }
  }

  if (typeof storageManager.persist === 'function') {
    return storageManager.persist();
  }

  return false;
}

export const projectIndexStorage = createStorageBase('project_index') as unknown as StorageAdapter<ProjectIndexRecord>;

export const projectStorage = createStorageBase('projects') as StorageAdapter<{
  id: string;
  name: string;
  description: string;
  status: string;
  goal?: { targetCount: number; currentCount: number; description: string };
  path?: string;
  workspaceId?: string;
  currentVersionId?: string;
  versions?: Array<{
    id: string;
    version: string;
    label: string;
    summary: string;
    status: string;
    goal?: { targetCount: number; currentCount: number; description: string };
    documents: Array<{
      id: string;
      title: string;
      type: string;
      versionId: string;
      summary: string;
      path: string;
      updatedAt: string;
      stages: Array<{
        id: string;
        title: string;
        summary: string;
        status: string;
      }>;
    }>;
    taskCreationRules?: string[];
    taskPreparationHistory?: Array<{
      id: string;
      versionId: string;
      targetDocumentId: string;
      targetDocumentTitle: string;
      targetStageId: string;
      targetStageTitle: string;
      goalUpdateNote: string;
      implementationUpdateNote: string;
      preparedAt: string;
    }>;
    updatedAt: string;
  }>;
  documents?: Array<{
    id: string;
    title: string;
    type: string;
    summary: string;
    path: string;
    updatedAt: string;
  }>;
  tracking?: {
    interfaceName: string;
    currentVersionId?: string;
    currentVersionLabel?: string;
    statusLabel: string;
    progress: number;
    currentFocus: string;
    childWorkspaceName: string;
    childWorkspacePath?: string;
    lastUpdatedAt: string;
  };
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export const taskStorage = createStorageBase('tasks') as StorageAdapter<{
  id: string;
  projectId: string;
  orderIndex?: number;
  versionId?: string;
  documentId?: string;
  documentStageId?: string;
  syncKey?: string;
  sourceType?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress?: number;
  targetSummary?: string;
  tags: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}>;

export const commentStorage = createStorageBase('comments') as StorageAdapter<{
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}>;

export const tagStorage = createStorageBase('tags') as StorageAdapter<{
  id: string;
  name: string;
  color: string;
}>;
