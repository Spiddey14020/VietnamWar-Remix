import { type User } from 'firebase/auth';
import {
  Activity,
  AlertTriangle,
  CloudDownload,
  CloudUpload,
  FileText,
  FolderOpen,
  HardDrive,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { HudSnapshot } from '../game/types';
import {
  clearCachedToken,
  getAccessToken,
  getCurrentGoogleUser,
  googleSignIn,
  initAuth,
  logout,
} from '../services/googleDriveAuth';
import {
  applyCloudSaveToLocalStorage,
  buildLocalSavePayload,
  CLOUD_SAVE_PREFIX,
  createDriveSaveFile,
  deleteDriveFile,
  DriveUnauthorizedError,
  listDriveFiles,
  queryDriveActivity,
  readDriveFileText,
  updateDriveSaveFile,
  type DriveActivityEntry,
  type DriveFileItem,
} from '../services/googleDriveService';

interface GoogleDriveModalProps {
  hud: HudSnapshot | null;
  onSaveRestored: () => void;
  onClose: () => void;
}

type ConfirmAction =
  | {
      kind: 'overwrite';
      file: DriveFileItem;
    }
  | {
      kind: 'delete';
      file: DriveFileItem;
    };

function formatBytes(sizeStr?: string): string {
  const bytes = Number(sizeStr);
  if (!Number.isFinite(bytes) || bytes <= 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatIsoDate(iso?: string): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GoogleDriveModal({ hud, onSaveRestored, onClose }: GoogleDriveModalProps) {
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getAccessToken());
  const [user, setUser] = useState<User | null>(() => getCurrentGoogleUser());
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [tab, setTab] = useState<'saves' | 'files' | 'activity'>('saves');
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [activities, setActivities] = useState<DriveActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [previewFile, setPreviewFile] = useState<{ name: string; content: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleAuthExpired = useCallback(() => {
    clearCachedToken();
    setNeedsAuth(true);
    setErrorMessage('Google Drive access token expired. Please sign in again.');
  }, []);

  const refreshDriveData = useCallback(
    async (activeTab: 'saves' | 'files' | 'activity', query: string) => {
      const token = getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        if (activeTab === 'activity') {
          const items = await queryDriveActivity(token);
          setActivities(items);
        } else {
          const items = await listDriveFiles(token, {
            savesOnly: activeTab === 'saves',
            query: activeTab === 'files' ? query : undefined,
            pageSize: 30,
          });
          setFiles(items);
        }
      } catch (err) {
        if (err instanceof DriveUnauthorizedError) {
          handleAuthExpired();
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to reach Google Drive.');
        }
      } finally {
        setLoading(false);
      }
    },
    [handleAuthExpired],
  );

  useEffect(() => {
    const unsub = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(!getAccessToken());
      },
    );
    if (getAccessToken()) {
      void refreshDriveData('saves', '');
    }
    return () => unsub();
  }, [refreshDriveData]);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const { user: signedInUser } = await googleSignIn();
      setUser(signedInUser);
      setNeedsAuth(false);
      setStatusMessage(`Connected to Google Drive as ${signedInUser.email || signedInUser.displayName}.`);
      await refreshDriveData(tab, searchQuery);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setFiles([]);
    setActivities([]);
    setPreviewFile(null);
    setNeedsAuth(true);
    setStatusMessage('Signed out of Google Drive.');
  };

  const getLocalSummary = () => ({
    level: hud?.progression.level ?? 1,
    rankTitle: hud?.progression.rankTitle ?? 'PVT E-1',
    soldierClass: hud?.progression.soldierClass ?? 'rifleman',
    factionId: hud?.campaign.factionId ?? 'us_macv',
  });

  const handleCreateNewSave = async () => {
    const token = getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setBusyMessage('Uploading new cloud save to Google Drive...');
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const payload = buildLocalSavePayload(getLocalSummary());
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `${CLOUD_SAVE_PREFIX}_${stamp}.json`;
      const created = await createDriveSaveFile(token, fileName, payload);
      setStatusMessage(`Uploaded ${created.name} to Google Drive.`);
      await refreshDriveData('saves', '');
    } catch (err) {
      if (err instanceof DriveUnauthorizedError) handleAuthExpired();
      else setErrorMessage(err instanceof Error ? err.message : 'Cloud upload failed.');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleRestoreSave = async (file: DriveFileItem) => {
    const token = getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setBusyMessage(`Downloading ${file.name}...`);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const raw = await readDriveFileText(token, file.id);
      const parsed = applyCloudSaveToLocalStorage(raw);
      onSaveRestored();
      setStatusMessage(
        `Restored "${file.name}" (LV ${parsed.summary.level} ${parsed.summary.rankTitle}).`,
      );
    } catch (err) {
      if (err instanceof DriveUnauthorizedError) handleAuthExpired();
      else setErrorMessage(err instanceof Error ? err.message : 'Failed to restore cloud save.');
    } finally {
      setBusyMessage(null);
    }
  };

  const handlePreviewFile = async (file: DriveFileItem) => {
    const token = getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setBusyMessage(`Reading ${file.name}...`);
    setErrorMessage(null);
    try {
      const text = await readDriveFileText(token, file.id);
      setPreviewFile({
        name: file.name,
        content: text.slice(0, 6000),
      });
    } catch (err) {
      if (err instanceof DriveUnauthorizedError) handleAuthExpired();
      else setErrorMessage(err instanceof Error ? err.message : 'Unable to read file contents.');
    } finally {
      setBusyMessage(null);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const token = getAccessToken();
    if (!token) {
      setConfirmAction(null);
      setNeedsAuth(true);
      return;
    }

    const action = confirmAction;
    setConfirmAction(null);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      if (action.kind === 'overwrite') {
        setBusyMessage(`Updating ${action.file.name} on Google Drive...`);
        const payload = buildLocalSavePayload(getLocalSummary());
        const updated = await updateDriveSaveFile(token, action.file.id, action.file.name, payload);
        setStatusMessage(`Updated cloud save "${updated.name}".`);
      } else {
        setBusyMessage(`Deleting ${action.file.name} from Google Drive...`);
        await deleteDriveFile(token, action.file.id);
        setStatusMessage(`Deleted "${action.file.name}" from Google Drive.`);
      }
      await refreshDriveData(tab, searchQuery);
    } catch (err) {
      if (err instanceof DriveUnauthorizedError) handleAuthExpired();
      else setErrorMessage(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusyMessage(null);
    }
  };

  const latestSaveFile = files.find((f) => f.name.startsWith(CLOUD_SAVE_PREFIX)) ?? null;

  return (
    <div className="fixed inset-0 z-40 flex items-start sm:items-center justify-center bg-[#090c08]/90 p-3 sm:p-6 pointer-events-auto overflow-y-auto touch-scroll">
      <div className="w-full max-w-3xl bg-[#151b13] border border-[#4a5640] rounded-lg shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-[#10140e] border-b border-[#323b2c]">
          <div className="flex items-center gap-3 min-w-0">
            <HardDrive className="w-5 h-5 text-[#c89b3c] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#c89b3c]">
                Google Workspace Cloud Sync
              </div>
              <h2 className="text-lg font-display font-bold uppercase tracking-wide text-[#ece9df] truncate">
                Google Drive Saves &amp; File Vault
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Google Drive modal"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-[#1c2319] hover:bg-[#2a3425] border border-[#3e4836] rounded text-[#d9d5c5] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Error / Status banners */}
          {errorMessage && (
            <div className="p-3 bg-[#361816] border border-[#96423a] rounded text-xs font-mono-tabular text-[#ffd2cb]">
              {errorMessage}
            </div>
          )}
          {statusMessage && (
            <div className="p-3 bg-[#1a2b1c] border border-[#4b7c50] rounded text-xs font-mono-tabular text-[#c9eccb]">
              {statusMessage}
            </div>
          )}

          {needsAuth ? (
            <div className="p-6 bg-[#10150f] border border-[#323b2c] rounded text-center space-y-4">
              <div className="text-sm text-[#d9d5c5] max-w-md mx-auto leading-relaxed">
                Sign in with your Google account to back up and restore your RPG progression,
                custom camouflages, loadouts, and procedural campaigns across devices, or browse and
                manage your Google Drive files.
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={isLoggingIn}
                  className="gsi-material-button"
                >
                  <div className="gsi-material-button-state" />
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                        <path fill="none" d="M0 0h48v48H0z" />
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents">
                      {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
                    </span>
                    <span style={{ display: 'none' }}>Sign in with Google</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Connected User Strip & Quick Save Controls */}
              <div className="p-3.5 bg-[#10150f] border border-[#323b2c] rounded flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono-tabular text-[#9cc47d] uppercase">
                    Connected · {user?.displayName || 'Google Drive User'}
                  </div>
                  <div className="text-xs font-mono-tabular text-[#b8b39e] truncate">
                    {user?.email || 'Drive session active in memory'} · Local Soldier: LV{' '}
                    {hud?.progression.level ?? 1} {hud?.progression.rankTitle ?? 'PVT E-1'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busyMessage)}
                    onClick={() => void handleCreateNewSave()}
                    className="min-h-[40px] px-3 py-1.5 bg-[#c89b3c] hover:bg-[#d8ab4c] text-[#11150f] rounded text-xs font-mono-tabular font-semibold uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Upload New Save</span>
                  </button>
                  {latestSaveFile && tab === 'saves' && (
                    <button
                      type="button"
                      disabled={Boolean(busyMessage)}
                      onClick={() =>
                        setConfirmAction({
                          kind: 'overwrite',
                          file: latestSaveFile,
                        })
                      }
                      className="min-h-[40px] px-3 py-1.5 bg-[#222a1e] hover:bg-[#2d3828] border border-[#6e8259] text-[#e5efe0] rounded text-xs font-mono-tabular uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CloudUpload className="w-3.5 h-3.5 text-[#9cc47d]" />
                      <span>Overwrite Latest</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="min-h-[40px] px-3 py-1.5 bg-[#1a2017] hover:bg-[#252d21] border border-[#3d4736] text-[#c4c0b0] rounded text-xs font-mono-tabular uppercase flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs + Search */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex p-1 bg-[#10140e] border border-[#323b2c] rounded">
                  {(
                    [
                      { id: 'saves', label: 'Cloud Saves' },
                      { id: 'files', label: 'All Drive Files' },
                      { id: 'activity', label: 'Drive Activity' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setPreviewFile(null);
                        void refreshDriveData(item.id, searchQuery);
                      }}
                      className={`min-h-[36px] px-3 py-1 text-xs font-mono-tabular uppercase rounded cursor-pointer transition-colors ${
                        tab === item.id
                          ? 'bg-[#c89b3c] text-[#11150f] font-semibold'
                          : 'text-[#c4c0b0] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {tab === 'files' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void refreshDriveData('files', searchQuery);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search file name..."
                        className="h-9 px-2.5 bg-[#10140e] border border-[#3a4433] rounded text-xs font-mono-tabular text-[#ece9df] placeholder:text-[#787f6e] focus:outline-none focus:border-[#c89b3c]"
                      />
                      <button
                        type="submit"
                        aria-label="Search Google Drive files"
                        className="h-9 px-2.5 bg-[#20271d] hover:bg-[#2b3426] border border-[#3d4736] rounded text-[#ece9df] cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                  <button
                    type="button"
                    onClick={() => void refreshDriveData(tab, searchQuery)}
                    disabled={loading}
                    className="h-9 px-3 bg-[#1c2319] hover:bg-[#283124] border border-[#3d4736] rounded text-xs font-mono-tabular uppercase text-[#d9d5c5] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {busyMessage && (
                <div className="text-xs font-mono-tabular text-[#c89b3c]">{busyMessage}</div>
              )}

              {/* Activity Feed or Files List */}
              {tab === 'activity' ? (
                <div className="max-h-72 overflow-y-auto bg-[#10140e] border border-[#2f382a] rounded divide-y divide-[#22291f]">
                  {loading ? (
                    <div className="p-4 text-xs font-mono-tabular text-[#9ea38f]">
                      Loading Google Drive activity...
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="p-4 text-xs font-mono-tabular text-[#9ea38f]">
                      No recent Drive activity found.
                    </div>
                  ) : (
                    activities.map((act, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Activity className="w-4 h-4 text-[#c89b3c] shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-mono-tabular text-[#ece9df] truncate">
                              {act.targetName}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-[#9cc47d]">
                              {act.actionLabel}
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[#8e9381] shrink-0">
                          {formatIsoDate(act.timestamp)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto bg-[#10140e] border border-[#2f382a] rounded divide-y divide-[#22291f]">
                  {loading ? (
                    <div className="p-4 text-xs font-mono-tabular text-[#9ea38f]">
                      Loading files from Google Drive...
                    </div>
                  ) : files.length === 0 ? (
                    <div className="p-5 text-center space-y-2">
                      <FolderOpen className="w-6 h-6 text-[#6e7762] mx-auto" />
                      <div className="text-xs font-mono-tabular text-[#9ea38f]">
                        {tab === 'saves'
                          ? 'No Vietnam War cloud saves found yet. Click "Upload New Save" above to create one.'
                          : 'No matching Google Drive files found.'}
                      </div>
                    </div>
                  ) : (
                    files.map((file) => {
                      const isSave = file.name.startsWith(CLOUD_SAVE_PREFIX);
                      return (
                        <div
                          key={file.id}
                          className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-[#161c14]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <FileText
                              className={`w-4 h-4 shrink-0 ${
                                isSave ? 'text-[#c89b3c]' : 'text-[#9ea38f]'
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-mono-tabular text-[#ece9df] truncate">
                                {file.name}
                              </div>
                              <div className="text-[11px] font-mono-tabular text-[#8e9381]">
                                {formatIsoDate(file.modifiedTime)} · {formatBytes(file.size)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSave ? (
                              <>
                                <button
                                  type="button"
                                  disabled={Boolean(busyMessage)}
                                  onClick={() => void handleRestoreSave(file)}
                                  className="min-h-[34px] px-2.5 py-1 bg-[#222d1e] hover:bg-[#2d3b27] border border-[#5d7348] rounded text-[11px] font-mono-tabular uppercase text-[#d8f0c0] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <CloudDownload className="w-3.5 h-3.5" />
                                  <span>Restore</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(busyMessage)}
                                  onClick={() => setConfirmAction({ kind: 'overwrite', file })}
                                  className="min-h-[34px] px-2.5 py-1 bg-[#1e251b] hover:bg-[#2a3325] border border-[#4a5640] rounded text-[11px] font-mono-tabular uppercase text-[#e6d19a] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <CloudUpload className="w-3.5 h-3.5" />
                                  <span>Update</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={Boolean(busyMessage)}
                                onClick={() => void handlePreviewFile(file)}
                                className="min-h-[34px] px-2.5 py-1 bg-[#1e251b] hover:bg-[#2a3325] border border-[#3d4736] rounded text-[11px] font-mono-tabular uppercase text-[#d9d5c5] cursor-pointer disabled:opacity-50"
                              >
                                Read
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={Boolean(busyMessage)}
                              onClick={() => setConfirmAction({ kind: 'delete', file })}
                              aria-label={`Delete ${file.name}`}
                              className="min-h-[34px] px-2 py-1 bg-[#2b1715] hover:bg-[#3f201d] border border-[#753933] rounded text-[#f3b5ae] cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Text / JSON Preview Drawer */}
              {previewFile && (
                <div className="p-3 bg-[#0d110c] border border-[#3a4433] rounded space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono-tabular text-[#c89b3c]">
                    <span>Preview: {previewFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setPreviewFile(null)}
                      className="text-[#9ea38f] hover:text-white cursor-pointer"
                    >
                      Close Preview
                    </button>
                  </div>
                  <pre className="max-h-40 overflow-auto text-[11px] font-mono-tabular text-[#d2cebf] whitespace-pre-wrap break-all">
                    {previewFile.content}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mandatory Explicit Confirmation Dialog for Mutating / Destructive Drive Operations */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md bg-[#161c14] border border-[#965146] rounded-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#e69a5c] shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h3 className="text-base font-display font-bold uppercase text-[#ece9df]">
                  {confirmAction.kind === 'delete'
                    ? 'Delete File from Google Drive?'
                    : 'Overwrite Cloud Save in Google Drive?'}
                </h3>
                <p className="text-xs text-[#d2cebf] leading-relaxed">
                  {confirmAction.kind === 'delete'
                    ? `Are you sure you want to permanently delete "${confirmAction.file.name}" from your Google Drive? This action cannot be undone.`
                    : `Replace the contents of "${confirmAction.file.name}" in Google Drive with your current local RPG rank, loadouts, custom camos, and campaign progress?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="min-h-[40px] px-4 py-1.5 bg-[#1e251b] hover:bg-[#2a3325] border border-[#3e4836] rounded text-xs font-mono-tabular uppercase text-[#d9d5c5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmedAction()}
                className={`min-h-[40px] px-4 py-1.5 rounded text-xs font-mono-tabular font-semibold uppercase cursor-pointer ${
                  confirmAction.kind === 'delete'
                    ? 'bg-[#b34237] hover:bg-[#c84d41] text-white'
                    : 'bg-[#c89b3c] hover:bg-[#d8ab4c] text-[#11150f]'
                }`}
              >
                {confirmAction.kind === 'delete' ? 'Confirm Delete' : 'Confirm Overwrite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
