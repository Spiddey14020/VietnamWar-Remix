import { useCallback, useEffect, useState } from 'react';

export type DesktopUpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'unsupported';

export interface DesktopUpdateStatus {
  stage: DesktopUpdateStage;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  message: string;
}

interface DesktopUpdaterBridge {
  isElectron: boolean;
  platform: string;
  getVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{ supported: boolean; reason?: string }>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<void>;
  onStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    desktopUpdater?: DesktopUpdaterBridge;
  }
}

export function useDesktopUpdater() {
  const bridge = typeof window !== 'undefined' ? window.desktopUpdater : undefined;
  const isElectron = Boolean(bridge?.isElectron);

  const [status, setStatus] = useState<DesktopUpdateStatus>({
    stage: 'idle',
    currentVersion: '1.0.0',
    message: '',
  });

  useEffect(() => {
    if (!bridge) return;

    let mounted = true;
    void bridge.getVersion().then((version) => {
      if (mounted && version) {
        setStatus((prev) => ({ ...prev, currentVersion: version }));
      }
    });

    const unsubscribe = bridge.onStatus((next) => {
      if (mounted) {
        setStatus(next);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [bridge]);

  const checkForUpdates = useCallback(async () => {
    if (!bridge) return;
    await bridge.checkForUpdates();
  }, [bridge]);

  const installUpdate = useCallback(async () => {
    if (!bridge) return;
    await bridge.installUpdate();
  }, [bridge]);

  return {
    isElectron,
    status,
    checkForUpdates,
    installUpdate,
  };
}
