import { useEffect, useState } from 'react';
import {
  HEADGEAR_OPTIONS,
  MILITARY_UNIFORMS,
  TACTICAL_RIGS,
  TERRAIN_ZONE_LABELS,
  WEAPON_SPECS,
  type CustomCamoConfig,
  type HeadgearId,
  type HudSnapshot,
  type TacticalRigId,
  type UniformCamoId,
  type WeaponId,
} from '../game/types';
import { CustomCamoStudio, buildCamoPreviewStyle } from './CustomCamoStudio';

export type LoadoutPresetId =
  | 'jungle_stalker'
  | 'river_raider'
  | 'ridge_assault'
  | 'night_raider';

interface CharacterLoadoutPanelProps {
  hud: HudSnapshot;
  onSelectLoadoutSlot: (slotIdx: number) => void;
  onRenameLoadoutSlot: (name: string) => void;
  onSetUniform: (uniform: UniformCamoId) => void;
  onSetCustomUniformCamo: (cfg: CustomCamoConfig) => void;
  onSetRig: (rig: TacticalRigId) => void;
  onSetHeadgear: (headgear: HeadgearId) => void;
  onSetPrimaryWeapon: (weaponId: WeaponId) => void;
  onApplyPreset: (presetId: LoadoutPresetId) => void;
  onOpenArmory?: () => void;
}

const PRESETS: { id: LoadoutPresetId; label: string; subtitle: string }[] = [
  { id: 'jungle_stalker', label: 'Jungle Stalker', subtitle: 'Tiger Stripe · Suppressed M16' },
  { id: 'river_raider', label: 'River Raider', subtitle: 'Mekong Mud · Zero Water Drag' },
  { id: 'ridge_assault', label: 'Ridge Breacher', subtitle: 'ERDL Leaf · M60 + Flak' },
  { id: 'night_raider', label: 'Night Raider', subtitle: 'Night Slate · 3x20 + Frags' },
];

export function CharacterLoadoutPanel({
  hud,
  onSelectLoadoutSlot,
  onRenameLoadoutSlot,
  onSetUniform,
  onSetCustomUniformCamo,
  onSetRig,
  onSetHeadgear,
  onSetPrimaryWeapon,
  onApplyPreset,
  onOpenArmory,
}: CharacterLoadoutPanelProps) {
  const loadout = hud.characterLoadout;
  const uniform = MILITARY_UNIFORMS[loadout.uniform];
  const customCamoCfg = loadout.customUniformCamo ?? hud.customUniformCamo;
  const isCustomUniform = loadout.uniform === 'custom_camo';
  const activePrimaryHex = isCustomUniform ? customCamoCfg.primaryHex : uniform.primaryHex;
  const activeSecondaryHex = isCustomUniform ? customCamoCfg.secondaryHex : uniform.secondaryHex;
  const activeAccentHex = isCustomUniform ? customCamoCfg.accentHex : uniform.accentHex;
  const activeUniformColorName = isCustomUniform
    ? customCamoCfg.name || uniform.colorName
    : uniform.colorName;
  const activeUniformTerrainLabel = isCustomUniform
    ? TERRAIN_ZONE_LABELS[customCamoCfg.favoredTerrain]
    : uniform.terrainLabel;
  const rig = TACTICAL_RIGS[loadout.rig];
  const headgear = HEADGEAR_OPTIONS[loadout.headgear];
  const primarySpec = WEAPON_SPECS[loadout.primaryWeapon];
  const [nameDraft, setNameDraft] = useState(loadout.name);

  useEffect(() => {
    setNameDraft(loadout.name);
  }, [loadout.name, hud.activeLoadoutSlot]);

  const inBattle = hud.phase === 'playing' || hud.phase === 'paused';
  const terrainLabel = TERRAIN_ZONE_LABELS[hud.terrainZone];
  const camoMatched = hud.terrainCamoActive;

  return (
    <div className="space-y-4">
      {/* Loadout Slots & Quick Presets */}
      <div className="p-3 bg-[#11150f] border border-[#2f382a] rounded space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {hud.loadoutSlots.map((slot, idx) => {
              const active = idx === hud.activeLoadoutSlot;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectLoadoutSlot(idx)}
                  className={`min-h-[44px] px-3 py-1.5 rounded border text-xs font-mono-tabular uppercase tracking-wide cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df] font-semibold'
                      : 'bg-[#171d14] border-[#323c2c] text-[#9ea38f] hover:text-[#ece9df]'
                  }`}
                >
                  Slot {idx + 1}: {slot.name}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={nameDraft}
              maxLength={28}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                if (nameDraft.trim() && nameDraft.trim() !== loadout.name) {
                  onRenameLoadoutSlot(nameDraft);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nameDraft.trim()) {
                  onRenameLoadoutSlot(nameDraft);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label="Loadout Slot Name"
              className="min-h-[44px] w-40 sm:w-44 px-2.5 bg-[#161c14] border border-[#3a4433] rounded text-xs font-mono-tabular text-[#ece9df] focus:outline-none focus:border-[#c89b3c]"
            />
            {onOpenArmory && (
              <button
                type="button"
                onClick={onOpenArmory}
                className="min-h-[44px] px-3 py-1.5 bg-[#232b20] hover:bg-[#2f392b] border border-[#4a5640] rounded text-xs font-mono-tabular uppercase text-[#c89b3c] cursor-pointer whitespace-nowrap shrink-0"
              >
                Tune Gun [T]
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#242c20]">
          <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#8e9381] mr-1">
            Quick Kits:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p.id)}
              className="min-h-[44px] px-2.5 py-1 bg-[#161c14] hover:bg-[#212a1d] border border-[#323b2c] hover:border-[#c89b3c]/70 rounded text-left cursor-pointer whitespace-nowrap shrink-0"
            >
              <div className="text-[11px] font-mono-tabular font-semibold text-[#ece9df]">
                {p.label}
              </div>
              <div className="text-[10px] font-mono-tabular text-[#9cc47d]">{p.subtitle}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Soldier Preview & Active Terrain Synergy */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 p-3 bg-[#11150f] border border-[#2f382a] rounded flex flex-col items-center justify-between gap-2">
          <div className="w-full flex items-center justify-between text-[11px] font-mono-tabular uppercase">
            <span className="text-[#c89b3c]">Field Kit Preview</span>
            <span className="text-[#9ea38f] truncate">{activeUniformColorName}</span>
          </div>

          <svg
            viewBox="0 0 180 210"
            className="w-40 h-44"
            role="img"
            aria-label={`${activeUniformColorName} soldier loadout preview`}
          >
            <defs>
              <pattern
                id="soldierCamoPattern"
                width="18"
                height="18"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(22)"
              >
                <rect width="18" height="18" fill={activePrimaryHex} />
                <rect x="0" y="0" width="9" height="6" fill={activeSecondaryHex} opacity="0.82" />
                <rect x="9" y="9" width="9" height="5" fill={activeAccentHex} opacity="0.6" />
              </pattern>
            </defs>

            {/* Ground shadow */}
            <ellipse cx="90" cy="196" rx="44" ry="8" fill="#090c08" opacity="0.7" />

            {/* Boots & Trousers */}
            <rect x="64" y="136" width="22" height="46" rx="4" fill="url(#soldierCamoPattern)" />
            <rect x="94" y="136" width="22" height="46" rx="4" fill="url(#soldierCamoPattern)" />
            <rect x="62" y="178" width="25" height="14" rx="3" fill="#1b1c18" />
            <rect x="93" y="178" width="25" height="14" rx="3" fill="#1b1c18" />

            {/* Torso Fatigues */}
            <rect
              x="54"
              y="68"
              width="72"
              height="72"
              rx="10"
              fill="url(#soldierCamoPattern)"
              stroke={activeSecondaryHex}
              strokeWidth="1.5"
            />
            {/* Sleeves & Gloves */}
            <rect x="34" y="72" width="20" height="54" rx="7" fill="url(#soldierCamoPattern)" />
            <rect x="126" y="72" width="20" height="54" rx="7" fill="url(#soldierCamoPattern)" />
            <rect x="35" y="122" width="18" height="13" rx="4" fill="#32352b" />
            <rect x="127" y="122" width="18" height="13" rx="4" fill="#32352b" />

            {/* Tactical Rig / Vest */}
            <rect
              x="57"
              y="73"
              width="66"
              height="58"
              rx="6"
              fill={rig.colorHex}
              opacity="0.9"
              stroke="#242a1f"
              strokeWidth="1.5"
            />
            {/* Webbing Straps & Pouches */}
            <rect x="64" y="72" width="11" height="58" fill="#2c3324" opacity="0.85" />
            <rect x="105" y="72" width="11" height="58" fill="#2c3324" opacity="0.85" />
            <rect x="61" y="108" width="24" height="17" rx="2" fill="#3a422f" stroke="#22271d" />
            <rect x="95" y="108" width="24" height="17" rx="2" fill="#3a422f" stroke="#22271d" />
            {loadout.rig === 'medic_pack' && (
              <g>
                <rect x="83" y="84" width="14" height="14" rx="2" fill="#d8d5c7" />
                <rect x="88" y="86" width="4" height="10" fill="#9c2f24" />
                <rect x="85" y="89" width="10" height="4" fill="#9c2f24" />
              </g>
            )}
            {loadout.rig === 'grenadier_vest' && (
              <g fill="#4c5c38" stroke="#23291d" strokeWidth="1">
                <circle cx="71" cy="92" r="5" />
                <circle cx="84" cy="92" r="5" />
                <circle cx="97" cy="92" r="5" />
                <circle cx="110" cy="92" r="5" />
              </g>
            )}

            {/* Neck & Head */}
            <rect x="82" y="56" width="16" height="14" rx="4" fill="#a88062" />
            <circle cx="90" cy="44" r="16" fill="#b4896a" />

            {/* Headgear Variants */}
            {loadout.headgear === 'm1_helmet' && (
              <g>
                <path
                  d="M70 43 C70 24, 110 24, 110 43 Z"
                  fill={headgear.colorHex}
                  stroke="#262d1e"
                  strokeWidth="1.5"
                />
                <rect x="69" y="40" width="42" height="5" rx="2" fill="#333c26" />
              </g>
            )}
            {loadout.headgear === 'boonie_hat' && (
              <g>
                <ellipse cx="90" cy="39" rx="28" ry="5" fill={headgear.colorHex} stroke="#28301e" />
                <path d="M74 39 L78 24 L102 24 L106 39 Z" fill={headgear.colorHex} />
                <rect x="75" y="34" width="30" height="3" fill="#2c3322" />
              </g>
            )}
            {loadout.headgear === 'comms_beret' && (
              <g>
                <path d="M72 37 C72 24, 108 23, 111 35 L72 37 Z" fill={headgear.colorHex} />
                <rect x="68" y="38" width="7" height="13" rx="2" fill="#1d201c" />
                <rect x="105" y="38" width="7" height="13" rx="2" fill="#1d201c" />
                <path d="M72 48 Q80 54 88 51" fill="none" stroke="#1d201c" strokeWidth="2" />
              </g>
            )}

            {/* Held Primary Weapon Silhouette */}
            {loadout.primaryWeapon === 'm60' ? (
              <g transform="translate(56, 116)">
                <rect x="0" y="6" width="74" height="10" rx="2" fill="#282c27" />
                <rect x="52" y="16" width="14" height="14" rx="2" fill="#3b482e" />
                <rect x="74" y="8" width="22" height="5" fill="#1f231f" />
              </g>
            ) : loadout.primaryWeapon === 'm1911' ? (
              <g transform="translate(76, 116)">
                <rect x="0" y="4" width="28" height="7" rx="1.5" fill="#262926" />
                <rect x="3" y="10" width="8" height="13" rx="1" fill="#4f3926" />
              </g>
            ) : (
              <g transform="translate(58, 116)">
                <rect x="0" y="7" width="66" height="7" rx="1.5" fill="#242824" />
                <rect x="26" y="14" width="8" height="14" rx="1" fill="#333733" />
                <rect x="66" y="8" width="20" height="4" fill="#1b1e1b" />
              </g>
            )}
          </svg>

          <div className="w-full pt-2 border-t border-[#242c20] text-[11px] font-mono-tabular space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#9ea38f]">{inBattle ? `Zone: ${terrainLabel}` : 'Favored Terrain'}</span>
              <span
                className={
                  !inBattle
                    ? 'text-[#c89b3c] font-semibold'
                    : camoMatched
                      ? 'text-[#9cc47d] font-semibold'
                      : 'text-[#8e9381]'
                }
              >
                {!inBattle ? activeUniformTerrainLabel : camoMatched ? 'CAMO MATCHED' : 'STANDBY'}
              </span>
            </div>
            <div className="text-[#c9c5b4] leading-snug">{uniform.terrainBonusText}</div>
          </div>
        </div>

        {/* Military Colors & Terrain Camo Grid */}
        <div className="md:col-span-8 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f]">
              Military Fatigues &amp; Terrain Camo Bonuses
            </div>
            <span className="text-[11px] font-mono-tabular text-[#c89b3c]">
              Updates 3D Soldier Sleeves &amp; Gloves
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(MILITARY_UNIFORMS) as UniformCamoId[]).map((id) => {
              const spec = MILITARY_UNIFORMS[id];
              const isCustomTile = id === 'custom_camo';
              const selected = loadout.uniform === id;
              const tileFavored = isCustomTile
                ? [customCamoCfg.favoredTerrain]
                : spec.favoredTerrains;
              const activeHere =
                inBattle &&
                (tileFavored.includes(hud.terrainZone) ||
                  (!isCustomTile &&
                    Boolean(spec.nightFavored) &&
                    (hud.environment.hour24 < 6.5 || hud.environment.hour24 >= 18.2)));
              const swatchStyle = isCustomTile
                ? buildCamoPreviewStyle(customCamoCfg)
                : { background: spec.swatch };
              const tileLabel = isCustomTile
                ? TERRAIN_ZONE_LABELS[customCamoCfg.favoredTerrain]
                : spec.terrainLabel;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSetUniform(id)}
                  className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                    selected
                      ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                      : 'bg-[#11150f] border-[#2f382a] text-[#c4c0b0] hover:border-[#4e5b46]'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded border border-[#4a5640] shrink-0 mt-0.5"
                    style={swatchStyle}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-display font-bold uppercase text-[#ece9df] truncate">
                        {isCustomTile ? customCamoCfg.name || spec.name : spec.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono-tabular shrink-0 ${
                          selected
                            ? 'text-[#c89b3c] font-semibold'
                            : activeHere
                              ? 'text-[#9cc47d]'
                              : 'text-[#8e9381]'
                        }`}
                      >
                        {selected ? 'EQUIPPED' : activeHere ? 'MATCHES ZONE' : tileLabel}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[#9cc47d] mt-1 leading-snug">
                      {spec.terrainBonusText}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom Camouflage Studio for Uniforms */}
      <CustomCamoStudio
        mode="uniform"
        value={customCamoCfg}
        isActive={loadout.uniform === 'custom_camo'}
        onChange={onSetCustomUniformCamo}
      />

      {/* Tactical Rig, Headgear & Primary Weapon */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Tactical Rig */}
        <div className="p-3 bg-[#11150f] border border-[#2f382a] rounded space-y-2">
          <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f]">
            Tactical Rig / Vest
          </div>
          <div className="space-y-1.5">
            {(Object.keys(TACTICAL_RIGS) as TacticalRigId[]).map((id) => {
              const r = TACTICAL_RIGS[id];
              const selected = loadout.rig === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSetRig(id)}
                  className={`w-full min-h-[44px] px-2.5 py-2 rounded border text-left cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                      : 'bg-[#161c14] border-[#2d3628] text-[#c4c0b0] hover:border-[#4c5944]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span>{r.name}</span>
                    {selected && (
                      <span className="text-[10px] font-mono-tabular text-[#c89b3c]">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#9cc47d] mt-0.5">
                    {r.bonusText}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Headgear */}
        <div className="p-3 bg-[#11150f] border border-[#2f382a] rounded space-y-2">
          <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f]">
            Headgear
          </div>
          <div className="space-y-1.5">
            {(Object.keys(HEADGEAR_OPTIONS) as HeadgearId[]).map((id) => {
              const h = HEADGEAR_OPTIONS[id];
              const selected = loadout.headgear === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSetHeadgear(id)}
                  className={`w-full min-h-[44px] px-2.5 py-2 rounded border text-left cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                      : 'bg-[#161c14] border-[#2d3628] text-[#c4c0b0] hover:border-[#4c5944]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span>{h.name}</span>
                    {selected && (
                      <span className="text-[10px] font-mono-tabular text-[#c89b3c]">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#9cc47d] mt-0.5">
                    {h.bonusText}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Deployment Firearm */}
        <div className="p-3 bg-[#11150f] border border-[#2f382a] rounded space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f]">
              Primary Weapon
            </span>
            <span className="text-[11px] font-mono-tabular text-[#c89b3c]">
              {primarySpec.caliber}
            </span>
          </div>
          <div className="space-y-1.5">
            {(['m16a1', 'm60', 'm1911'] as WeaponId[]).map((id) => {
              const w = WEAPON_SPECS[id];
              const kit = loadout.weapons[id];
              const selected = loadout.primaryWeapon === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSetPrimaryWeapon(id)}
                  className={`w-full min-h-[44px] px-2.5 py-2 rounded border text-left cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                      : 'bg-[#161c14] border-[#2d3628] text-[#c4c0b0] hover:border-[#4c5944]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span>{w.name}</span>
                    <span className="text-[10px] font-mono-tabular text-[#c89b3c]">
                      {selected ? 'PRIMARY' : w.caliber}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#9ea38f] mt-0.5 truncate">
                    Optic: {kit.attachments.optic} · Muzzle: {kit.attachments.muzzle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
