import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');
const OUTPUT_EXE = path.join(RELEASE_DIR, 'Vietnam-War-1968-Setup.exe');

export const PLAY_VBS = `Set shell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\\launch.ps1"""
shell.Run cmd, 0, False
`;

export const LAUNCH_PS1 = `$ErrorActionPreference = 'Stop'
$InstallerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $InstallerDir
$AppDir = Join-Path $RootDir 'app'
$ProfileDir = Join-Path $RootDir 'browser-profile'

if (-not (Test-Path (Join-Path $AppDir 'index.html'))) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show('Game files are missing. Please re-run Vietnam-War-1968-Setup.exe.', 'Vietnam War 1968')
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

async function copyDirRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function computeDirSizeKb(dir) {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await computeDirSizeKb(full);
    } else if (entry.isFile()) {
      const stat = await fs.stat(full);
      total += stat.size;
    }
  }
  return Math.max(1024, Math.ceil(total / 1024));
}

async function hasMakensis() {
  try {
    await execFileAsync('makensis', ['-VERSION']);
    return true;
  } catch {
    return false;
  }
}

export async function buildStandaloneExe() {
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
  } catch {
    const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
    await execFileAsync(process.execPath, [viteBin, 'build'], { cwd: ROOT_DIR });
  }

  await fs.mkdir(RELEASE_DIR, { recursive: true });

  const makensisAvailable = await hasMakensis();
  if (!makensisAvailable) {
    try {
      await fs.access(OUTPUT_EXE);
      console.log(`makensis not installed; using prebuilt ${OUTPUT_EXE}`);
      return OUTPUT_EXE;
    } catch {
      throw new Error('NSIS compiler (makensis) is not installed and no prebuilt Setup.exe exists.');
    }
  }

  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vw1968-nsis-'));
  try {
    const stageApp = path.join(stageDir, 'app');
    const stageInstaller = path.join(stageDir, 'installer');
    await copyDirRecursive(DIST_DIR, stageApp);
    await fs.mkdir(stageInstaller, { recursive: true });

    const icoSrc = path.join(PUBLIC_DIR, 'vietnam-war-1968.ico');
    const icoDest = path.join(stageInstaller, 'vietnam-war-1968.ico');
    let hasIcon = false;
    try {
      await fs.copyFile(icoSrc, icoDest);
      hasIcon = true;
    } catch {
      hasIcon = false;
    }

    await fs.writeFile(path.join(stageInstaller, 'launch.ps1'), LAUNCH_PS1, 'utf8');
    await fs.writeFile(path.join(stageInstaller, 'Play-Vietnam-War.vbs'), PLAY_VBS, 'utf8');

    const estimatedSizeKb = await computeDirSizeKb(stageApp);
    const nsiScript = `Unicode True
!include "MUI2.nsh"

Name "Vietnam War 1968"
OutFile "${OUTPUT_EXE}"
InstallDir "$LOCALAPPDATA\\VietnamWar1968"
InstallDirRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "Vietnam War 1968"
VIAddVersionKey "CompanyName" "Mekong Valley Tactical Sim"
VIAddVersionKey "FileDescription" "Vietnam War 1968 Open-World Military Simulation Installer"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "ProductVersion" "1.0.0.0"
VIAddVersionKey "LegalCopyright" "Mekong Valley Tactical Sim"

${hasIcon ? `!define MUI_ICON "${icoDest}"\n!define MUI_UNICON "${icoDest}"` : ''}
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchGameFromFinish
!define MUI_FINISHPAGE_RUN_TEXT "Launch Vietnam War 1968 now"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function LaunchGameFromFinish
  Exec '"$SYSDIR\\wscript.exe" //B "$INSTDIR\\installer\\Play-Vietnam-War.vbs"'
FunctionEnd

Section "Vietnam War 1968" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR\\app"
  File /r "${stageApp}\\*"

  SetOutPath "$INSTDIR\\installer"
  File /r "${stageInstaller}\\*"

  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  ; Desktop Shortcut
  CreateShortCut "$DESKTOP\\Vietnam War 1968.lnk" "$SYSDIR\\wscript.exe" '//B "$INSTDIR\\installer\\Play-Vietnam-War.vbs"' ${hasIcon ? `"$INSTDIR\\installer\\vietnam-war-1968.ico"` : '""'} 0 SW_SHOWNORMAL "" "Launch Vietnam War 1968 Military Simulation FPS"

  ; Start Menu Folder & Shortcuts
  CreateDirectory "$SMPROGRAMS\\Vietnam War 1968"
  CreateShortCut "$SMPROGRAMS\\Vietnam War 1968\\Vietnam War 1968.lnk" "$SYSDIR\\wscript.exe" '//B "$INSTDIR\\installer\\Play-Vietnam-War.vbs"' ${hasIcon ? `"$INSTDIR\\installer\\vietnam-war-1968.ico"` : '""'} 0 SW_SHOWNORMAL "" "Launch Vietnam War 1968 Military Simulation FPS"
  CreateShortCut "$SMPROGRAMS\\Vietnam War 1968\\Uninstall Vietnam War 1968.lnk" "$INSTDIR\\Uninstall.exe"

  ; Register in Windows Settings -> Apps & Features
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "DisplayName" "Vietnam War 1968"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "Publisher" "Mekong Valley Tactical Sim"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "InstallLocation" "$INSTDIR"
  ${hasIcon ? `WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "DisplayIcon" "$INSTDIR\\installer\\vietnam-war-1968.ico"` : ''}
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "NoRepair" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968" "EstimatedSize" ${estimatedSizeKb}
SectionEnd

Section "Uninstall"
  nsExec::Exec 'powershell.exe -NoProfile -WindowStyle Hidden -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like $\'*VietnamWar1968*$\' -and $_.Name -match $\'powershell|msedge|chrome|brave$\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"'

  Delete "$DESKTOP\\Vietnam War 1968.lnk"
  Delete "$SMPROGRAMS\\Vietnam War 1968\\Vietnam War 1968.lnk"
  Delete "$SMPROGRAMS\\Vietnam War 1968\\Uninstall Vietnam War 1968.lnk"
  RMDir "$SMPROGRAMS\\Vietnam War 1968"

  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VietnamWar1968"

  RMDir /r "$INSTDIR\\app"
  RMDir /r "$INSTDIR\\installer"
  RMDir /r "$INSTDIR\\browser-profile"
  Delete "$INSTDIR\\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
`;

    const nsiPath = path.join(stageDir, 'installer.nsi');
    await fs.writeFile(nsiPath, nsiScript, 'utf8');
    await execFileAsync('makensis', ['-V2', nsiPath], { cwd: stageDir });

    const stat = await fs.stat(OUTPUT_EXE);
    console.log(`Built standalone Windows installer: ${OUTPUT_EXE} (${Math.round(stat.size / 1024)} KB)`);
    return OUTPUT_EXE;
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  buildStandaloneExe().catch((err) => {
    console.error('Failed to build standalone Windows .exe installer:', err);
    process.exitCode = 1;
  });
}
