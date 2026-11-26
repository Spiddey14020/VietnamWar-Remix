import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ELECTRON_DIR = path.join(ROOT_DIR, 'electron');
const ELECTRON_APP_DIR = path.join(ELECTRON_DIR, 'app');
const ELECTRON_ICONS_DIR = path.join(ELECTRON_DIR, 'icons');
const ELECTRON_PKG_PATH = path.join(ELECTRON_DIR, 'package.json');
const ROOT_PKG_PATH = path.join(ROOT_DIR, 'package.json');

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

function normalizeSemver(raw) {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/.test(cleaned)) {
    return null;
  }
  return cleaned === '0.0.0' ? '1.0.0' : cleaned;
}

async function main() {
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
  } catch {
    const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
    await execFileAsync(process.execPath, [viteBin, 'build'], { cwd: ROOT_DIR });
  }

  await fs.rm(ELECTRON_APP_DIR, { recursive: true, force: true });
  await copyDirRecursive(DIST_DIR, ELECTRON_APP_DIR);

  await fs.mkdir(ELECTRON_ICONS_DIR, { recursive: true });
  for (const [srcName, destName] of [
    ['vietnam-war-1968.ico', 'vietnam-war-1968.ico'],
    ['pwa-512x512.png', 'vietnam-war-1968.png'],
  ]) {
    try {
      await fs.copyFile(path.join(PUBLIC_DIR, srcName), path.join(ELECTRON_ICONS_DIR, destName));
    } catch {
      // Optional icon
    }
  }

  const cliVersionArg = process.argv.find((arg) => arg.startsWith('--version='));
  const cliVersion = cliVersionArg ? cliVersionArg.slice('--version='.length) : undefined;
  const rootPkg = JSON.parse(await fs.readFile(ROOT_PKG_PATH, 'utf8'));
  const electronPkg = JSON.parse(await fs.readFile(ELECTRON_PKG_PATH, 'utf8'));

  const targetVersion =
    normalizeSemver(cliVersion) ||
    normalizeSemver(process.env.RELEASE_VERSION) ||
    normalizeSemver(rootPkg.version) ||
    normalizeSemver(electronPkg.version) ||
    '1.0.0';

  electronPkg.version = targetVersion;

  const ghRepo = process.env.GITHUB_REPOSITORY || '';
  if (ghRepo.includes('/')) {
    const [owner, repo] = ghRepo.split('/');
    if (owner && repo) {
      electronPkg.build = electronPkg.build || {};
      electronPkg.build.publish = [
        {
          provider: 'github',
          owner,
          repo,
          releaseType: 'release',
        },
      ];
    }
  }

  await fs.writeFile(ELECTRON_PKG_PATH, `${JSON.stringify(electronPkg, null, 2)}\n`, 'utf8');
  console.log(
    `Prepared Electron bundle v${targetVersion} in ${ELECTRON_APP_DIR}${
      ghRepo ? ` (GitHub publish target: ${ghRepo})` : ''
    }`,
  );
}

main().catch((err) => {
  console.error('Failed to prepare Electron desktop bundle:', err);
  process.exitCode = 1;
});
