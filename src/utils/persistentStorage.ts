import { getDesktopBridge } from './desktop';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear?: () => void;
}

const memoryStorage = new Map<string, string>();

function getMemoryStorage(): StorageLike {
  return {
    getItem(key) {
      return memoryStorage.get(key) ?? null;
    },
    setItem(key, value) {
      memoryStorage.set(key, value);
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
    clear() {
      memoryStorage.clear();
    },
  };
}

export function getPersistentStorage(): StorageLike {
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    return desktopBridge.storage;
  }

  if (typeof window !== 'undefined') {
    throw new Error('TaskManager 仅支持桌面端运行，未检测到桌面桥接环境。');
  }

  return getMemoryStorage();
}
