const STORAGE_PREFIX = 'taskmanager_';

export interface StorageAdapter<T> {
  getAll(): T[];
  getById(id: string): T | undefined;
  save(item: T): void;
  update(id: string, item: Partial<T>): void;
  delete(id: string): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Storable = Record<string, unknown> & { id: string };

function createStorageBase(
  storageKey: string
): StorageAdapter<Storable> {
  const fullKey = `${STORAGE_PREFIX}${storageKey}`;

  function getData(): Storable[] {
    const data = localStorage.getItem(fullKey);
    return (data ? JSON.parse(data) : []) as Storable[];
  }

  function setData(data: Storable[]): void {
    localStorage.setItem(fullKey, JSON.stringify(data));
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

export const projectStorage = createStorageBase('projects') as StorageAdapter<{
  id: string;
  name: string;
  description: string;
  status: string;
  goal?: { targetCount: number; currentCount: number; description: string };
  path?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export const taskStorage = createStorageBase('tasks') as StorageAdapter<{
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
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
