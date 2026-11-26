import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import express from 'express';
import JSZip from 'jszip';

const execFileAsync = promisify(execFile);
const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const SETUP_EXE_PATH = path.join(RELEASE_DIR, 'Vietnam-War-1968-Setup.exe');
const LINUX_SH_PATH = path.join(RELEASE_DIR, 'Vietnam-War-1968-Linux-Installer.sh');
const LINUX_TAR_GZ_PATH = path.join(RELEASE_DIR, 'Vietnam-War-1968-Linux.tar.gz');
const PORT = Number(process.env.PORT || 3000);

let activeBuildPromise: Promise<void> | null = null;
let activeExeBuildPromise: Promise<void> | null = null;
let activeLinuxBuildPromise: Promise<void> | null = null;

async function ensureDistBuilt(): Promise<void> {
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
    return;
  } catch {
    // Build missing dist/ on demand so the Windows installer always ships complete offline assets
  }

  if (!activeBuildPromise) {
    const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
    activeBuildPromise = execFileAsync(process.execPath, [viteBin, 'build'], {
      cwd: ROOT_DIR,
    })
      .then(() => undefined)
      .finally(() => {
        activeBuildPromise = null;
      });
  }
  await activeBuildPromise;
}

async function ensureSetupExeBuilt(): Promise<string> {
  await ensureDistBuilt();
  let needsBuild = false;
  try {
    const [exeStat, distStat] = await Promise.all([
      fs.stat(SETUP_EXE_PATH),
      fs.stat(path.join(DIST_DIR, 'index.html')),
    ]);
    if (distStat.mtimeMs > exeStat.mtimeMs) {
      needsBuild = true;
    }
  } catch {
    needsBuild = true;
  }

  if (needsBuild) {
    if (!activeExeBuildPromise) {
      const exeScript = path.join(ROOT_DIR, 'scripts', 'build-windows-exe.mjs');
      activeExeBuildPromise = execFileAsync(process.execPath, [exeScript], {
        cwd: ROOT_DIR,
      })
        .then(() => undefined)
        .finally(() => {
          activeExeBuildPromise = null;
        });
    }
    await activeExeBuildPromise;
  }
  return SETUP_EXE_PATH;
}

async function ensureLinuxBuilt(): Promise<{ shPath: string; tarGzPath: string }> {
  await ensureDistBuilt();
  let needsBuild = false;
  try {
    const [shStat, tarStat, distStat] = await Promise.all([
      fs.stat(LINUX_SH_PATH),
      fs.stat(LINUX_TAR_GZ_PATH),
      fs.stat(path.join(DIST_DIR, 'index.html')),
    ]);
    if (distStat.mtimeMs > shStat.mtimeMs || distStat.mtimeMs > tarStat.mtimeMs) {
      needsBuild = true;
    }
  } catch {
    needsBuild = true;
  }

  if (needsBuild) {
    if (!activeLinuxBuildPromise) {
      const linuxScript = path.join(ROOT_DIR, 'scripts', 'build-linux-installer.mjs');
      activeLinuxBuildPromise = execFileAsync(process.execPath, [linuxScript], {
        cwd: ROOT_DIR,
      })
        .then(() => undefined)
        .finally(() => {
          activeLinuxBuildPromise = null;
        });
    }
    await activeLinuxBuildPromise;
  }
  return { shPath: LINUX_SH_PATH, tarGzPath: LINUX_TAR_GZ_PATH };
}

async function addDirectoryToZip(zip: JSZip, dirPath: string, zipPrefix: string): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, fullPath, relPath);
    } else if (entry.isFile()) {
      const data = await fs.readFile(fullPath);
      zip.file(relPath, data);
    }
  }
}

const INSTALL_BAT = `@echo off
setlocal
title Vietnam War 1968 - Windows PC Installer
echo Launching Vietnam War 1968 PC Installer...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\\install.ps1"
if errorlevel 1 (
  echo.
  echo Installation encountered an error. Press any key to close.
  pause > nul
)
endlocal
`;

const UNINSTALL_BAT = `@echo off
setlocal
title Uninstall Vietnam War 1968
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\\uninstall.ps1"
if errorlevel 1 pause
endlocal
`;

const PLAY_VBS = `Set shell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\\launch.ps1"""
shell.Run cmd, 0, False
`;

const LAUNCH_PS1 = `$ErrorActionPreference = 'Stop'
$InstallerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $InstallerDir
$AppDir = Join-Path $RootDir 'app'
$ProfileDir = Join-Path $RootDir 'browser-profile'

if (-not (Test-Path (Join-Path $AppDir 'index.html'))) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show('Game bundle files are missing. Please re-run Install-Vietnam-War.bat.', 'Vietnam War 1968')
  exit 1
}

# Pick a free local port on 127.0.0.1
$tcp = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
$tcp.Start()
$port = $tcp.LocalEndpoint.Port
$tcp.Stop()

$prefix = "http://127.0.0.1:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

$mimeTypes = @{
  '.html'        = 'text/html; charset=utf-8'
  '.js'          = 'application/javascript; charset=utf-8'
  '.mjs'         = 'application/javascript; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png'         = 'image/png'
  '.jpg'         = 'image/jpeg'
  '.svg'         = 'image/svg+xml'
  '.ico'         = 'image/x-icon'
  '.woff'        = 'font/woff'
  '.woff2'       = 'font/woff2'
  '.wasm'        = 'application/wasm'
}

# Run lightweight static asset server in a background runspace so browser waits cleanly
$rs = [RunspaceFactory]::CreateRunspace()
$rs.Open()
$ps = [PowerShell]::Create()
$ps.Runspace = $rs
[void]$ps.AddScript({
  param($listener, $appDir, $mimeTypes)
  $appRootFull = [System.IO.Path]::GetFullPath($appDir)
  while ($listener.IsListening) {
    try {
      $ctx = $listener.GetContext()
      $rawPath = $ctx.Request.Url.AbsolutePath.TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($rawPath)) { $rawPath = 'index.html' }
      $safePath = $rawPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $candidate = [System.IO.Path]::GetFullPath((Join-Path $appRootFull $safePath))
      if (-not $candidate.StartsWith($appRootFull) -or -not (Test-Path $candidate -PathType Leaf)) {
        $candidate = Join-Path $appRootFull 'index.html'
      }
      $ext = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
      $ctype = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($candidate)
      $ctx.Response.ContentType = $ctype
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.AddHeader('Cache-Control', 'no-cache')
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $ctx.Response.OutputStream.Close()
    } catch {
      break
    }
  }
}).AddArgument($listener).AddArgument($AppDir).AddArgument($mimeTypes)
$async = $ps.BeginInvoke()

# Find Edge / Chrome / Brave for frameless app-window mode
$browserCandidates = @(
  "$env:ProgramFiles(x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe",
  "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
  "$env:ProgramFiles(x86)\\Google\\Chrome\\Application\\chrome.exe",
  "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe",
  "$env:ProgramFiles\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
)
$browserExe = $browserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

try {
  if ($browserExe) {
    if (-not (Test-Path $ProfileDir)) { New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null }
    $browserArgs = "--app=$prefix --user-data-dir=""$ProfileDir"" --start-maximized"
    Start-Process -FilePath $browserExe -ArgumentList $browserArgs -Wait
  } else {
    Start-Process $prefix
    Start-Sleep -Seconds 1800
  }
} finally {
  try { $listener.Stop() } catch {}
  try { $listener.Close() } catch {}
  try { $ps.Dispose() } catch {}
  try { $rs.Dispose() } catch {}
}
`;

const INSTALL_PS1 = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$SourceRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$SourceApp = Join-Path $SourceRoot 'app'
$SourceInstaller = Join-Path $SourceRoot 'installer'

$TargetRoot = Join-Path $env:LOCALAPPDATA 'VietnamWar1968'
$TargetApp = Join-Path $TargetRoot 'app'
$TargetInstaller = Join-Path $TargetRoot 'installer'
$IconPath = Join-Path $TargetInstaller 'vietnam-war-1968.ico'
$LauncherVbs = Join-Path $TargetInstaller 'Play-Vietnam-War.vbs'

if (-not (Test-Path (Join-Path $SourceApp 'index.html'))) {
  [System.Windows.Forms.MessageBox]::Show(
    'Please extract the entire ZIP archive before running Install-Vietnam-War.bat.',
    'Vietnam War 1968 Installer',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
  exit 1
}

Write-Host 'Installing Vietnam War 1968 to' $TargetRoot '...'
New-Item -ItemType Directory -Path $TargetApp -Force | Out-Null
New-Item -ItemType Directory -Path $TargetInstaller -Force | Out-Null

Copy-Item -Path (Join-Path $SourceApp '*') -Destination $TargetApp -Recurse -Force
Copy-Item -Path (Join-Path $SourceInstaller '*') -Destination $TargetInstaller -Recurse -Force
Copy-Item -Path (Join-Path $SourceRoot 'Uninstall-Vietnam-War.bat') -Destination $TargetRoot -Force

$wsh = New-Object -ComObject WScript.Shell

# Desktop shortcut
$DesktopLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Vietnam War 1968.lnk'
$sc = $wsh.CreateShortcut($DesktopLnk)
$sc.TargetPath = 'wscript.exe'
$sc.Arguments = "//B ""$LauncherVbs"""
$sc.WorkingDirectory = $TargetRoot
$sc.Description = 'Launch Vietnam War 1968 Military Simulation FPS'
if (Test-Path $IconPath) { $sc.IconLocation = $IconPath }
$sc.Save()

# Start Menu shortcuts
$StartMenuDir = Join-Path ([Environment]::GetFolderPath('Programs')) 'Vietnam War 1968'
New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
$StartLnk = Join-Path $StartMenuDir 'Vietnam War 1968.lnk'
$sc2 = $wsh.CreateShortcut($StartLnk)
$sc2.TargetPath = 'wscript.exe'
$sc2.Arguments = "//B ""$LauncherVbs"""
$sc2.WorkingDirectory = $TargetRoot
$sc2.Description = 'Launch Vietnam War 1968 Military Simulation FPS'
if (Test-Path $IconPath) { $sc2.IconLocation = $IconPath }
$sc2.Save()

$UninstallPs1 = Join-Path $TargetInstaller 'uninstall.ps1'
$UninstallLnk = Join-Path $StartMenuDir 'Uninstall Vietnam War 1968.lnk'
$sc3 = $wsh.CreateShortcut($UninstallLnk)
$sc3.TargetPath = 'powershell.exe'
$sc3.Arguments = "-NoProfile -ExecutionPolicy Bypass -File ""$UninstallPs1"""
$sc3.WorkingDirectory = $TargetRoot
$sc3.Save()

# Register in Windows Settings -> Apps & Features (HKCU per-user, no UAC admin prompt needed)
$RegPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968'
New-Item -Path $RegPath -Force | Out-Null
Set-ItemProperty -Path $RegPath -Name 'DisplayName' -Value 'Vietnam War 1968'
Set-ItemProperty -Path $RegPath -Name 'DisplayVersion' -Value '1.0.0'
Set-ItemProperty -Path $RegPath -Name 'Publisher' -Value 'Mekong Valley Tactical Sim'
Set-ItemProperty -Path $RegPath -Name 'InstallLocation' -Value $TargetRoot
if (Test-Path $IconPath) { Set-ItemProperty -Path $RegPath -Name 'DisplayIcon' -Value $IconPath }
Set-ItemProperty -Path $RegPath -Name 'UninstallString' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""$UninstallPs1"""
Set-ItemProperty -Path $RegPath -Name 'NoModify' -Value 1 -Type DWord
Set-ItemProperty -Path $RegPath -Name 'NoRepair' -Value 1 -Type DWord

Write-Host 'Installation complete! Shortcuts added to Desktop and Start Menu.'
$answer = [System.Windows.Forms.MessageBox]::Show(
  "Vietnam War 1968 installed successfully to Desktop and Start Menu.\`n\`nLaunch the game now?",
  'Vietnam War 1968 Installer',
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Information
)
if ($answer -eq [System.Windows.Forms.DialogResult]::Yes) {
  Start-Process 'wscript.exe' -ArgumentList "//B ""$LauncherVbs"""
}
`;

const UNINSTALL_PS1 = `$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms

$TargetRoot = Join-Path $env:LOCALAPPDATA 'VietnamWar1968'
$DesktopLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Vietnam War 1968.lnk'
$StartMenuDir = Join-Path ([Environment]::GetFolderPath('Programs')) 'Vietnam War 1968'
$RegPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968'

Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match 'powershell|msedge|chrome' -and $_.CommandLine -like '*VietnamWar1968*'
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

if (Test-Path $DesktopLnk) { Remove-Item $DesktopLnk -Force }
if (Test-Path $StartMenuDir) { Remove-Item $StartMenuDir -Recurse -Force }
if (Test-Path $RegPath) { Remove-Item $RegPath -Recurse -Force }
if (Test-Path $TargetRoot) { Remove-Item $TargetRoot -Recurse -Force }

[System.Windows.Forms.MessageBox]::Show(
  'Vietnam War 1968 has been uninstalled from your PC.',
  'Uninstall Complete',
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
`;

const ELECTRON_PACKAGE_JSON = `{
  "name": "vietnam-war-1968-desktop",
  "version": "1.0.0",
  "description": "Vietnam War 1968 Open-World Military Simulation FPS",
  "main": "main.cjs",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder --win nsis --x64"
  },
  "build": {
    "appId": "com.mekongvalley.vietnamwar1968",
    "productName": "Vietnam War 1968",
    "directories": {
      "output": "dist-installer"
    },
    "files": [
      "main.cjs",
      "../app/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "../installer/vietnam-war-1968.ico"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  },
  "devDependencies": {
    "electron": "^35.0.0",
    "electron-builder": "^25.1.8"
  }
}
`;

const ELECTRON_MAIN_CJS = `const { app, BrowserWindow, protocol } = require('electron');
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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

let server = null;

function startStaticAppServer() {
  const appRoot = fs.existsSync(path.join(__dirname, 'app'))
    ? path.join(__dirname, 'app')
    : path.join(__dirname, '..', 'app');

  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(reqUrl.pathname).replace(/^\\/+/, '');
      if (!rel) rel = 'index.html';
      let target = path.resolve(appRoot, rel);
      if (!target.startsWith(appRoot) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        target = path.join(appRoot, 'index.html');
      }
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(\`http://127.0.0.1:\${addr.port}/\`);
    });
  });
}

app.whenReady().then(async () => {
  const url = await startStaticAppServer();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0e120d',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'installer', 'vietnam-war-1968.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(url);
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
`;

const BUILD_EXE_BAT = `@echo off
setlocal
title Build Standalone Setup.exe (Electron NSIS)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required only to compile a standalone Setup.exe.
  echo Note: Install-Vietnam-War.bat in the parent folder works WITHOUT Node.js!
  pause
  exit /b 1
)
echo Installing Electron builder dependencies...
call npm install
if errorlevel 1 pause & exit /b 1
echo Building Windows Setup.exe installer...
call npm run dist
if errorlevel 1 pause & exit /b 1
echo.
echo Built Setup.exe inside electron\\dist-installer\\
explorer dist-installer
endlocal
`;

const README_TXT = `VIETNAM WAR 1968 - WINDOWS PC INSTALLER
======================================

OPTION 1: ONE-CLICK WINDOWS INSTALLER (No Node.js or external tools needed)
1. Extract this entire ZIP folder anywhere on your Windows 10 or Windows 11 PC.
2. Double-click "Install-Vietnam-War.bat".
3. The installer copies the offline game bundle into your local user folder
   (%LOCALAPPDATA%\\VietnamWar1968), installs Desktop and Start Menu shortcuts
   with custom icon, and registers "Vietnam War 1968" in Windows Apps & Features.
4. Launch anytime from Desktop or Start Menu ("Vietnam War 1968").
5. To uninstall, use Windows Settings -> Apps or run "Uninstall-Vietnam-War.bat".

OPTION 2: BUILD A STANDALONE NSIS Setup.exe (Optional, requires Node.js)
1. Open the "electron" folder.
2. Double-click "Build-Setup-Exe.bat".
3. Electron Builder produces a standalone Setup.exe inside electron\\dist-installer\\.
`;

async function createServer() {
  const app = express();

  const handleExeDownload = async (_req: express.Request, res: express.Response) => {
    try {
      const exePath = await ensureSetupExeBuilt();
      const exeBuffer = await fs.readFile(exePath);
      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Vietnam-War-1968-Setup.exe"',
      );
      res.setHeader('Content-Length', String(exeBuffer.length));
      res.send(exeBuffer);
    } catch (err) {
      console.error('Failed to serve standalone .exe installer:', err);
      res.status(500).json({ error: 'Unable to package standalone Windows .exe installer.' });
    }
  };

  app.get('/api/Vietnam-War-1968-Setup.exe', handleExeDownload);
  app.get('/api/windows-setup.exe', handleExeDownload);

  const handleLinuxShDownload = async (_req: express.Request, res: express.Response) => {
    try {
      const { shPath } = await ensureLinuxBuilt();
      const shBuffer = await fs.readFile(shPath);
      res.setHeader('Content-Type', 'application/x-sh');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Vietnam-War-1968-Linux-Installer.sh"',
      );
      res.setHeader('Content-Length', String(shBuffer.length));
      res.send(shBuffer);
    } catch (err) {
      console.error('Failed to serve Linux .sh installer:', err);
      res.status(500).json({ error: 'Unable to package Linux installer script.' });
    }
  };

  const handleLinuxTarGzDownload = async (_req: express.Request, res: express.Response) => {
    try {
      const { tarGzPath } = await ensureLinuxBuilt();
      const tarBuffer = await fs.readFile(tarGzPath);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Vietnam-War-1968-Linux.tar.gz"',
      );
      res.setHeader('Content-Length', String(tarBuffer.length));
      res.send(tarBuffer);
    } catch (err) {
      console.error('Failed to serve Linux .tar.gz archive:', err);
      res.status(500).json({ error: 'Unable to package Linux .tar.gz archive.' });
    }
  };

  app.get('/api/Vietnam-War-1968-Linux-Installer.sh', handleLinuxShDownload);
  app.get('/api/linux-installer.sh', handleLinuxShDownload);
  app.get('/api/Vietnam-War-1968-Linux.tar.gz', handleLinuxTarGzDownload);
  app.get('/api/linux-installer.tar.gz', handleLinuxTarGzDownload);

  app.get('/api/windows-installer.zip', async (_req, res) => {
    try {
      await ensureDistBuilt();
      const zip = new JSZip();

      await addDirectoryToZip(zip, DIST_DIR, 'app');

      // Ensure Windows icon exists inside installer/
      try {
        const icoBytes = await fs.readFile(path.join(PUBLIC_DIR, 'vietnam-war-1968.ico'));
        zip.file('installer/vietnam-war-1968.ico', icoBytes);
      } catch {
        // Optional fallback if icon missing
      }

      zip.file('Install-Vietnam-War.bat', INSTALL_BAT);
      zip.file('Uninstall-Vietnam-War.bat', UNINSTALL_BAT);
      zip.file('README-WINDOWS-INSTALL.txt', README_TXT);

      zip.file('installer/install.ps1', INSTALL_PS1);
      zip.file('installer/uninstall.ps1', UNINSTALL_PS1);
      zip.file('installer/launch.ps1', LAUNCH_PS1);
      zip.file('installer/Play-Vietnam-War.vbs', PLAY_VBS);

      const electronDir = path.join(ROOT_DIR, 'electron');
      for (const relFile of ['package.json', 'main.cjs', 'preload.cjs']) {
        try {
          const content = await fs.readFile(path.join(electronDir, relFile));
          zip.file(`electron/${relFile}`, content);
        } catch {
          if (relFile === 'package.json') zip.file('electron/package.json', ELECTRON_PACKAGE_JSON);
          if (relFile === 'main.cjs') zip.file('electron/main.cjs', ELECTRON_MAIN_CJS);
        }
      }
      zip.file('electron/Build-Setup-Exe.bat', BUILD_EXE_BAT);

      const archive = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Vietnam-War-1968-Windows-Installer.zip"',
      );
      res.setHeader('Content-Length', String(archive.length));
      res.send(archive);
    } catch (err) {
      console.error('Failed to build Windows installer ZIP:', err);
      res.status(500).json({ error: 'Unable to package Windows installer archive.' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  } else {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...(disableHmr ? { hmr: false, ws: false } : {}),
      },
      appType: 'spa',
    });

    if (disableHmr) {
      app.get('/@vite/client', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(`import "/node_modules/vite/dist/client/env.mjs";
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay {}
`);
      });
    }

    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vietnam War 1968 server listening on http://0.0.0.0:${PORT}`);
  });
}

void createServer();
