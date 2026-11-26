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
const OUTPUT_TAR_GZ = path.join(RELEASE_DIR, 'Vietnam-War-1968-Linux.tar.gz');
const OUTPUT_SH = path.join(RELEASE_DIR, 'Vietnam-War-1968-Linux-Installer.sh');

const LAUNCH_SH = `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "\${BASH_SOURCE[0]}")")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="$ROOT_DIR/app"
PROFILE_DIR="$ROOT_DIR/browser-profile"

if [ ! -f "$APP_DIR/index.html" ]; then
  echo "Error: Vietnam War 1968 offline files missing in $APP_DIR" >&2
  if command -v zenity >/dev/null 2>&1; then
    zenity --error --title="Vietnam War 1968" --text="Game files are missing. Please re-run the Linux installer." || true
  fi
  exit 1
fi

PORT_FILE="$(mktemp)"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$PORT_FILE"
}
trap cleanup EXIT INT TERM

if command -v python3 >/dev/null 2>&1; then
  python3 - "$APP_DIR" "$PORT_FILE" <<'PYEOF' &
import http.server
import mimetypes
import os
import socketserver
import sys

app_dir = os.path.abspath(sys.argv[1])
port_file = sys.argv[2]

mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('application/wasm', '.wasm')

class SpaHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=app_dir, **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def send_error(self, code, message=None, explain=None):
        if code == 404:
            self.path = '/index.html'
            return self.do_GET()
        super().send_error(code, message, explain)
    def log_message(self, format, *args):
        pass

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

with ReusableTCPServer(('127.0.0.1', 0), SpaHandler) as httpd:
    with open(port_file, 'w', encoding='utf-8') as f:
        f.write(str(httpd.server_address[1]))
    httpd.serve_forever()
PYEOF
  SERVER_PID=$!
elif command -v node >/dev/null 2>&1; then
  node - "$APP_DIR" "$PORT_FILE" <<'JSEOF' &
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const appDir = path.resolve(process.argv[2]);
const portFile = process.argv[3];
const mime = {
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
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\\/+/, '') || 'index.html';
  let filePath = path.resolve(appDir, urlPath);
  if (!filePath.startsWith(appDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(appDir, 'index.html');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
});
server.listen(0, '127.0.0.1', () => {
  fs.writeFileSync(portFile, String(server.address().port));
});
JSEOF
  SERVER_PID=$!
else
  echo "Error: Python 3 or Node.js is required to serve the local game bundle." >&2
  exit 1
fi

PORT=""
for _ in $(seq 1 50); do
  if [ -s "$PORT_FILE" ]; then
    PORT="$(cat "$PORT_FILE")"
    break
  fi
  sleep 0.1
done

if [ -z "$PORT" ]; then
  echo "Error: Failed to start local game HTTP server." >&2
  exit 1
fi

URL="http://127.0.0.1:$PORT/"
mkdir -p "$PROFILE_DIR"

CHROME_BIN=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge vivaldi-stable; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROME_BIN="$candidate"
    break
  fi
done

if [ -n "$CHROME_BIN" ]; then
  exec "$CHROME_BIN" \\
    --app="$URL" \\
    --user-data-dir="$PROFILE_DIR" \\
    --class=VietnamWar1968 \\
    --start-maximized
elif command -v flatpak >/dev/null 2>&1 && flatpak info com.google.Chrome >/dev/null 2>&1; then
  flatpak run com.google.Chrome --app="$URL" --user-data-dir="$PROFILE_DIR" --start-maximized
elif command -v flatpak >/dev/null 2>&1 && flatpak info org.chromium.Chromium >/dev/null 2>&1; then
  flatpak run org.chromium.Chromium --app="$URL" --user-data-dir="$PROFILE_DIR" --start-maximized
elif command -v firefox >/dev/null 2>&1; then
  mkdir -p "$PROFILE_DIR/firefox"
  firefox --no-remote --profile "$PROFILE_DIR/firefox" --new-window "$URL" &
  BROWSER_PID=$!
  wait "$BROWSER_PID"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
  echo "Vietnam War 1968 running at $URL (press Ctrl+C to stop server)"
  wait "$SERVER_PID"
else
  echo "Open $URL in your browser to play Vietnam War 1968."
  wait "$SERVER_PID"
fi
`;

const UNINSTALL_SH = `#!/usr/bin/env bash
set -euo pipefail

DATA_HOME="\${XDG_DATA_HOME:-$HOME/.local/share}"
INSTALL_DIR="$DATA_HOME/VietnamWar1968"
APPS_DIR="$DATA_HOME/applications"
ICON_PNG="$DATA_HOME/icons/hicolor/512x512/apps/vietnam-war-1968.png"
ICON_SVG="$DATA_HOME/icons/hicolor/scalable/apps/vietnam-war-1968.svg"
BIN_LINK="$HOME/.local/bin/vietnam-war-1968"

DESKTOP_DIR="$HOME/Desktop"
if command -v xdg-user-dir >/dev/null 2>&1; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
fi

rm -rf "$INSTALL_DIR"
rm -f "$APPS_DIR/vietnam-war-1968.desktop"
rm -f "$APPS_DIR/uninstall-vietnam-war-1968.desktop"
rm -f "$DESKTOP_DIR/Vietnam-War-1968.desktop"
rm -f "$ICON_PNG" "$ICON_SVG" "$BIN_LINK"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

echo "Vietnam War 1968 has been uninstalled from $INSTALL_DIR."
if command -v zenity >/dev/null 2>&1 && [ -n "\${DISPLAY:-}\${WAYLAND_DISPLAY:-}" ]; then
  zenity --info --title="Vietnam War 1968" --text="Vietnam War 1968 has been uninstalled." 2>/dev/null || true
fi
`;

const INSTALL_SH = `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "--uninstall" ]; then
  if [ -f "\${XDG_DATA_HOME:-$HOME/.local/share}/VietnamWar1968/uninstall.sh" ]; then
    exec bash "\${XDG_DATA_HOME:-$HOME/.local/share}/VietnamWar1968/uninstall.sh"
  else
    echo "Vietnam War 1968 is not installed."
    exit 0
  fi
fi

SOURCE_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
DATA_HOME="\${XDG_DATA_HOME:-$HOME/.local/share}"
INSTALL_DIR="$DATA_HOME/VietnamWar1968"
APPS_DIR="$DATA_HOME/applications"
ICON_PNG_DIR="$DATA_HOME/icons/hicolor/512x512/apps"
ICON_SVG_DIR="$DATA_HOME/icons/hicolor/scalable/apps"
BIN_DIR="$HOME/.local/bin"

DESKTOP_DIR="$HOME/Desktop"
if command -v xdg-user-dir >/dev/null 2>&1; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
fi

echo "Installing Vietnam War 1968 to $INSTALL_DIR ..."
rm -rf "$INSTALL_DIR/app" "$INSTALL_DIR/bin"
mkdir -p "$INSTALL_DIR/app" "$INSTALL_DIR/bin" "$APPS_DIR" "$ICON_PNG_DIR" "$ICON_SVG_DIR" "$BIN_DIR"

cp -r "$SOURCE_DIR/app/." "$INSTALL_DIR/app/"
cp "$SOURCE_DIR/bin/launch-vietnam-war.sh" "$INSTALL_DIR/bin/launch-vietnam-war.sh"
cp "$SOURCE_DIR/uninstall.sh" "$INSTALL_DIR/uninstall.sh"
chmod +x "$INSTALL_DIR/bin/launch-vietnam-war.sh" "$INSTALL_DIR/uninstall.sh"

ICON_REF="vietnam-war-1968"
if [ -f "$SOURCE_DIR/icons/vietnam-war-1968.png" ]; then
  cp "$SOURCE_DIR/icons/vietnam-war-1968.png" "$ICON_PNG_DIR/vietnam-war-1968.png"
  ICON_REF="$ICON_PNG_DIR/vietnam-war-1968.png"
fi
if [ -f "$SOURCE_DIR/icons/vietnam-war-1968.svg" ]; then
  cp "$SOURCE_DIR/icons/vietnam-war-1968.svg" "$ICON_SVG_DIR/vietnam-war-1968.svg"
fi

ln -sf "$INSTALL_DIR/bin/launch-vietnam-war.sh" "$BIN_DIR/vietnam-war-1968"

DESKTOP_ENTRY="[Desktop Entry]
Version=1.0
Type=Application
Name=Vietnam War 1968
GenericName=Tactical Military FPS
Comment=Open-world 1968 Mekong Valley military simulation FPS
Exec="$INSTALL_DIR/bin/launch-vietnam-war.sh"
Icon=$ICON_REF
Terminal=false
Categories=Game;ActionGame;Shooter;
StartupWMClass=VietnamWar1968
StartupNotify=true
"

UNINSTALL_ENTRY="[Desktop Entry]
Version=1.0
Type=Application
Name=Uninstall Vietnam War 1968
Comment=Remove Vietnam War 1968 from your Linux system
Exec=bash "$INSTALL_DIR/uninstall.sh"
Icon=user-trash
Terminal=true
Categories=Game;
"

printf "%s" "$DESKTOP_ENTRY" > "$APPS_DIR/vietnam-war-1968.desktop"
printf "%s" "$UNINSTALL_ENTRY" > "$APPS_DIR/uninstall-vietnam-war-1968.desktop"
chmod +x "$APPS_DIR/vietnam-war-1968.desktop" "$APPS_DIR/uninstall-vietnam-war-1968.desktop"

if [ -d "$DESKTOP_DIR" ]; then
  printf "%s" "$DESKTOP_ENTRY" > "$DESKTOP_DIR/Vietnam-War-1968.desktop"
  chmod +x "$DESKTOP_DIR/Vietnam-War-1968.desktop"
  if command -v gio >/dev/null 2>&1; then
    gio set "$DESKTOP_DIR/Vietnam-War-1968.desktop" metadata::trusted true 2>/dev/null || true
  fi
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$DATA_HOME/icons/hicolor" 2>/dev/null || true
fi

echo ""
echo "Installation complete!"
echo "  - Applications menu: Vietnam War 1968"
echo "  - Terminal command:  ~/.local/bin/vietnam-war-1968"
echo "  - Uninstall anytime: $INSTALL_DIR/uninstall.sh"
echo ""

if [ "\${LAUNCH_AFTER_INSTALL:-0}" = "1" ]; then
  exec "$INSTALL_DIR/bin/launch-vietnam-war.sh"
elif command -v zenity >/dev/null 2>&1 && [ -n "\${DISPLAY:-}\${WAYLAND_DISPLAY:-}" ]; then
  if zenity --question --title="Vietnam War 1968" --text="Vietnam War 1968 installed successfully!\\n\\nLaunch the game now?" 2>/dev/null; then
    "$INSTALL_DIR/bin/launch-vietnam-war.sh" &
  fi
fi
`;

const README_LINUX = `VIETNAM WAR 1968 - LINUX DESKTOP INSTALLER
=========================================

QUICK INSTALL (Ubuntu, Debian, Fedora, Arch, Mint, Pop!_OS, SteamOS):
1. Option A (Single-file self-extracting installer):
   chmod +x Vietnam-War-1968-Linux-Installer.sh
   ./Vietnam-War-1968-Linux-Installer.sh

2. Option B (Portable .tar.gz archive):
   tar -xzf Vietnam-War-1968-Linux.tar.gz
   cd Vietnam-War-1968-Linux
   ./install.sh

WHAT IT INSTALLS (No root/sudo needed):
- Offline game bundle: ~/.local/share/VietnamWar1968/app
- Launcher script:     ~/.local/bin/vietnam-war-1968
- Desktop & App Menu:  ~/.local/share/applications/vietnam-war-1968.desktop
- Uninstaller:         ~/.local/share/VietnamWar1968/uninstall.sh
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

export async function buildLinuxArtifacts() {
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
  } catch {
    const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
    await execFileAsync(process.execPath, [viteBin, 'build'], { cwd: ROOT_DIR });
  }

  await fs.mkdir(RELEASE_DIR, { recursive: true });
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vw1968-linux-'));

  try {
    const bundleRoot = path.join(stageDir, 'Vietnam-War-1968-Linux');
    const stageApp = path.join(bundleRoot, 'app');
    const stageBin = path.join(bundleRoot, 'bin');
    const stageIcons = path.join(bundleRoot, 'icons');

    await copyDirRecursive(DIST_DIR, stageApp);
    await fs.mkdir(stageBin, { recursive: true });
    await fs.mkdir(stageIcons, { recursive: true });

    try {
      await fs.copyFile(
        path.join(PUBLIC_DIR, 'pwa-512x512.png'),
        path.join(stageIcons, 'vietnam-war-1968.png'),
      );
    } catch {
      // Optional icon
    }
    try {
      await fs.copyFile(
        path.join(PUBLIC_DIR, 'icon.svg'),
        path.join(stageIcons, 'vietnam-war-1968.svg'),
      );
    } catch {
      // Optional icon
    }

    await fs.writeFile(path.join(stageBin, 'launch-vietnam-war.sh'), LAUNCH_SH, { mode: 0o755 });
    await fs.writeFile(path.join(bundleRoot, 'install.sh'), INSTALL_SH, { mode: 0o755 });
    await fs.writeFile(path.join(bundleRoot, 'uninstall.sh'), UNINSTALL_SH, { mode: 0o755 });
    await fs.writeFile(path.join(bundleRoot, 'README-LINUX.txt'), README_LINUX, { mode: 0o644 });

    await execFileAsync(
      'tar',
      ['-czf', OUTPUT_TAR_GZ, '-C', stageDir, 'Vietnam-War-1968-Linux'],
      { cwd: stageDir },
    );

    const tarBuffer = await fs.readFile(OUTPUT_TAR_GZ);
    const payloadBase64 = tarBuffer.toString('base64').replace(/.{1,76}/g, '$&\n');

    const selfExtractorHeader = `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "--uninstall" ]; then
  if [ -f "\${XDG_DATA_HOME:-$HOME/.local/share}/VietnamWar1968/uninstall.sh" ]; then
    exec bash "\${XDG_DATA_HOME:-$HOME/.local/share}/VietnamWar1968/uninstall.sh"
  fi
  echo "Vietnam War 1968 is not currently installed."
  exit 0
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Extracting Vietnam War 1968 Linux bundle..."
ARCHIVE_LINE="$(awk '/^__ARCHIVE_BELOW__$/ {print NR + 1; exit 0;}' "$0")"
tail -n +"$ARCHIVE_LINE" "$0" | base64 -d | tar -xz -C "$TMP_DIR"
bash "$TMP_DIR/Vietnam-War-1968-Linux/install.sh" "$@"
exit 0
__ARCHIVE_BELOW__
`;

    await fs.writeFile(OUTPUT_SH, selfExtractorHeader + payloadBase64, { mode: 0o755 });

    const [tarStat, shStat] = await Promise.all([fs.stat(OUTPUT_TAR_GZ), fs.stat(OUTPUT_SH)]);
    console.log(
      `Built Linux installers: ${OUTPUT_SH} (${Math.round(shStat.size / 1024)} KB) & ${OUTPUT_TAR_GZ} (${Math.round(tarStat.size / 1024)} KB)`,
    );
    return { shPath: OUTPUT_SH, tarGzPath: OUTPUT_TAR_GZ };
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  buildLinuxArtifacts().catch((err) => {
    console.error('Failed to build Linux installer artifacts:', err);
    process.exitCode = 1;
  });
}
