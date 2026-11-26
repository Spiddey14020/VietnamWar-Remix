import {
  CheckCircle2,
  Download,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Globe,
  RefreshCw,
  RotateCcw,
  Tag,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDesktopUpdater } from '../hooks/useDesktopUpdater';

const STORAGE_REPO_KEY = 'vietnam_war_github_repo_v1';
const STORAGE_LAST_COMMIT_KEY = 'vietnam_war_github_last_sha_v1';
const DEFAULT_APP_VERSION = '1.0.0';

interface GitHubAssetInfo {
  name: string;
  size: number;
  downloadUrl: string;
}

interface GitHubReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
  prerelease: boolean;
  assets: GitHubAssetInfo[];
}

interface GitHubCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  htmlUrl: string;
}

interface GitHubCheckResult {
  repo: string;
  htmlUrl: string;
  description: string;
  defaultBranch: string;
  hasPages: boolean;
  pagesUrl: string | null;
  latestRelease: GitHubReleaseInfo | null;
  latestTag: { name: string; commitSha: string } | null;
  recentCommits: GitHubCommitInfo[];
  checkedAt: string;
}

interface GitHubUpdateModalProps {
  onClose: () => void;
}

export function parseGitHubRepoInput(rawInput: string): { owner: string; repo: string; slug: string } | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  let candidate = trimmed.replace(/^git@github\.com:/i, 'https://github.com/');
  if (!/^https?:\/\//i.test(candidate) && candidate.includes('github.')) {
    candidate = `https://${candidate}`;
  }

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      const parts = url.pathname
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean);

      if (host.endsWith('.github.io')) {
        const owner = host.slice(0, -'.github.io'.length);
        const repo = (parts[0] || `${owner}.github.io`).replace(/\.git$/i, '');
        if (/^[A-Za-z0-9_.-]+$/.test(owner) && /^[A-Za-z0-9_.-]+$/.test(repo)) {
          return { owner, repo, slug: `${owner}/${repo}` };
        }
      }

      if (host === 'github.com' || host === 'www.github.com') {
        if (parts.length >= 2) {
          const owner = parts[0];
          const repo = parts[1].replace(/\.git$/i, '');
          if (/^[A-Za-z0-9_.-]+$/.test(owner) && /^[A-Za-z0-9_.-]+$/.test(repo)) {
            return { owner, repo, slug: `${owner}/${repo}` };
          }
        }
      }
    } catch {
      return null;
    }
  }

  const slashParts = trimmed.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
  if (slashParts.length === 2) {
    const [owner, repo] = slashParts;
    if (/^[A-Za-z0-9_.-]+$/.test(owner) && /^[A-Za-z0-9_.-]+$/.test(repo)) {
      return { owner, repo, slug: `${owner}/${repo}` };
    }
  }

  return null;
}

function parseSemverParts(version: string): [number, number, number] | null {
  const cleaned = version.trim().replace(/^v/i, '').split('-')[0];
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(cleaned);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  if (!pa || !pb) {
    return a.replace(/^v/i, '').localeCompare(b.replace(/^v/i, ''));
  }
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso: string): string {
  if (!iso) return 'Unknown date';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString();
}

async function fetchGitHubDirectly(owner: string, repo: string): Promise<GitHubCheckResult> {
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = { Accept: 'application/vnd.github+json' };

  const repoRes = await fetch(base, { headers });
  if (!repoRes.ok) {
    const errBody = await repoRes.json().catch(() => ({}));
    throw new Error(
      (errBody as { message?: string }).message ||
        `GitHub returned ${repoRes.status} for ${owner}/${repo}`,
    );
  }
  const repoJson = (await repoRes.json()) as {
    full_name: string;
    html_url: string;
    description?: string | null;
    default_branch?: string;
    has_pages?: boolean;
  };

  const [releaseRes, tagsRes, commitsRes] = await Promise.all([
    fetch(`${base}/releases/latest`, { headers }).catch(() => null),
    fetch(`${base}/tags?per_page=3`, { headers }).catch(() => null),
    fetch(`${base}/commits?per_page=3`, { headers }).catch(() => null),
  ]);

  let latestRelease: GitHubReleaseInfo | null = null;
  if (releaseRes && releaseRes.ok) {
    const rel = (await releaseRes.json()) as {
      tag_name?: string;
      name?: string;
      published_at?: string;
      html_url?: string;
      body?: string;
      prerelease?: boolean;
      assets?: Array<{ name: string; size: number; browser_download_url: string }>;
    };
    latestRelease = {
      tagName: rel.tag_name || '',
      name: rel.name || rel.tag_name || 'Latest Release',
      publishedAt: rel.published_at || '',
      htmlUrl: rel.html_url || `${repoJson.html_url}/releases`,
      body: rel.body || '',
      prerelease: Boolean(rel.prerelease),
      assets: (rel.assets || []).map((a) => ({
        name: a.name,
        size: a.size,
        downloadUrl: a.browser_download_url,
      })),
    };
  }

  let latestTag: { name: string; commitSha: string } | null = null;
  if (tagsRes && tagsRes.ok) {
    const tags = (await tagsRes.json()) as Array<{ name: string; commit?: { sha?: string } }>;
    if (Array.isArray(tags) && tags.length > 0) {
      latestTag = {
        name: tags[0].name,
        commitSha: tags[0].commit?.sha || '',
      };
    }
  }

  let recentCommits: GitHubCommitInfo[] = [];
  if (commitsRes && commitsRes.ok) {
    const commits = (await commitsRes.json()) as Array<{
      sha: string;
      html_url: string;
      commit?: {
        message?: string;
        author?: { name?: string; date?: string };
      };
    }>;
    if (Array.isArray(commits)) {
      recentCommits = commits.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: (c.commit?.message || '').split('\n')[0],
        author: c.commit?.author?.name || 'Developer',
        date: c.commit?.author?.date || '',
        htmlUrl: c.html_url,
      }));
    }
  }

  return {
    repo: repoJson.full_name,
    htmlUrl: repoJson.html_url,
    description: repoJson.description || '',
    defaultBranch: repoJson.default_branch || 'main',
    hasPages: Boolean(repoJson.has_pages),
    pagesUrl: repoJson.has_pages ? `https://${owner}.github.io/${repo}/` : null,
    latestRelease,
    latestTag,
    recentCommits,
    checkedAt: new Date().toISOString(),
  };
}

export function GitHubUpdateModal({ onClose }: GitHubUpdateModalProps) {
  const {
    isElectron,
    status: desktopStatus,
    checkForUpdates: checkDesktopUpdates,
    installUpdate: installDesktopUpdate,
  } = useDesktopUpdater();

  const currentVersion = isElectron ? desktopStatus.currentVersion : DEFAULT_APP_VERSION;

  const [repoInput, setRepoInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_REPO_KEY);
      if (saved) return saved;
    } catch {
      // ignore storage errors
    }
    const envRepo = import.meta.env.VITE_GITHUB_REPO as string | undefined;
    return envRepo || '';
  });
  const [previousCommitSha, setPreviousCommitSha] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_LAST_COMMIT_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GitHubCheckResult | null>(null);
  const [newCommitDetected, setNewCommitDetected] = useState(false);

  const runCheck = useCallback(
    async (inputOverride?: string) => {
      const raw = (inputOverride ?? repoInput).trim();
      const parsed = parseGitHubRepoInput(raw);
      if (!parsed) {
        setError(
          'Enter your GitHub repository as owner/repo or a full URL like https://github.com/owner/repo.',
        );
        return;
      }

      setLoading(true);
      setError(null);
      setNewCommitDetected(false);

      try {
        try {
          localStorage.setItem(STORAGE_REPO_KEY, parsed.slug);
        } catch {
          // ignore storage errors
        }
        setRepoInput(parsed.slug);

        let data: GitHubCheckResult | null = null;
        try {
          const apiRes = await fetch(
            `/api/github/check?repo=${encodeURIComponent(parsed.slug)}`,
          );
          if (apiRes.ok) {
            data = (await apiRes.json()) as GitHubCheckResult;
          } else if (apiRes.status !== 404) {
            const errJson = (await apiRes.json().catch(() => ({}))) as { error?: string };
            throw new Error(errJson.error || `Server error (${apiRes.status})`);
          }
        } catch (proxyErr) {
          // If backend proxy is unavailable (e.g. static Electron/GitHub Pages), call GitHub API directly
          if (
            proxyErr instanceof Error &&
            !/failed to fetch|network|404/i.test(proxyErr.message)
          ) {
            throw proxyErr;
          }
        }

        if (!data) {
          data = await fetchGitHubDirectly(parsed.owner, parsed.repo);
        }

        setResult(data);

        const latestSha = data.recentCommits[0]?.sha || null;
        if (latestSha) {
          if (previousCommitSha && previousCommitSha !== latestSha) {
            setNewCommitDetected(true);
          }
          try {
            localStorage.setItem(STORAGE_LAST_COMMIT_KEY, latestSha);
          } catch {
            // ignore storage errors
          }
          setPreviousCommitSha(latestSha);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to check GitHub for updates.');
      } finally {
        setLoading(false);
      }
    },
    [repoInput, previousCommitSha],
  );

  // Auto-check on open if repository is saved, or ask server for a configured default repo
  useEffect(() => {
    const parsed = parseGitHubRepoInput(repoInput);
    if (parsed) {
      void runCheck(parsed.slug);
      return;
    }

    let cancelled = false;
    void fetch('/api/github/default-repo')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { repo?: string | null } | null) => {
        if (!cancelled && data?.repo) {
          setRepoInput(data.repo);
          void runCheck(data.repo);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const versionComparison = useMemo(() => {
    if (!result) return null;
    const remoteVersionRaw = result.latestRelease?.tagName || result.latestTag?.name || '';
    if (!remoteVersionRaw) {
      return {
        status: 'no-release' as const,
        remoteVersion: null,
      };
    }
    const cmp = compareSemver(remoteVersionRaw, currentVersion);
    if (cmp > 0) {
      return {
        status: 'update-available' as const,
        remoteVersion: remoteVersionRaw.replace(/^v/i, ''),
      };
    }
    return {
      status: 'up-to-date' as const,
      remoteVersion: remoteVersionRaw.replace(/^v/i, ''),
    };
  }, [result, currentVersion]);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/75 p-3 sm:p-6 overflow-y-auto touch-scroll">
      <div className="w-full max-w-2xl bg-[#121710] border border-[#49543e] rounded-md shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-[#171e15] border-b border-[#2e3828]">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-[#9cc47d]" />
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold tracking-wider uppercase text-[#ece9df]">
                GitHub Site &amp; Update Checker
              </h2>
              <p className="text-[11px] font-mono-tabular text-[#9ea38f]">
                Installed Build: v{currentVersion}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close GitHub updates dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded border border-[#323b2c] bg-[#1a2017] hover:bg-[#252d21] text-[#b8b39e] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[82dvh] overflow-y-auto touch-scroll">
          {/* Repo / GitHub site input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runCheck();
            }}
            className="space-y-2"
          >
            <label
              htmlFor="github-repo-input"
              className="block text-xs font-mono-tabular uppercase tracking-wider text-[#b8b39e]"
            >
              Your GitHub Repository or GitHub Site URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="github-repo-input"
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="owner/repo or https://github.com/owner/vietnam-war-1968"
                className="flex-1 min-h-[44px] px-3.5 py-2 bg-[#0c100a] border border-[#3a4533] focus:border-[#c89b3c] outline-none rounded text-sm font-mono-tabular text-[#ece9df] placeholder:text-[#687060]"
              />
              <button
                type="submit"
                disabled={loading}
                className="min-h-[44px] px-5 py-2 bg-[#c89b3c] hover:bg-[#d8ab4c] disabled:opacity-60 text-[#11150f] font-display font-semibold uppercase tracking-wider text-sm rounded flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Checking...' : 'Check Updates'}</span>
              </button>
            </div>
            <p className="text-[11px] text-[#8e9381] font-mono-tabular">
              Supports <span className="text-[#c9c5b4]">owner/repo</span>,{' '}
              <span className="text-[#c9c5b4]">https://github.com/owner/repo</span>, or{' '}
              <span className="text-[#c9c5b4]">https://owner.github.io/repo</span>. Saved automatically.
            </p>
          </form>

          {/* Electron Desktop Auto-Updater Section (shown when inside Electron app) */}
          {isElectron && (
            <div className="p-3.5 bg-[#171d14] border border-[#414e38] rounded space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#c89b3c]">
                  Electron Built-In Auto-Updater
                </div>
                {desktopStatus.stage === 'downloaded' ? (
                  <button
                    type="button"
                    onClick={() => void installDesktopUpdate()}
                    className="min-h-[38px] px-3 py-1.5 bg-[#c89b3c] hover:bg-[#d8ab4c] text-[#11150f] rounded text-xs font-mono-tabular font-semibold uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart &amp; Install v{desktopStatus.availableVersion}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void checkDesktopUpdates()}
                    className="min-h-[38px] px-3 py-1.5 bg-[#20281c] hover:bg-[#2a3424] border border-[#56664b] text-[#e5efe0] rounded text-xs font-mono-tabular uppercase cursor-pointer"
                  >
                    Run Desktop Updater
                  </button>
                )}
              </div>
              {desktopStatus.message && (
                <div className="text-xs font-mono-tabular text-[#b8b39e]">
                  {desktopStatus.message}
                </div>
              )}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="p-3.5 bg-[#2c1512] border border-[#8e3e34] rounded text-xs font-mono-tabular text-[#f5b7ad]">
              {error}
            </div>
          )}

          {/* Results */}
          {result && !error && (
            <div className="space-y-4">
              {/* Update status summary */}
              {versionComparison?.status === 'update-available' ? (
                <div className="p-4 bg-[#272010] border border-[#c89b3c] rounded space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#f4d78b] font-display font-semibold uppercase tracking-wider">
                      <Tag className="w-4 h-4 text-[#c89b3c]" />
                      <span>
                        Update Available: v{versionComparison.remoteVersion}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono-tabular text-[#d9c38c]">
                      Current: v{currentVersion}
                    </span>
                  </div>
                  <p className="text-xs text-[#e7dec1]">
                    A newer release is published on your GitHub repository. Download the updated
                    installer below or view the full release page.
                  </p>
                </div>
              ) : versionComparison?.status === 'up-to-date' ? (
                <div className="p-4 bg-[#142215] border border-[#517a49] rounded flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#a7dc8e] font-display font-semibold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Up to Date (v{versionComparison.remoteVersion})</span>
                  </div>
                  {newCommitDetected && (
                    <span className="text-[11px] font-mono-tabular px-2 py-0.5 bg-[#2a2312] border border-[#c89b3c] rounded text-[#f4d78b]">
                      New commits pushed since last check
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[#171d14] border border-[#3d4736] rounded space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-display font-semibold uppercase tracking-wider text-[#ece9df]">
                      Connected to {result.repo} (No Published Releases Yet)
                    </div>
                    {newCommitDetected && (
                      <span className="text-[11px] font-mono-tabular px-2 py-0.5 bg-[#2a2312] border border-[#c89b3c] rounded text-[#f4d78b]">
                        New commit detected!
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#a5a897]">
                    Tracking latest commits on branch{' '}
                    <span className="font-mono-tabular text-[#ece9df]">{result.defaultBranch}</span>.
                    Push a <span className="font-mono-tabular text-[#ece9df]">v1.x.x</span> tag or run
                    the GitHub Actions release workflow to publish downloadable installers.
                  </p>
                </div>
              )}

              {/* Quick GitHub Links */}
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={result.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 bg-[#1a2017] hover:bg-[#252e20] border border-[#3d4736] rounded text-xs font-mono-tabular text-[#ece9df] flex items-center gap-1.5"
                >
                  <GitBranch className="w-3.5 h-3.5 text-[#9cc47d]" />
                  <span>Open GitHub Repo</span>
                  <ExternalLink className="w-3 h-3 text-[#8e9381]" />
                </a>

                <a
                  href={result.latestRelease?.htmlUrl || `${result.htmlUrl}/releases`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3 py-1.5 bg-[#1a2017] hover:bg-[#252e20] border border-[#3d4736] rounded text-xs font-mono-tabular text-[#ece9df] flex items-center gap-1.5"
                >
                  <Tag className="w-3.5 h-3.5 text-[#c89b3c]" />
                  <span>{result.latestRelease ? 'View Latest Release' : 'Releases Page'}</span>
                  <ExternalLink className="w-3 h-3 text-[#8e9381]" />
                </a>

                {result.pagesUrl && (
                  <a
                    href={result.pagesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] px-3 py-1.5 bg-[#1a2017] hover:bg-[#252e20] border border-[#3d4736] rounded text-xs font-mono-tabular text-[#ece9df] flex items-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5 text-[#9cc47d]" />
                    <span>Open GitHub Pages Site</span>
                    <ExternalLink className="w-3 h-3 text-[#8e9381]" />
                  </a>
                )}
              </div>

              {/* Latest Release Notes & Downloadable Assets */}
              {result.latestRelease && (
                <div className="p-4 bg-[#161c13] border border-[#323b2c] rounded space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-display font-semibold uppercase tracking-wide text-[#ece9df]">
                      {result.latestRelease.name}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[#9ea38f]">
                      Published {formatDate(result.latestRelease.publishedAt)}
                    </div>
                  </div>

                  {result.latestRelease.body && (
                    <pre className="p-3 bg-[#0e120c] border border-[#283022] rounded text-xs font-mono-tabular text-[#c9c5b4] whitespace-pre-wrap max-h-40 overflow-y-auto touch-scroll">
                      {result.latestRelease.body}
                    </pre>
                  )}

                  {result.latestRelease.assets.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#9ea38f]">
                        Release Downloads
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {result.latestRelease.assets
                          .filter((a) => !a.name.endsWith('.blockmap') && !a.name.endsWith('.yml'))
                          .map((asset) => (
                            <a
                              key={asset.name}
                              href={asset.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[40px] px-3 py-2 bg-[#1a2117] hover:bg-[#252e21] border border-[#49563f] rounded text-xs font-mono-tabular text-[#ece9df] flex items-center justify-between gap-2"
                            >
                              <span className="truncate flex items-center gap-1.5">
                                <Download className="w-3.5 h-3.5 text-[#c89b3c] shrink-0" />
                                <span className="truncate">{asset.name}</span>
                              </span>
                              <span className="text-[10px] text-[#9ea38f] shrink-0">
                                {formatBytes(asset.size)}
                              </span>
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Commits on GitHub */}
              {result.recentCommits.length > 0 && (
                <div className="p-4 bg-[#161c13] border border-[#323b2c] rounded space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#b8b39e] flex items-center gap-1.5">
                      <GitCommitHorizontal className="w-4 h-4 text-[#9cc47d]" />
                      <span>Latest GitHub Commits ({result.defaultBranch})</span>
                    </div>
                    <span className="text-[10px] font-mono-tabular text-[#7d8473]">
                      Checked {formatDate(result.checkedAt)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {result.recentCommits.map((commit) => (
                      <a
                        key={commit.sha}
                        href={commit.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2.5 bg-[#0e120c] hover:bg-[#141a11] border border-[#283022] rounded transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-[#ece9df] font-medium truncate">
                            {commit.message}
                          </span>
                          <span className="font-mono-tabular text-[11px] text-[#c89b3c] shrink-0">
                            {commit.shortSha}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono-tabular text-[#8e9381] mt-0.5">
                          {commit.author} · {formatDate(commit.date)}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
