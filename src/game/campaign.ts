import { distToRiver, HOWITZER_BATTERY_POS, LZ_BRAVO_POS, PLAYABLE_RADIUS } from './terrain';
import {
  CAMPAIGN_FACTIONS,
  type CampaignFactionId,
  type CampaignModifierId,
  type CampaignStage,
  type CampaignState,
  type WeatherKind,
} from './types';

export const CAMPAIGN_MODIFIER_META: Record<
  CampaignModifierId,
  { label: string; summary: string }
> = {
  night_ops: {
    label: 'Night Ops',
    summary: 'Low-light infiltration under flare & moonlight cover.',
  },
  monsoon_front: {
    label: 'Monsoon Squall',
    summary: 'Driving tropical downpour, thunderclaps & reduced sightlines.',
  },
  reinforced_garrison: {
    label: 'Reinforced Garrison',
    summary: 'Heavy sector garrisons with +20% hardened combat endurance.',
  },
  heavy_artillery: {
    label: 'Heavy Counter-Battery',
    summary: 'Frequent distant artillery barrages requiring sound-ranging.',
  },
  elite_scouts: {
    label: 'Veteran Patrols',
    summary: 'Aggressive flanker squads patrolling river trails & ridges.',
  },
};

function hashSeed(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number): () => number {
  let t = a >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomSeedCode(): string {
  const prefixes = ['DELTA', 'MEKONG', 'IRON', 'THUNDER', 'RIVER', 'JUNGLE', 'RIDGE', 'DRAGON'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${p}-${n}`;
}

const REGION_NAMES = [
  'North Mekong Tributary',
  'Ia Drang Bamboo Draw',
  'Route 9 Ridge Line',
  'Chu Lai Coastal Basin',
  'A Shau Valley Gorge',
  'My Tho Rubber Flats',
];

const ALLIED_OP_TITLES = [
  'Operation Steel Bamboo',
  'Operation Cedar Thunder',
  'Operation Attleboro Sweep',
  'Operation Riverine Watch',
  'Operation Junction Strike',
  'Operation Iron Marsh',
  'Operation Rolling Ridge',
  'Operation Pegasus Dawn',
];

const PAVN_OP_TITLES = [
  'Campaign Ho Chi Minh Spear',
  'Offensive Xuan Loc Surge',
  'Operation Monsoon Dagger',
  'Offensive Route 9 Break',
  'Operation Mekong Shadow',
  'Offensive Cu Chi Sapper',
  'Operation Red Laterite',
  'Offensive Midnight Drum',
];

function sampleValidObjectivePos(
  rng: () => number,
  avoid: { x: number; z: number; minDist: number }[],
  fallback: { x: number; z: number },
  preferNorth = true,
): { x: number; z: number } {
  const maxR = PLAYABLE_RADIUS - 28;
  for (let attempt = 0; attempt < 96; attempt++) {
    const angle = preferNorth
      ? -Math.PI * 0.92 + rng() * Math.PI * 0.84 // Northern/flank semicircle away from LZ Bravo south
      : rng() * Math.PI * 2;
    const radius = 56 + rng() * (maxR - 56);
    const x = Math.round(Math.cos(angle) * radius);
    const z = Math.round(Math.sin(angle) * radius);

    if (Math.hypot(x, z) > maxR) continue;
    if (distToRiver(x, z) < 13.5) continue;

    let tooClose = false;
    for (const a of avoid) {
      if (Math.hypot(x - a.x, z - a.z) < a.minDist) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) return { x, z };
  }
  return { ...fallback };
}

function getFactionObjectiveStrings(
  factionId: CampaignFactionId,
  stageIndex: number,
): { alphaLabel: string; charlieLabel: string; extractLabel: string } {
  const faction = CAMPAIGN_FACTIONS[factionId];
  if (faction.side === 'PAVN_NLF') {
    const alphaVariants = [
      'Overrun Allied Mortar Pit',
      'Sabotage Firebase Mortar Nest',
      'Silence ARVN/US Heavy Mortars',
    ];
    const charlieVariants = [
      'Capture Allied Radio Bunker',
      'Storm MACV Comms Bunker',
      'Seize Coalition Signals Post',
    ];
    return {
      alphaLabel: alphaVariants[stageIndex % alphaVariants.length],
      charlieLabel: charlieVariants[stageIndex % charlieVariants.length],
      extractLabel: faction.extractionLabel,
    };
  }
  const alphaVariants = [
    'Destroy PAVN Mortar Pit',
    'Neutralize NVA 82mm Battery',
    'Demolish Ridge Mortar Nest',
  ];
  const charlieVariants = [
    'Secure VC Signals Bunker',
    'Capture NVA Comms Relay',
    'Clear River Radio Bunker',
  ];
  return {
    alphaLabel: alphaVariants[stageIndex % alphaVariants.length],
    charlieLabel: charlieVariants[stageIndex % charlieVariants.length],
    extractLabel: faction.extractionLabel,
  };
}

export function generateCampaign(
  seedInput?: string,
  tourNumber = 1,
  factionId: CampaignFactionId = 'us_macv',
): CampaignState {
  const seed = (seedInput && seedInput.trim().toUpperCase()) || generateRandomSeedCode();
  const h = hashSeed(`${seed}::TOUR-${tourNumber}`);
  const rng = mulberry32(h());
  const faction = CAMPAIGN_FACTIONS[factionId];

  const titlePool = [...(faction.side === 'PAVN_NLF' ? PAVN_OP_TITLES : ALLIED_OP_TITLES)];
  for (let i = titlePool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [titlePool[i], titlePool[j]] = [titlePool[j], titlePool[i]];
  }

  const modPool: CampaignModifierId[] = [
    'night_ops',
    'monsoon_front',
    'reinforced_garrison',
    'heavy_artillery',
    'elite_scouts',
  ];
  const weathers: WeatherKind[] = ['CLEAR', 'OVERCAST', 'MIST', 'MONSOON'];
  const hours = [6.4, 9.2, 13.5, 17.9, 22.1];

  const stages: CampaignStage[] = [];
  for (let i = 0; i < 5; i++) {
    const regionName = REGION_NAMES[Math.floor(rng() * REGION_NAMES.length)];
    const title = titlePool[i % titlePool.length];
    const modCount = i === 0 ? 1 : i >= 3 ? 2 : 1 + (rng() > 0.45 ? 1 : 0);

    const shuffledMods = [...modPool].sort(() => rng() - 0.5);
    const modifiers = shuffledMods.slice(0, modCount);

    let hour24 = hours[(i + Math.floor(rng() * hours.length)) % hours.length];
    if (modifiers.includes('night_ops')) {
      hour24 = 21.6 + rng() * 2.2;
    }

    let weather = weathers[Math.floor(rng() * weathers.length)];
    if (modifiers.includes('monsoon_front')) {
      weather = 'MONSOON';
    }

    const alphaPos = sampleValidObjectivePos(
      rng,
      [
        { x: LZ_BRAVO_POS.x, z: LZ_BRAVO_POS.z, minDist: 54 },
        { x: HOWITZER_BATTERY_POS.x, z: HOWITZER_BATTERY_POS.z, minDist: 54 },
      ],
      { x: -58, z: -42 },
      true,
    );

    const charliePos = sampleValidObjectivePos(
      rng,
      [
        { x: LZ_BRAVO_POS.x, z: LZ_BRAVO_POS.z, minDist: 54 },
        { x: HOWITZER_BATTERY_POS.x, z: HOWITZER_BATTERY_POS.z, minDist: 54 },
        { x: alphaPos.x, z: alphaPos.z, minDist: 64 },
      ],
      { x: 64, z: -34 },
      true,
    );

    const enemyCountBonus =
      i * 2 + (tourNumber - 1) * 2 + (modifiers.includes('reinforced_garrison') ? 3 : 0);
    const enemyHpMult = Number(
      (
        1 +
        i * 0.08 +
        (tourNumber - 1) * 0.1 +
        (modifiers.includes('reinforced_garrison') ? 0.18 : 0)
      ).toFixed(2),
    );
    const artyCadenceMult = Number(
      (1 + i * 0.08 + (modifiers.includes('heavy_artillery') ? 0.32 : 0)).toFixed(2),
    );

    const rewardXp = 450 + i * 220 + (tourNumber - 1) * 150;
    const rewardAttrPts = i >= 2 ? 2 : 1;
    const rewardSkillPts = i % 2 === 1 || i === 4 ? 1 : 0;

    const labels = getFactionObjectiveStrings(factionId, i);
    const briefing =
      faction.side === 'PAVN_NLF'
        ? `${faction.shortName} strike teams infiltrate ${regionName} to dismantle forward mortar emplacements, capture coalition comms, and exfiltrate.`
        : `${faction.shortName} forces sweep ${regionName} to knock out mortar positions, secure signals bunkers, and hold extraction.`;

    stages.push({
      index: i,
      opCode: `OP-0${i + 1}`,
      title,
      briefing,
      regionName,
      hour24: Number(hour24.toFixed(1)),
      weather,
      modifiers,
      alphaPos,
      charliePos,
      alphaLabel: labels.alphaLabel,
      charlieLabel: labels.charlieLabel,
      extractLabel: labels.extractLabel,
      enemyCountBonus,
      enemyHpMult,
      artyCadenceMult,
      rewardXp,
      rewardAttrPts,
      rewardSkillPts,
      completed: false,
      bestTimeSec: null,
      bestKills: null,
    });
  }

  return {
    active: true,
    seed,
    tourNumber,
    factionId,
    currentStageIndex: 0,
    stages,
    campaignCompleted: false,
  };
}

export function rethemeCampaignStagesForFaction(
  campaign: CampaignState,
  factionId: CampaignFactionId,
): CampaignState {
  const faction = CAMPAIGN_FACTIONS[factionId];
  const titlePool = faction.side === 'PAVN_NLF' ? PAVN_OP_TITLES : ALLIED_OP_TITLES;
  return {
    ...campaign,
    factionId,
    stages: campaign.stages.map((st, idx) => {
      const labels = getFactionObjectiveStrings(factionId, idx);
      return {
        ...st,
        title: st.completed ? st.title : titlePool[(idx + campaign.tourNumber) % titlePool.length],
        briefing:
          faction.side === 'PAVN_NLF'
            ? `${faction.shortName} strike teams infiltrate ${st.regionName} to dismantle forward mortar emplacements, capture coalition comms, and exfiltrate.`
            : `${faction.shortName} forces sweep ${st.regionName} to knock out mortar positions, secure signals bunkers, and hold extraction.`,
        alphaLabel: labels.alphaLabel,
        charlieLabel: labels.charlieLabel,
        extractLabel: labels.extractLabel,
      };
    }),
  };
}
