import { useState } from 'react';
import {
  WEAPON_SPECS,
  type BoltPartId,
  type CustomCamoConfig,
  type HudSnapshot,
  type MuzzleAttachment,
  type OpticAttachment,
  type SpringPartId,
  type TriggerPartId,
  type UnderbarrelAttachment,
  type WeaponId,
  type WeaponPaintId,
} from '../game/types';
import { CustomCamoStudio } from './CustomCamoStudio';

interface ArmoryModalProps {
  hud: HudSnapshot;
  onSetAttachment: (
    weaponId: WeaponId,
    slot: 'optic' | 'muzzle' | 'underbarrel',
    value: OpticAttachment | MuzzleAttachment | UnderbarrelAttachment,
  ) => void;
  onSetPaint: (weaponId: WeaponId, paint: WeaponPaintId) => void;
  onSetCustomPaint: (weaponId: WeaponId, cfg: CustomCamoConfig) => void;
  onSetInternalPart: (
    weaponId: WeaponId,
    slot: 'trigger' | 'bolt' | 'spring',
    value: TriggerPartId | BoltPartId | SpringPartId,
  ) => void;
  onSelectWeapon: (weaponId: WeaponId) => void;
  onClose: () => void;
}

type ArmoryTab = 'attachments' | 'paint' | 'internals';

const OPTICS: { id: OpticAttachment; name: string; effect: string }[] = [
  { id: 'iron', name: 'Iron Sights', effect: 'Historically accurate 1968 open sight · Fast acquisition' },
  { id: 'colt_scope', name: 'Colt 3x20 Scope', effect: '25° true 3x optical zoom · -35% ADS spread' },
  { id: 'oeg_dot', name: 'Armson OEG Dot', effect: '46° amber occluded dot · -18% ADS spread' },
];

const MUZZLES: { id: MuzzleAttachment; name: string; effect: string }[] = [
  { id: 'standard', name: 'Standard Muzzle', effect: 'Full muzzle velocity · Standard report' },
  { id: 'suppressor', name: 'HEL E4A Suppressor', effect: 'Zero flash · Quiet shot · 24m alert radius' },
  { id: 'compensator', name: 'Cutts Compensator', effect: 'Gas-ported brake · -30% climb & yaw recoil' },
];

const UNDERBARRELS: { id: UnderbarrelAttachment; name: string; effect: string }[] = [
  { id: 'standard', name: 'Standard Issue', effect: 'Base magazine & weight balance' },
  { id: 'extended_mag', name: 'Extended Mag / Box', effect: '+50% magazine capacity' },
  { id: 'bipod_grip', name: 'Foregrip / Bipod', effect: '-28% hipfire spread · -22% recoil' },
];

const PAINTS: {
  id: WeaponPaintId;
  name: string;
  desc: string;
  minLevel: number;
  swatch: string;
}[] = [
  {
    id: 'parkerized',
    name: 'Factory Parkerized',
    desc: 'Standard issue dark manganese phosphate',
    minLevel: 1,
    swatch: 'linear-gradient(135deg, #2d322c 0%, #1d201c 100%)',
  },
  {
    id: 'od_green',
    name: 'Olive Drab Field Coat',
    desc: 'Matte jungle enamel over receiver & furniture',
    minLevel: 1,
    swatch: 'linear-gradient(135deg, #4b5a34 0%, #313b21 100%)',
  },
  {
    id: 'tiger_stripe',
    name: 'MACV Tiger Stripe',
    desc: 'High-contrast SOG reconnaissance camouflage',
    minLevel: 1,
    swatch: 'repeating-linear-gradient(125deg, #465331 0 10px, #1e2217 10px 16px, #687347 16px 22px)',
  },
  {
    id: 'mud_camo',
    name: 'Mekong Mud Wash',
    desc: 'River delta earth & foliage break-up finish',
    minLevel: 2,
    swatch: 'repeating-linear-gradient(110deg, #5d4f38 0 12px, #3b3223 12px 19px, #7b6a4d 19px 25px)',
  },
  {
    id: 'chrome_nickel',
    name: 'Nickel-Chrome Plating',
    desc: 'Corrosion-proof humid-climate satin steel',
    minLevel: 3,
    swatch: 'linear-gradient(135deg, #d7dce0 0%, #869099 100%)',
  },
  {
    id: 'brass_tribute',
    name: 'Command Brass',
    desc: 'Officer anodized bronze receiver & walnut grip',
    minLevel: 4,
    swatch: 'linear-gradient(135deg, #d4a84e 0%, #7f5d20 100%)',
  },
];

const TRIGGERS: { id: TriggerPartId; name: string; effect: string; minLevel: number }[] = [
  { id: 'standard_trigger', name: 'Mil-Spec Trigger', effect: 'Standard sear release & cycle', minLevel: 1 },
  { id: 'hair_trigger', name: 'Match Hair Trigger', effect: '+16% Fire Rate (RPM) · Crisp reset', minLevel: 1 },
  { id: 'lightweight_sear', name: 'Polished Match Sear', effect: '+28% Fire Rate · +8% Shot Damage', minLevel: 3 },
];

const BOLTS: { id: BoltPartId; name: string; effect: string; minLevel: number }[] = [
  { id: 'standard_bolt', name: 'Forged Steel Bolt', effect: 'Standard cyclic action', minLevel: 1 },
  { id: 'chrome_bolt', name: 'Chrome-Lined BCG', effect: '+19% Fire Rate · +18% Faster Reload', minLevel: 1 },
  { id: 'titanium_bcg', name: 'Hyper-Cyclic Titanium BCG', effect: '+39% Fire Rate · +25% Faster Reload', minLevel: 2 },
];

const SPRINGS: { id: SpringPartId; name: string; effect: string; minLevel: number }[] = [
  { id: 'standard_spring', name: 'Standard Buffer Spring', effect: 'Factory return tension', minLevel: 1 },
  { id: 'heavy_buffer', name: 'Hydraulic Buffer', effect: '+9% Fire Rate · -20% Recoil Kick', minLevel: 1 },
  { id: 'overclock_spring', name: 'High-Tension Overclock Spring', effect: '+22% Fire Rate · -15% Shot Spread', minLevel: 2 },
];

export function ArmoryModal({
  hud,
  onSetAttachment,
  onSetPaint,
  onSetCustomPaint,
  onSetInternalPart,
  onSelectWeapon,
  onClose,
}: ArmoryModalProps) {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>(hud.activeWeapon);
  const [tab, setTab] = useState<ArmoryTab>('attachments');

  const spec = WEAPON_SPECS[selectedWeapon];
  const state = hud.weapons[selectedWeapon];
  const att = state.attachments;
  const intl = state.internals;
  const level = hud.progression.level;

  const effectiveMag =
    att.underbarrel === 'extended_mag' ? Math.round(spec.magSize * 1.5) : spec.magSize;

  let intervalMult = 1.0;
  if (intl.trigger === 'hair_trigger') intervalMult *= 0.86;
  else if (intl.trigger === 'lightweight_sear') intervalMult *= 0.78;
  if (intl.bolt === 'chrome_bolt') intervalMult *= 0.84;
  else if (intl.bolt === 'titanium_bcg') intervalMult *= 0.72;
  if (intl.spring === 'heavy_buffer') intervalMult *= 0.92;
  else if (intl.spring === 'overclock_spring') intervalMult *= 0.82;
  const effectiveInterval = Math.max(0.038, spec.fireInterval * intervalMult);
  const effectiveRpm = Math.round(60 / effectiveInterval);

  let reloadMult = 1.0;
  if (intl.bolt === 'chrome_bolt') reloadMult *= 0.82;
  else if (intl.bolt === 'titanium_bcg') reloadMult *= 0.75;
  const levelPerk = Math.max(0.75, 1 - (level - 1) * 0.03);
  const effectiveReload = Math.max(0.65, spec.reloadDuration * reloadMult * levelPerk);

  const effectiveDmg = Math.round(
    spec.damage * (intl.trigger === 'lightweight_sear' ? 1.08 : 1.0),
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0e0a]/88 p-3 sm:p-4 pointer-events-auto overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#161c14] border border-[#4a5640] rounded-lg p-4 sm:p-5 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#c89b3c]">
              Firebase Armory Bench · LV {level} {hud.progression.rankTitle}
            </div>
            <h2 className="text-xl font-display font-bold tracking-wide text-[#ece9df] uppercase">
              Weapon Customization
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 bg-[#232b20] hover:bg-[#2f392b] border border-[#4a5640] rounded text-xs font-medium text-[#ece9df] cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Weapon Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['m16a1', 'm60', 'm1911'] as WeaponId[]).map((id) => {
            const wSpec = WEAPON_SPECS[id];
            const active = selectedWeapon === id;
            const equipped = hud.activeWeapon === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedWeapon(id);
                  onSelectWeapon(id);
                }}
                className={`min-h-[46px] px-3 py-2 rounded border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#c89b3c] border-[#f0cf81] text-[#11150f]'
                    : 'bg-[#11150f] border-[#333d2d] text-[#d9d5c5] hover:border-[#55634b]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-sm uppercase">{wSpec.name}</span>
                  {equipped && (
                    <span
                      className={`text-[10px] font-mono-tabular uppercase ${
                        active ? 'text-[#11150f]' : 'text-[#c89b3c]'
                      }`}
                    >
                      In Hand
                    </span>
                  )}
                </div>
                <div
                  className={`text-[11px] font-mono-tabular ${
                    active ? 'text-[#2b2618]' : 'text-[#8e9381]'
                  }`}
                >
                  {wSpec.caliber}
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Calculated Performance Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3 py-2.5 mb-3 bg-[#11150f] border border-[#2f382a] rounded text-xs font-mono-tabular text-[#d4d0bf]">
          <div>
            <div className="text-[10px] text-[#8e9381] uppercase">Fire Rate</div>
            <div className="text-sm font-bold text-[#c89b3c] tabular-nums">{effectiveRpm} RPM</div>
          </div>
          <div>
            <div className="text-[10px] text-[#8e9381] uppercase">Reload</div>
            <div className="text-sm font-bold text-[#ece9df] tabular-nums">
              {effectiveReload.toFixed(2)}s
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#8e9381] uppercase">Damage</div>
            <div className="text-sm font-bold text-[#ece9df] tabular-nums">{effectiveDmg} HP</div>
          </div>
          <div>
            <div className="text-[10px] text-[#8e9381] uppercase">Capacity</div>
            <div className="text-sm font-bold text-[#ece9df] tabular-nums">{effectiveMag} rds</div>
          </div>
        </div>

        {/* Section Sub-tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#11150f] border border-[#2f382a] rounded mb-4">
          {(
            [
              { id: 'attachments', label: 'Attachments' },
              { id: 'paint', label: 'Paints & Camo' },
              { id: 'internals', label: 'Internal Parts' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] text-xs font-mono-tabular uppercase tracking-wide rounded transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-[#2a3423] border border-[#c89b3c] text-[#ece9df] font-semibold'
                  : 'text-[#9ea38f] hover:text-[#ece9df]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Attachments Tab */}
        {tab === 'attachments' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
                Optic Sight
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {OPTICS.map((opt) => {
                  const isSel = att.optic === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSetAttachment(selectedWeapon, 'optic', opt.id)}
                      className={`min-h-[54px] p-2.5 rounded border text-left transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                          : 'bg-[#11150f] border-[#2f382a] text-[#b8b39e] hover:border-[#4c5844]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#ece9df]">{opt.name}</div>
                      <div className="text-[11px] text-[#9ea38f] mt-0.5 leading-snug">{opt.effect}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
                Muzzle Device
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {MUZZLES.map((muz) => {
                  const isSel = att.muzzle === muz.id;
                  return (
                    <button
                      key={muz.id}
                      type="button"
                      onClick={() => onSetAttachment(selectedWeapon, 'muzzle', muz.id)}
                      className={`min-h-[54px] p-2.5 rounded border text-left transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                          : 'bg-[#11150f] border-[#2f382a] text-[#b8b39e] hover:border-[#4c5844]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#ece9df]">{muz.name}</div>
                      <div className="text-[11px] text-[#9ea38f] mt-0.5 leading-snug">{muz.effect}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
                Magazine &amp; Underbarrel
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {UNDERBARRELS.map((und) => {
                  const isSel = att.underbarrel === und.id;
                  return (
                    <button
                      key={und.id}
                      type="button"
                      onClick={() => onSetAttachment(selectedWeapon, 'underbarrel', und.id)}
                      className={`min-h-[54px] p-2.5 rounded border text-left transition-colors cursor-pointer ${
                        isSel
                          ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                          : 'bg-[#11150f] border-[#2f382a] text-[#b8b39e] hover:border-[#4c5844]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#ece9df]">{und.name}</div>
                      <div className="text-[11px] text-[#9ea38f] mt-0.5 leading-snug">{und.effect}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Paints & Camo Tab */}
        {tab === 'paint' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-2">
                Military Receiver &amp; Furniture Presets (Live 3D Preview)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PAINTS.map((p) => {
                  const unlocked = level >= p.minLevel;
                  const isSel = state.paint === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onSetPaint(selectedWeapon, p.id)}
                      className={`min-h-[60px] p-2.5 rounded border flex items-center gap-3 text-left transition-colors ${
                        !unlocked
                          ? 'bg-[#10130e] border-[#252b20] text-[#6d7362] cursor-not-allowed'
                          : isSel
                            ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df] cursor-pointer'
                            : 'bg-[#11150f] border-[#2f382a] text-[#b8b39e] hover:border-[#4c5844] cursor-pointer'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded border border-[#4a5442] shrink-0"
                        style={{ background: p.swatch }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#ece9df] truncate">{p.name}</span>
                          <span
                            className={`text-[10px] font-mono-tabular shrink-0 ${
                              unlocked ? 'text-[#9cc47d]' : 'text-[#c89b3c]'
                            }`}
                          >
                            {unlocked ? (isSel ? 'ACTIVE' : `LV ${p.minLevel}`) : `LOCKED LV ${p.minLevel}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9ea38f] mt-0.5 leading-snug">{p.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <CustomCamoStudio
              mode="weapon"
              value={state.customPaint ?? hud.customWeaponCamo}
              isActive={state.paint === 'custom'}
              onChange={(cfg) => onSetCustomPaint(selectedWeapon, cfg)}
            />
          </div>
        )}

        {/* Internal Parts Tab */}
        {tab === 'internals' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
                Trigger Assembly
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TRIGGERS.map((tr) => {
                  const unlocked = level >= tr.minLevel;
                  const isSel = intl.trigger === tr.id;
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onSetInternalPart(selectedWeapon, 'trigger', tr.id)}
                      className={`min-h-[58px] p-2.5 rounded border text-left transition-colors ${
                        !unlocked
                          ? 'bg-[#10130e] border-[#252b20] text-[#6d7362] cursor-not-allowed'
                          : isSel
                            ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df] cursor-pointer'
                            : 'bg-[#11150f] border-[#2f382a] text-[#b8b39e] hover:border-[#4c5844] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-[#ece9df]">{tr.name}</span>
                        {!unlocked && (
                          <span className="text-[10px] font-mono-tabular text-[#c89b3c]">
                            LV {tr.minLevel}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9ea38f] mt-0.5 leading-snug">{tr.effect}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
                Bolt Carrier Group (BCG)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BOLTS.map((b) => {
                  const unlocked = level >= b.minLevel;
                  const isSel = intl.bolt === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onSetInternalPart(selectedWeapon, 'bolt', b.id)}
                      className={`min-h-[58px] p-2.5 rounded border text-left transition-colors ${
                        !unlocked
                          ? 'bg-[#10130e] border-[#252b20] text-[#6d7362] cursor-not-allowed'
                          : isSel
                            ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df] cursor-pointer'
                            : 'bg-[#11150f] border-[#2f382a] text-[#b8b39e] hover:border-[#4c5844] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-[#ece9df]">{b.name}</span>
                        {!unlocked && (
                          <span className="text-[10px] font-mono-tabular text-[#c89b3c]">
                            LV {b.minLevel}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9ea38f] mt-0.5 leading-snug">{b.effect}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
                Recoil Buffer Spring
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SPRINGS.map((sp) => {
                  const unlocked = level >= sp.minLevel;
                  const isSel = intl.spring === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onSetInternalPart(selectedWeapon, 'spring', sp.id)}
                      className={`min-h-[58px] p-2.5 rounded border text-left transition-colors ${
                        !unlocked
                          ? 'bg-[#10130e] border-[#252b20] text-[#6d7362] cursor-not-allowed'
                          : isSel
                            ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df] cursor-pointer'
                            : 'bg-[#11150f] border-[#2f382a] text-[#b8b39e] hover:border-[#4c5844] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-[#ece9df]">{sp.name}</span>
                        {!unlocked && (
                          <span className="text-[10px] font-mono-tabular text-[#c89b3c]">
                            LV {sp.minLevel}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9ea38f] mt-0.5 leading-snug">{sp.effect}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
