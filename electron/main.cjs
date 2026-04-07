const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

// Keep a stable desktop profile path in both dev and packaged modes.
app.setName('TaskManager');
app.setPath('userData', path.join(app.getPath('appData'), 'TaskManager'));

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const isDevServerMode = Boolean(DEV_SERVER_URL);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: 'TaskManager',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDevServerMode) {
    window.loadURL(DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[task-manager] did-fail-load:', { errorCode, errorDescription, validatedURL });
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('[task-manager] render-process-gone:', details);
  });
}

ipcMain.on('task-manager:get-user-data-path', (event) => {
  event.returnValue = app.getPath('userData');
});

ipcMain.handle('task-manager:select-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择项目文件夹',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  return {
    path: selectedPath,
    name: path.basename(selectedPath),
  };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('second-instance', () => {
    const [existingWindow] = BrowserWindow.getAllWindows();
    if (existingWindow) {
      if (existingWindow.isMinimized()) {
        existingWindow.restore();
      }
      existingWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
