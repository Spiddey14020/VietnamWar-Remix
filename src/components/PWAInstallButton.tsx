import { Download, MonitorDown } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [iosTipOpen, setIosTipOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {!isInstalled && (isInstallable || isIOS) && (
          <button
            type="button"
            onClick={() => {
              if (isIOS) {
                setIosTipOpen((v) => !v);
              } else {
                void install();
              }
            }}
            className="min-h-[44px] px-3.5 py-2 bg-[#232b20] hover:bg-[#2f392b] border border-[#6e8259] rounded text-xs font-mono-tabular uppercase tracking-wide text-[#e5efe0] flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <MonitorDown className="w-4 h-4 text-[#9cc47d]" />
            <span>{isIOS ? 'Install on iOS' : 'Install PC / App'}</span>
          </button>
        )}

        <a
          href="/api/Vietnam-War-1968-Setup.exe"
          download="Vietnam-War-1968-Setup.exe"
          className="min-h-[44px] px-3.5 py-2 bg-[#1a2017]/95 hover:bg-[#252e20] border border-[#c89b3c]/80 rounded text-xs font-mono-tabular uppercase tracking-wide text-[#f0dca0] flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4 text-[#c89b3c]" />
          <span>{compact ? 'Windows Setup (.exe)' : 'Download Windows Setup (.exe)'}</span>
        </a>
      </div>

      {!compact && (
        <div className="text-[11px] font-mono-tabular text-[#8e9381]">
          Standalone Windows 10/11 installer (.exe) — double-click to install offline with Desktop &amp; Start Menu shortcuts and Uninstaller.
        </div>
      )}

      {iosTipOpen && (
        <div className="p-2.5 bg-[#121610] border border-[#4a5640] rounded text-[11px] font-mono-tabular text-[#d9d5c5]">
          Tap Safari Share and choose Add to Home Screen to install offline.
        </div>
      )}
    </div>
  );
}
