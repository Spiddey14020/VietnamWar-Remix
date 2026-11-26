import { execFile } from 'node:child_process';
import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
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
const UPDATE_STATE_PATH = path.join(ROOT_DIR, '.update-state.json');
const PORT = Number(process.env.PORT || 3000);

let activeBuildPromise: Promise<void> | null = null;
let activeExeBuildPromise: Promise<void> | null = null;
let activeLinuxBuildPromise: Promise<void> | null = null;

interface LocalUpdateState {
  installedVersion?: string;
  installedCommitSha?: string | null;
  installedAt?: string | null;
  repo?: string;
  serverUrl?: string;
}

const GITHUB_KNOWN_SAFE_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'codeload.github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);

function isPrivateOrBlockedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    if (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80')
    ) {
      return true;
    }
    if (normalized.startsWith('::ffff:')) {
      return isPrivateOrBlockedIp(normalized.slice(7));
    }
    return false;
  }
  return true;
}

async function assertPublicHttpsUrl(rawUrl: string, allowedHosts: Set<string>): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid GitHub server URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS GitHub servers are allowed.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Embedded credentials are not allowed in URLs.');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    net.isIP(host) !== 0
  ) {
    throw new Error('Loopback, private, or literal IP hosts are blocked.');
  }
  if (!allowedHosts.has(host)) {
    throw new Error(`Host "${host}" is outside the validated GitHub server allowlist.`);
  }
  const resolved = await dns.lookup(host, { all: true }).catch(() => []);
  if (resolved.length === 0) {
    throw new Error(`Could not resolve host "${host}".`);
  }
  for (const addr of resolved) {
    if (isPrivateOrBlockedIp(addr.address)) {
      throw new Error('Target host resolves to a restricted network address.');
    }
  }
  return parsed;
}

function parseGitHubConfigInput(
  rawRepo?: unknown,
  rawServerUrl?: unknown,
  rawBranch?: unknown,
): {
  owner: string;
  repoName: string;
  repo: string;
  serverUrl: string;
  serverHost: string;
  apiBase: string;
  branch: string;
  allowedHosts: Set<string>;
} {
  const repoStr = String(rawRepo || process.env.GITHUB_REPO || '').trim();
  const repoMatch = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/.exec(repoStr);
  if (
    !repoMatch ||
    repoMatch[1] === '.' ||
    repoMatch[1] === '..' ||
    repoMatch[2] === '.' ||
    repoMatch[2] === '..'
  ) {
    throw new Error('Repository must be in "owner/repo" format.');
  }
  const owner = repoMatch[1];
  const repoName = repoMatch[2];

  const branchStr = String(rawBranch || process.env.GITHUB_BRANCH || 'main').trim();
  if (
    !/^[A-Za-z0-9._/-]{1,120}$/.test(branchStr) ||
    branchStr.includes('..') ||
    branchStr.startsWith('/') ||
    branchStr.endsWith('/')
  ) {
    throw new Error('Invalid branch or ref name.');
  }

  const serverInput = String(
    rawServerUrl || process.env.GITHUB_SERVER_URL || 'https://github.com',
  )
    .trim()
    .replace(/\/+$/, '');
  let serverParsed: URL;
  try {
    serverParsed = new URL(serverInput);
  } catch {
    throw new Error('Invalid GitHub server URL.');
  }
  if (serverParsed.protocol !== 'https:' || serverParsed.username || serverParsed.password) {
    throw new Error('GitHub server URL must be a clean HTTPS origin.');
  }
  const serverHost = serverParsed.hostname.toLowerCase();
  if (
    !serverHost ||
    serverHost === 'localhost' ||
    serverHost.endsWith('.localhost') ||
    serverHost.endsWith('.local') ||
    serverHost.endsWith('.internal') ||
    net.isIP(serverHost) !== 0
  ) {
    throw new Error('GitHub server host cannot be a local/private address.');
  }

  const isPublicGitHub = serverHost === 'github.com' || serverHost === 'api.github.com';
  const normalizedServerUrl = isPublicGitHub
    ? 'https://github.com'
    : `https://${serverParsed.host}`;
  const apiBase = isPublicGitHub
    ? 'https://api.github.com'
    : `https://${serverParsed.host}/api/v3`;

  const allowedHosts = new Set<string>(GITHUB_KNOWN_SAFE_HOSTS);
  allowedHosts.add(serverHost);

  return {
    owner,
    repoName,
    repo: `${owner}/${repoName}`,
    serverUrl: normalizedServerUrl,
    serverHost,
    apiBase,
    branch: branchStr,
    allowedHosts,
  };
}

async function fetchGitHubApiJson(
  urlStr: string,
  allowedHosts: Set<string>,
  apiHost: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = await assertPublicHttpsUrl(urlStr, allowedHosts);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Vietnam-War-1968-Updater',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token && url.hostname.toLowerCase() === apiHost) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  return { ok: resp.ok, status: resp.status, data };
}

async function fetchGitHubBinaryWithRedirects(
  initialUrlStr: string,
  allowedHosts: Set<string>,
  apiHost: string,
  maxBytes = 55 * 1024 * 1024,
): Promise<Buffer> {
  let currentUrl = await assertPublicHttpsUrl(initialUrlStr, allowedHosts);
  const token = process.env.GITHUB_TOKEN?.trim();

  for (let hop = 0; hop < 6; hop++) {
    const headers: Record<string, string> = {
      Accept: 'application/octet-stream, application/zip, */*',
      'User-Agent': 'Vietnam-War-1968-Updater',
    };
    if (token && currentUrl.hostname.toLowerCase() === apiHost) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resp = await fetch(currentUrl.toString(), {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(45000),
    });

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      if (!location) throw new Error('Redirect missing target location.');
      const nextRaw = new URL(location, currentUrl).toString();
      currentUrl = await assertPublicHttpsUrl(nextRaw, allowedHosts);
      continue;
    }

    if (!resp.ok) {
      throw new Error(`GitHub download failed with status HTTP ${resp.status}.`);
    }

    const contentLength = Number(resp.headers.get('content-length') || '0');
    if (contentLength > maxBytes) {
      throw new Error('Update archive exceeds maximum allowed 55 MB limit.');
    }

    const arrBuf = await resp.arrayBuffer();
    if (arrBuf.byteLength > maxBytes) {
      throw new Error('Update archive exceeds maximum allowed 55 MB limit.');
    }
    return Buffer.from(arrBuf);
  }
  throw new Error('Too many redirects while downloading GitHub update.');
}

function compareSemverStrings(aRaw: string, bRaw: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .slice(0, 3)
      .map((n) => parseInt(n, 10) || 0);
  const [a0 = 0, a1 = 0, a2 = 0] = parse(aRaw);
  const [b0 = 0, b1 = 0, b2 = 0] = parse(bRaw);
  if (a0 !== b0) return a0 > b0 ? 1 : -1;
  if (a1 !== b1) return a1 > b1 ? 1 : -1;
  if (a2 !== b2) return a2 > b2 ? 1 : -1;
  return 0;
}

async function readLocalVersionAndState(): Promise<{
  currentVersion: string;
  state: LocalUpdateState;
}> {
  let pkgVersion = '1.0.0';
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    if (typeof pkg.version === 'string' && pkg.version) pkgVersion = pkg.version;
  } catch {
    // fallback
  }
  let state: LocalUpdateState = {};
  try {
    state = JSON.parse(await fs.readFile(UPDATE_STATE_PATH, 'utf8')) as LocalUpdateState;
  } catch {
    // no update state yet
  }
  return {
    currentVersion: state.installedVersion || pkgVersion,
    state,
  };
}

function safeResolveWithinDir(baseDir: string, relPosixPath: string): string | null {
  const cleaned = relPosixPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('\0')) return null;
  const segments = cleaned.split('/');
  if (segments.some((seg) => seg === '..' || seg === '.')) return null;
  const resolvedBase = path.resolve(baseDir);
  const target = path.resolve(resolvedBase, ...segments);
  if (target !== resolvedBase && !target.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return target;
}

async function copyDirOverwrite(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirOverwrite(s, d);
    } else if (entry.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}

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

      zip.file('electron/package.json', ELECTRON_PACKAGE_JSON);
      zip.file('electron/main.cjs', ELECTRON_MAIN_CJS);
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

  app.use('/api/github', express.json({ limit: '64kb' }));

  app.get('/api/github/config', async (_req, res) => {
    const { currentVersion, state } = await readLocalVersionAndState();
    res.json({
      currentVersion,
      installedCommitSha: state.installedCommitSha ?? null,
      installedAt: state.installedAt ?? null,
      defaultServerUrl: process.env.GITHUB_SERVER_URL?.trim() || 'https://github.com',
      defaultRepo: process.env.GITHUB_REPO?.trim() || state.repo || '',
      defaultBranch: process.env.GITHUB_BRANCH?.trim() || 'main',
    });
  });

  app.get('/api/github/check-update', async (req, res) => {
    try {
      const cfg = parseGitHubConfigInput(
        req.query.repo,
        req.query.serverUrl,
        req.query.branch,
      );
      const apiHost = new URL(cfg.apiBase).hostname.toLowerCase();
      const { currentVersion, state } = await readLocalVersionAndState();

      // Fetch latest release (prefer /releases/latest, fallback to /releases?per_page=1)
      let releaseObj: any = null;
      const latestRel = await fetchGitHubApiJson(
        `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repoName}/releases/latest`,
        cfg.allowedHosts,
        apiHost,
      );
      if (latestRel.ok && latestRel.data) {
        releaseObj = latestRel.data;
      } else if (latestRel.status === 404) {
        const listRel = await fetchGitHubApiJson(
          `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repoName}/releases?per_page=1`,
          cfg.allowedHosts,
          apiHost,
        );
        if (listRel.ok && Array.isArray(listRel.data) && listRel.data.length > 0) {
          releaseObj = listRel.data[0];
        }
      } else if (!latestRel.ok) {
        return res.status(latestRel.status === 404 ? 404 : 502).json({
          error:
            latestRel.data?.message ||
            `GitHub API error (HTTP ${latestRel.status}) while querying ${cfg.repo}.`,
        });
      }

      // Fetch latest commit on selected branch
      const commitResp = await fetchGitHubApiJson(
        `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repoName}/commits/${encodeURIComponent(cfg.branch)}`,
        cfg.allowedHosts,
        apiHost,
      );
      if (!commitResp.ok && !releaseObj) {
        return res.status(commitResp.status === 404 ? 404 : 502).json({
          error:
            commitResp.data?.message ||
            `Repository or branch "${cfg.branch}" not found on ${cfg.serverUrl}.`,
        });
      }

      let latestRelease: any = null;
      if (releaseObj) {
        const safeAssets: any[] = [];
        if (Array.isArray(releaseObj.assets)) {
          for (const asset of releaseObj.assets) {
            if (typeof asset?.browser_download_url === 'string') {
              try {
                await assertPublicHttpsUrl(asset.browser_download_url, cfg.allowedHosts);
                safeAssets.push({
                  name: String(asset.name || 'asset'),
                  size: Number(asset.size || 0),
                  downloadUrl: asset.browser_download_url,
                  contentType: String(asset.content_type || 'application/octet-stream'),
                });
              } catch {
                // Skip unsafe external asset hosts
              }
            }
          }
        }
        latestRelease = {
          tagName: String(releaseObj.tag_name || ''),
          name: String(releaseObj.name || releaseObj.tag_name || 'Release'),
          publishedAt: releaseObj.published_at || null,
          body: String(releaseObj.body || '').slice(0, 4000),
          htmlUrl: String(releaseObj.html_url || `${cfg.serverUrl}/${cfg.repo}/releases`),
          zipballUrl: typeof releaseObj.zipball_url === 'string' ? releaseObj.zipball_url : null,
          tarballUrl: typeof releaseObj.tarball_url === 'string' ? releaseObj.tarball_url : null,
          assets: safeAssets,
        };
      }

      const commitData = commitResp.ok ? commitResp.data : null;
      const latestCommit = commitData?.sha
        ? {
            sha: String(commitData.sha),
            shortSha: String(commitData.sha).slice(0, 7),
            message: String(commitData.commit?.message || '').split('\n')[0],
            author: String(
              commitData.commit?.author?.name || commitData.author?.login || 'Maintainer',
            ),
            date: commitData.commit?.author?.date || null,
            htmlUrl: String(
              commitData.html_url || `${cfg.serverUrl}/${cfg.repo}/commit/${commitData.sha}`,
            ),
          }
        : null;

      let updateAvailable = false;
      let comparisonReason = 'Current version matches upstream.';
      if (latestRelease?.tagName) {
        const cmp = compareSemverStrings(latestRelease.tagName, currentVersion);
        if (cmp > 0) {
          updateAvailable = true;
          comparisonReason = `${latestRelease.tagName} is newer than installed v${currentVersion.replace(/^v/i, '')}`;
        } else {
          comparisonReason = `Installed v${currentVersion.replace(/^v/i, '')} is up to date with ${latestRelease.tagName}`;
        }
      } else if (latestCommit) {
        if (!state.installedCommitSha || state.installedCommitSha !== latestCommit.sha) {
          updateAvailable = true;
          comparisonReason = `New commit ${latestCommit.shortSha} available on ${cfg.branch}`;
        } else {
          comparisonReason = `Running latest commit ${latestCommit.shortSha}`;
        }
      }

      res.json({
        currentVersion,
        installedCommitSha: state.installedCommitSha ?? null,
        installedAt: state.installedAt ?? null,
        repo: cfg.repo,
        serverUrl: cfg.serverUrl,
        branch: cfg.branch,
        updateAvailable,
        comparisonReason,
        latestRelease,
        latestCommit,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to check GitHub updates.',
      });
    }
  });

  app.get('/api/github/download-archive', async (req, res) => {
    try {
      const cfg = parseGitHubConfigInput(
        req.query.repo,
        req.query.serverUrl,
        req.query.ref || req.query.branch,
      );
      const apiHost = new URL(cfg.apiBase).hostname.toLowerCase();
      const zipApiUrl = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repoName}/zipball/${encodeURIComponent(cfg.branch)}`;
      const buf = await fetchGitHubBinaryWithRedirects(zipApiUrl, cfg.allowedHosts, apiHost);
      const safeFile = `${cfg.owner}-${cfg.repoName}-${cfg.branch.replace(/[^A-Za-z0-9._-]/g, '_')}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFile}"`);
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to download GitHub archive.',
      });
    }
  });

  app.post('/api/github/install-update', async (req, res) => {
    const tmpStage = await fs.mkdtemp(path.join(os.tmpdir(), 'vw1968-gh-update-'));
    try {
      const cfg = parseGitHubConfigInput(
        req.body?.repo,
        req.body?.serverUrl,
        req.body?.branch,
      );
      const apiHost = new URL(cfg.apiBase).hostname.toLowerCase();
      const requestedTag =
        typeof req.body?.tagName === 'string' && req.body.tagName.trim()
          ? req.body.tagName.trim()
          : null;
      if (requestedTag && (!/^[A-Za-z0-9._/-]{1,120}$/.test(requestedTag) || requestedTag.includes('..'))) {
        return res.status(400).json({ error: 'Invalid release tag.' });
      }

      // Resolve commit SHA and optional release metadata
      let releaseTag = requestedTag;
      let downloadUrl = `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repoName}/zipball/${encodeURIComponent(releaseTag || cfg.branch)}`;
      const commitResp = await fetchGitHubApiJson(
        `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repoName}/commits/${encodeURIComponent(releaseTag || cfg.branch)}`,
        cfg.allowedHosts,
        apiHost,
      );
      const commitSha: string | null = commitResp.ok && commitResp.data?.sha ? String(commitResp.data.sha) : null;

      if (releaseTag) {
        const relResp = await fetchGitHubApiJson(
          `${cfg.apiBase}/repos/${cfg.owner}/${cfg.repoName}/releases/tags/${encodeURIComponent(releaseTag)}`,
          cfg.allowedHosts,
          apiHost,
        );
        if (relResp.ok && relResp.data) {
          const bundleAsset = Array.isArray(relResp.data.assets)
            ? relResp.data.assets.find((a: any) =>
                typeof a?.name === 'string' &&
                /dist|bundle|web/i.test(a.name) &&
                a.name.endsWith('.zip') &&
                typeof a.browser_download_url === 'string',
              )
            : null;
          if (bundleAsset) {
            downloadUrl = bundleAsset.browser_download_url;
          } else if (typeof relResp.data.zipball_url === 'string') {
            downloadUrl = relResp.data.zipball_url;
          }
        }
      }

      const zipBuf = await fetchGitHubBinaryWithRedirects(downloadUrl, cfg.allowedHosts, apiHost);
      const zip = await JSZip.loadAsync(zipBuf);
      const fileEntries = Object.values(zip.files).filter((f) => !f.dir);
      if (fileEntries.length === 0) {
        throw new Error('Downloaded GitHub archive was empty.');
      }

      // Detect common single top-level directory prefix (GitHub zipballs wrap files in owner-repo-sha/)
      const firstSegments = new Set(
        fileEntries.map((f) => f.name.replace(/\\/g, '/').split('/')[0]).filter(Boolean),
      );
      const stripRootPrefix = firstSegments.size === 1 && fileEntries.every((f) => f.name.includes('/'));

      for (const entry of fileEntries) {
        let rel = entry.name.replace(/\\/g, '/');
        if (stripRootPrefix) {
          const slashIdx = rel.indexOf('/');
          rel = slashIdx >= 0 ? rel.slice(slashIdx + 1) : rel;
        }
        const safeOut = safeResolveWithinDir(tmpStage, rel);
        if (!safeOut) continue;
        await fs.mkdir(path.dirname(safeOut), { recursive: true });
        const content = await entry.async('nodebuffer');
        await fs.writeFile(safeOut, content);
      }

      // Check whether the archive is a prebuilt dist bundle or a source repository
      let installedMode: 'bundle' | 'source' = 'source';
      const hasStagedRootIndex = await fs
        .access(path.join(tmpStage, 'index.html'))
        .then(() => true)
        .catch(() => false);
      const hasStagedDist = await fs
        .access(path.join(tmpStage, 'dist', 'index.html'))
        .then(() => true)
        .catch(() => false);
      const hasStagedSrc = await fs
        .access(path.join(tmpStage, 'src'))
        .then(() => true)
        .catch(() => false);

      if (hasStagedDist) {
        installedMode = 'bundle';
        await copyDirOverwrite(path.join(tmpStage, 'dist'), DIST_DIR);
      } else if (hasStagedRootIndex && !hasStagedSrc) {
        installedMode = 'bundle';
        await copyDirOverwrite(tmpStage, DIST_DIR);
      } else if (hasStagedSrc) {
        installedMode = 'source';
        const allowedDirs = ['src', 'public', 'scripts'];
        for (const dirName of allowedDirs) {
          const sDir = path.join(tmpStage, dirName);
          const exists = await fs
            .access(sDir)
            .then(() => true)
            .catch(() => false);
          if (exists) {
            await copyDirOverwrite(sDir, path.join(ROOT_DIR, dirName));
          }
        }
        const allowedFiles = [
          'index.html',
          'package.json',
          'tsconfig.json',
          'vite.config.ts',
          'metadata.json',
        ];
        for (const fileName of allowedFiles) {
          const sFile = path.join(tmpStage, fileName);
          const exists = await fs
            .access(sFile)
            .then(() => true)
            .catch(() => false);
          if (exists) {
            await fs.copyFile(sFile, path.join(ROOT_DIR, fileName));
          }
        }
        const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
        await execFileAsync(process.execPath, [viteBin, 'build'], { cwd: ROOT_DIR });
      } else {
        throw new Error('GitHub archive does not contain an app bundle or src/ directory.');
      }

      // Refresh local installers quietly if tools are present
      try {
        await execFileAsync(process.execPath, [path.join(ROOT_DIR, 'scripts', 'build-linux-installer.mjs')], {
          cwd: ROOT_DIR,
        });
      } catch {
        // optional
      }
      try {
        await execFileAsync(process.execPath, [path.join(ROOT_DIR, 'scripts', 'build-windows-exe.mjs')], {
          cwd: ROOT_DIR,
        });
      } catch {
        // optional
      }

      const { currentVersion } = await readLocalVersionAndState();
      const nextVersion = releaseTag ? releaseTag.replace(/^v/i, '') : currentVersion;
      const nextState: LocalUpdateState = {
        installedVersion: nextVersion,
        installedCommitSha: commitSha,
        installedAt: new Date().toISOString(),
        repo: cfg.repo,
        serverUrl: cfg.serverUrl,
      };
      await fs.writeFile(UPDATE_STATE_PATH, JSON.stringify(nextState, null, 2), 'utf8');

      res.json({
        installed: true,
        mode: installedMode,
        installedVersion: nextVersion,
        installedCommitSha: commitSha,
        message: `Installed ${releaseTag || (commitSha ? `commit ${commitSha.slice(0, 7)}` : cfg.branch)} from ${cfg.repo}. Reload the app to apply.`,
      });
    } catch (err: any) {
      const code = err?.code;
      const msg =
        code === 'EROFS' || code === 'EACCES'
          ? 'This hosted instance has a read-only filesystem. Use Download ZIP or Release Downloads to update locally.'
          : err instanceof Error
            ? err.message
            : 'Unable to install update from GitHub.';
      res.status(code === 'EROFS' || code === 'EACCES' ? 409 : 400).json({
        installed: false,
        error: msg,
      });
    } finally {
      await fs.rm(tmpStage, { recursive: true, force: true });
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
