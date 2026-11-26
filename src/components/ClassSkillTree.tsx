import { useEffect, useMemo, useState } from 'react';
import {
  CLASS_SKILL_TREES,
  SOLDIER_CLASSES,
  type SkillTreeNodeId,
  type SkillTreeNodeSpec,
  type SoldierClassId,
  type SoldierProgression,
} from '../game/types';

interface ClassSkillTreeProps {
  progression: SoldierProgression;
  onUnlockNode: (nodeId: SkillTreeNodeId) => void;
  onSelectClass: (cls: SoldierClassId) => void;
  onRespec: () => void;
}

const TIER_ROMAN: Record<1 | 2 | 3 | 4, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

export function ClassSkillTree({
  progression,
  onUnlockNode,
  onSelectClass,
  onRespec,
}: ClassSkillTreeProps) {
  const [viewedClass, setViewedClass] = useState<SoldierClassId>(progression.soldierClass);
  const nodes = useMemo(() => CLASS_SKILL_TREES[viewedClass], [viewedClass]);
  const [selectedNodeId, setSelectedNodeId] = useState<SkillTreeNodeId>(nodes[0].id);

  useEffect(() => {
    setViewedClass(progression.soldierClass);
  }, [progression.soldierClass]);

  useEffect(() => {
    const classNodes = CLASS_SKILL_TREES[viewedClass];
    if (!classNodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(classNodes[0].id);
    }
  }, [viewedClass, selectedNodeId]);

  const unlockedSet = useMemo(
    () => new Set(progression.unlockedSkillNodes),
    [progression.unlockedSkillNodes],
  );

  const isViewingActiveClass = viewedClass === progression.soldierClass;
  const unlockedInClass = nodes.filter((n) => unlockedSet.has(n.id)).length;
  const selectedNode: SkillTreeNodeSpec =
    nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];

  const getNodeStatus = (node: SkillTreeNodeSpec): 'unlocked' | 'available' | 'locked' => {
    if (unlockedSet.has(node.id)) return 'unlocked';
    const prereqsMet = node.requires.every((req) => unlockedSet.has(req));
    if (prereqsMet && progression.skillPoints > 0 && isViewingActiveClass) {
      return 'available';
    }
    return 'locked';
  };

  const selectedStatus = getNodeStatus(selectedNode);
  const selectedPrereqsMet = selectedNode.requires.every((req) => unlockedSet.has(req));
  const selectedPrereqNames = selectedNode.requires
    .map((reqId) => nodes.find((n) => n.id === reqId)?.name ?? reqId)
    .join(' + ');

  return (
    <div className="space-y-3">
      {/* Class Inspector Switcher & Skill Point Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-[#11150f] border border-[#2f382a] rounded w-full sm:w-auto">
          {(Object.keys(SOLDIER_CLASSES) as SoldierClassId[]).map((clsId) => {
            const cls = SOLDIER_CLASSES[clsId];
            const isViewed = viewedClass === clsId;
            const isEquipped = progression.soldierClass === clsId;
            const clsUnlocked = CLASS_SKILL_TREES[clsId].filter((n) => unlockedSet.has(n.id)).length;
            return (
              <button
                key={clsId}
                type="button"
                onClick={() => setViewedClass(clsId)}
                className={`min-h-[40px] px-2.5 py-1.5 rounded text-[11px] font-mono-tabular uppercase tracking-wide transition-colors cursor-pointer whitespace-nowrap truncate ${
                  isViewed
                    ? 'bg-[#2a3423] border border-[#c89b3c] text-[#ece9df] font-semibold'
                    : 'text-[#9ea38f] hover:text-[#ece9df]'
                }`}
              >
                {cls.name.split(' ')[0]} {clsUnlocked}/6{isEquipped ? ' · ON' : ''}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono-tabular text-[#c89b3c] tabular-nums">
            {progression.skillPoints} Skill Pts · {unlockedInClass}/{nodes.length} Active
          </span>
          <button
            type="button"
            onClick={onRespec}
            className="min-h-[40px] px-3 py-1 bg-[#1b2218] hover:bg-[#273123] border border-[#3e4a37] rounded text-[11px] font-mono-tabular text-[#d4d0bf] cursor-pointer whitespace-nowrap shrink-0"
          >
            Reset Points
          </button>
        </div>
      </div>

      {/* Main Split: Visual Node Graph + Selected Specialization Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-3">
        {/* Visual Interactive Node Tree */}
        <div className="relative h-[370px] sm:h-[400px] bg-[#0e120c] border border-[#2f382a] rounded overflow-hidden select-none">
          {/* Subtle tactical blueprint grid lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern id="skill-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="#182015"
                  strokeWidth="0.35"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#skill-grid)" />

            {/* Prerequisite Path Connectors */}
            {nodes.map((node) =>
              node.requires.map((reqId) => {
                const parent = nodes.find((n) => n.id === reqId);
                if (!parent) return null;
                const parentUnlocked = unlockedSet.has(parent.id);
                const childUnlocked = unlockedSet.has(node.id);
                const childReady = parentUnlocked && !childUnlocked && progression.skillPoints > 0 && isViewingActiveClass;

                const midY = (parent.posY + node.posY) / 2;
                const d = `M ${parent.posX} ${parent.posY} C ${parent.posX} ${midY}, ${node.posX} ${midY}, ${node.posX} ${node.posY}`;

                const stroke = childUnlocked
                  ? '#86b85e'
                  : childReady
                    ? '#c89b3c'
                    : parentUnlocked
                      ? '#5b684f'
                      : '#2a3325';

                return (
                  <path
                    key={`${parent.id}->${node.id}`}
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={childUnlocked ? 1.35 : childReady ? 1.15 : 0.85}
                    strokeDasharray={parentUnlocked ? undefined : '1.8 1.5'}
                  />
                );
              }),
            )}
          </svg>

          {/* Interactive Specialization Nodes */}
          {nodes.map((node) => {
            const status = getNodeStatus(node);
            const isSelected = selectedNode.id === node.id;
            const prereqsMet = node.requires.every((req) => unlockedSet.has(req));

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                style={{ left: `${node.posX}%`, top: `${node.posY}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-[132px] sm:w-[154px] min-h-[54px] px-2.5 py-2 rounded border text-left transition-all cursor-pointer ${
                  status === 'unlocked'
                    ? 'bg-[#1d2b17] border-[#86b85e] text-[#ece9df]'
                    : status === 'available'
                      ? 'bg-[#282414] border-[#c89b3c] text-[#f4ead1] hover:bg-[#332d18]'
                      : prereqsMet && isViewingActiveClass
                        ? 'bg-[#141a12] border-[#4b5741] text-[#c7c3b4] hover:border-[#6a7a5c]'
                        : 'bg-[#10140e] border-[#293124] text-[#7c8271] hover:border-[#3e4937]'
                } ${isSelected ? 'ring-2 ring-[#f2d488] ring-offset-1 ring-offset-[#0e120c] z-10' : 'z-0'}`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular uppercase tracking-wider">
                  <span
                    className={
                      status === 'unlocked'
                        ? 'text-[#9cc47d]'
                        : status === 'available'
                          ? 'text-[#f2d488]'
                          : 'text-[#878d7b]'
                    }
                  >
                    T{TIER_ROMAN[node.tier]} · {node.branchLabel}
                  </span>
                  <span
                    className={
                      status === 'unlocked'
                        ? 'text-[#a5d67e] font-bold'
                        : status === 'available'
                          ? 'text-[#c89b3c] font-bold'
                          : 'text-[#636a59]'
                    }
                  >
                    {status === 'unlocked' ? 'ON' : status === 'available' ? '+' : 'LOCK'}
                  </span>
                </div>
                <div className="text-xs font-semibold leading-tight mt-0.5 truncate">
                  {node.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Node Tactical Detail & Unlock Panel */}
        <div className="bg-[#11150f] border border-[#2f382a] rounded p-4 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular uppercase tracking-wider">
              <span className="text-[#c89b3c]">
                {SOLDIER_CLASSES[viewedClass].name} · Tier {TIER_ROMAN[selectedNode.tier]}
              </span>
              <span
                className={
                  selectedStatus === 'unlocked'
                    ? 'text-[#a5d67e] font-semibold'
                    : selectedStatus === 'available'
                      ? 'text-[#f2d488]'
                      : 'text-[#8e9381]'
                }
              >
                {selectedStatus === 'unlocked'
                  ? 'ACTIVE'
                  : selectedStatus === 'available'
                    ? 'READY TO UNLOCK'
                    : 'LOCKED'}
              </span>
            </div>

            <h3 className="text-base font-display font-bold uppercase tracking-wide text-[#ece9df]">
              {selectedNode.name}
            </h3>

            <p className="text-xs text-[#b5b1a0] leading-relaxed">
              {selectedNode.summary}
            </p>

            <div className="p-2.5 bg-[#161c14] border border-[#2f382a] rounded">
              <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#8e9381] mb-1">
                Specialization Bonus
              </div>
              <div className="text-xs font-mono-tabular text-[#9cc47d]">
                {selectedNode.effectText}
              </div>
            </div>

            <div className="text-[11px] font-mono-tabular text-[#9ea38f]">
              {selectedNode.requires.length === 0 ? (
                <span>Prerequisite: None (Tier I Entry Node)</span>
              ) : (
                <span className={selectedPrereqsMet ? 'text-[#9cc47d]' : 'text-[#c4925a]'}>
                  Prerequisite: {selectedPrereqNames}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#242c20]">
            {!isViewingActiveClass ? (
              <button
                type="button"
                onClick={() => onSelectClass(viewedClass)}
                className="min-h-[44px] w-full px-3 py-2 bg-[#232b20] hover:bg-[#2f3a2a] border border-[#c89b3c] rounded text-xs font-mono-tabular uppercase tracking-wide text-[#f2d488] cursor-pointer whitespace-nowrap"
              >
                Activate {SOLDIER_CLASSES[viewedClass].name}
              </button>
            ) : selectedStatus === 'unlocked' ? (
              <div className="min-h-[44px] w-full px-3 py-2 bg-[#1c2817] border border-[#5f784c] rounded flex items-center justify-center text-xs font-mono-tabular uppercase tracking-wide text-[#b4d996]">
                Specialization Active
              </div>
            ) : (
              <button
                type="button"
                disabled={selectedStatus !== 'available'}
                onClick={() => onUnlockNode(selectedNode.id)}
                className={`min-h-[44px] w-full px-3 py-2 rounded border text-xs font-mono-tabular uppercase tracking-wide cursor-pointer whitespace-nowrap ${
                  selectedStatus === 'available'
                    ? 'bg-[#c89b3c] hover:bg-[#d8ab4c] border-[#f2d488] text-[#11150f] font-bold'
                    : 'bg-[#171c15] border-[#2c3428] text-[#606758] cursor-not-allowed'
                }`}
              >
                {!selectedPrereqsMet
                  ? 'Unlock Prerequisite First'
                  : progression.skillPoints <= 0
                    ? 'Needs 1 Skill Point'
                    : 'Unlock Specialization (1 Pt)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
