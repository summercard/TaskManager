const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const userDataPath = ipcRenderer.sendSync('task-manager:get-user-data-path');
const storageFilePath = path.join(userDataPath, 'task-manager-storage.json');
const storageBackupFilePath = path.join(userDataPath, 'task-manager-storage.backup.json');
const storageTempFilePath = path.join(userDataPath, 'task-manager-storage.tmp.json');
const appDataPath = path.dirname(userDataPath);

function isObjectRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSnapshotFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getLegacyStorageFileCandidates() {
  const legacyProfileNames = ['Electron', 'task-manager', 'TaskManager-main'];

  return legacyProfileNames.flatMap((profileName) => {
    const legacyUserDataPath = path.join(appDataPath, profileName);

    if (legacyUserDataPath === userDataPath) {
      return [];
    }

    return [
      path.join(legacyUserDataPath, 'task-manager-storage.json'),
      path.join(legacyUserDataPath, 'task-manager-storage.backup.json'),
    ];
  });
}

function readLegacySnapshot() {
  const legacyCandidates = getLegacyStorageFileCandidates();
  for (const candidatePath of legacyCandidates) {
    const snapshot = readSnapshotFile(candidatePath);
    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

function ensureStorageFile() {
  fs.mkdirSync(path.dirname(storageFilePath), { recursive: true });
  const currentSnapshot = readSnapshotFile(storageFilePath);
  if (!currentSnapshot) {
    const backupSnapshot = readSnapshotFile(storageBackupFilePath);
    const legacySnapshot = readLegacySnapshot();
    const fallbackSnapshot = backupSnapshot ?? legacySnapshot ?? {};
    const serialized = JSON.stringify(fallbackSnapshot, null, 2);
    fs.writeFileSync(storageFilePath, serialized, 'utf8');
    fs.writeFileSync(storageBackupFilePath, serialized, 'utf8');
    return;
  }

  if (!fs.existsSync(storageBackupFilePath)) {
    fs.writeFileSync(storageBackupFilePath, JSON.stringify(currentSnapshot, null, 2), 'utf8');
  }
}

function readStorageSnapshot() {
  ensureStorageFile();
  const primarySnapshot = readSnapshotFile(storageFilePath);
  if (primarySnapshot) {
    return primarySnapshot;
  }

  const backupSnapshot = readSnapshotFile(storageBackupFilePath);
  if (backupSnapshot) {
    writeStorageSnapshot(backupSnapshot);
    return backupSnapshot;
  }

  return {};
}

function writeStorageSnapshot(snapshot) {
  ensureStorageFile();
  const safeSnapshot = isObjectRecord(snapshot) ? snapshot : {};
  const serialized = JSON.stringify(safeSnapshot, null, 2);

  fs.writeFileSync(storageTempFilePath, serialized, 'utf8');
  fs.renameSync(storageTempFilePath, storageFilePath);
  fs.writeFileSync(storageBackupFilePath, serialized, 'utf8');
}

async function ensureParentDirectory(targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
}

async function ensureFile(targetPath) {
  await ensureParentDirectory(targetPath);

  try {
    await fsp.access(targetPath, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(targetPath, '', 'utf8');
  }
}

contextBridge.exposeInMainWorld('taskManagerDesktop', {
  isDesktop: true,
  getUserDataPath: () => userDataPath,
  storage: {
    getItem(key) {
      const snapshot = readStorageSnapshot();
      return typeof snapshot[key] === 'string' ? snapshot[key] : null;
    },
    setItem(key, value) {
      const snapshot = readStorageSnapshot();
      snapshot[key] = value;
      writeStorageSnapshot(snapshot);
    },
    removeItem(key) {
      const snapshot = readStorageSnapshot();
      delete snapshot[key];
      writeStorageSnapshot(snapshot);
    },
    clear() {
      writeStorageSnapshot({});
    },
  },
  fs: {
    selectDirectory() {
      return ipcRenderer.invoke('task-manager:select-directory');
    },
    basename(targetPath) {
      return path.basename(targetPath);
    },
    joinPath(basePath, entryName) {
      return path.join(basePath, entryName);
    },
    async pathExists(targetPath) {
      try {
        await fsp.access(targetPath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
    async ensureDirectory(targetPath) {
      await fsp.mkdir(targetPath, { recursive: true });
    },
    async ensureFile(targetPath) {
      await ensureFile(targetPath);
    },
    async readTextFile(targetPath) {
      return fsp.readFile(targetPath, 'utf8');
    },
    async writeTextFile(targetPath, content) {
      await ensureParentDirectory(targetPath);
      await fsp.writeFile(targetPath, content, 'utf8');
    },
    async removeEntry(targetPath, recursive = false) {
      await fsp.rm(targetPath, {
        force: false,
        recursive,
      });
    },
  },
});
