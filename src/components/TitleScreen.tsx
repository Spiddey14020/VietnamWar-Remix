import {
  CAMPAIGN_FACTIONS,
  HEADGEAR_OPTIONS,
  MILITARY_UNIFORMS,
  SOLDIER_CLASSES,
  TACTICAL_RIGS,
  TERRAIN_ZONE_LABELS,
  WEAPON_SPECS,
  type ControlMode,
  type HudSnapshot,
  type SoldierClassId,
} from '../game/types';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleScreenProps {
  hud: HudSnapshot | null;
  controlMode: ControlMode;
  onChangeControlMode: (mode: ControlMode) => void;
  onSelectClass: (cls: SoldierClassId) => void;
  onOpenRpg: () => void;
  onOpenLoadout: () => void;
  onOpenCampaign: () => void;
  onStart: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function TitleScreen({
  hud,
  controlMode,
  onChangeControlMode,
  onSelectClass,
  onOpenRpg,
  onOpenLoadout,
  onOpenCampaign,
  onStart,
  muted,
  onToggleMute,
}: TitleScreenProps) {
  const prog = hud?.progression;
  const activeClassId: SoldierClassId = prog?.soldierClass ?? 'rifleman';
  const unspentTotal = (prog?.attributePoints ?? 0) + (prog?.skillPoints ?? 0);
  const loadout = hud?.characterLoadout;
  const activeUniform = loadout ? MILITARY_UNIFORMS[loadout.uniform] : null;
  const activeRig = loadout ? TACTICAL_RIGS[loadout.rig] : null;
  const activeHeadgear = loadout ? HEADGEAR_OPTIONS[loadout.headgear] : null;
  const activePrimary = loadout ? WEAPON_SPECS[loadout.primaryWeapon] : null;
  const campaign = hud?.campaign;
  const activeFaction = campaign ? CAMPAIGN_FACTIONS[campaign.factionId] : null;
  const activeStage = campaign?.active
    ? campaign.stages[campaign.currentStageIndex] ?? null
    : null;
  const customCamo = loadout?.customUniformCamo ?? hud?.customUniformCamo;
  const uniformTitle =
    loadout?.uniform === 'custom_camo'
      ? customCamo?.name || activeUniform?.name
      : activeUniform?.name;
  const uniformTerrain =
    loadout?.uniform === 'custom_camo' && customCamo
      ? TERRAIN_ZONE_LABELS[customCamo.favoredTerrain]
      : activeUniform?.terrainLabel;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-auto bg-gradient-to-r from-[#0e120d]/92 via-[#0e120d]/65 to-[#0e120d]/25 p-5 sm:p-8 md:p-12 overflow-y-auto">
      {/* Top minimal utility row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs tracking-widest text-[#b8b39e] uppercase font-mono-tabular">
          <span>Mekong Valley Sector</span>
          <span aria-hidden="true">·</span>
          <span>1968 Single-Player RPG Simulation</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {prog && (
            <button
              type="button"
              onClick={onOpenRpg}
              className={`min-h-[44px] px-4 py-2 text-xs font-mono-tabular uppercase rounded border transition-colors cursor-pointer whitespace-nowrap ${
                unspentTotal > 0
                  ? 'bg-[#c89b3c] hover:bg-[#d8ab4c] border-[#f4d78b] text-[#11150f] font-bold'
                  : 'bg-[#1a2017]/90 hover:bg-[#252d21] border-[#3d4736] text-[#ece9df]'
              }`}
            >
              {unspentTotal > 0 ? `RPG Dossier (${unspentTotal} Pts)` : `LV ${prog.level} ${prog.rankTitle}`}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            className="min-h-[44px] px-4 py-2 text-xs font-medium tracking-wider uppercase bg-[#1a2017]/90 hover:bg-[#252d21] text-[#ece9df] border border-[#3d4736] rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {muted ? 'Audio Off' : 'Audio On'}
          </button>
        </div>
      </div>

      {/* Main Title Lockup + Soldier Class Selection */}
      <div className="max-w-3xl my-auto py-4">
        <svg
          viewBox="0 0 540 132"
          className="w-full max-w-[420px] h-auto mb-4"
          role="img"
          aria-label="Vietnam War"
        >
          <g fill="none" stroke="#c89b3c" strokeWidth="2">
            <circle cx="34" cy="64" r="24" strokeOpacity="0.8" />
            <polygon
              points="34,43 39,58 55,58 42,67 47,82 34,73 21,82 26,67 13,58 29,58"
              fill="#c89b3c"
              stroke="none"
            />
          </g>
          <text
            x="76"
            y="64"
            fill="#ece9df"
            fontFamily="Oswald, sans-serif"
            fontWeight="700"
            fontSize="58"
            letterSpacing="3"
          >
            VIETNAM WAR
          </text>
          <line x1="78" y1="80" x2="510" y2="80" stroke="#536048" strokeWidth="1.5" />
          <text
            x="78"
            y="106"
            fill="#b8b39e"
            fontFamily="IBM Plex Mono, monospace"
            fontWeight="500"
            fontSize="15"
            letterSpacing="2.4"
          >
            OPEN-WORLD TACTICAL RPG · ANDROID &amp; PC
          </text>
        </svg>

        <p className="text-sm text-[#d2cebf] leading-relaxed max-w-xl mb-5">
          Select your military specialty, allocate combat attributes and perks, complete field
          contracts across the Mekong valley, and lead extraction from LZ Bravo.
        </p>

        {/* Soldier Class Selection */}
        <div className="mb-5">
          <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-2">
            Select Soldier Class
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(Object.keys(SOLDIER_CLASSES) as SoldierClassId[]).map((id) => {
              const cls = SOLDIER_CLASSES[id];
              const selected = activeClassId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectClass(id)}
                  className={`p-3 rounded border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                    selected
                      ? 'bg-[#283321]/95 border-[#c89b3c] text-[#ece9df]'
                      : 'bg-[#141912]/88 border-[#323a2c] text-[#c4c0b0] hover:border-[#4e5b46]'
                  }`}
                >
                  <div>
                    <div className="text-sm font-display font-bold uppercase text-[#ece9df]">
                      {cls.name}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[#c89b3c]">
                      {cls.roleTitle}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#9cc47d] leading-snug">
                    {cls.primaryBonus}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Campaign Faction & Procedural Operations Strip */}
        {campaign && activeFaction && (
          <div className="mb-4 p-3 bg-[#141912]/90 border border-[#323a2c] rounded flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-mono-tabular text-[#c89b3c] uppercase truncate">
                Faction: {activeFaction.name} ·{' '}
                {activeStage ? `${activeStage.opCode}: ${activeStage.title}` : 'Free Valley Skirmish'}
              </div>
              <div className="text-[11px] font-mono-tabular text-[#b8b39e] truncate">
                {activeStage
                  ? `Seed ${campaign.seed} · ${activeStage.regionName} · ${activeStage.weather}`
                  : activeFaction.bonusSummary}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenCampaign}
              className="min-h-[44px] px-4 py-2 bg-[#232b20] hover:bg-[#2f392b] border border-[#c89b3c]/70 rounded text-xs font-mono-tabular uppercase tracking-wide text-[#ece9df] cursor-pointer whitespace-nowrap shrink-0"
            >
              Campaign &amp; Factions
            </button>
          </div>
        )}

        {/* Active Character Loadout & Uniform Camo Strip */}
        {loadout && activeUniform && activeRig && activeHeadgear && activePrimary && (
          <div className="mb-5 p-3 bg-[#141912]/90 border border-[#323a2c] rounded flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="w-9 h-9 rounded border border-[#5a664b] shrink-0"
                style={{
                  background:
                    loadout.uniform === 'custom_camo' && customCamo
                      ? customCamo.primaryHex
                      : activeUniform.swatch,
                }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-xs font-mono-tabular text-[#c89b3c] uppercase truncate">
                  Slot {(hud?.activeLoadoutSlot ?? 0) + 1}: {loadout.name} · {uniformTitle}
                </div>
                <div className="text-[11px] font-mono-tabular text-[#b8b39e] truncate">
                  {activePrimary.name} · {activeRig.name} · {activeHeadgear.name}
                </div>
                <div className="text-[11px] font-mono-tabular text-[#9cc47d] truncate">
                  Terrain ({uniformTerrain}): {activeUniform.terrainBonusText}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenLoadout}
              className="min-h-[44px] px-4 py-2 bg-[#232b20] hover:bg-[#2f392b] border border-[#c89b3c]/70 rounded text-xs font-mono-tabular uppercase tracking-wide text-[#ece9df] cursor-pointer whitespace-nowrap shrink-0"
            >
              Customize Loadout &amp; Camo
            </button>
          </div>
        )}

        {/* Control layout selector + Deploy CTA */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs text-[#9ea38f] mb-1.5">Input Profile</div>
            <div className="inline-flex items-center p-1 bg-[#161b14]/95 border border-[#323a2c] rounded">
              {(
                [
                  { id: 'auto', label: 'Auto Detect' },
                  { id: 'touch', label: 'Android Touch' },
                  { id: 'desktop', label: 'PC Mouse & Keys' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeControlMode(opt.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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

          <button
            type="button"
            onClick={onStart}
            className="min-h-[50px] px-8 py-3 text-base font-display font-semibold tracking-wider uppercase bg-[#c89b3c] hover:bg-[#d8ab4c] active:scale-[0.99] text-[#11150f] rounded transition-transform cursor-pointer whitespace-nowrap shrink-0"
          >
            Deploy {activeFaction ? activeFaction.shortName : SOLDIER_CLASSES[activeClassId].name}
          </button>
        </div>

        {/* Desktop PC App Install & Downloadable Windows Installer */}
        <div className="mt-5 pt-4 border-t border-[#262f21]">
          <PWAInstallButton />
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="text-xs text-[#a5a897] font-mono-tabular">
        {controlMode === 'touch'
          ? 'Left Thumb Move · Right Drag Aim · Fire / ADS / Crouch / Frag Touch Buttons'
          : 'WASD Move · Mouse Aim & Fire · R Reload · C Crouch · G Frag · H Bandage · K RPG & Quests · M Map'}
      </div>
    </div>
  );
}

