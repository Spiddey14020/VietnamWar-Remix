import {
  CAMPAIGN_FACTIONS,
  SOLDIER_CLASSES,
  type ControlMode,
  type HudSnapshot,
  type WeatherKind,
} from '../game/types';
import { PWAInstallButton } from './PWAInstallButton';

interface PauseOutcomeModalProps {
  hud: HudSnapshot;
  controlMode: ControlMode;
  sensitivity: number;
  onChangeControlMode: (mode: ControlMode) => void;
  onChangeSensitivity: (val: number) => void;
  onChangeAmbienceVolume: (val: number) => void;
  onChangeSfxVolume: (val: number) => void;
  onSetTimeOfDay: (hour: number) => void;
  onSetWeather: (mode: WeatherKind | 'AUTO') => void;
  onSetTimeSpeed: (mult: number) => void;
  onToggleMute: () => void;
  onOpenArmory: () => void;
  onOpenRpg: () => void;
  onOpenCampaign: () => void;
  onNextOperation?: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PauseOutcomeModal({
  hud,
  controlMode,
  sensitivity,
  onChangeControlMode,
  onChangeSensitivity,
  onChangeAmbienceVolume,
  onChangeSfxVolume,
  onSetTimeOfDay,
  onSetWeather,
  onSetTimeSpeed,
  onToggleMute,
  onOpenArmory,
  onOpenRpg,
  onOpenCampaign,
  onNextOperation,
  onResume,
  onRestart,
  onReturnTitle,
}: PauseOutcomeModalProps) {
  const isVictory = hud.phase === 'victory';
  const isGameOver = hud.phase === 'gameover';
  const isPaused = hud.phase === 'paused';

  const accuracy =
    hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;
  const completedCount = hud.objectives.filter((o) => o.completed).length;
  const prog = hud.progression;
  const className = SOLDIER_CLASSES[prog.soldierClass].name;
  const questsDone = prog.quests.filter((q) => q.completed).length;
  const xpPct = Math.min(100, Math.round((prog.xpIntoLevel / prog.xpForNextLevel) * 100));
  const activeFaction = CAMPAIGN_FACTIONS[hud.campaign.factionId];
  const activeStage = hud.campaign.active
    ? hud.campaign.stages[hud.campaign.currentStageIndex] ?? null
    : null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0c0f0b]/88 p-4 pointer-events-auto overflow-y-auto">
      <div className="w-full max-w-md bg-[#161c14] border border-[#4a5640] rounded-lg p-5 sm:p-6 shadow-2xl my-auto">
        <div className="text-xs font-mono-tabular uppercase tracking-widest text-[#c89b3c] mb-1">
          {isVictory
            ? 'Extraction Confirmed'
            : isGameOver
              ? 'Casualty Report'
              : 'Simulation Paused'}
        </div>
        <h2 className="text-2xl font-display font-bold tracking-wide text-[#ece9df] uppercase mb-2">
          {isVictory
            ? 'Mission Accomplished'
            : isGameOver
              ? 'Killed in Action'
              : 'Tactical Menu'}
        </h2>
        <p className="text-xs font-mono-tabular uppercase text-[#9cc47d] mb-1">
          {activeFaction.name} ·{' '}
          {activeStage ? `${activeStage.opCode}: ${activeStage.title}` : 'Free Valley Skirmish'}
        </p>
        <p className="text-sm text-[#c4c0b0] mb-4">
          {isVictory
            ? `${activeFaction.extractionLabel} confirmed with all valley objectives secured.`
            : isGameOver
              ? 'Your squad lost contact in the Mekong tributary valley. Redeploy to try again.'
              : 'Adjust controls, weather & time cycle, audio mix, weapon customization, or resume.'}
        </p>

        {/* Career Rank, Class & XP Card */}
        <div className="mb-4 p-3 bg-[#11150f] border border-[#3a4433] rounded">
          <div className="flex items-center justify-between text-xs font-mono-tabular mb-1.5 gap-2">
            <span className="text-[#c89b3c] font-semibold truncate">
              LV {prog.level} · {prog.rankTitle} · {className}
            </span>
            <span className="text-[#d9d5c5] tabular-nums shrink-0">
              {prog.xpIntoLevel} / {prog.xpForNextLevel} XP · {questsDone}/{prog.quests.length} Quests
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#23291f] rounded overflow-hidden">
            <div className="h-full bg-[#c89b3c]" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-3.5 bg-[#11150f] border border-[#2f382a] rounded">
          <div>
            <div className="text-[11px] text-[#9ea38f]">Hostiles Neutralized</div>
            <div className="text-lg font-display font-bold text-[#ece9df] tabular-nums">
              {hud.kills}{' '}
              <span className="text-xs font-mono-tabular text-[#c89b3c] font-normal">
                ({hud.officer.killsByArtillery} Arty)
              </span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9ea38f]">Shot Accuracy</div>
            <div className="text-lg font-display font-bold text-[#ece9df] tabular-nums">
              {accuracy}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9ea38f]">Objectives Secured</div>
            <div className="text-lg font-display font-bold text-[#ece9df] tabular-nums">
              {completedCount} / {hud.objectives.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9ea38f]">Mission Time</div>
            <div className="text-lg font-display font-bold text-[#ece9df] tabular-nums">
              {formatTime(hud.elapsedSec)}
            </div>
          </div>
        </div>

        {/* Settings when paused */}
        {isPaused && (
          <div className="space-y-3.5 mb-5">
            {/* Environment: Time of Day & Dynamic Weather */}
            <div className="p-3 bg-[#11150f] border border-[#2f382a] rounded space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-[#9ea38f]">Valley Environment</span>
                <span className="text-[#ece9df] tabular-nums">
                  {hud.environment.clockStr} · {hud.environment.phaseLabel} · {hud.environment.weather}
                </span>
              </div>

              <div>
                <div className="text-[11px] text-[#8e9381] mb-1">Time of Day</div>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { label: 'Dawn', h: 6.1 },
                      { label: 'Noon', h: 12.2 },
                      { label: 'Dusk', h: 18.2 },
                      { label: 'Night', h: 22.5 },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => onSetTimeOfDay(t.h)}
                      className="min-h-[36px] text-[11px] font-mono-tabular bg-[#1a2017] hover:bg-[#2a3325] border border-[#333d2d] rounded text-[#d9d5c5] cursor-pointer"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-[#8e9381] mb-1">Weather Front</div>
                <div className="grid grid-cols-5 gap-1">
                  {(
                    [
                      { id: 'AUTO', label: 'Auto' },
                      { id: 'CLEAR', label: 'Clear' },
                      { id: 'OVERCAST', label: 'Cloud' },
                      { id: 'MONSOON', label: 'Storm' },
                      { id: 'MIST', label: 'Mist' },
                    ] as const
                  ).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onSetWeather(w.id)}
                      className={`min-h-[36px] text-[11px] font-mono-tabular rounded border cursor-pointer ${
                        w.id !== 'AUTO' && hud.environment.weather === w.id
                          ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                          : 'bg-[#1a2017] hover:bg-[#2a3325] border-[#333d2d] text-[#c9c5b4]'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-[#8e9381] mb-1">Diurnal Cycle Speed</div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: '1x Real', mult: 1 },
                    { label: '4x Fast', mult: 4 },
                    { label: 'Freeze', mult: 0 },
                  ].map((spd) => (
                    <button
                      key={spd.label}
                      type="button"
                      onClick={() => onSetTimeSpeed(spd.mult)}
                      className={`min-h-[34px] text-[11px] font-mono-tabular rounded border cursor-pointer ${
                        hud.environment.timeSpeedMult === spd.mult
                          ? 'bg-[#c89b3c] border-[#f0cf81] text-[#11150f] font-semibold'
                          : 'bg-[#1a2017] hover:bg-[#2a3325] border-[#333d2d] text-[#c9c5b4]'
                      }`}
                    >
                      {spd.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-[#9ea38f] mb-1.5">Control Profile</div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#11150f] border border-[#2f382a] rounded">
                {(
                  [
                    { id: 'auto', label: 'Auto' },
                    { id: 'touch', label: 'Touch HUD' },
                    { id: 'desktop', label: 'Mouse/Keys' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeControlMode(opt.id)}
                    className={`min-h-[38px] text-xs font-medium rounded transition-colors cursor-pointer ${
                      controlMode === opt.id
                        ? 'bg-[#c89b3c] text-[#11150f]'
                        : 'text-[#c9c5b4] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[#9ea38f] mb-1">
                <span>Look Sensitivity</span>
                <span className="font-mono-tabular text-[#ece9df] tabular-nums">
                  {sensitivity.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.0"
                step="0.1"
                value={sensitivity}
                onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
                className="w-full accent-[#c89b3c]"
              />
            </div>

            {/* Separate Ambience & Combat SFX Sliders */}
            <div className="pt-2 border-t border-[#2b3426] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9ea38f]">Audio Mix</span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="px-2.5 py-1 text-[11px] font-mono-tabular bg-[#1e251b] hover:bg-[#2a3325] border border-[#3e4836] rounded text-[#ece9df] cursor-pointer"
                >
                  {hud.muted ? 'Master Muted' : 'Master Active'}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-[#9ea38f] mb-1">
                  <span>Ambience (Wind, Rain, Wildlife, Distant Arty)</span>
                  <span className="font-mono-tabular text-[#ece9df] tabular-nums">
                    {Math.round(hud.ambienceVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={hud.ambienceVolume}
                  onChange={(e) => onChangeAmbienceVolume(parseFloat(e.target.value))}
                  className="w-full accent-[#c89b3c]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-[#9ea38f] mb-1">
                  <span>Combat SFX (Weapons, Thunder, Explosions)</span>
                  <span className="font-mono-tabular text-[#ece9df] tabular-nums">
                    {Math.round(hud.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={hud.sfxVolume}
                  onChange={(e) => onChangeSfxVolume(parseFloat(e.target.value))}
                  className="w-full accent-[#c89b3c]"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {isVictory && onNextOperation && (
            <button
              type="button"
              onClick={onNextOperation}
              className="min-h-[48px] w-full bg-[#c89b3c] hover:bg-[#d8ab4c] text-[#11150f] font-display font-semibold tracking-wider uppercase rounded transition-colors cursor-pointer"
            >
              Deploy Next Campaign Operation
            </button>
          )}

          {isPaused && (
            <>
              <button
                type="button"
                onClick={onResume}
                className="min-h-[48px] w-full bg-[#c89b3c] hover:bg-[#d8ab4c] text-[#11150f] font-display font-semibold tracking-wider uppercase rounded transition-colors cursor-pointer"
              >
                Resume Operation
              </button>
              <button
                type="button"
                onClick={onOpenRpg}
                className="min-h-[44px] w-full bg-[#1e261b] hover:bg-[#2a3425] text-[#ece9df] border border-[#4a5640] font-display font-semibold tracking-wider uppercase text-sm rounded transition-colors cursor-pointer"
              >
                Soldier RPG, Attributes &amp; Quests (K)
              </button>
              <button
                type="button"
                onClick={onOpenArmory}
                className="min-h-[44px] w-full bg-[#1e261b] hover:bg-[#2a3425] text-[#ece9df] border border-[#4a5640] font-display font-semibold tracking-wider uppercase text-sm rounded transition-colors cursor-pointer"
              >
                Weapon Armory, Paints &amp; Internals (T)
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenCampaign}
            className="min-h-[44px] w-full bg-[#1e261b] hover:bg-[#2a3425] text-[#ece9df] border border-[#4a5640] font-display font-semibold tracking-wider uppercase text-sm rounded transition-colors cursor-pointer"
          >
            Campaign Operations &amp; Factions
          </button>

          <button
            type="button"
            onClick={onRestart}
            className={`min-h-[48px] w-full font-display font-semibold tracking-wider uppercase rounded transition-colors cursor-pointer ${
              isPaused || (isVictory && onNextOperation)
                ? 'bg-[#232b20] hover:bg-[#2f3a2b] text-[#ece9df] border border-[#4a5640]'
                : 'bg-[#c89b3c] hover:bg-[#d8ab4c] text-[#11150f]'
            }`}
          >
            {isPaused ? 'Restart Mission' : 'Redeploy to Valley'}
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="min-h-[44px] w-full bg-transparent hover:bg-[#1e251b] text-[#b8b39e] text-sm rounded border border-[#323b2c] transition-colors cursor-pointer"
          >
            Return to Title Screen
          </button>

          {isPaused && (
            <div className="pt-2 border-t border-[#293124]">
              <PWAInstallButton compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
