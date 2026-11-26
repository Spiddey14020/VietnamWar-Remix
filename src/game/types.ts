export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type WeaponId = 'm16a1' | 'm60' | 'm1911';

export type FireMode = 'AUTO' | 'SEMI';

export type ControlMode = 'auto' | 'touch' | 'desktop';

export type OpticAttachment = 'iron' | 'colt_scope' | 'oeg_dot';
export type MuzzleAttachment = 'standard' | 'suppressor' | 'compensator';
export type UnderbarrelAttachment = 'standard' | 'extended_mag' | 'bipod_grip';

export type PaintFinishType = 'matte' | 'satin' | 'gloss' | 'metallic' | 'candy' | 'chrome';

export type CamoPatternStyle = 'solid' | 'tiger' | 'woodland' | 'splinter' | 'gradient';

export interface CustomCamoConfig {
  name: string;
  pattern: CamoPatternStyle;
  finish: PaintFinishType;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  favoredTerrain: TerrainZoneId;
}

export type WeaponPaintId =
  | 'parkerized'
  | 'od_green'
  | 'tiger_stripe'
  | 'mud_camo'
  | 'chrome_nickel'
  | 'brass_tribute'
  | 'custom';

export type TriggerPartId = 'standard_trigger' | 'hair_trigger' | 'lightweight_sear';
export type BoltPartId = 'standard_bolt' | 'chrome_bolt' | 'titanium_bcg';
export type SpringPartId = 'standard_spring' | 'heavy_buffer' | 'overclock_spring';

export interface WeaponInternals {
  trigger: TriggerPartId;
  bolt: BoltPartId;
  spring: SpringPartId;
}

export interface WeaponLoadoutAttachments {
  optic: OpticAttachment;
  muzzle: MuzzleAttachment;
  underbarrel: UnderbarrelAttachment;
}

export type WeatherKind = 'CLEAR' | 'OVERCAST' | 'MONSOON' | 'MIST';

export interface EnvironmentState {
  hour24: number;
  clockStr: string;
  phaseLabel: 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT';
  weather: WeatherKind;
  rainIntensity: number; // 0..1
  timeSpeedMult: number;
}

export type SoldierClassId = 'rifleman' | 'recon' | 'machine_gunner' | 'artillery_officer';

export type RpgAttributeKey = 'grit' | 'agility' | 'marksmanship' | 'command';

export type RpgAttributes = Record<RpgAttributeKey, number>;

export type RpgPerkId = 'field_medic' | 'scavenger' | 'danger_close' | 'deadeye';

export type RpgPerks = Record<RpgPerkId, number>;

export interface SoldierClassSpec {
  id: SoldierClassId;
  name: string;
  roleTitle: string;
  summary: string;
  primaryBonus: string;
  startingWeapon: WeaponId;
  baseAttributes: RpgAttributes;
}

export const SOLDIER_CLASSES: Record<SoldierClassId, SoldierClassSpec> = {
  rifleman: {
    id: 'rifleman',
    name: 'Infantry Rifleman',
    roleTitle: '1st Cav Fireteam Lead',
    summary: 'Balanced frontline rifleman with disciplined reloads, extra vitality, and stamina recovery on kills.',
    primaryBonus: '+25 HP · +15% M16A1 Speed · +15 Stamina on Kill',
    startingWeapon: 'm16a1',
    baseAttributes: { grit: 1, agility: 0, marksmanship: 1, command: 0 },
  },
  recon: {
    id: 'recon',
    name: 'MACV-SOG Recon',
    roleTitle: 'Long-Range Scout',
    summary: 'Stealth stalker deploying with suppressed firearms, high mobility, and lethal headshot precision.',
    primaryBonus: '+14% Speed · Suppressed Start · +25% Headshot & Stealth XP',
    startingWeapon: 'm16a1',
    baseAttributes: { grit: 0, agility: 2, marksmanship: 1, command: 0 },
  },
  machine_gunner: {
    id: 'machine_gunner',
    name: 'Heavy Gunner',
    roleTitle: 'M60 Weapons Squad',
    summary: 'Armored suppression specialist deploying with a tuned M60 LMG, heavy ammo reserves, and shrapnel resistance.',
    primaryBonus: '+40 HP · Tuned M60 + Extra Ammo · -20% Incoming Blast',
    startingWeapon: 'm60',
    baseAttributes: { grit: 2, agility: 0, marksmanship: 0, command: 0 },
  },
  artillery_officer: {
    id: 'artillery_officer',
    name: 'Artillery Officer',
    roleTitle: '155mm Fire Direction',
    summary: 'Forward observer with immediate 155mm battery command, rapid salvo reloads, and expanded splash radius.',
    primaryBonus: 'Instant FDC Command · 25% Faster Salvos · +20% Blast Radius',
    startingWeapon: 'm16a1',
    baseAttributes: { grit: 0, agility: 0, marksmanship: 0, command: 2 },
  },
};

export type QuestId =
  | 'q_river_patrol'
  | 'q_headhunter'
  | 'q_counter_battery'
  | 'q_danger_close'
  | 'q_armory_mastery';

export interface RpgQuestState {
  id: QuestId;
  title: string;
  category: 'COMBAT' | 'PRECISION' | 'ORDNANCE' | 'TACTICAL';
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewardXp: number;
  rewardLabel: string;
}

export type DailyMissionMetric =
  | 'kills_total'
  | 'kills_river'
  | 'kills_headshot'
  | 'counter_battery'
  | 'artillery_kills'
  | 'sectors_cleared'
  | 'kills_crouched'
  | 'grenade_kills';

export type DailyMissionCategory =
  | 'JUNGLE OPS'
  | 'COUNTER-BATTERY'
  | 'MARKSMANSHIP'
  | 'FIRE SUPPORT'
  | 'ASSAULT';

export interface ClassGearReward {
  gearName: string;
  gearSummary: string;
  weaponId: WeaponId;
  optic?: OpticAttachment;
  muzzle?: MuzzleAttachment;
  underbarrel?: UnderbarrelAttachment;
  paint?: WeaponPaintId;
  trigger?: TriggerPartId;
  bolt?: BoltPartId;
  spring?: SpringPartId;
  bonusBandages?: number;
  bonusGrenades?: number;
  refillAmmo?: boolean;
}

export interface DailyMissionState {
  id: string;
  code: string;
  title: string;
  category: DailyMissionCategory;
  description: string;
  metric: DailyMissionMetric;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewardXp: number;
  classGear: Record<SoldierClassId, ClassGearReward>;
}

export type SkillTreeNodeId =
  | 'rif_quick_mag'
  | 'rif_bayonet_stride'
  | 'rif_controlled_burst'
  | 'rif_grenadier'
  | 'rif_pointman'
  | 'rif_linebreaker'
  | 'rec_muffled_step'
  | 'rec_phantom_sprint'
  | 'rec_optic_zero'
  | 'rec_vital_shot'
  | 'rec_shadow_xp'
  | 'rec_phantom'
  | 'mg_asbestos_barrel'
  | 'mg_flak_plate'
  | 'mg_tripod_brace'
  | 'mg_ammo_bearer'
  | 'mg_suppression'
  | 'mg_fortress'
  | 'art_rapid_lanyard'
  | 'art_acoustic_array'
  | 'art_hc_shells'
  | 'art_wp_chemistry'
  | 'art_forward_obs'
  | 'art_steel_rain';

export interface SkillTreeNodeSpec {
  id: SkillTreeNodeId;
  classId: SoldierClassId;
  tier: 1 | 2 | 3 | 4;
  branchLabel: string;
  name: string;
  summary: string;
  effectText: string;
  requires: SkillTreeNodeId[];
  posX: number; // 0..100 percentage for SVG & node graph layout
  posY: number; // 0..100 percentage
}

export const CLASS_SKILL_TREES: Record<SoldierClassId, SkillTreeNodeSpec[]> = {
  rifleman: [
    {
      id: 'rif_quick_mag',
      classId: 'rifleman',
      tier: 1,
      branchLabel: 'CORE DRILL',
      name: 'Quick Mag Drill',
      summary: 'Muscle-memory magazine indexing under jungle ambush pressure.',
      effectText: '-15% Reload Duration across all weapons',
      requires: [],
      posX: 50,
      posY: 14,
    },
    {
      id: 'rif_bayonet_stride',
      classId: 'rifleman',
      tier: 2,
      branchLabel: 'MOBILITY',
      name: 'Jungle Conditioning',
      summary: 'Endurance training for muddy paddy dikes and dense ridge climbs.',
      effectText: '+8% Move Speed · +20% Stamina Regen',
      requires: ['rif_quick_mag'],
      posX: 24,
      posY: 40,
    },
    {
      id: 'rif_controlled_burst',
      classId: 'rifleman',
      tier: 2,
      branchLabel: 'MARKSMAN',
      name: 'Controlled Bursts',
      summary: 'Tight cheek weld and trigger discipline during sustained firefights.',
      effectText: '-20% Recoil Kick · -15% Hipfire Spread',
      requires: ['rif_quick_mag'],
      posX: 76,
      posY: 40,
    },
    {
      id: 'rif_grenadier',
      classId: 'rifleman',
      tier: 3,
      branchLabel: 'ASSAULT',
      name: 'Grenadier Webbing',
      summary: 'Carry extra M26 fragmentation grenades for clearing entrenched bunkers.',
      effectText: '+2 Max & Starting Frags · +18% Frag Blast Radius',
      requires: ['rif_bayonet_stride'],
      posX: 24,
      posY: 67,
    },
    {
      id: 'rif_pointman',
      classId: 'rifleman',
      tier: 3,
      branchLabel: 'FIREPOWER',
      name: '1st Cav Pointman',
      summary: 'Hardened frontline rifleman tuned for 5.56mm stopping power.',
      effectText: '+25 Max HP · +12% M16A1 Bullet Damage',
      requires: ['rif_controlled_burst'],
      posX: 76,
      posY: 67,
    },
    {
      id: 'rif_linebreaker',
      classId: 'rifleman',
      tier: 4,
      branchLabel: 'CAPSTONE',
      name: 'Linebreaker',
      summary: 'Sustained combat momentum keeps the fireteam pushing forward.',
      effectText: '+12 HP & +15 Stamina restored on every weapon kill',
      requires: ['rif_grenadier', 'rif_pointman'],
      posX: 50,
      posY: 89,
    },
  ],
  recon: [
    {
      id: 'rec_muffled_step',
      classId: 'recon',
      tier: 1,
      branchLabel: 'STEALTH',
      name: 'Muffled Tread',
      summary: 'Subsonic fire discipline and jungle pathing keep patrols guessing.',
      effectText: '-30% Gunshot Enemy Alert Radius',
      requires: [],
      posX: 50,
      posY: 14,
    },
    {
      id: 'rec_phantom_sprint',
      classId: 'recon',
      tier: 2,
      branchLabel: 'EVASION',
      name: 'SOG Trail Runner',
      summary: 'Rapid flanking maneuvers across the Mekong banks with minimal fatigue.',
      effectText: '+12% Move Speed · -25% Sprint Stamina Drain',
      requires: ['rec_muffled_step'],
      posX: 24,
      posY: 40,
    },
    {
      id: 'rec_optic_zero',
      classId: 'recon',
      tier: 2,
      branchLabel: 'OPTICS',
      name: 'Matched Optics',
      summary: 'Hand-zeroed scopes and stabilized breathing when sighting targets.',
      effectText: '-22% ADS Spread across all firearms',
      requires: ['rec_muffled_step'],
      posX: 76,
      posY: 40,
    },
    {
      id: 'rec_shadow_xp',
      classId: 'recon',
      tier: 3,
      branchLabel: 'INTEL',
      name: 'Intel Extraction',
      summary: 'Collect field intelligence from precision kills and captured bunkers.',
      effectText: '+25% Bonus XP from Headshots & Sector Clears',
      requires: ['rec_phantom_sprint'],
      posX: 24,
      posY: 67,
    },
    {
      id: 'rec_vital_shot',
      classId: 'recon',
      tier: 3,
      branchLabel: 'LETHALITY',
      name: 'Vital Organ Shot',
      summary: 'Surgical shot placement through dense foliage and monsoon mist.',
      effectText: '+35% Headshot Damage Multiplier',
      requires: ['rec_optic_zero'],
      posX: 76,
      posY: 67,
    },
    {
      id: 'rec_phantom',
      classId: 'recon',
      tier: 4,
      branchLabel: 'CAPSTONE',
      name: 'MACV Phantom',
      summary: 'Suppressors turn lethal without sacrificing ballistic punch.',
      effectText: '+18% Weapon Damage when firing a Suppressed firearm',
      requires: ['rec_shadow_xp', 'rec_vital_shot'],
      posX: 50,
      posY: 89,
    },
  ],
  machine_gunner: [
    {
      id: 'mg_asbestos_barrel',
      classId: 'machine_gunner',
      tier: 1,
      branchLabel: 'CYCLIC RATE',
      name: 'Quick-Change Barrel',
      summary: 'Asbestos glove barrel swaps allow higher sustained M60 cadence.',
      effectText: '+14% M60 LMG Fire Rate',
      requires: [],
      posX: 50,
      posY: 14,
    },
    {
      id: 'mg_flak_plate',
      classId: 'machine_gunner',
      tier: 2,
      branchLabel: 'ARMOR',
      name: 'M69 Flak Armor',
      summary: 'Reinforced ballistic nylon vest absorbs mortar and frag splinters.',
      effectText: '-20% Incoming Blast & Shrapnel Damage',
      requires: ['mg_asbestos_barrel'],
      posX: 24,
      posY: 40,
    },
    {
      id: 'mg_tripod_brace',
      classId: 'machine_gunner',
      tier: 2,
      branchLabel: 'STABILITY',
      name: 'Braced Fireteam',
      summary: 'Lock the M60 into the shoulder pocket when kneeling in cover.',
      effectText: '-25% Recoil & -22% Spread with M60 or Crouched',
      requires: ['mg_asbestos_barrel'],
      posX: 76,
      posY: 40,
    },
    {
      id: 'mg_ammo_bearer',
      classId: 'machine_gunner',
      tier: 3,
      branchLabel: 'LOGISTICS',
      name: 'Belt-Fed Carrier',
      summary: 'Extra linked 7.62mm bandoliers and extended feed trays.',
      effectText: '+100 M60 Reserve Cap · +25% M60 Magazine Size',
      requires: ['mg_flak_plate'],
      posX: 24,
      posY: 67,
    },
    {
      id: 'mg_suppression',
      classId: 'machine_gunner',
      tier: 3,
      branchLabel: 'SUPPRESSION',
      name: 'Shock Suppression',
      summary: 'Cracking 7.62mm tracers pin hostile squads behind cover longer.',
      effectText: '+50% Suppression applied to enemies near fire line',
      requires: ['mg_tripod_brace'],
      posX: 76,
      posY: 67,
    },
    {
      id: 'mg_fortress',
      classId: 'machine_gunner',
      tier: 4,
      branchLabel: 'CAPSTONE',
      name: 'Walking Fortress',
      summary: 'Unbreakable heavy weapons anchor holding the valley line.',
      effectText: '+30 Max HP · -15% All Incoming Damage',
      requires: ['mg_ammo_bearer', 'mg_suppression'],
      posX: 50,
      posY: 89,
    },
  ],
  artillery_officer: [
    {
      id: 'art_rapid_lanyard',
      classId: 'artillery_officer',
      tier: 1,
      branchLabel: 'GUN CREW',
      name: 'Synchronized Crews',
      summary: 'Drilled 155mm gunners ram powder bags and swab breeches faster.',
      effectText: '-18% 155mm Howitzer Salvo Reload Time',
      requires: [],
      posX: 50,
      posY: 14,
    },
    {
      id: 'art_acoustic_array',
      classId: 'artillery_officer',
      tier: 2,
      branchLabel: 'SOUND RANGE',
      name: 'Acoustic Triangulation',
      summary: 'Microsecond flash-to-bang computation accelerates counter-battery fire.',
      effectText: '-25% Counter-Battery Cooldown',
      requires: ['art_rapid_lanyard'],
      posX: 24,
      posY: 40,
    },
    {
      id: 'art_hc_shells',
      classId: 'artillery_officer',
      tier: 2,
      branchLabel: 'BLAST ZONE',
      name: 'High-Capacity Fuze',
      summary: 'Variable-time airburst fuzes widen lethal shrapnel saturation.',
      effectText: '+20% 155mm Howitzer Splash Radius',
      requires: ['art_rapid_lanyard'],
      posX: 76,
      posY: 40,
    },
    {
      id: 'art_forward_obs',
      classId: 'artillery_officer',
      tier: 3,
      branchLabel: 'COMMAND',
      name: 'FDC Command Link',
      summary: 'Priority battalion radio clearance awards higher combat merit.',
      effectText: '+18% All Career XP Earned',
      requires: ['art_acoustic_array'],
      posX: 24,
      posY: 67,
    },
    {
      id: 'art_wp_chemistry',
      classId: 'artillery_officer',
      tier: 3,
      branchLabel: 'ORDNANCE',
      name: 'Enhanced Ordnance',
      summary: 'Super-charge propellant and dense fragmentation casing.',
      effectText: '+22% 155mm Artillery Shell Damage',
      requires: ['art_hc_shells'],
      posX: 76,
      posY: 67,
    },
    {
      id: 'art_steel_rain',
      classId: 'artillery_officer',
      tier: 4,
      branchLabel: 'CAPSTONE',
      name: 'Steel Rain',
      summary: 'Master of Fire Direction saturating the Mekong ridge with precision.',
      effectText: '+15% Artillery Splash Radius · +45 Bonus XP per 155mm Kill',
      requires: ['art_forward_obs', 'art_wp_chemistry'],
      posX: 50,
      posY: 89,
    },
  ],
};

export interface XpEventInfo {
  id: number;
  label: string;
  amount: number;
}

export interface SoldierProgression {
  xp: number;
  level: number;
  rankTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  recentEvent: XpEventInfo | null;
  soldierClass: SoldierClassId;
  attributePoints: number;
  skillPoints: number;
  attributes: RpgAttributes;
  perks: RpgPerks;
  unlockedSkillNodes: SkillTreeNodeId[];
  quests: RpgQuestState[];
  totalQuestsCompleted: number;
  dailyDateKey: string;
  dailyMissions: DailyMissionState[];
  totalDailyCompleted: number;
}

export type ShellType = 'HE' | 'WP';
export type SheafPattern = 'CONVERGE' | 'BARRAGE';

export interface HowitzerGunState {
  id: number;
  callsign: string;
  status: 'READY' | 'FIRING' | 'RELOADING';
  reloadLeftSec: number;
  azimuthDeg: number;
  elevationDeg: number;
}

export interface ArtilleryOfficerState {
  officerActive: boolean;
  binocularZoom: boolean;
  shellType: ShellType;
  sheafPattern: SheafPattern;
  targetX: number | null;
  targetZ: number | null;
  targetGridRef: string | null;
  targetRangeM: number | null;
  targetAzimuthDeg: number | null;
  etaSec: number | null;
  guns: HowitzerGunState[];
  salvosFired: number;
  killsByArtillery: number;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  caliber: string;
  magSize: number;
  maxReserve: number;
  fireInterval: number;
  reloadDuration: number;
  damage: number;
  headshotMultiplier: number;
  hipSpread: number;
  adsSpread: number;
  recoilPitch: number;
  recoilYaw: number;
  adsFov: number;
  supportsAuto: boolean;
  defaultFireMode: FireMode;
  muzzleVelocity: number;
  moveSpeedMult: number;
}

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  m16a1: {
    id: 'm16a1',
    name: 'M16A1',
    caliber: '5.56x45mm',
    magSize: 20,
    maxReserve: 140,
    fireInterval: 0.088,
    reloadDuration: 1.85,
    damage: 34,
    headshotMultiplier: 2.2,
    hipSpread: 0.032,
    adsSpread: 0.004,
    recoilPitch: 0.022,
    recoilYaw: 0.009,
    adsFov: 50,
    supportsAuto: true,
    defaultFireMode: 'AUTO',
    muzzleVelocity: 240,
    moveSpeedMult: 1.0,
  },
  m60: {
    id: 'm60',
    name: 'M60 LMG',
    caliber: '7.62x51mm',
    magSize: 100,
    maxReserve: 200,
    fireInterval: 0.108,
    reloadDuration: 3.1,
    damage: 42,
    headshotMultiplier: 2.0,
    hipSpread: 0.048,
    adsSpread: 0.009,
    recoilPitch: 0.028,
    recoilYaw: 0.015,
    adsFov: 54,
    supportsAuto: true,
    defaultFireMode: 'AUTO',
    muzzleVelocity: 255,
    moveSpeedMult: 0.84,
  },
  m1911: {
    id: 'm1911',
    name: 'M1911A1',
    caliber: '.45 ACP',
    magSize: 7,
    maxReserve: 42,
    fireInterval: 0.19,
    reloadDuration: 1.35,
    damage: 38,
    headshotMultiplier: 2.0,
    hipSpread: 0.024,
    adsSpread: 0.005,
    recoilPitch: 0.032,
    recoilYaw: 0.008,
    adsFov: 58,
    supportsAuto: false,
    defaultFireMode: 'SEMI',
    muzzleVelocity: 170,
    moveSpeedMult: 1.06,
  },
};

export interface ObjectiveState {
  id: 'alpha' | 'charlie' | 'extract';
  code: string;
  label: string;
  x: number;
  z: number;
  completed: boolean;
  active: boolean;
  progress: number;
}

export type BatteryStatus = 'active' | 'detected' | 'striking' | 'neutralized';

export interface ArtilleryBatteryInfo {
  id: string;
  callsign: string;
  worldX: number;
  worldZ: number;
  elevationM: number;
  status: BatteryStatus;
  gridRef: string;
  azimuthDeg: number;
  rangeMeters: number;
  acousticDelaySec: number;
  elevationDeltaM: number;
  lastShotAgeSec: number;
}

export interface CounterBatteryState {
  activeSolution: ArtilleryBatteryInfo | null;
  batteries: ArtilleryBatteryInfo[];
  strikeCooldownSec: number;
  neutralizedCount: number;
}

export interface WeaponRuntimeState {
  mag: number;
  reserve: number;
  fireMode: FireMode;
  attachments: WeaponLoadoutAttachments;
  paint: WeaponPaintId;
  customPaint?: CustomCamoConfig;
  internals: WeaponInternals;
}

export type TerrainZoneId = 'jungle' | 'river' | 'ridge' | 'bunker';

export const TERRAIN_ZONE_LABELS: Record<TerrainZoneId, string> = {
  jungle: 'Dense Jungle',
  river: 'Mekong River',
  ridge: 'Highland Ridge',
  bunker: 'Firebase / Compound',
};

export type UniformCamoId =
  | 'og107_olive'
  | 'tiger_stripe'
  | 'erdl_woodland'
  | 'khaki_tan'
  | 'mekong_mud'
  | 'charcoal_night'
  | 'custom_camo';

export type TacticalRigId =
  | 'light_webbing'
  | 'grenadier_vest'
  | 'flak_jacket'
  | 'medic_pack';

export type HeadgearId = 'm1_helmet' | 'boonie_hat' | 'comms_beret';

export interface MilitaryUniformSpec {
  id: UniformCamoId;
  name: string;
  colorName: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  swatch: string;
  favoredTerrains: TerrainZoneId[];
  nightFavored?: boolean;
  terrainLabel: string;
  terrainBonusText: string;
  passiveText: string;
}

export const MILITARY_UNIFORMS: Record<UniformCamoId, MilitaryUniformSpec> = {
  og107_olive: {
    id: 'og107_olive',
    name: 'OG-107 Olive Sateen',
    colorName: 'Olive Green 107',
    primaryHex: '#465432',
    secondaryHex: '#354025',
    accentHex: '#637249',
    swatch: 'linear-gradient(135deg, #4b5a36 0%, #313b22 100%)',
    favoredTerrains: ['jungle'],
    terrainLabel: 'Dense Jungle',
    terrainBonusText: '-28% Enemy Sight Range · +18% Stamina Regen in Jungle',
    passiveText: 'Standard breathable cotton sateen fatigues',
  },
  tiger_stripe: {
    id: 'tiger_stripe',
    name: 'MACV Tiger Stripe',
    colorName: 'Jungle Tiger Camo',
    primaryHex: '#3d4929',
    secondaryHex: '#1b1f15',
    accentHex: '#636c45',
    swatch: 'repeating-linear-gradient(125deg, #465331 0 10px, #1d2116 10px 16px, #687347 16px 22px)',
    favoredTerrains: ['jungle', 'river'],
    terrainLabel: 'Jungle & River',
    terrainBonusText: '-35% Enemy Detection · +10% Speed in Jungle & Riverbanks',
    passiveText: 'Disruptive tropical stripe pattern for close ambush',
  },
  erdl_woodland: {
    id: 'erdl_woodland',
    name: 'ERDL Highland Leaf',
    colorName: 'Woodland Leaf',
    primaryHex: '#4e5d34',
    secondaryHex: '#6b573b',
    accentHex: '#28311d',
    swatch: 'repeating-linear-gradient(110deg, #4f5e34 0 12px, #6c583c 12px 20px, #29321e 20px 26px)',
    favoredTerrains: ['ridge', 'jungle'],
    terrainLabel: 'Highland Ridge & Jungle',
    terrainBonusText: '+12% Shot Damage · -18% Incoming Fire on Ridges',
    passiveText: 'Four-tone Highland leaf pattern for rocky slopes',
  },
  khaki_tan: {
    id: 'khaki_tan',
    name: 'M1967 Laterite Khaki',
    colorName: 'Field Khaki Tan',
    primaryHex: '#8a7451',
    secondaryHex: '#6b573a',
    accentHex: '#a58d67',
    swatch: 'linear-gradient(135deg, #8e7753 0%, #655136 100%)',
    favoredTerrains: ['ridge', 'bunker'],
    terrainLabel: 'Trails, Ridges & Compounds',
    terrainBonusText: '-22% Reload Time · -20% Blast Damage near Bunkers & Trails',
    passiveText: 'Dust-toned poplin tuned for sandbag positions & red dirt',
  },
  mekong_mud: {
    id: 'mekong_mud',
    name: 'Riverine Mud Drab',
    colorName: 'Delta Mud Brown',
    primaryHex: '#4d412d',
    secondaryHex: '#342c1d',
    accentHex: '#6a5a40',
    swatch: 'repeating-linear-gradient(135deg, #564832 0 11px, #372f20 11px 19px, #726145 19px 25px)',
    favoredTerrains: ['river'],
    terrainLabel: 'Mekong River & Banks',
    terrainBonusText: 'Zero Water Slowdown (+35% River Speed) · -25% River Sighting',
    passiveText: 'Waxed delta brown fatigues shed muddy river current',
  },
  charcoal_night: {
    id: 'charcoal_night',
    name: 'SOG Night Slate',
    colorName: 'Charcoal Black',
    primaryHex: '#232824',
    secondaryHex: '#151815',
    accentHex: '#384039',
    swatch: 'linear-gradient(135deg, #272c28 0%, #151815 100%)',
    favoredTerrains: ['bunker'],
    nightFavored: true,
    terrainLabel: 'Compounds & Night Ops',
    terrainBonusText: '-38% Detection · +18% Headshot Damage at Night or Bunkers',
    passiveText: 'Low-sheen midnight slate for night raids & bunker breaches',
  },
  custom_camo: {
    id: 'custom_camo',
    name: 'Custom Camo Studio',
    colorName: 'Custom Coat',
    primaryHex: '#4f5d38',
    secondaryHex: '#252b1c',
    accentHex: '#b38b42',
    swatch: 'repeating-linear-gradient(125deg, #4f5d38 0 10px, #252b1c 10px 16px, #b38b42 16px 22px)',
    favoredTerrains: ['jungle'],
    terrainLabel: 'Custom Affinity',
    terrainBonusText: '-28% Enemy Detection · +10% Speed & +10% Damage in Chosen Terrain',
    passiveText: 'Bespoke field paint, pattern & finish engineered in the Camo Studio',
  },
};

export interface TacticalRigSpec {
  id: TacticalRigId;
  name: string;
  colorHex: string;
  bonusText: string;
}

export const TACTICAL_RIGS: Record<TacticalRigId, TacticalRigSpec> = {
  light_webbing: {
    id: 'light_webbing',
    name: 'M56 Light Webbing',
    colorHex: '#596342',
    bonusText: '+8% Move Speed · +15% Stamina Regen',
  },
  grenadier_vest: {
    id: 'grenadier_vest',
    name: 'M79 Bandolier Vest',
    colorHex: '#63563b',
    bonusText: '+2 Starting & Max Frags · +25% Reserve Ammo Cap',
  },
  flak_jacket: {
    id: 'flak_jacket',
    name: 'M69 Flak Jacket',
    colorHex: '#424b33',
    bonusText: '+25 Max HP · -18% Blast & Shrapnel Damage',
  },
  medic_pack: {
    id: 'medic_pack',
    name: 'Corpsman Trauma Rig',
    colorHex: '#545f46',
    bonusText: '+2 Starting Bandages · +30% Bandage Speed & +15 HP Heal',
  },
};

export interface HeadgearSpec {
  id: HeadgearId;
  name: string;
  colorHex: string;
  bonusText: string;
}

export const HEADGEAR_OPTIONS: Record<HeadgearId, HeadgearSpec> = {
  m1_helmet: {
    id: 'm1_helmet',
    name: 'M1 Steel Helmet',
    colorHex: '#465233',
    bonusText: '+10 Max HP · -15% Incoming Bullet Damage',
  },
  boonie_hat: {
    id: 'boonie_hat',
    name: 'Jungle Boonie Hat',
    colorHex: '#58643f',
    bonusText: '-15% Enemy Spot Range · +12% Crouch Speed',
  },
  comms_beret: {
    id: 'comms_beret',
    name: 'FDC Radio Headset',
    colorHex: '#283024',
    bonusText: '-15% Artillery & CB Cooldown · +12% Career XP',
  },
};

export interface WeaponPresetLoadout {
  attachments: WeaponLoadoutAttachments;
  paint: WeaponPaintId;
  customPaint?: CustomCamoConfig;
  internals: WeaponInternals;
}

export interface CharacterLoadoutConfig {
  name: string;
  uniform: UniformCamoId;
  customUniformCamo?: CustomCamoConfig;
  rig: TacticalRigId;
  headgear: HeadgearId;
  primaryWeapon: WeaponId;
  weapons: Record<WeaponId, WeaponPresetLoadout>;
}

export type CampaignFactionId =
  | 'us_macv'
  | 'arvn'
  | 'anzac'
  | 'rok'
  | 'pavn_nva'
  | 'vc_nlf';

export interface CampaignFactionSpec {
  id: CampaignFactionId;
  name: string;
  shortName: string;
  side: 'ALLIED' | 'PAVN_NLF';
  allegianceLabel: string;
  headquartersName: string;
  extractionLabel: string;
  uniformHex: number;
  helmetHex: number;
  suggestedUniform: UniformCamoId;
  recommendedWeapon: WeaponId;
  bonusSummary: string;
  lore: string;
}

export const CAMPAIGN_FACTIONS: Record<CampaignFactionId, CampaignFactionSpec> = {
  us_macv: {
    id: 'us_macv',
    name: 'US MACV · 1st Cavalry',
    shortName: 'US MACV',
    side: 'ALLIED',
    allegianceLabel: 'United States Army / USMC',
    headquartersName: 'LZ Bravo Firebase',
    extractionLabel: 'Extract via UH-1 Huey',
    uniformHex: 0x465432,
    helmetHex: 0x3b482c,
    suggestedUniform: 'og107_olive',
    recommendedWeapon: 'm16a1',
    bonusSummary: '+15% Artillery Support Damage · Standard Airmobile Doctrine',
    lore: '1st Cavalry airmobile infantry & MACV advisors securing Mekong river crossings and NVA firebases.',
  },
  arvn: {
    id: 'arvn',
    name: 'ARVN Rangers (BDQ)',
    shortName: 'ARVN BDQ',
    side: 'ALLIED',
    allegianceLabel: 'Republic of Vietnam Forces',
    headquartersName: 'Camp Dong Ha Outpost',
    extractionLabel: 'Extract via VNAF H-34',
    uniformHex: 0x3d4929,
    helmetHex: 0x333c24,
    suggestedUniform: 'tiger_stripe',
    recommendedWeapon: 'm16a1',
    bonusSummary: '+15% Reload Speed · +15% Stamina Regen in Delta',
    lore: 'Biet Dong Quan elite South Vietnamese shock rangers conducting aggressive counter-insurgency sweeps.',
  },
  anzac: {
    id: 'anzac',
    name: 'ANZAC · 1ATF & SASR',
    shortName: 'ANZAC 1ATF',
    side: 'ALLIED',
    allegianceLabel: 'Australian & New Zealand Task Force',
    headquartersName: 'Nui Dat Fire Support Base',
    extractionLabel: 'Extract via RAAF Iroquois',
    uniformHex: 0x4b5835,
    helmetHex: 0x3a4227,
    suggestedUniform: 'erdl_woodland',
    recommendedWeapon: 'm16a1',
    bonusSummary: '-18% Enemy Detection Range · +15% Headshot Lethality',
    lore: 'Silent, disciplined Australian and New Zealand jungle patrols specializing in ambush mastery.',
  },
  rok: {
    id: 'rok',
    name: 'ROK Tiger Division',
    shortName: 'ROK Tiger',
    side: 'ALLIED',
    allegianceLabel: 'Republic of Korea Capital Div.',
    headquartersName: 'Qui Nhon Tactical Base',
    extractionLabel: 'Extract via Allied Airlift',
    uniformHex: 0x4c5239,
    helmetHex: 0x3d442e,
    suggestedUniform: 'khaki_tan',
    recommendedWeapon: 'm60',
    bonusSummary: '+20 Max HP · +10% Weapon Damage · High Shock Grit',
    lore: 'Fierce Capital Mechanized & Blue Dragon units known for unyielding perimeter defense and bayonet assaults.',
  },
  pavn_nva: {
    id: 'pavn_nva',
    name: 'PAVN / NVA Regulars',
    shortName: 'PAVN / NVA',
    side: 'PAVN_NLF',
    allegianceLabel: "People's Army of Vietnam",
    headquartersName: 'Route 9 Regimental Staging',
    extractionLabel: 'Exfiltrate to Ho Chi Minh Trail',
    uniformHex: 0x726546,
    helmetHex: 0x5c5338,
    suggestedUniform: 'khaki_tan',
    recommendedWeapon: 'm60',
    bonusSummary: '-18% Incoming Blast Damage · +20% Reserve Ammo Capacity',
    lore: 'Disciplined North Vietnamese regulars assaulting Allied forward firebases, mortar pits, and relay bunkers.',
  },
  vc_nlf: {
    id: 'vc_nlf',
    name: 'Viet Cong / NLF Guerrillas',
    shortName: 'Viet Cong',
    side: 'PAVN_NLF',
    allegianceLabel: 'National Liberation Front',
    headquartersName: 'Cu Chi Tunnel Complex',
    extractionLabel: 'Exfiltrate to Delta Tree Line',
    uniformHex: 0x222521,
    helmetHex: 0x736345,
    suggestedUniform: 'charcoal_night',
    recommendedWeapon: 'm16a1',
    bonusSummary: '-25% Detection in Jungle/Night · +12% Move Speed',
    lore: 'Mekong guerrilla sappers striking Allied mortar emplacements and communications hubs from dense cover.',
  },
};

export type CampaignModifierId =
  | 'night_ops'
  | 'monsoon_front'
  | 'reinforced_garrison'
  | 'heavy_artillery'
  | 'elite_scouts';

export interface CampaignStage {
  index: number;
  opCode: string;
  title: string;
  briefing: string;
  regionName: string;
  hour24: number;
  weather: WeatherKind;
  modifiers: CampaignModifierId[];
  alphaPos: { x: number; z: number };
  charliePos: { x: number; z: number };
  alphaLabel: string;
  charlieLabel: string;
  extractLabel: string;
  enemyCountBonus: number;
  enemyHpMult: number;
  artyCadenceMult: number;
  rewardXp: number;
  rewardAttrPts: number;
  rewardSkillPts: number;
  completed: boolean;
  bestTimeSec: number | null;
  bestKills: number | null;
}

export interface CampaignState {
  active: boolean;
  seed: string;
  tourNumber: number;
  factionId: CampaignFactionId;
  currentStageIndex: number;
  stages: CampaignStage[];
  campaignCompleted: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  health: number;
  maxHealth: number;
  stamina: number;
  bleeding: boolean;
  bandages: number;
  bandagingProgress: number;
  grenades: number;
  isCrouching: boolean;
  isSprinting: boolean;
  isAds: boolean;
  adsBlend: number;
  isReloading: boolean;
  reloadProgress: number;
  activeWeapon: WeaponId;
  weapons: Record<WeaponId, WeaponRuntimeState>;
  headingDeg: number;
  playerX: number;
  playerZ: number;
  terrainZone: TerrainZoneId;
  terrainCamoActive: boolean;
  characterLoadout: CharacterLoadoutConfig;
  activeLoadoutSlot: number;
  loadoutSlots: CharacterLoadoutConfig[];
  customWeaponCamo: CustomCamoConfig;
  customUniformCamo: CustomCamoConfig;
  campaign: CampaignState;
  objectives: ObjectiveState[];
  counterBattery: CounterBatteryState;
  officer: ArtilleryOfficerState;
  environment: EnvironmentState;
  progression: SoldierProgression;
  nearbyPrompt: string | null;
  nearbyActionType: 'resupply' | 'objective' | 'extract' | 'armory' | 'fdc' | null;
  hitMarkerTimer: number;
  hitMarkerKill: boolean;
  damageFlash: number;
  damageAngleRad: number | null;
  shotsFired: number;
  shotsHit: number;
  kills: number;
  enemiesRemaining: number;
  elapsedSec: number;
  muted: boolean;
  ambienceVolume: number;
  sfxVolume: number;
  pointerLocked: boolean;
  statusBanner: string | null;
  extractCountdown: number | null;
  enemyGrenadeAlert: { distanceM: number; fuseSec: number } | null;
}

export interface TouchInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  lookDeltaX: number;
  lookDeltaY: number;
  firing: boolean;
}

export interface GameSettings {
  controlMode: ControlMode;
  sensitivity: number;
}
