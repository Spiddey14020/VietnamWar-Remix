import type {
  ClassGearReward,
  DailyMissionCategory,
  DailyMissionMetric,
  DailyMissionState,
  SoldierClassId,
} from './types';

interface DailyTemplate {
  baseId: string;
  title: string;
  category: DailyMissionCategory;
  description: (target: number) => string;
  metric: DailyMissionMetric;
  minTarget: number;
  maxTarget: number;
  baseXp: number;
  classGear: Record<SoldierClassId, ClassGearReward>;
}

const DAILY_TEMPLATE_POOL: DailyTemplate[] = [
  {
    baseId: 'mekong_crossing',
    title: 'Mekong River Ambush',
    category: 'JUNGLE OPS',
    description: (t) => `Neutralize ${t} NVA/VC hostiles along the Mekong riverbanks or valley patrols.`,
    metric: 'kills_river',
    minTarget: 3,
    maxTarget: 5,
    baseXp: 240,
    classGear: {
      rifleman: {
        gearName: 'Colt 3x20 + Chrome BCG',
        gearSummary: 'M16A1 Colt 3x20 Scope · Chrome-Lined BCG · +1 Bandage',
        weaponId: 'm16a1',
        optic: 'colt_scope',
        bolt: 'chrome_bolt',
        bonusBandages: 1,
      },
      recon: {
        gearName: 'Tiger Stripe + HEL Suppressor',
        gearSummary: 'M16A1 Tiger Stripe Camo · HEL E4A Suppressor · +1 Bandage',
        weaponId: 'm16a1',
        muzzle: 'suppressor',
        paint: 'tiger_stripe',
        bonusBandages: 1,
      },
      machine_gunner: {
        gearName: '150rd Belt + Cutts Comp',
        gearSummary: 'M60 Extended 150rd Box · Cutts Compensator · Full Ammo',
        weaponId: 'm60',
        underbarrel: 'extended_mag',
        muzzle: 'compensator',
        refillAmmo: true,
      },
      artillery_officer: {
        gearName: 'Command Brass M1911 Kit',
        gearSummary: 'M1911A1 Brass Finish · Armson OEG Dot · +1 Frag',
        weaponId: 'm1911',
        optic: 'oeg_dot',
        paint: 'brass_tribute',
        bonusGrenades: 1,
      },
    },
  },
  {
    baseId: 'acoustic_hunt',
    title: 'Counter-Battery Hunter',
    category: 'COUNTER-BATTERY',
    description: (t) => `Sound-range and neutralize ${t} hostile artillery batteries across the ridge.`,
    metric: 'counter_battery',
    minTarget: 2,
    maxTarget: 3,
    baseXp: 310,
    classGear: {
      rifleman: {
        gearName: 'Match Hair Trigger Kit',
        gearSummary: 'M16A1 Match Hair Trigger · Extended 30rd Mag · Full Ammo',
        weaponId: 'm16a1',
        trigger: 'hair_trigger',
        underbarrel: 'extended_mag',
        refillAmmo: true,
      },
      recon: {
        gearName: 'Titanium BCG + Mekong Mud',
        gearSummary: 'M16A1 Titanium BCG · Mekong Mud Camo · Colt 3x20 Scope',
        weaponId: 'm16a1',
        bolt: 'titanium_bcg',
        paint: 'mud_camo',
        optic: 'colt_scope',
      },
      machine_gunner: {
        gearName: 'Hydraulic Buffer + OD Coat',
        gearSummary: 'M60 Hydraulic Buffer · OD Green Finish · +2 Frags',
        weaponId: 'm60',
        spring: 'heavy_buffer',
        paint: 'od_green',
        bonusGrenades: 2,
      },
      artillery_officer: {
        gearName: 'FDC Match Sidearm + Frags',
        gearSummary: 'M1911A1 Lightweight Sear · Titanium BCG · +2 Frags & +1 Bandage',
        weaponId: 'm1911',
        trigger: 'lightweight_sear',
        bolt: 'titanium_bcg',
        bonusGrenades: 2,
        bonusBandages: 1,
      },
    },
  },
  {
    baseId: 'canopy_marksman',
    title: 'Canopy Precision Sweep',
    category: 'MARKSMANSHIP',
    description: (t) => `Score ${t} lethal headshot neutralizations through jungle foliage.`,
    metric: 'kills_headshot',
    minTarget: 3,
    maxTarget: 5,
    baseXp: 280,
    classGear: {
      rifleman: {
        gearName: 'Armson OEG + Bipod Foregrip',
        gearSummary: 'M16A1 Armson OEG Dot · Bipod Foregrip · Lightweight Sear',
        weaponId: 'm16a1',
        optic: 'oeg_dot',
        underbarrel: 'bipod_grip',
        trigger: 'lightweight_sear',
      },
      recon: {
        gearName: 'SOG Match Rifle Package',
        gearSummary: 'M16A1 Colt 3x20 Scope · Lightweight Sear · Overclock Spring',
        weaponId: 'm16a1',
        optic: 'colt_scope',
        trigger: 'lightweight_sear',
        spring: 'overclock_spring',
      },
      machine_gunner: {
        gearName: 'M60 Optic & Bipod Brace',
        gearSummary: 'M60 Armson OEG Dot · Bipod Foregrip · Chrome-Lined BCG',
        weaponId: 'm60',
        optic: 'oeg_dot',
        underbarrel: 'bipod_grip',
        bolt: 'chrome_bolt',
      },
      artillery_officer: {
        gearName: 'Nickel Officer Colt .45',
        gearSummary: 'M1911A1 Chrome Nickel · Suppressed Barrel · Match Hair Trigger',
        weaponId: 'm1911',
        paint: 'chrome_nickel',
        muzzle: 'suppressor',
        trigger: 'hair_trigger',
      },
    },
  },
  {
    baseId: 'steel_rain_salvo',
    title: 'Thunder Battery Salvo',
    category: 'FIRE SUPPORT',
    description: (t) => `Call 155mm Howitzer fire missions to eliminate ${t} enemy combatants.`,
    metric: 'artillery_kills',
    minTarget: 2,
    maxTarget: 4,
    baseXp: 300,
    classGear: {
      rifleman: {
        gearName: 'Overclock M16A1 Internals',
        gearSummary: 'M16A1 Overclock Spring · Cutts Compensator · Full Ammo',
        weaponId: 'm16a1',
        spring: 'overclock_spring',
        muzzle: 'compensator',
        refillAmmo: true,
      },
      recon: {
        gearName: 'Suppressed Sidearm Kit',
        gearSummary: 'M1911A1 HEL E4A Suppressor · Extended Mag · +1 Bandage',
        weaponId: 'm1911',
        muzzle: 'suppressor',
        underbarrel: 'extended_mag',
        bonusBandages: 1,
      },
      machine_gunner: {
        gearName: 'High-Cyclic M60 Internals',
        gearSummary: 'M60 Overclock Spring · Lightweight Sear · Full Ammo',
        weaponId: 'm60',
        spring: 'overclock_spring',
        trigger: 'lightweight_sear',
        refillAmmo: true,
      },
      artillery_officer: {
        gearName: 'FDC Master Carbine Upgrade',
        gearSummary: 'M16A1 Colt 3x20 Scope · Titanium BCG · +2 Frags',
        weaponId: 'm16a1',
        optic: 'colt_scope',
        bolt: 'titanium_bcg',
        bonusGrenades: 2,
      },
    },
  },
  {
    baseId: 'valley_clearance',
    title: 'Search & Destroy Sweep',
    category: 'ASSAULT',
    description: (t) => `Eliminate ${t} hostile fighters anywhere across the Mekong Valley AO.`,
    metric: 'kills_total',
    minTarget: 6,
    maxTarget: 9,
    baseXp: 250,
    classGear: {
      rifleman: {
        gearName: '1st Cav Assault Kit',
        gearSummary: 'M16A1 OD Green Coat · 30rd Extended Mag · +1 Frag & +1 Bandage',
        weaponId: 'm16a1',
        paint: 'od_green',
        underbarrel: 'extended_mag',
        bonusGrenades: 1,
        bonusBandages: 1,
      },
      recon: {
        gearName: 'MACV-SOG Ghost Kit',
        gearSummary: 'M16A1 Suppressor · Hair Trigger · +1 Bandage & Full Ammo',
        weaponId: 'm16a1',
        muzzle: 'suppressor',
        trigger: 'hair_trigger',
        bonusBandages: 1,
        refillAmmo: true,
      },
      machine_gunner: {
        gearName: 'Tiger Stripe Gunner Kit',
        gearSummary: 'M60 Tiger Stripe Camo · Titanium BCG · Full Ammo',
        weaponId: 'm60',
        paint: 'tiger_stripe',
        bolt: 'titanium_bcg',
        refillAmmo: true,
      },
      artillery_officer: {
        gearName: 'Officer Assault Carbine',
        gearSummary: 'M16A1 Armson OEG · Heavy Buffer · +1 Bandage & Full Ammo',
        weaponId: 'm16a1',
        optic: 'oeg_dot',
        spring: 'heavy_buffer',
        bonusBandages: 1,
        refillAmmo: true,
      },
    },
  },
  {
    baseId: 'sector_breach',
    title: 'Ridge & Bunker Breach',
    category: 'ASSAULT',
    description: (t) => `Capture or destroy ${t} primary Sector Objective(s) (Alpha Mortar or Charlie Comms).`,
    metric: 'sectors_cleared',
    minTarget: 1,
    maxTarget: 2,
    baseXp: 340,
    classGear: {
      rifleman: {
        gearName: 'Pointman Titanium Upgrade',
        gearSummary: 'M16A1 Titanium BCG · Cutts Compensator · +2 Frags',
        weaponId: 'm16a1',
        bolt: 'titanium_bcg',
        muzzle: 'compensator',
        bonusGrenades: 2,
      },
      recon: {
        gearName: 'SOG Nickel Sidearm + Optic',
        gearSummary: 'M1911A1 Chrome Nickel · Armson OEG Dot · Overclock Spring',
        weaponId: 'm1911',
        paint: 'chrome_nickel',
        optic: 'oeg_dot',
        spring: 'overclock_spring',
      },
      machine_gunner: {
        gearName: 'M60 Heavy Suppression Kit',
        gearSummary: 'M60 Extended 150rd Box · Titanium BCG · +2 Bandages',
        weaponId: 'm60',
        underbarrel: 'extended_mag',
        bolt: 'titanium_bcg',
        bonusBandages: 2,
      },
      artillery_officer: {
        gearName: 'Battalion Brass Carbine',
        gearSummary: 'M16A1 Brass Tribute · Lightweight Sear · +2 Bandages',
        weaponId: 'm16a1',
        paint: 'brass_tribute',
        trigger: 'lightweight_sear',
        bonusBandages: 2,
      },
    },
  },
  {
    baseId: 'foxholes_discipline',
    title: 'Low-Profile Ambush',
    category: 'JUNGLE OPS',
    description: (t) => `Neutralize ${t} hostiles from a crouched firing stance [C].`,
    metric: 'kills_crouched',
    minTarget: 3,
    maxTarget: 5,
    baseXp: 260,
    classGear: {
      rifleman: {
        gearName: 'M16A1 Bipod & Mud Camo',
        gearSummary: 'M16A1 Bipod Foregrip · Mekong Mud Camo · Heavy Buffer',
        weaponId: 'm16a1',
        underbarrel: 'bipod_grip',
        paint: 'mud_camo',
        spring: 'heavy_buffer',
      },
      recon: {
        gearName: 'Suppressed Colt Scope Kit',
        gearSummary: 'M16A1 Colt 3x20 Scope · HEL Suppressor · Chrome BCG',
        weaponId: 'm16a1',
        optic: 'colt_scope',
        muzzle: 'suppressor',
        bolt: 'chrome_bolt',
      },
      machine_gunner: {
        gearName: 'M60 Prone/Crouch Kit',
        gearSummary: 'M60 Bipod Foregrip · Heavy Buffer · Mekong Mud Camo',
        weaponId: 'm60',
        underbarrel: 'bipod_grip',
        spring: 'heavy_buffer',
        paint: 'mud_camo',
      },
      artillery_officer: {
        gearName: 'Spotter M1911 & Munitions',
        gearSummary: 'M1911A1 Cutts Compensator · Hair Trigger · +2 Frags',
        weaponId: 'm1911',
        muzzle: 'compensator',
        trigger: 'hair_trigger',
        bonusGrenades: 2,
      },
    },
  },
  {
    baseId: 'bunker_frag',
    title: 'Tunnel Rat Clearance',
    category: 'ASSAULT',
    description: (t) => `Neutralize ${t} enemy fighter(s) with M26 fragmentation grenades [G].`,
    metric: 'grenade_kills',
    minTarget: 1,
    maxTarget: 2,
    baseXp: 290,
    classGear: {
      rifleman: {
        gearName: 'Grenadier Rapid Carbine',
        gearSummary: 'M16A1 Lightweight Sear · 30rd Extended Mag · +2 Frags',
        weaponId: 'm16a1',
        trigger: 'lightweight_sear',
        underbarrel: 'extended_mag',
        bonusGrenades: 2,
      },
      recon: {
        gearName: 'SOG CQB Sidearm Kit',
        gearSummary: 'M1911A1 Lightweight Sear · Titanium BCG · +2 Frags',
        weaponId: 'm1911',
        trigger: 'lightweight_sear',
        bolt: 'titanium_bcg',
        bonusGrenades: 2,
      },
      machine_gunner: {
        gearName: 'Breacher M60 Package',
        gearSummary: 'M60 Cutts Compensator · Hair Trigger · +2 Frags',
        weaponId: 'm60',
        muzzle: 'compensator',
        trigger: 'hair_trigger',
        bonusGrenades: 2,
      },
      artillery_officer: {
        gearName: 'High-Explosive FDC Pack',
        gearSummary: 'M16A1 Chrome-Lined BCG · Overclock Spring · +2 Frags & +1 Bandage',
        weaponId: 'm16a1',
        bolt: 'chrome_bolt',
        spring: 'overclock_spring',
        bonusGrenades: 2,
        bonusBandages: 1,
      },
    },
  },
];

export function getLocalDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDailyMissions(
  dateKey: string,
  rerollCounter = 0,
): DailyMissionState[] {
  const rng = mulberry32(hashSeed(`${dateKey}#${rerollCounter}`));
  const pool = [...DAILY_TEMPLATE_POOL];

  // Fisher-Yates shuffle with deterministic daily seed
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return pool.slice(0, 3).map((tpl, idx) => {
    const span = tpl.maxTarget - tpl.minTarget + 1;
    const target = tpl.minTarget + Math.floor(rng() * span);
    const bonusXpStep = (target - tpl.minTarget) * 35;
    const rewardXp = tpl.baseXp + bonusXpStep;
    return {
      id: `${dateKey}_${rerollCounter}_${tpl.baseId}`,
      code: `OP-DAY-0${idx + 1}`,
      title: tpl.title,
      category: tpl.category,
      description: tpl.description(target),
      metric: tpl.metric,
      progress: 0,
      target,
      completed: false,
      claimed: false,
      rewardXp,
      classGear: tpl.classGear,
    };
  });
}
