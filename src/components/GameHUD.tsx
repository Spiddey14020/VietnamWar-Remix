import {
  CAMPAIGN_FACTIONS,
  MILITARY_UNIFORMS,
  SOLDIER_CLASSES,
  TERRAIN_ZONE_LABELS,
  WEAPON_SPECS,
  type HudSnapshot,
  type WeaponId,
} from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  showTouchControls: boolean;
  onToggleMap: () => void;
  onToggleArmory: () => void;
  onToggleRpg: () => void;
  onToggleOfficer: () => void;
  onToggleBinoculars: () => void;
  onDesignateAndFire: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onContextAction: () => void;
  onCallCounterBattery: () => void;
}

const COMPASS_LABELS: { deg: number; label: string }[] = [
  { deg: 0, label: 'N' },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'E' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W' },
  { deg: 315, label: 'NW' },
];

function shortestAngleDiff(a: number, b: number): number {
  let d = ((b - a + 540) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

export function GameHUD({
  hud,
  showTouchControls,
  onToggleMap,
  onToggleArmory,
  onToggleRpg,
  onToggleOfficer,
  onToggleBinoculars,
  onDesignateAndFire,
  onToggleMute,
  onPause,
  onSelectWeapon,
  onContextAction,
  onCallCounterBattery,
}: GameHUDProps) {
  const spec = WEAPON_SPECS[hud.activeWeapon];
  const weaponState = hud.weapons[hud.activeWeapon];
  const att = weaponState.attachments;
  const intl = weaponState.internals;
  const cbSol = hud.counterBattery.activeSolution;
  const cbCooldown = hud.counterBattery.strikeCooldownSec;
  const officer = hud.officer;
  const readyGuns = officer.guns.filter((g) => g.status === 'READY').length;
  const env = hud.environment;
  const prog = hud.progression;
  const unspentRpg = prog.attributePoints + prog.skillPoints;
  const activeQuests = prog.quests.filter((q) => !q.completed).slice(0, 2);
  const activeClassSpec = SOLDIER_CLASSES[prog.soldierClass];
  const activeUniform = MILITARY_UNIFORMS[hud.characterLoadout.uniform];
  const uniformDisplayName =
    hud.characterLoadout.uniform === 'custom_camo'
      ? (hud.characterLoadout.customUniformCamo?.name || hud.customUniformCamo.name || activeUniform.colorName)
      : activeUniform.colorName;
  const activeFaction = CAMPAIGN_FACTIONS[hud.campaign.factionId];
  const activeStage = hud.campaign.active
    ? hud.campaign.stages[hud.campaign.currentStageIndex] ?? null
    : null;
  const terrainLabel = TERRAIN_ZONE_LABELS[hud.terrainZone];
  const xpPct = Math.min(100, Math.round((prog.xpIntoLevel / prog.xpForNextLevel) * 100));
  const hpPct = Math.max(0, Math.min(100, Math.round((hud.health / hud.maxHealth) * 100)));

  const attTags: string[] = [];
  if (att.optic === 'colt_scope') attTags.push('3x20');
  else if (att.optic === 'oeg_dot') attTags.push('OEG');
  if (att.muzzle === 'suppressor') attTags.push('SUPP');
  else if (att.muzzle === 'compensator') attTags.push('COMP');
  if (att.underbarrel === 'extended_mag') attTags.push('EXT');
  else if (att.underbarrel === 'bipod_grip') attTags.push('GRIP');
  if (
    intl.trigger !== 'standard_trigger' ||
    intl.bolt !== 'standard_bolt' ||
    intl.spring !== 'standard_spring'
  ) {
    attTags.push('TUNED');
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Binocular Field Glass Mask & Mil-Dot Stadia Reticle */}
      {officer.binocularZoom && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, transparent 36%, rgba(8, 11, 7, 0.94) 62%)',
          }}
        >
          <svg
            viewBox="0 0 400 260"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[440px] h-auto"
          >
            <g stroke="#e6e1cc" strokeWidth="1" opacity="0.82">
              <line x1="70" y1="130" x2="184" y2="130" />
              <line x1="216" y1="130" x2="330" y2="130" />
              <line x1="200" y1="36" x2="200" y2="114" />
              <line x1="200" y1="146" x2="200" y2="224" />
              {[-4, -3, -2, -1, 1, 2, 3, 4].map((step) => (
                <g key={step}>
                  <line
                    x1={200 + step * 24}
                    y1="126"
                    x2={200 + step * 24}
                    y2="134"
                  />
                  <line
                    x1="196"
                    y1={130 + step * 18}
                    x2="204"
                    y2={130 + step * 18}
                  />
                </g>
              ))}
              <circle cx="200" cy="130" r="3" fill="none" stroke="#c89b3c" strokeWidth="1.4" />
            </g>
          </svg>
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={onDesignateAndFire}
              disabled={readyGuns === 0}
              className={`min-h-[44px] px-4 py-2 rounded border text-xs font-mono-tabular uppercase tracking-wider cursor-pointer ${
                readyGuns > 0
                  ? 'bg-[#c89b3c]/95 hover:bg-[#dab04f] border-[#f6dc95] text-[#11150f] font-bold'
                  : 'bg-[#121610]/90 border-[#444c3d] text-[#8e9381] cursor-not-allowed'
              }`}
            >
              {readyGuns > 0
                ? showTouchControls
                  ? `Spot & Fire 155mm (${readyGuns}/3)`
                  : `[Click / F] Spot & Fire 155mm (${officer.shellType})`
                : '155mm Squad Reloading...'}
            </button>
          </div>
        </div>
      )}

      {/* Damage red vignette */}
      {hud.damageFlash > 0.02 && (
        <div
          className="absolute inset-0 transition-opacity duration-75"
          style={{
            background:
              'radial-gradient(circle at center, transparent 48%, rgba(165, 28, 22, 0.72) 100%)',
            opacity: hud.damageFlash,
          }}
        />
      )}

      {/* Top Perimeter: Objectives + Officer/Map/CB (Left) · Compass + Time/Weather (Center) · Audio/Pause (Right) */}
      <div className="flex items-start justify-between px-3 sm:px-5 pt-3 gap-3">
        {/* Top-Left: Objective Cluster + Map/Armory/Officer Controls */}
        <div className="flex flex-col gap-1.5 max-w-[270px] sm:max-w-[330px]">
          <div className="bg-[#121610]/85 border border-[#3a4433] px-3 py-2 rounded">
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular uppercase tracking-wider text-[#9cc47d] mb-0.5">
              <span className="truncate">
                {activeFaction.shortName} · {activeStage ? `${activeStage.opCode} ${activeStage.title}` : 'Valley Skirmish'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#c89b3c]">
                Mission Objectives
              </span>
              <span className="text-[11px] font-mono-tabular text-[#a9ad99] tabular-nums">
                {hud.kills} KIA
              </span>
            </div>
            <div className="space-y-1 text-xs">
              {hud.objectives.map((obj) => (
                <div
                  key={obj.id}
                  className={`flex items-center justify-between gap-2 ${
                    obj.completed
                      ? 'text-[#7f8973] line-through'
                      : obj.active
                        ? 'text-[#ece9df]'
                        : 'text-[#6c7362]'
                  }`}
                >
                  <span className="truncate">{obj.code} · {obj.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onToggleMap}
              className="min-h-[40px] px-2.5 py-1.5 bg-[#121610]/88 hover:bg-[#1e251b] border border-[#3a4433] rounded text-[11px] font-mono-tabular text-[#d9d5c5] cursor-pointer whitespace-nowrap"
            >
              Map (M)
            </button>
            <button
              type="button"
              onClick={onToggleArmory}
              className="min-h-[40px] px-2.5 py-1.5 bg-[#121610]/88 hover:bg-[#1e251b] border border-[#3a4433] rounded text-[11px] font-mono-tabular text-[#d9d5c5] cursor-pointer whitespace-nowrap"
            >
              Armory (T)
            </button>
            <button
              type="button"
              onClick={onToggleRpg}
              className={`min-h-[40px] px-2.5 py-1.5 border rounded text-[11px] font-mono-tabular cursor-pointer whitespace-nowrap transition-colors ${
                unspentRpg > 0
                  ? 'bg-[#c89b3c] border-[#f5d98a] text-[#11150f] font-bold'
                  : 'bg-[#121610]/88 hover:bg-[#1e251b] border-[#3a4433] text-[#d9d5c5]'
              }`}
            >
              {unspentRpg > 0 ? `RPG +${unspentRpg} (K)` : 'RPG (K)'}
            </button>
            <button
              type="button"
              onClick={onToggleOfficer}
              className={`min-h-[40px] px-2.5 py-1.5 border rounded text-[11px] font-mono-tabular cursor-pointer whitespace-nowrap transition-colors ${
                officer.officerActive
                  ? 'bg-[#c89b3c] border-[#f5d98a] text-[#11150f] font-bold'
                  : 'bg-[#121610]/88 hover:bg-[#1e251b] border-[#3a4433] text-[#d9d5c5]'
              }`}
            >
              Officer (O)
            </button>

            {officer.officerActive && (
              <button
                type="button"
                onClick={onToggleBinoculars}
                className={`min-h-[40px] px-2.5 py-1.5 border rounded text-[11px] font-mono-tabular cursor-pointer whitespace-nowrap ${
                  officer.binocularZoom
                    ? 'bg-[#2a3822] border-[#9cc47d] text-[#e7f2dc] font-bold'
                    : 'bg-[#121610]/88 hover:bg-[#1e251b] border-[#4e5c44] text-[#d9d5c5]'
                }`}
              >
                Binos (V)
              </button>
            )}

            {cbSol && (
              <button
                type="button"
                disabled={cbCooldown > 0}
                onClick={onCallCounterBattery}
                className={`min-h-[40px] px-2.5 py-1.5 border rounded text-[11px] font-mono-tabular cursor-pointer whitespace-nowrap transition-colors ${
                  cbCooldown > 0
                    ? 'bg-[#121610]/85 border-[#4c5544] text-[#8d927f] cursor-not-allowed'
                    : 'bg-[#8f3224]/92 hover:bg-[#a93c2b] border-[#e28778] text-[#fff6eb]'
                }`}
              >
                {cbCooldown > 0
                  ? `CB Ready ${cbCooldown}s`
                  : showTouchControls
                    ? `CB ${String(cbSol.azimuthDeg).padStart(3, '0')}°`
                    : `[F] CB ${String(cbSol.azimuthDeg).padStart(3, '0')}°`}
              </button>
            )}
          </div>

          {officer.officerActive && (
            <div className="bg-[#121610]/88 border border-[#5f6f47] px-2.5 py-1.5 rounded text-[11px] font-mono-tabular text-[#d9e5cc] tabular-nums">
              <div className="flex items-center justify-between gap-2 text-[#c89b3c]">
                <span>155MM SQUAD · {readyGuns}/3 READY</span>
                <span>{officer.shellType} · {officer.sheafPattern}</span>
              </div>
              <div className="text-[#c8c5b4]">
                {officer.etaSec !== null
                  ? `SALVO INBOUND · SPLASH IN ${officer.etaSec}S`
                  : officer.targetGridRef
                    ? `TGT ${officer.targetGridRef} · ${officer.targetRangeM}M`
                    : 'Binos [V] or Map [M] to designate target'}
              </div>
            </div>
          )}

          {cbSol && (
            <div className="bg-[#121610]/85 border border-[#6e3b2e] px-2.5 py-1.5 rounded text-[11px] font-mono-tabular text-[#e8d5bd] tabular-nums">
              <div className="text-[#e69a5c] truncate">{cbSol.callsign}</div>
              <div>
                {cbSol.gridRef} · {String(cbSol.azimuthDeg).padStart(3, '0')}° · {cbSol.rangeMeters}m
              </div>
            </div>
          )}

          {activeQuests.length > 0 && (
            <div className="hidden md:block bg-[#121610]/80 border border-[#2f3829] px-2.5 py-1.5 rounded text-[11px] font-mono-tabular text-[#c9c5b4] tabular-nums">
              <div className="text-[10px] uppercase tracking-wider text-[#9cc47d] mb-0.5">
                Active Quests
              </div>
              {activeQuests.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{q.title}</span>
                  <span className="text-[#c89b3c] shrink-0">
                    {q.progress}/{q.target}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top-Center: Tactical Compass Ribbon + Diurnal Clock & Weather */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="relative w-72 h-9 bg-[#121610]/85 border border-[#3a4433] rounded overflow-hidden">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#c89b3c]/70 -translate-x-1/2" />
            {COMPASS_LABELS.map((item) => {
              const diff = shortestAngleDiff(hud.headingDeg, item.deg);
              if (Math.abs(diff) > 72) return null;
              const leftPct = 50 + (diff / 72) * 50;
              return (
                <span
                  key={item.label}
                  className="absolute top-1.5 -translate-x-1/2 text-xs font-mono-tabular font-semibold text-[#d4d0bf]"
                  style={{ left: `${leftPct}%` }}
                >
                  {item.label}
                </span>
              );
            })}

            {hud.objectives
              .filter((o) => o.active && !o.completed)
              .map((obj) => {
                const dx = obj.x - hud.playerX;
                const dz = obj.z - hud.playerZ;
                const bearingRad = Math.atan2(dx, -dz);
                const bearingDeg = ((bearingRad * 180) / Math.PI + 360) % 360;
                const diff = shortestAngleDiff(hud.headingDeg, bearingDeg);
                if (Math.abs(diff) > 72) return null;
                const leftPct = 50 + (diff / 72) * 50;
                return (
                  <span
                    key={obj.id}
                    className="absolute bottom-0.5 -translate-x-1/2 text-[10px] font-mono-tabular font-bold text-[#c89b3c]"
                    style={{ left: `${leftPct}%` }}
                  >
                    {obj.id === 'alpha' ? 'A' : obj.id === 'charlie' ? 'C' : 'LZ'}
                  </span>
                );
              })}

            {cbSol &&
              (() => {
                const diff = shortestAngleDiff(hud.headingDeg, cbSol.azimuthDeg);
                if (Math.abs(diff) > 72) return null;
                const leftPct = 50 + (diff / 72) * 50;
                return (
                  <span
                    className="absolute bottom-0.5 -translate-x-1/2 text-[10px] font-mono-tabular font-bold text-[#e67058]"
                    style={{ left: `${leftPct}%` }}
                  >
                    ARTY
                  </span>
                );
              })()}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] font-mono-tabular tabular-nums bg-[#121610]/80 px-2.5 py-0.5 rounded border border-[#323a2c]">
            <span className="text-[#c89b3c]">{String(Math.round(hud.headingDeg)).padStart(3, '0')}°</span>
            <span className="text-[#56604d]" aria-hidden="true">·</span>
            <span className="text-[#ece9df]">{env.clockStr}</span>
            <span className="text-[#56604d]" aria-hidden="true">·</span>
            <span className="text-[#9cc47d]">{env.phaseLabel}</span>
            <span className="text-[#56604d]" aria-hidden="true">·</span>
            <span className="text-[#b8b39e]">{env.weather}</span>
          </div>
        </div>

        {/* Top-Right: Compact Mobile Clock + Mute & Pause */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="min-h-[44px] px-3 py-2 bg-[#121610]/85 hover:bg-[#1e251b] border border-[#3a4433] rounded text-xs font-mono-tabular text-[#ece9df] cursor-pointer whitespace-nowrap"
            >
              {hud.muted ? 'Muted' : 'Audio'}
            </button>
            <button
              type="button"
              onClick={onPause}
              className="min-h-[44px] px-3.5 py-2 bg-[#121610]/85 hover:bg-[#1e251b] border border-[#3a4433] rounded text-xs font-mono-tabular text-[#ece9df] cursor-pointer whitespace-nowrap"
            >
              Pause
            </button>
          </div>
          <div className="sm:hidden text-[10px] font-mono-tabular tabular-nums bg-[#121610]/85 border border-[#323a2c] px-2 py-0.5 rounded text-[#d4d0bf]">
            {env.clockStr} · {env.phaseLabel} · {env.weather}
          </div>
        </div>
      </div>

      {/* Status / Extraction / XP Toast Banner */}
      {(hud.statusBanner || hud.extractCountdown !== null || prog.recentEvent) && (
        <div className="absolute top-22 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-center">
          {hud.statusBanner && (
            <div className="bg-[#121610]/90 border border-[#c89b3c]/60 px-4 py-1.5 rounded text-xs font-mono-tabular tracking-wider text-[#f0e5c2] whitespace-nowrap">
              {hud.statusBanner}
            </div>
          )}
          {prog.recentEvent && (
            <div
              key={prog.recentEvent.id}
              className="bg-[#161e13]/92 border border-[#7ea85a] px-3 py-1 rounded text-[11px] font-mono-tabular tracking-wide text-[#c9e8a9] tabular-nums whitespace-nowrap"
            >
              +{prog.recentEvent.amount} XP · {prog.recentEvent.label}
            </div>
          )}
          {hud.enemyGrenadeAlert && (
            <div className="bg-[#4b1812]/95 border border-[#f06e58] px-4 py-1.5 rounded text-xs font-mono-tabular font-bold tracking-wider text-[#fff2ec] tabular-nums whitespace-nowrap">
              INCOMING ENEMY FRAG · {hud.enemyGrenadeAlert.distanceM}M · {hud.enemyGrenadeAlert.fuseSec}S
            </div>
          )}
          {hud.extractCountdown !== null && (
            <div className="bg-[#1a2216]/95 border border-[#c89b3c] px-4 py-2 rounded text-sm font-display tracking-wider text-[#c89b3c] tabular-nums whitespace-nowrap">
              HOLD LZ BRAVO · HUEY EXTRACTION IN {hud.extractCountdown}S
            </div>
          )}
        </div>
      )}

      {/* Colt 3x20 Optical Scope Mask (unobstructed when adsBlend > 0.72) */}
      {!officer.binocularZoom && att.optic === 'colt_scope' && hud.adsBlend > 0.72 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, transparent 27%, rgba(8, 10, 7, 0.96) 35%)',
          }}
        >
          <svg
            viewBox="0 0 240 240"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[56vmin] h-[56vmin] max-w-[420px] max-h-[420px]"
          >
            <circle cx="120" cy="120" r="108" fill="none" stroke="#22281f" strokeWidth="3" />
            <circle cx="120" cy="120" r="105" fill="none" stroke="#c89b3c" strokeWidth="0.6" strokeOpacity="0.35" />
            {/* Thick outer duplex stadia posts + fine inner crosshairs */}
            <line x1="12" y1="120" x2="78" y2="120" stroke="#0d100c" strokeWidth="3.2" />
            <line x1="162" y1="120" x2="228" y2="120" stroke="#0d100c" strokeWidth="3.2" />
            <line x1="120" y1="12" x2="120" y2="78" stroke="#0d100c" strokeWidth="3.2" />
            <line x1="120" y1="162" x2="120" y2="228" stroke="#0d100c" strokeWidth="3.2" />
            <line x1="78" y1="120" x2="162" y2="120" stroke="#11150f" strokeWidth="1" />
            <line x1="120" y1="78" x2="120" y2="162" stroke="#11150f" strokeWidth="1" />
            {/* Rangefinder stadia ticks */}
            {[-20, -10, 10, 20].map((d) => (
              <g key={d} stroke="#11150f" strokeWidth="1">
                <line x1={120 + d} y1="117" x2={120 + d} y2="123" />
                <line x1="117" y1={120 + d} x2="123" y2={120 + d} />
              </g>
            ))}
            <circle cx="120" cy="120" r="1.8" fill="#e67058" />
          </svg>
        </div>
      )}

      {/* Center Reticle (Hipfire / OEG ADS) + Hit Marker */}
      {!officer.binocularZoom && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {hud.adsBlend <= 0.35 && (
            <div className="relative w-7 h-7">
              <div className="absolute left-1/2 top-0 w-px h-2 bg-[#ece9df]/80 -translate-x-1/2" />
              <div className="absolute left-1/2 bottom-0 w-px h-2 bg-[#ece9df]/80 -translate-x-1/2" />
              <div className="absolute top-1/2 left-0 h-px w-2 bg-[#ece9df]/80 -translate-y-1/2" />
              <div className="absolute top-1/2 right-0 h-px w-2 bg-[#ece9df]/80 -translate-y-1/2" />
            </div>
          )}

          {att.optic === 'oeg_dot' && hud.adsBlend > 0.65 && (
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffaa33] shadow-[0_0_8px_#ffaa33]" />
          )}

          {hud.hitMarkerTimer > 0 && (
            <svg
              viewBox="0 0 32 32"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8"
            >
              <g
                stroke={hud.hitMarkerKill ? '#e04f3e' : '#ffffff'}
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <line x1="6" y1="6" x2="12" y2="12" />
                <line x1="26" y1="6" x2="20" y2="12" />
                <line x1="6" y1="26" x2="12" y2="20" />
                <line x1="26" y1="26" x2="20" y2="20" />
              </g>
            </svg>
          )}
        </div>
      )}

      {/* Reload / Bandage Progress Indicator */}
      {(hud.isReloading || hud.bandagingProgress > 0) && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 w-40 bg-[#121610]/90 border border-[#3e4836] rounded p-1.5">
          <div className="text-[10px] font-mono-tabular text-center text-[#d9d5c5] mb-1">
            {hud.bandagingProgress > 0 ? 'Applying Field Dressing' : `Reloading ${spec.name}`}
          </div>
          <div className="w-full h-1.5 bg-[#242b20] rounded overflow-hidden">
            <div
              className="h-full bg-[#c89b3c]"
              style={{
                width: `${Math.round((hud.bandagingProgress > 0 ? hud.bandagingProgress : hud.reloadProgress) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Contextual Interactive Action Prompt */}
      {hud.nearbyPrompt && (
        <div className="absolute left-1/2 bottom-28 sm:bottom-24 -translate-x-1/2 pointer-events-auto">
          {hud.nearbyActionType ? (
            <button
              type="button"
              onClick={onContextAction}
              className="min-h-[44px] px-5 py-2 bg-[#161b14]/95 hover:bg-[#222a1e] border border-[#c89b3c] rounded text-xs sm:text-sm font-medium text-[#f2ebd4] cursor-pointer whitespace-nowrap"
            >
              {showTouchControls ? `Tap: ${hud.nearbyPrompt}` : `[E] ${hud.nearbyPrompt}`}
            </button>
          ) : (
            <div className="px-4 py-1.5 bg-[#121610]/90 border border-[#536048] rounded text-xs font-mono-tabular text-[#ece9df] whitespace-nowrap">
              {hud.nearbyPrompt}
            </div>
          )}
        </div>
      )}

      {/* Desktop Pointer Lock Hint when unlocked */}
      {!showTouchControls && !hud.pointerLocked && (
        <div className="absolute left-1/2 bottom-16 -translate-x-1/2 bg-[#121610]/85 border border-[#3d4736] px-3.5 py-1.5 rounded text-xs text-[#c7c3b2] whitespace-nowrap">
          Click 3D viewport to lock mouse aim · Esc to unlock
        </div>
      )}

      {/* Bottom Perimeter Status Clusters */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
        {/* Bottom-Left: Health, Stamina, Rank & XP */}
        <div className="bg-[#121610]/88 border border-[#3a4433] rounded px-3.5 py-2.5 min-w-[188px]">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs text-[#a5a897]">Health</span>
            <span
              className={`text-xl font-display font-bold tabular-nums ${
                hud.health <= 30 ? 'text-[#e05a47]' : 'text-[#ece9df]'
              }`}
            >
              {hud.health}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#23291f] rounded overflow-hidden mt-1 mb-2">
            <div
              className={`h-full ${hud.health <= 30 ? 'bg-[#d94a38]' : 'bg-[#7d9c54]'}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#b8b39e] gap-2.5 mb-2">
            <span>STM {hud.stamina}%</span>
            <span aria-hidden="true">·</span>
            <span>{hud.isCrouching ? 'CROUCH' : hud.isSprinting ? 'SPRINT' : 'STAND'}</span>
            {hud.bleeding && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#e86958] font-semibold">BLEEDING</span>
              </>
            )}
          </div>

          {/* Rank, Class & Career XP Bar */}
          <div className="pt-1.5 border-t border-[#293124]">
            <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[#c89b3c] tabular-nums gap-2">
              <span className="truncate">LV {prog.level} · {prog.rankTitle} · {activeClassSpec.name}</span>
              <span className="text-[#9ea38f] shrink-0">
                {prog.xpIntoLevel}/{prog.xpForNextLevel} XP
              </span>
            </div>
            <div className="w-full h-1 bg-[#23291f] rounded overflow-hidden mt-1">
              <div className="h-full bg-[#c89b3c]" style={{ width: `${xpPct}%` }} />
            </div>
          </div>

          {/* Terrain Zone & Uniform Camo Bonus Status */}
          <div className="pt-1.5 mt-1.5 border-t border-[#293124] flex items-center justify-between gap-2 text-[10px] font-mono-tabular">
            <span className="text-[#a9ad99] truncate">{terrainLabel}</span>
            <span
              className={`shrink-0 ${
                hud.terrainCamoActive ? 'text-[#9cc47d] font-semibold' : 'text-[#8e9381]'
              }`}
            >
              {uniformDisplayName} · {hud.terrainCamoActive ? 'CAMO ACTIVE' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Bottom-Right: Weapon Loadout, Attachments & Ammo */}
        <div className="bg-[#121610]/88 border border-[#3a4433] rounded px-3.5 py-2.5 text-right pointer-events-auto">
          <div className="flex items-baseline justify-end gap-2">
            <span className="text-2xl font-display font-bold text-[#ece9df] tabular-nums">
              {weaponState.mag}
            </span>
            <span className="text-sm font-mono-tabular text-[#8e9381] tabular-nums">
              / {weaponState.reserve}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 text-[11px] font-mono-tabular text-[#c89b3c] mt-0.5">
            <span>{spec.name}</span>
            <span aria-hidden="true">·</span>
            <span>{weaponState.fireMode}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#b8b39e]">FRAG {hud.grenades}</span>
          </div>
          {attTags.length > 0 && (
            <div className="text-[10px] font-mono-tabular text-[#9cc47d] mt-0.5">
              {attTags.join(' · ')}
            </div>
          )}
          {!showTouchControls && (
            <div className="flex items-center justify-end gap-1.5 mt-2">
              {(['m16a1', 'm60', 'm1911'] as WeaponId[]).map((id, idx) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectWeapon(id)}
                  className={`px-2 py-0.5 text-[10px] font-mono-tabular rounded border cursor-pointer ${
                    hud.activeWeapon === id
                      ? 'bg-[#c89b3c] border-[#c89b3c] text-[#11150f] font-bold'
                      : 'bg-[#1a2017] border-[#394232] text-[#a9ad99] hover:text-white'
                  }`}
                >
                  {idx + 1} {WEAPON_SPECS[id].name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
