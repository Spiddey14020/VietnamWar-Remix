import { Download, MonitorDown, Smartphone, Terminal } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isAndroid, isLinux, install } = usePWAInstall();
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {!isInstalled && (isInstallable || isIOS || isAndroid) && (
          <button
            type="button"
            onClick={() => {
              if (isInstallable) {
                void install();
              } else {
                setTipOpen((v) => !v);
              }
            }}
            className="min-h-[44px] px-3.5 py-2 bg-[#232b20] hover:bg-[#2f392b] border border-[#6e8259] rounded text-xs font-mono-tabular uppercase tracking-wide text-[#e5efe0] flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isAndroid ? (
              <Smartphone className="w-4 h-4 text-[#9cc47d]" />
            ) : (
              <MonitorDown className="w-4 h-4 text-[#9cc47d]" />
            )}
            <span>
              {isIOS
                ? 'Install on iOS'
                : isAndroid
                  ? 'Install Android App'
                  : 'Install PC / App'}
            </span>
          </button>
        )}

        {isLinux ? (
          <>
            <a
              href="/api/Vietnam-War-1968-Linux-Installer.sh"
              download="Vietnam-War-1968-Linux-Installer.sh"
              className="min-h-[44px] px-3.5 py-2 rounded text-xs font-mono-tabular uppercase tracking-wide flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 bg-[#1a2017]/95 hover:bg-[#252e20] border border-[#c89b3c]/80 text-[#f0dca0]"
            >
              <Terminal className="w-4 h-4 text-[#c89b3c]" />
              <span>{compact ? 'Linux Installer (.sh)' : 'Download Linux Installer (.sh)'}</span>
            </a>

            {!compact && (
              <a
                href="/api/Vietnam-War-1968-Linux.tar.gz"
                download="Vietnam-War-1968-Linux.tar.gz"
                className="min-h-[44px] px-3.5 py-2 rounded text-xs font-mono-tabular uppercase tracking-wide flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 bg-[#151a13]/95 hover:bg-[#1e251b] border border-[#4f6142] text-[#dce5d1]"
              >
                <Download className="w-4 h-4 text-[#9cc47d]" />
                <span>Linux Archive (.tar.gz)</span>
              </a>
            )}

            <a
              href="/api/Vietnam-War-1968-Setup.exe"
              download="Vietnam-War-1968-Setup.exe"
              className="min-h-[44px] px-3.5 py-2 rounded text-xs font-mono-tabular uppercase tracking-wide flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 bg-[#151a13]/95 hover:bg-[#1e251b] border border-[#3a4433] text-[#b8b39e]"
            >
              <Download className="w-4 h-4 text-[#9ea38f]" />
              <span>Windows (.exe)</span>
            </a>
          </>
        ) : (
          <>
            <a
              href="/api/Vietnam-War-1968-Setup.exe"
              download="Vietnam-War-1968-Setup.exe"
              className={`min-h-[44px] px-3.5 py-2 rounded text-xs font-mono-tabular uppercase tracking-wide flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                isAndroid
                  ? 'bg-[#151a13] hover:bg-[#1e251b] border border-[#3a4433] text-[#b8b39e]'
                  : 'bg-[#1a2017]/95 hover:bg-[#252e20] border border-[#c89b3c]/80 text-[#f0dca0]'
              }`}
            >
              <Download className={`w-4 h-4 ${isAndroid ? 'text-[#9ea38f]' : 'text-[#c89b3c]'}`} />
              <span>{compact ? 'Windows Setup (.exe)' : 'Download Windows Setup (.exe)'}</span>
            </a>

            {!compact && (
              <a
                href="/api/windows-installer.zip"
                download="Vietnam-War-1968-Windows-Installer.zip"
                className="min-h-[44px] px-3.5 py-2 rounded text-xs font-mono-tabular uppercase tracking-wide flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 bg-[#151a13]/95 hover:bg-[#1e251b] border border-[#3a4433] text-[#d4d0bf]"
              >
                <Download className="w-4 h-4 text-[#9ea38f]" />
                <span>Portable ZIP</span>
              </a>
            )}

            <a
              href="/api/Vietnam-War-1968-Linux-Installer.sh"
              download="Vietnam-War-1968-Linux-Installer.sh"
              className="min-h-[44px] px-3.5 py-2 rounded text-xs font-mono-tabular uppercase tracking-wide flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 bg-[#151a13]/95 hover:bg-[#1e251b] border border-[#4f6142] text-[#dce5d1]"
            >
              <Terminal className="w-4 h-4 text-[#9cc47d]" />
              <span>{compact ? 'Linux (.sh)' : 'Linux Installer (.sh)'}</span>
            </a>

            {!compact && (
              <a
                href="/api/Vietnam-War-1968-Linux.tar.gz"
                download="Vietnam-War-1968-Linux.tar.gz"
                className="min-h-[44px] px-3.5 py-2 rounded text-xs font-mono-tabular uppercase tracking-wide flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 bg-[#151a13]/95 hover:bg-[#1e251b] border border-[#3a4433] text-[#d4d0bf]"
              >
                <Download className="w-4 h-4 text-[#9ea38f]" />
                <span>Linux (.tar.gz)</span>
              </a>
            )}
          </>
        )}
      </div>

      {!compact && (
        <div className="text-[11px] font-mono-tabular text-[#8e9381]">
          {isLinux
            ? 'Run chmod +x Vietnam-War-1968-Linux-Installer.sh && ./Vietnam-War-1968-Linux-Installer.sh (no sudo needed) to add Desktop & App Menu shortcuts, or extract the .tar.gz bundle.'
            : isAndroid
              ? 'Install as a full-screen offline Android app on phone or tablet, or download the Windows (.exe) / Linux (.sh) installer for PC.'
              : 'Standalone Windows 10/11 (.exe), Portable ZIP, and native Linux (.sh / .tar.gz) installers with desktop shortcuts and offline launcher.'}
        </div>
      )}

      {tipOpen && (
        <div className="p-2.5 bg-[#121610] border border-[#4a5640] rounded text-[11px] font-mono-tabular text-[#d9d5c5]">
          {isIOS
            ? 'Tap Safari Share and choose Add to Home Screen to install offline.'
            : 'In Android Chrome or Edge, tap the browser menu (⋮) and select "Install app" or "Add to Home screen" for fullscreen offline play.'}
        </div>
      )}
    </div>
  );
}
