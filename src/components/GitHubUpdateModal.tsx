import {
  CheckCircle2,
  Download,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Server,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface GitHubReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
  contentType: string;
}

interface GitHubUpdateCheckResponse {
  currentVersion: string;
  installedCommitSha: string | null;
  installedAt: string | null;
  repo: string;
  serverUrl: string;
  branch: string;
  updateAvailable: boolean;
  comparisonReason: string;
  latestRelease: {
    tagName: string;
    name: string;
    publishedAt: string | null;
    body: string;
    htmlUrl: string;
    zipballUrl: string | null;
    tarballUrl: string | null;
    assets: GitHubReleaseAsset[];
  } | null;
  latestCommit: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string | null;
    htmlUrl: string;
  } | null;
}

interface GitHubUpdateModalProps {
  onClose: () => void;
}

const STORAGE_KEY = 'vietnam_war_github_updater_v1';

interface SavedConfig {
  serverUrl: string;
  repo: string;
  branch: string;
}

function loadSavedConfig(): SavedConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedConfig>;
      return {
        serverUrl: typeof parsed.serverUrl === 'string' && parsed.serverUrl ? parsed.serverUrl : 'https://github.com',
        repo: typeof parsed.repo === 'string' ? parsed.repo : '',
        branch: typeof parsed.branch === 'string' && parsed.branch ? parsed.branch : 'main',
      };
    }
  } catch {
    // ignore storage failures
  }
  return { serverUrl: 'https://github.com', repo: '', branch: 'main' };
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSafeHttpsUrl(raw?: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function GitHubUpdateModal({ onClose }: GitHubUpdateModalProps) {
  const [serverUrl, setServerUrl] = useState(() => loadSavedConfig().serverUrl);
  const [repo, setRepo] = useState(() => loadSavedConfig().repo);
  const [branch, setBranch] = useState(() => loadSavedConfig().branch);

  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [reloadReady, setReloadReady] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [installedSha, setInstalledSha] = useState<string | null>(null);
  const [result, setResult] = useState<GitHubUpdateCheckResponse | null>(null);

  const persistConfig = useCallback((nextServer: string, nextRepo: string, nextBranch: string) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          serverUrl: nextServer.trim(),
          repo: nextRepo.trim(),
          branch: nextBranch.trim(),
        }),
      );
    } catch {
      // ignore storage failures
    }
  }, []);

  const runCheck = useCallback(
    async (srv: string, rp: string, br: string) => {
      const cleanRepo = rp.trim();
      const cleanServer = (srv.trim() || 'https://github.com').replace(/\/+$/, '');
      const cleanBranch = br.trim() || 'main';
      if (!cleanRepo) {
        setErrorMsg('Enter your GitHub repository (owner/repo) to check for updates.');
        return;
      }
      persistConfig(cleanServer, cleanRepo, cleanBranch);
      setChecking(true);
      setErrorMsg(null);
      setStatusMsg(null);
      try {
        const params = new URLSearchParams({
          repo: cleanRepo,
          serverUrl: cleanServer,
          branch: cleanBranch,
        });
        const resp = await fetch(`/api/github/check-update?${params.toString()}`);
        const data = (await resp.json()) as GitHubUpdateCheckResponse & { error?: string };
        if (!resp.ok) {
          throw new Error(data.error || 'Failed to check GitHub server for updates.');
        }
        setResult(data);
        setCurrentVersion(data.currentVersion);
        setInstalledSha(data.installedCommitSha);
        setStatusMsg(
          data.updateAvailable
            ? `Update found: ${data.comparisonReason}`
            : `Up to date (${data.comparisonReason})`,
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to reach GitHub update server.');
      } finally {
        setChecking(false);
      }
    },
    [persistConfig],
  );

  useEffect(() => {
    let active = true;
    fetch('/api/github/config')
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          cfg: {
            currentVersion?: string;
            installedCommitSha?: string | null;
            defaultRepo?: string;
            defaultServerUrl?: string;
            defaultBranch?: string;
          } | null,
        ) => {
          if (!active || !cfg) return;
          if (cfg.currentVersion) setCurrentVersion(cfg.currentVersion);
          if (cfg.installedCommitSha) setInstalledSha(cfg.installedCommitSha);

          const saved = loadSavedConfig();
          const initialRepo = saved.repo || cfg.defaultRepo || '';
          const initialServer =
            saved.serverUrl !== 'https://github.com'
              ? saved.serverUrl
              : cfg.defaultServerUrl || 'https://github.com';
          const initialBranch = saved.branch || cfg.defaultBranch || 'main';

          if (!saved.repo && cfg.defaultRepo) setRepo(cfg.defaultRepo);
          if (saved.serverUrl === 'https://github.com' && cfg.defaultServerUrl) {
            setServerUrl(cfg.defaultServerUrl);
          }
          if (!saved.branch && cfg.defaultBranch) setBranch(cfg.defaultBranch);

          if (initialRepo) {
            void runCheck(initialServer, initialRepo, initialBranch);
          }
        },
      )
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [runCheck]);

  const handleInstallUpdate = async () => {
    const cleanRepo = repo.trim();
    const cleanServer = (serverUrl.trim() || 'https://github.com').replace(/\/+$/, '');
    const cleanBranch = branch.trim() || 'main';
    if (!cleanRepo) {
      setErrorMsg('Enter your GitHub repository (owner/repo) first.');
      return;
    }

    persistConfig(cleanServer, cleanRepo, cleanBranch);
    setInstalling(true);
    setErrorMsg(null);
    setStatusMsg('Downloading package from GitHub server and installing update...');

    try {
      const resp = await fetch('/api/github/install-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: cleanRepo,
          serverUrl: cleanServer,
          branch: cleanBranch,
          tagName: result?.latestRelease?.tagName ?? null,
        }),
      });
      const data = (await resp.json()) as {
        installed?: boolean;
        installedVersion?: string;
        installedCommitSha?: string | null;
        message?: string;
        error?: string;
      };
      if (!resp.ok || !data.installed) {
        throw new Error(data.error || 'Update installation failed.');
      }

      if (data.installedVersion) setCurrentVersion(data.installedVersion);
      if (data.installedCommitSha) setInstalledSha(data.installedCommitSha);

      // Refresh PWA service worker and browser caches so reloaded app gets updated build
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
      if ('caches' in window) {
        const keys = await caches.keys().catch(() => []);
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }

      setReloadReady(true);
      setStatusMsg(data.message || 'Update installed successfully. Reload to launch the new version.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to download and install update.');
      setStatusMsg(null);
    } finally {
      setInstalling(false);
    }
  };

  const archiveDownloadHref =
    repo.trim() &&
    `/api/github/download-archive?${new URLSearchParams({
      repo: repo.trim(),
      serverUrl: (serverUrl.trim() || 'https://github.com').replace(/\/+$/, ''),
      ref: result?.latestRelease?.tagName || branch.trim() || 'main',
    }).toString()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[#0c0f0b]/90 p-3 sm:p-4 pointer-events-auto overflow-y-auto touch-scroll">
      <div className="w-full max-w-xl bg-[#161c14] border border-[#4a5640] rounded-lg p-4 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-mono-tabular uppercase tracking-widest text-[#c89b3c]">
              GitHub Server Updater
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wide text-[#ece9df]">
              App Updates &amp; Releases
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close GitHub updates"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-[#1e261b] hover:bg-[#2a3425] border border-[#3e4836] rounded text-[#d9d5c5] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Local App Status */}
        <div className="mb-4 p-3 bg-[#11150f] border border-[#2f382a] rounded flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
          <span className="text-[#9ea38f]">
            Installed Version:{' '}
            <strong className="text-[#ece9df]">v{currentVersion.replace(/^v/i, '')}</strong>
          </span>
          {installedSha && (
            <span className="text-[#9cc47d]">
              Commit: {installedSha.slice(0, 7)}
            </span>
          )}
        </div>

        {/* GitHub Server & Repository Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runCheck(serverUrl, repo, branch);
          }}
          className="space-y-3 mb-4 p-3.5 bg-[#11150f] border border-[#2f382a] rounded"
        >
          <div>
            <label
              htmlFor="gh-server-url"
              className="flex items-center gap-1.5 text-[11px] font-mono-tabular uppercase text-[#9ea38f] mb-1"
            >
              <Server className="w-3.5 h-3.5 text-[#c89b3c]" />
              <span>GitHub Server URL (HTTPS)</span>
            </label>
            <input
              id="gh-server-url"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://github.com or https://git.yourdomain.com"
              className="w-full min-h-[40px] px-3 py-1.5 bg-[#181e15] border border-[#384331] rounded text-sm font-mono-tabular text-[#ece9df] focus:outline-none focus:border-[#c89b3c]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label
                htmlFor="gh-repo"
                className="flex items-center gap-1.5 text-[11px] font-mono-tabular uppercase text-[#9ea38f] mb-1"
              >
                <GitBranch className="w-3.5 h-3.5 text-[#c89b3c]" />
                <span>Repository (owner/repo)</span>
              </label>
              <input
                id="gh-repo"
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="username/vietnam-war-1968"
                className="w-full min-h-[40px] px-3 py-1.5 bg-[#181e15] border border-[#384331] rounded text-sm font-mono-tabular text-[#ece9df] focus:outline-none focus:border-[#c89b3c]"
              />
            </div>

            <div>
              <label
                htmlFor="gh-branch"
                className="block text-[11px] font-mono-tabular uppercase text-[#9ea38f] mb-1"
              >
                Branch
              </label>
              <input
                id="gh-branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full min-h-[40px] px-3 py-1.5 bg-[#181e15] border border-[#384331] rounded text-sm font-mono-tabular text-[#ece9df] focus:outline-none focus:border-[#c89b3c]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={checking || installing}
            className="min-h-[44px] w-full bg-[#232b20] hover:bg-[#2f392b] disabled:opacity-60 border border-[#c89b3c]/80 text-[#f0dca0] font-display font-semibold tracking-wider uppercase text-sm rounded flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking GitHub Server...' : 'Check for Updates'}</span>
          </button>
        </form>

        {/* Status / Errors */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-[#2a1715] border border-[#8e3a32] rounded text-xs font-mono-tabular text-[#f2bdb6]">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div className="mb-4 p-3 bg-[#192416] border border-[#567448] rounded text-xs font-mono-tabular text-[#cfe6bf] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#9cc47d] shrink-0 mt-0.5" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Latest Release / Commit Details & Install Controls */}
        {result && (
          <div className="space-y-3.5 mb-4 p-3.5 bg-[#11150f] border border-[#34402d] rounded">
            {result.latestRelease ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-mono-tabular uppercase text-[#c89b3c]">
                    Latest Release: {result.latestRelease.tagName}
                  </span>
                  {result.latestRelease.publishedAt && (
                    <span className="text-[11px] font-mono-tabular text-[#8e9381]">
                      {new Date(result.latestRelease.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-[#ece9df] mb-1">
                  {result.latestRelease.name}
                </div>
                {result.latestRelease.body && (
                  <pre className="whitespace-pre-wrap text-xs text-[#b8b39e] bg-[#161c14] border border-[#2a3325] rounded p-2.5 max-h-32 overflow-y-auto touch-scroll font-sans">
                    {result.latestRelease.body}
                  </pre>
                )}

                {result.latestRelease.assets.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-mono-tabular uppercase text-[#9ea38f] mb-1.5">
                      Release Downloads
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.latestRelease.assets
                        .filter((asset) => isSafeHttpsUrl(asset.downloadUrl))
                        .map((asset) => (
                          <a
                            key={asset.name}
                            href={asset.downloadUrl}
                            download={asset.name}
                            className="min-h-[38px] px-3 py-1.5 bg-[#1b2218] hover:bg-[#273123] border border-[#4a5840] rounded text-xs font-mono-tabular text-[#ece9df] inline-flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5 text-[#c89b3c]" />
                            <span>
                              {asset.name} ({formatBytes(asset.size)})
                            </span>
                          </a>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : result.latestCommit ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-mono-tabular uppercase text-[#c89b3c]">
                    Latest Commit on {result.branch}
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[#9cc47d]">
                    {result.latestCommit.shortSha}
                  </span>
                </div>
                <div className="text-sm text-[#ece9df] mb-1">{result.latestCommit.message}</div>
                <div className="text-[11px] font-mono-tabular text-[#8e9381]">
                  {result.latestCommit.author}
                  {result.latestCommit.date
                    ? ` · ${new Date(result.latestCommit.date).toLocaleString()}`
                    : ''}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#263022]">
              <button
                type="button"
                disabled={installing || checking}
                onClick={() => void handleInstallUpdate()}
                className="min-h-[46px] flex-1 bg-[#c89b3c] hover:bg-[#d8ab4c] disabled:opacity-60 text-[#11150f] font-display font-semibold tracking-wider uppercase text-sm rounded flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {installing ? 'Downloading & Installing...' : 'Download & Install Update'}
                </span>
              </button>

              {archiveDownloadHref && (
                <a
                  href={archiveDownloadHref}
                  download={`${repo.trim().replace('/', '-')}-${result.latestRelease?.tagName || branch.trim() || 'main'}.zip`}
                  className="min-h-[46px] px-4 bg-[#1a2017] hover:bg-[#252e20] border border-[#4a5640] text-[#ece9df] font-mono-tabular uppercase text-xs rounded flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#9cc47d]" />
                  <span>Download ZIP</span>
                </a>
              )}

              {isSafeHttpsUrl(result.latestRelease?.htmlUrl || result.latestCommit?.htmlUrl) && (
                <a
                  href={result.latestRelease?.htmlUrl || result.latestCommit?.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[46px] px-3.5 bg-[#1a2017] hover:bg-[#252e20] border border-[#3a4433] text-[#c4c0b0] font-mono-tabular uppercase text-xs rounded flex items-center justify-center gap-1.5 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View</span>
                </a>
              )}
            </div>

            {reloadReady && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[44px] w-full bg-[#364d2b] hover:bg-[#435f36] border border-[#7ea367] text-[#eff7ea] font-display font-semibold tracking-wider uppercase text-sm rounded cursor-pointer"
              >
                Reload App to Apply Update
              </button>
            )}
          </div>
        )}

        <p className="text-[11px] font-mono-tabular text-[#8e9381]">
          Checks releases and branch commits on GitHub.com or your private HTTPS GitHub Enterprise
          server. Private repos can set GITHUB_TOKEN in server environment settings.
        </p>
      </div>
    </div>
  );
}
