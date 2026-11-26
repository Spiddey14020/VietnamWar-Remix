import { SOLDIER_CLASSES, type SoldierProgression } from '../game/types';

interface DailyMissionLogProps {
  progression: SoldierProgression;
  onClaimMission: (missionId: string) => void;
  onRerollMissions: () => void;
}

export function DailyMissionLog({
  progression,
  onClaimMission,
  onRerollMissions,
}: DailyMissionLogProps) {
  const activeClass = SOLDIER_CLASSES[progression.soldierClass];
  const completedCount = progression.dailyMissions.filter((m) => m.completed).length;
  const claimedCount = progression.dailyMissions.filter((m) => m.claimed).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div>
          <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#c89b3c]">
            Daily Ops Log · {progression.dailyDateKey}
          </div>
          <div className="text-[11px] font-mono-tabular text-[#9ea38f] tabular-nums mt-0.5">
            Active Specialty: {activeClass.name} · Claimed Today: {claimedCount}/{progression.dailyMissions.length} · Career Daily Ops: {progression.totalDailyCompleted}
          </div>
        </div>
        <button
          type="button"
          onClick={onRerollMissions}
          className="min-h-[44px] px-3.5 py-2 bg-[#1b2218] hover:bg-[#273123] border border-[#4a5640] rounded text-xs font-mono-tabular uppercase tracking-wide text-[#ece9df] cursor-pointer whitespace-nowrap shrink-0"
        >
          Cycle Daily Orders
        </button>
      </div>

      <div className="text-[11px] text-[#a9ad99]">
        Procedurally generated Mekong Valley field orders. Claiming a completed order awards Career XP and issues gear tuned for your active soldier class ({activeClass.name}).
      </div>

      <div className="space-y-2.5">
        {progression.dailyMissions.map((m) => {
          const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
          const gear = m.classGear[progression.soldierClass];
          const readyToClaim = m.completed && !m.claimed;

          return (
            <div
              key={m.id}
              className={`p-3.5 rounded border transition-colors ${
                m.claimed
                  ? 'bg-[#141a12] border-[#36442f]'
                  : readyToClaim
                    ? 'bg-[#1d2718] border-[#c89b3c]'
                    : 'bg-[#11150f] border-[#2f382a]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
                  <span className="text-[#c89b3c]">{m.code}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#9ea38f]">{m.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-sm font-sans font-semibold text-[#ece9df]">
                    {m.title}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono-tabular tabular-nums ${
                    m.claimed
                      ? 'text-[#84a66a]'
                      : readyToClaim
                        ? 'text-[#f2d488] font-semibold'
                        : 'text-[#d9d5c5]'
                  }`}
                >
                  {m.claimed
                    ? 'CLAIMED'
                    : readyToClaim
                      ? 'READY TO CLAIM'
                      : `${m.progress} / ${m.target}`}
                </span>
              </div>

              <p className="text-xs text-[#b5b1a0] mb-2">{m.description}</p>

              <div className="w-full h-1.5 bg-[#23291f] rounded overflow-hidden mb-2.5">
                <div
                  className={`h-full transition-all ${
                    m.completed ? 'bg-[#86b85e]' : 'bg-[#c89b3c]'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-[#242c20]">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[11px] font-mono-tabular text-[#c89b3c] tabular-nums">
                    +{m.rewardXp} XP · {activeClass.name} Gear: {gear.gearName}
                  </div>
                  <div className="text-[11px] text-[#9cc47d] leading-snug">
                    {gear.gearSummary}
                  </div>
                </div>

                {readyToClaim ? (
                  <button
                    type="button"
                    onClick={() => onClaimMission(m.id)}
                    className="min-h-[44px] px-4 py-2 bg-[#c89b3c] hover:bg-[#d8ab4c] border border-[#f2d488] rounded text-xs font-mono-tabular font-bold uppercase tracking-wide text-[#11150f] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Claim XP &amp; Gear
                  </button>
                ) : m.claimed ? (
                  <span className="min-h-[36px] inline-flex items-center px-3 text-[11px] font-mono-tabular uppercase tracking-wide text-[#84a66a] whitespace-nowrap shrink-0">
                    Issued to Armory
                  </span>
                ) : (
                  <span className="min-h-[36px] inline-flex items-center px-3 text-[11px] font-mono-tabular uppercase tracking-wide text-[#7c8271] tabular-nums whitespace-nowrap shrink-0">
                    {completedCount > 0 ? 'In Progress' : `${m.target - m.progress} Remaining`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
