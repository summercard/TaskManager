export interface DesktopStorageBridge {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

export interface DesktopDirectorySelection {
  path: string;
  name: string;
}

export interface DesktopFileSystemBridge {
  selectDirectory: () => Promise<DesktopDirectorySelection | null>;
  basename: (targetPath: string) => string;
  joinPath: (basePath: string, entryName: string) => string;
  pathExists: (targetPath: string) => Promise<boolean>;
  ensureDirectory: (targetPath: string) => Promise<void>;
  ensureFile: (targetPath: string) => Promise<void>;
  readTextFile: (targetPath: string) => Promise<string>;
  writeTextFile: (targetPath: string, content: string) => Promise<void>;
  removeEntry: (targetPath: string, recursive?: boolean) => Promise<void>;
}

export interface DesktopBridge {
  isDesktop: true;
  getUserDataPath: () => string;
  storage: DesktopStorageBridge;
  fs: DesktopFileSystemBridge;
}

declare global {
  interface Window {
    taskManagerDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.taskManagerDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return getDesktopBridge()?.isDesktop === true;
}
