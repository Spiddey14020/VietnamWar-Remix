import { useEffect, useState } from 'react';
import {
  CLASS_SKILL_TREES,
  SOLDIER_CLASSES,
  type CustomCamoConfig,
  type HeadgearId,
  type HudSnapshot,
  type RpgAttributeKey,
  type RpgPerkId,
  type SkillTreeNodeId,
  type SoldierClassId,
  type TacticalRigId,
  type UniformCamoId,
  type WeaponId,
} from '../game/types';
import { CharacterLoadoutPanel, type LoadoutPresetId } from './CharacterLoadoutPanel';
import { ClassSkillTree } from './ClassSkillTree';
import { DailyMissionLog } from './DailyMissionLog';

export type RpgTab = 'build' | 'loadout' | 'skilltree' | 'daily' | 'quests' | 'classes';

interface RpgDossierModalProps {
  hud: HudSnapshot;
  initialTab?: RpgTab;
  onSelectClass: (cls: SoldierClassId) => void;
  onAllocateAttribute: (key: RpgAttributeKey) => void;
  onUpgradePerk: (perkId: RpgPerkId) => void;
  onUnlockSkillNode: (nodeId: SkillTreeNodeId) => void;
  onClaimDailyMission: (missionId: string) => void;
  onRerollDailyMissions: () => void;
  onSelectLoadoutSlot: (slotIdx: number) => void;
  onRenameLoadoutSlot: (name: string) => void;
  onSetUniform: (uniform: UniformCamoId) => void;
  onSetCustomUniformCamo: (cfg: CustomCamoConfig) => void;
  onSetRig: (rig: TacticalRigId) => void;
  onSetHeadgear: (headgear: HeadgearId) => void;
  onSetPrimaryWeapon: (weaponId: WeaponId) => void;
  onApplyPreset: (presetId: LoadoutPresetId) => void;
  onOpenArmory?: () => void;
  onRespec: () => void;
  onClose: () => void;
}

const ATTRIBUTE_META: {
  key: RpgAttributeKey;
  label: string;
  effect: (val: number) => string;
}[] = [
  {
    key: 'grit',
    label: 'Grit & Vitality',
    effect: (v) => `+${v * 12} Max HP · -${v * 3}% Incoming Damage`,
  },
  {
    key: 'agility',
    label: 'Agility & Conditioning',
    effect: (v) => `+${(v * 3.5).toFixed(1)}% Move Speed · +${v * 8}% Stamina Regen`,
  },
  {
    key: 'marksmanship',
    label: 'Marksmanship',
    effect: (v) => `+${v * 4}% Shot Damage & Reload · -${v * 4}% Recoil`,
  },
  {
    key: 'command',
    label: 'Command & Ordnance',
    effect: (v) => `-${v * 6}% Arty Cooldown · +${v * 8}% Blast Dmg & XP`,
  },
];

const PERK_META: {
  id: RpgPerkId;
  name: string;
  summary: string;
  ranks: string[];
}[] = [
  {
    id: 'field_medic',
    name: 'Combat Trauma Medic',
    summary: 'Accelerates dressing speed and maximizes battlefield healing.',
    ranks: [
      'Rank 1: +22% bandage speed · +15 HP healed',
      'Rank 2: +44% speed · +30 HP · +1 starting bandage',
      'Rank 3: +66% speed · +45 HP healed per dressing',
    ],
  },
  {
    id: 'scavenger',
    name: 'Ordnance Scavenger',
    summary: 'Recover ammunition and fragmentation grenades from neutralized hostiles.',
    ranks: [
      'Rank 1: +4 reserve rounds recovered per kill',
      'Rank 2: +8 rounds per kill · +1 frag every 4 kills',
      'Rank 3: +12 rounds per kill · +1 frag every 4 kills',
    ],
  },
  {
    id: 'danger_close',
    name: 'Danger Close Mastery',
    summary: 'Brace against concussive 155mm shockwaves and flying shrapnel.',
    ranks: [
      'Rank 1: -22% self-blast & shrapnel damage',
      'Rank 2: -44% self-blast & shrapnel damage',
      'Rank 3: -66% self-blast & shrapnel damage',
    ],
  },
  {
    id: 'deadeye',
    name: 'Jungle Deadeye',
    summary: 'Sharpen optical focus for lethal headshots and adrenaline recovery.',
    ranks: [
      'Rank 1: +25% headshot multiplier · +8 stamina on kill',
      'Rank 2: +50% headshot · -16% ADS spread · +16 stamina',
      'Rank 3: +75% headshot · -24% ADS spread · +24 stamina',
    ],
  },
];

export function RpgDossierModal({
  hud,
  initialTab = 'build',
  onSelectClass,
  onAllocateAttribute,
  onUpgradePerk,
  onUnlockSkillNode,
  onClaimDailyMission,
  onRerollDailyMissions,
  onSelectLoadoutSlot,
  onRenameLoadoutSlot,
  onSetUniform,
  onSetCustomUniformCamo,
  onSetRig,
  onSetHeadgear,
  onSetPrimaryWeapon,
  onApplyPreset,
  onOpenArmory,
  onRespec,
  onClose,
}: RpgDossierModalProps) {
  const [tab, setTab] = useState<RpgTab>(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const prog = hud.progression;
  const xpPct = Math.min(100, Math.round((prog.xpIntoLevel / prog.xpForNextLevel) * 100));
  const activeClass = SOLDIER_CLASSES[prog.soldierClass];
  const completedQuestsCount = prog.quests.filter((q) => q.completed).length;
  const activeTreeTotal = CLASS_SKILL_TREES[prog.soldierClass].length;
  const activeTreeUnlocked = CLASS_SKILL_TREES[prog.soldierClass].filter((n) =>
    prog.unlockedSkillNodes.includes(n.id),
  ).length;
  const claimedDailyCount = prog.dailyMissions.filter((m) => m.claimed).length;
  const readyDailyCount = prog.dailyMissions.filter((m) => m.completed && !m.claimed).length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-start sm:items-center justify-center bg-[#0b0e0a]/88 p-3 sm:p-4 pointer-events-auto overflow-y-auto touch-scroll"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#161c14] border border-[#4a5640] rounded-lg p-4 sm:p-6 shadow-2xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#c89b3c]">
              LV {prog.level} · {prog.rankTitle} · {activeClass.name}
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold tracking-wide text-[#ece9df] uppercase">
              Soldier RPG Dossier &amp; Quests
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 bg-[#232b20] hover:bg-[#2f392b] border border-[#4a5640] rounded text-xs font-medium text-[#ece9df] cursor-pointer whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>

        {/* Career XP & Unspent Points Strip */}
        <div className="p-3 bg-[#11150f] border border-[#2f382a] rounded mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular mb-1.5">
            <span className="text-[#d9d5c5] tabular-nums">
              {prog.xpIntoLevel} / {prog.xpForNextLevel} XP to LV {prog.level + 1} ({prog.xp} Total)
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[#c89b3c] tabular-nums">
              <span>{prog.attributePoints} Attr Pts</span>
              <span aria-hidden="true">·</span>
              <span>{prog.skillPoints} Skill Pts</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#9cc47d]">
                Tree {activeTreeUnlocked}/{activeTreeTotal}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#9cc47d]">
                Daily {claimedDailyCount}/{prog.dailyMissions.length}
              </span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-[#23291f] rounded overflow-hidden">
            <div className="h-full bg-[#c89b3c]" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1 p-1 bg-[#11150f] border border-[#2f382a] rounded mb-4">
          {(
            [
              {
                id: 'build',
                label:
                  prog.attributePoints + prog.skillPoints > 0
                    ? `Stats (${prog.attributePoints + prog.skillPoints})`
                    : 'Stats & Perks',
              },
              {
                id: 'loadout',
                label: 'Loadout & Camo',
              },
              {
                id: 'skilltree',
                label: `Skill Tree (${activeTreeUnlocked}/${activeTreeTotal})`,
              },
              {
                id: 'daily',
                label:
                  readyDailyCount > 0
                    ? `Daily (${readyDailyCount} Ready)`
                    : `Daily (${claimedDailyCount}/${prog.dailyMissions.length})`,
              },
              { id: 'quests', label: `Quests (${completedQuestsCount}/${prog.quests.length})` },
              { id: 'classes', label: 'Classes' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] px-2 text-xs font-mono-tabular uppercase tracking-wide rounded transition-colors cursor-pointer whitespace-nowrap truncate ${
                tab === t.id
                  ? 'bg-[#2a3423] border border-[#c89b3c] text-[#ece9df] font-semibold'
                  : 'text-[#9ea38f] hover:text-[#ece9df]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Attributes & Perks */}
        {tab === 'build' && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f]">
                  Core Attributes ({prog.attributePoints} Points Available)
                </div>
                <button
                  type="button"
                  onClick={onRespec}
                  className="min-h-[36px] px-3 py-1 bg-[#1b2218] hover:bg-[#273123] border border-[#3e4a37] rounded text-[11px] font-mono-tabular text-[#d4d0bf] cursor-pointer whitespace-nowrap"
                >
                  Reset Points
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ATTRIBUTE_META.map((attr) => {
                  const val = prog.attributes[attr.key];
                  const baseVal = activeClass.baseAttributes[attr.key];
                  const spentVal = val - baseVal;
                  const canSpend = prog.attributePoints > 0 && spentVal < 10;
                  return (
                    <div
                      key={attr.key}
                      className="p-3 bg-[#11150f] border border-[#2f382a] rounded flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#ece9df]">{attr.label}</span>
                          <span className="text-xs font-mono-tabular text-[#c89b3c] tabular-nums">
                            {val}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9ea38f] mt-0.5 tabular-nums">
                          {attr.effect(val)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canSpend}
                        onClick={() => onAllocateAttribute(attr.key)}
                        className={`min-h-[40px] min-w-[48px] px-3 py-1.5 rounded border text-xs font-mono-tabular font-bold shrink-0 cursor-pointer ${
                          canSpend
                            ? 'bg-[#c89b3c] hover:bg-[#d8ab4c] border-[#f2d488] text-[#11150f]'
                            : 'bg-[#171c15] border-[#2c3428] text-[#606758] cursor-not-allowed'
                        }`}
                      >
                        +1
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-2">
                Combat Skill Perks ({prog.skillPoints} Skill Points Available)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PERK_META.map((perk) => {
                  const rank = prog.perks[perk.id];
                  const maxed = rank >= 3;
                  const canUpgrade = prog.skillPoints > 0 && !maxed;
                  return (
                    <div
                      key={perk.id}
                      className="p-3 bg-[#11150f] border border-[#2f382a] rounded flex flex-col justify-between gap-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#ece9df]">{perk.name}</span>
                          <span className="text-xs font-mono-tabular text-[#c89b3c] tabular-nums">
                            Rank {rank} / 3
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9ea38f] mt-1 leading-snug">
                          {perk.summary}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[#9cc47d] mt-1.5">
                          {rank > 0 ? perk.ranks[rank - 1] : perk.ranks[0]}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canUpgrade}
                        onClick={() => onUpgradePerk(perk.id)}
                        className={`min-h-[40px] w-full px-3 py-1.5 rounded border text-xs font-mono-tabular uppercase tracking-wide cursor-pointer ${
                          maxed
                            ? 'bg-[#222d1e] border-[#5f784c] text-[#b4d996] cursor-default'
                            : canUpgrade
                              ? 'bg-[#c89b3c] hover:bg-[#d8ab4c] border-[#f2d488] text-[#11150f] font-bold'
                              : 'bg-[#171c15] border-[#2c3428] text-[#606758] cursor-not-allowed'
                        }`}
                      >
                        {maxed ? 'Mastered' : canUpgrade ? 'Unlock Next Rank' : 'Needs Skill Point'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Character Loadouts & Military Camo */}
        {tab === 'loadout' && (
          <CharacterLoadoutPanel
            hud={hud}
            onSelectLoadoutSlot={onSelectLoadoutSlot}
            onRenameLoadoutSlot={onRenameLoadoutSlot}
            onSetUniform={onSetUniform}
            onSetCustomUniformCamo={onSetCustomUniformCamo}
            onSetRig={onSetRig}
            onSetHeadgear={onSetHeadgear}
            onSetPrimaryWeapon={onSetPrimaryWeapon}
            onApplyPreset={onApplyPreset}
            onOpenArmory={onOpenArmory}
          />
        )}

        {/* Tab 3: Visual Interactive Class Skill Tree */}
        {tab === 'skilltree' && (
          <ClassSkillTree
            progression={prog}
            onUnlockNode={onUnlockSkillNode}
            onSelectClass={onSelectClass}
            onRespec={onRespec}
          />
        )}

        {/* Tab 3: Procedural Daily Mission Log */}
        {tab === 'daily' && (
          <DailyMissionLog
            progression={prog}
            onClaimMission={onClaimDailyMission}
            onRerollMissions={onRerollDailyMissions}
          />
        )}

        {/* Tab 4: Quest Journal */}
        {tab === 'quests' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono-tabular text-[#9ea38f] mb-1">
              <span>Active Mekong Valley Field Contracts</span>
              <span className="tabular-nums">Career Quests Completed: {prog.totalQuestsCompleted}</span>
            </div>
            {prog.quests.map((q) => {
              const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
              return (
                <div
                  key={q.id}
                  className={`p-3.5 rounded border ${
                    q.completed
                      ? 'bg-[#172114] border-[#5f7a49]'
                      : 'bg-[#11150f] border-[#2f382a]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-xs font-mono-tabular">
                      <span className="text-[#c89b3c]">{q.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-sm font-sans font-semibold text-[#ece9df]">
                        {q.title}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono-tabular tabular-nums ${
                        q.completed ? 'text-[#a5d67e] font-semibold' : 'text-[#d9d5c5]'
                      }`}
                    >
                      {q.completed ? 'COMPLETED' : `${q.progress} / ${q.target}`}
                    </span>
                  </div>
                  <p className="text-xs text-[#b5b1a0] mb-2">{q.description}</p>
                  <div className="w-full h-1.5 bg-[#23291f] rounded overflow-hidden mb-2">
                    <div
                      className={`h-full ${q.completed ? 'bg-[#86b85e]' : 'bg-[#c89b3c]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#c89b3c]">
                    Reward: {q.rewardLabel}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Soldier Classes */}
        {tab === 'classes' && (
          <div className="space-y-3">
            <div className="text-xs text-[#a9ad99]">
              Select your military specialty. Stat bonuses apply immediately; starting weapon kits and field ordnance equip on next deployment.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(SOLDIER_CLASSES) as SoldierClassId[]).map((id) => {
                const cls = SOLDIER_CLASSES[id];
                const isSelected = prog.soldierClass === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectClass(id)}
                    className={`p-3.5 rounded border text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                        : 'bg-[#11150f] border-[#2f382a] text-[#c4c0b0] hover:border-[#4e5b46]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-display font-bold uppercase text-[#ece9df]">
                          {cls.name}
                        </span>
                        <span
                          className={`text-[11px] font-mono-tabular ${
                            isSelected ? 'text-[#c89b3c] font-semibold' : 'text-[#8e9381]'
                          }`}
                        >
                          {isSelected ? 'ACTIVE' : cls.roleTitle}
                        </span>
                      </div>
                      <p className="text-xs text-[#b5b1a0] mt-1.5 leading-relaxed">{cls.summary}</p>
                    </div>
                    <div className="pt-2 border-t border-[#293124] text-[11px] font-mono-tabular text-[#9cc47d]">
                      {cls.primaryBonus}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
