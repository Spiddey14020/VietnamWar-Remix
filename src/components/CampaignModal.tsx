import { useState } from 'react';
import { CAMPAIGN_MODIFIER_META, generateRandomSeedCode } from '../game/campaign';
import {
  CAMPAIGN_FACTIONS,
  type CampaignFactionId,
  type HudSnapshot,
} from '../game/types';

interface CampaignModalProps {
  hud: HudSnapshot;
  onSelectFaction: (factionId: CampaignFactionId) => void;
  onGenerateCampaign: (seed?: string, factionId?: CampaignFactionId) => void;
  onDeployStage: (stageIndex: number) => void;
  onDeploySkirmish: () => void;
  onClose: () => void;
}

const ALLIED_FACTIONS: CampaignFactionId[] = ['us_macv', 'arvn', 'anzac', 'rok'];
const PAVN_FACTIONS: CampaignFactionId[] = ['pavn_nva', 'vc_nlf'];

function formatDuration(sec: number | null): string {
  if (sec === null) return '--:--';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CampaignModal({
  hud,
  onSelectFaction,
  onGenerateCampaign,
  onDeployStage,
  onDeploySkirmish,
  onClose,
}: CampaignModalProps) {
  const campaign = hud.campaign;
  const activeFaction = CAMPAIGN_FACTIONS[campaign.factionId];
  const [seedInput, setSeedInput] = useState(campaign.seed);

  const stagesCleared = campaign.stages.filter((s) => s.completed).length;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#0b0e0a]/90 p-3 sm:p-5 pointer-events-auto overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-[#161c14] border border-[#4a5640] rounded-lg p-4 sm:p-6 shadow-2xl my-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#c89b3c]">
              Tour #{campaign.tourNumber} · Seed {campaign.seed} · {stagesCleared}/5 Operations Cleared
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold tracking-wide text-[#ece9df] uppercase">
              Procedural Vietnam War Campaign &amp; Factions
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onDeploySkirmish();
                onClose();
              }}
              className="min-h-[44px] px-3.5 py-2 bg-[#1b2218] hover:bg-[#273123] border border-[#4a5640] rounded text-xs font-mono-tabular uppercase text-[#d9d5c5] cursor-pointer whitespace-nowrap shrink-0"
            >
              Play Free Skirmish
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 bg-[#232b20] hover:bg-[#2f392b] border border-[#4a5640] rounded text-xs font-medium text-[#ece9df] cursor-pointer whitespace-nowrap shrink-0"
            >
              Close
            </button>
          </div>
        </div>

        {/* Playable Faction Selection */}
        <div className="p-3.5 bg-[#11150f] border border-[#2f382a] rounded space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#c89b3c]">
                Select Campaign Faction (1968 Theater of Operations)
              </div>
              <div className="text-xs text-[#b8b39e]">
                Allied forces assault PAVN/VC positions; PAVN &amp; Viet Cong infiltrate Allied firebases and fight US/ARVN regulars.
              </div>
            </div>
            <div className="text-xs font-mono-tabular text-[#9cc47d]">
              Active: {activeFaction.name}
            </div>
          </div>

          {/* Allied Coalition Factions */}
          <div>
            <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#8e9381] mb-1.5">
              Free World / Allied Coalition
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {ALLIED_FACTIONS.map((fId) => {
                const f = CAMPAIGN_FACTIONS[fId];
                const selected = campaign.factionId === fId;
                return (
                  <button
                    key={fId}
                    type="button"
                    onClick={() => onSelectFaction(fId)}
                    className={`p-3 rounded border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                      selected
                        ? 'bg-[#283321] border-[#c89b3c] text-[#ece9df]'
                        : 'bg-[#161c14] border-[#2e3729] text-[#c4c0b0] hover:border-[#4f5d47]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-display font-bold uppercase text-[#ece9df]">
                          {f.shortName}
                        </span>
                        <span
                          className="w-4 h-4 rounded-sm border border-[#5a664b] shrink-0"
                          style={{ backgroundColor: `#${f.uniformHex.toString(16).padStart(6, '0')}` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[#c89b3c] truncate">
                        {f.allegianceLabel}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#9cc47d] leading-snug">{f.bonusSummary}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* North Vietnamese & NLF Factions */}
          <div>
            <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#8e9381] mb-1.5">
              PAVN / NVA &amp; National Liberation Front
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PAVN_FACTIONS.map((fId) => {
                const f = CAMPAIGN_FACTIONS[fId];
                const selected = campaign.factionId === fId;
                return (
                  <button
                    key={fId}
                    type="button"
                    onClick={() => onSelectFaction(fId)}
                    className={`p-3 rounded border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                      selected
                        ? 'bg-[#2c251c] border-[#d97c4a] text-[#ece9df]'
                        : 'bg-[#161c14] border-[#2e3729] text-[#c4c0b0] hover:border-[#634c3a]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-display font-bold uppercase text-[#ece9df]">
                          {f.name}
                        </span>
                        <span
                          className="w-4 h-4 rounded-sm border border-[#6e5e46] shrink-0"
                          style={{ backgroundColor: `#${f.uniformHex.toString(16).padStart(6, '0')}` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="text-[11px] text-[#b5b1a0] mt-0.5 leading-snug">{f.lore}</div>
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[#e69a5c] leading-snug">
                      {f.bonusSummary}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Seed Controls & Campaign Status */}
        <div className="p-3 bg-[#11150f] border border-[#2f382a] rounded flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-mono-tabular uppercase text-[#9ea38f]">
              Campaign Seed
              <input
                type="text"
                maxLength={18}
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value.toUpperCase())}
                className="ml-2 min-h-[40px] w-36 px-2.5 bg-[#161c14] border border-[#3a4433] rounded text-xs font-mono-tabular text-[#ece9df] uppercase focus:outline-none focus:border-[#c89b3c]"
              />
            </label>
            <button
              type="button"
              onClick={() => onGenerateCampaign(seedInput, campaign.factionId)}
              className="min-h-[40px] px-3.5 py-1.5 bg-[#232b20] hover:bg-[#2f392b] border border-[#4a5640] rounded text-xs font-mono-tabular uppercase text-[#ece9df] cursor-pointer whitespace-nowrap"
            >
              Generate from Seed
            </button>
            <button
              type="button"
              onClick={() => {
                const nextSeed = generateRandomSeedCode();
                setSeedInput(nextSeed);
                onGenerateCampaign(nextSeed, campaign.factionId);
              }}
              className="min-h-[40px] px-3.5 py-1.5 bg-[#c89b3c] hover:bg-[#d8ab4c] border border-[#f2d488] rounded text-xs font-mono-tabular font-bold uppercase text-[#11150f] cursor-pointer whitespace-nowrap"
            >
              New Tour / Random Seed
            </button>
          </div>
          <div className="text-xs font-mono-tabular text-[#9cc47d]">
            {campaign.campaignCompleted
              ? 'TOUR COMPLETED · REPLAY ANY STAGE OR START NEXT TOUR'
              : `NEXT OP: ${campaign.stages[campaign.currentStageIndex]?.opCode ?? 'OP-01'}`}
          </div>
        </div>

        {/* 5 Procedurally Generated Stages */}
        <div className="space-y-2.5">
          {campaign.stages.map((st) => {
            const isCurrent = st.index === campaign.currentStageIndex;
            const prevCompleted = st.index === 0 || campaign.stages[st.index - 1]?.completed;
            const deployable = prevCompleted || st.completed || isCurrent;
            const hourWhole = Math.floor(st.hour24);
            const minWhole = Math.round((st.hour24 - hourWhole) * 60);
            const timeStr = `${String(hourWhole).padStart(2, '0')}:${String(minWhole).padStart(2, '0')}`;

            return (
              <div
                key={st.opCode}
                className={`p-3.5 rounded border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                  st.completed
                    ? 'bg-[#172114] border-[#5f7a49]'
                    : isCurrent
                      ? 'bg-[#20281b] border-[#c89b3c]'
                      : 'bg-[#11150f] border-[#2d3628]'
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
                    <span className="font-bold text-[#c89b3c]">{st.opCode}</span>
                    <span className="text-sm sm:text-base font-display font-bold uppercase text-[#ece9df]">
                      {st.title}
                    </span>
                    <span className="text-[#9ea38f]">· {st.regionName}</span>
                    <span className="text-[#9cc47d] tabular-nums">
                      · {timeStr} {st.weather}
                    </span>
                    {st.completed && (
                      <span className="px-2 py-0.5 bg-[#263820] border border-[#6e9952] rounded text-[10px] text-[#b4e095] font-semibold">
                        CLEARED
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#b8b39e] leading-snug">{st.briefing}</p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular text-[#d4d0bf]">
                    <span>A: {st.alphaLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>C: {st.charlieLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#c89b3c]">
                      Reward: +{st.rewardXp} XP
                      {st.rewardAttrPts > 0 ? ` · +${st.rewardAttrPts} Attr` : ''}
                      {st.rewardSkillPts > 0 ? ` · +${st.rewardSkillPts} Skill` : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono-tabular">
                    {st.modifiers.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 bg-[#161c14] border border-[#3a4433] rounded text-[#e69a5c]"
                        title={CAMPAIGN_MODIFIER_META[m].summary}
                      >
                        {CAMPAIGN_MODIFIER_META[m].label}
                      </span>
                    ))}
                    {st.bestTimeSec !== null && (
                      <span className="text-[#9ea38f] tabular-nums">
                        Best: {formatDuration(st.bestTimeSec)} · {st.bestKills ?? 0} KIA
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!deployable}
                  onClick={() => {
                    onDeployStage(st.index);
                    onClose();
                  }}
                  className={`min-h-[46px] px-5 py-2 rounded font-display font-semibold uppercase tracking-wider text-sm cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    !deployable
                      ? 'bg-[#171c15] border border-[#2c3428] text-[#606758] cursor-not-allowed'
                      : isCurrent
                        ? 'bg-[#c89b3c] hover:bg-[#d8ab4c] text-[#11150f]'
                        : 'bg-[#232b20] hover:bg-[#2f3a2b] border border-[#4a5640] text-[#ece9df]'
                  }`}
                >
                  {!deployable
                    ? 'Locked'
                    : st.completed
                      ? 'Replay Operation'
                      : `Deploy ${st.opCode}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
