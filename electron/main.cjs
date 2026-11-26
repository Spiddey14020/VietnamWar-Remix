const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

let server = null;
let mainWindow = null;
let lastUpdaterState = {
  stage: 'idle',
  currentVersion: app.getVersion(),
  message: '',
};

function broadcastUpdaterState(nextState) {
  lastUpdaterState = {
    currentVersion: app.getVersion(),
    ...nextState,
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', lastUpdaterState);
  }
}

function resolveAppDir() {
  const localApp = path.join(__dirname, 'app');
  if (fs.existsSync(path.join(localApp, 'index.html'))) {
    return localApp;
  }
  const parentDist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(path.join(parentDist, 'index.html'))) {
    return parentDist;
  }
  return localApp;
}

function resolveWindowIcon() {
  const icoPath = path.join(__dirname, 'icons', 'vietnam-war-1968.ico');
  const pngPath = path.join(__dirname, 'icons', 'vietnam-war-1968.png');
  if (process.platform === 'win32' && fs.existsSync(icoPath)) {
    return icoPath;
  }
  if (fs.existsSync(pngPath)) {
    return pngPath;
  }
  return undefined;
}

function startStaticAppServer() {
  const appRoot = path.resolve(resolveAppDir());

  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, '');
      if (!rel) rel = 'index.html';

      let target = path.resolve(appRoot, rel);
      const insideRoot =
        target === appRoot || target.startsWith(`${appRoot}${path.sep}`);
      if (!insideRoot || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        target = path.join(appRoot, 'index.html');
      }

      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(target).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(`http://127.0.0.1:${addr.port}/`);
    });
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    broadcastUpdaterState({
      stage: 'checking',
      message: 'Checking GitHub Releases for updates...',
    });
  });

  autoUpdater.on('update-available', (info) => {
    broadcastUpdaterState({
      stage: 'available',
      availableVersion: info.version,
      message: `Update v${info.version} found. Downloading...`,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    broadcastUpdaterState({
      stage: 'not-available',
      availableVersion: info?.version,
      message: `Up to date (v${app.getVersion()}).`,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcastUpdaterState({
      stage: 'downloading',
      progress: Math.round(progress.percent || 0),
      message: `Downloading update (${Math.round(progress.percent || 0)}%)...`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdaterState({
      stage: 'downloaded',
      availableVersion: info.version,
      progress: 100,
      message: `v${info.version} ready to install.`,
    });
  });

  autoUpdater.on('error', (err) => {
    const raw = err instanceof Error ? err.message : String(err || 'Update check failed');
    broadcastUpdaterState({
      stage: 'error',
      message: raw.split('\n')[0].slice(0, 140),
    });
  });

  ipcMain.handle('updater:get-version', () => app.getVersion());

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      broadcastUpdaterState({
        stage: 'unsupported',
        message: 'Live auto-updates are active in packaged GitHub Release builds.',
      });
      return { supported: false, reason: 'unpackaged' };
    }
    try {
      await autoUpdater.checkForUpdates();
      return { supported: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      broadcastUpdaterState({
        stage: 'error',
        message: msg.split('\n')[0].slice(0, 140),
      });
      return { supported: true, reason: msg };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) return false;
    await autoUpdater.downloadUpdate();
    return true;
  });

  ipcMain.handle('updater:install', () => {
    if (server) {
      try {
        server.close();
      } catch {
        // ignore close error on exit
      }
    }
    autoUpdater.quitAndInstall(false, true);
  });
}

app.whenReady().then(async () => {
  setupAutoUpdater();

  const url = await startStaticAppServer();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0e120d',
    autoHideMenuBar: true,
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.hostname === 'accounts.google.com') {
        return { action: 'allow' };
      }
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        void shell.openExternal(targetUrl);
      }
    } catch {
      // ignore invalid URL
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(url);
  broadcastUpdaterState(lastUpdaterState);

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {
        // Offline or unreachable GitHub Releases should fail silently on launch
      });
    }, 2500);
  }
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
