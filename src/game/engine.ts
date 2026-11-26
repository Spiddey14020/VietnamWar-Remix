import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TacticalAudioEngine } from './audio';
import {
  buildAmmoCrate,
  buildBunkerComplex,
  buildEnemySoldier,
  buildGuardTower,
  buildHowitzerGun,
  buildHueyHelicopter,
  buildMortarEmplacement,
  buildPalmCrownGeometry,
  buildSandbagWall,
  buildViewmodelWeapon,
  buildWoodenBridge,
  type EnemyModelHandle,
  type HowitzerHandle,
  type HueyHandle,
  type ViewmodelHandle,
} from './models';
import {
  BRIDGE_X,
  createSandbagTexture,
  createTerrainMesh,
  createTropicalSkyDome,
  createWaterMesh,
  createWoodTexture,
  deformTerrainCrater,
  distToRiver,
  groundHeightAt,
  HOWITZER_BATTERY_POS,
  isInRiver,
  LZ_BRAVO_POS,
  PLAYABLE_RADIUS,
  restoreTerrainCraters,
  riverCenterZ,
  riverHalfWidth,
  SECTOR_ALPHA_POS,
  SECTOR_CHARLIE_POS,
  WATER_LEVEL,
  getTerrainZoneAt,
  type SkyDomeHandle,
} from './terrain';
import {
  CAMPAIGN_FACTIONS,
  CLASS_SKILL_TREES,
  HEADGEAR_OPTIONS,
  MILITARY_UNIFORMS,
  SOLDIER_CLASSES,
  TACTICAL_RIGS,
  WEAPON_SPECS,
  type ArtilleryBatteryInfo,
  type BoltPartId,
  type CampaignFactionId,
  type CampaignState,
  type CharacterLoadoutConfig,
  type CustomCamoConfig,
  type DailyMissionMetric,
  type DailyMissionState,
  type GamePhase,
  type GraphicsQuality,
  type HeadgearId,
  type HowitzerGunState,
  type HudSnapshot,
  type MuzzleAttachment,
  type ObjectiveState,
  type OpticAttachment,
  type QuestId,
  type RpgAttributeKey,
  type RpgAttributes,
  type RpgPerkId,
  type RpgPerks,
  type RpgQuestState,
  type SheafPattern,
  type ShellType,
  type SkillTreeNodeId,
  type SoldierClassId,
  type SpringPartId,
  type TacticalRigId,
  type TerrainZoneId,
  type TouchInputState,
  type TriggerPartId,
  type UnderbarrelAttachment,
  type UniformCamoId,
  type WeaponId,
  type WeaponPaintId,
  type WeaponPresetLoadout,
  type WeaponRuntimeState,
  type WeatherKind,
  type XpEventInfo,
} from './types';
import { generateCampaign, rethemeCampaignStagesForFaction } from './campaign';
import { generateDailyMissions, getLocalDateKey } from './dailyMissions';

const XP_STORAGE_KEY = 'vietnam_war_career_xp_v1';
const RPG_PROFILE_KEY = 'vietnam_war_rpg_profile_v1';
const DAILY_MISSIONS_KEY = 'vietnam_war_daily_missions_v1';
const CHAR_LOADOUT_KEY = 'vietnam_war_char_loadout_v1';
const CUSTOM_CAMO_STORAGE_KEY = 'vietnam_war_custom_camo_v1';
const CAMPAIGN_STORAGE_KEY = 'vietnam_war_campaign_v1';
const PROXIMITY_VOICE_KEY = 'vietnam_war_proximity_voice_v1';

const RANK_LADDER: { minXp: number; title: string }[] = [
  { minXp: 0, title: 'PVT E-1' },
  { minXp: 200, title: 'PFC E-3' },
  { minXp: 500, title: 'CPL E-4' },
  { minXp: 900, title: 'SGT E-5' },
  { minXp: 1400, title: 'SSG E-6' },
  { minXp: 2000, title: 'SFC E-7' },
  { minXp: 2700, title: '2LT O-1' },
  { minXp: 3500, title: '1LT O-2' },
  { minXp: 4400, title: 'CPT O-3' },
  { minXp: 5400, title: 'MAJ O-4' },
];

// Pre-allocated scratch math helpers (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _color = new THREE.Color();
const _v4Color = new THREE.Color();
const _v4Color2 = new THREE.Color();
const _obsOrigin = new THREE.Vector3();
const _obsDir = new THREE.Vector3();
const _obsTmp = new THREE.Vector3();
const _obsRayHit = new THREE.Vector3();

interface CircleCollider {
  x: number;
  z: number;
  r: number;
}

interface EnemyActor {
  id: number;
  model: EnemyModelHandle;
  role: 'rifleman' | 'flanker' | 'suppressor' | 'grenadier' | 'commander';
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  deathTimer: number;
  sector: 'alpha' | 'charlie' | 'patrol' | 'extract';
  homeX: number;
  homeZ: number;
  patrolWaypointX: number;
  patrolWaypointZ: number;
  patrolPauseTimer: number;
  patrolScanPhase: number;
  state: 'patrol' | 'investigate' | 'engage' | 'flank' | 'suppress_pin' | 'bound' | 'retreat' | 'reloading';
  posture: 'stand' | 'crouch';
  crouchBlend: number;
  suppression: number;
  ammoInMag: number;
  reloadTimer: number;
  coverX: number | null;
  coverZ: number | null;
  lastKnownX: number;
  lastKnownZ: number;
  searchTimer: number;
  tacticTimer: number;
  fireCooldown: number;
  windupTimer: number;
  burstLeft: number;
  strafeDir: number;
  strafeTimer: number;
  hitFlashTimer: number;
  walkPhase: number;
  breath: number;
  drownBubbleTimer: number;
  hasLos: boolean;
  hasHeadOnlyLos: boolean;
  losTimer: number;
  lastSeenPlayerTime: number;
  grenadeCount: number;
  grenadeCooldown: number;
  healUsed: boolean;
  healTimer: number;
  commandCooldown: number;
  coverStayTimer: number;
}

interface TracerBullet {
  mesh: THREE.Mesh;
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  fromPlayer: boolean;
  damage: number;
}

interface ParticleSpark {
  mesh: THREE.Mesh;
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
}

interface ActiveGrenade {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  fromEnemy: boolean;
}

interface BlastEffect {
  active: boolean;
  age: number;
  maxAge: number;
  maxRadius: number;
  isWp: boolean;
  shockwave: THREE.Mesh;
  fireball: THREE.Mesh;
  smoke: THREE.Mesh;
  light: THREE.PointLight;
}

interface ShrapnelFragment {
  active: boolean;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  groundPuffDone: boolean;
}

export class VietnamGameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onPhaseChange: (phase: GamePhase) => void;
  private audio = new TacticalAudioEngine();
  private simPointmanPos = new THREE.Vector3(LZ_BRAVO_POS.x - 8, 0, LZ_BRAVO_POS.z + 6);
  private simRtoPos = new THREE.Vector3(LZ_BRAVO_POS.x + 9, 0, LZ_BRAVO_POS.z + 7);
  private squadChatterCooldown = 4.2;
  private enemyRadioChatterCooldown = 3.5;
  private lastEnemyRadioTime = -10;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private weaponCamera!: THREE.PerspectiveCamera;
  private weaponScene!: THREE.Scene;
  private isSoftwareGl = false;
  private isMobileDevice = false;
  private graphicsQuality: GraphicsQuality = 'auto';
  private contextLost = false;
  private disposed = false;
  private frameId = 0;
  private lastTime = 0;
  private hudEmitAccum = 0;

  // World handles
  private huey!: HueyHandle;
  private skyDome!: SkyDomeHandle;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private nightTorch!: THREE.PointLight;
  private fogExp!: THREE.FogExp2;
  private bgColor = new THREE.Color('#5a6b54');
  private waterTex!: THREE.CanvasTexture;
  private dustPoints!: THREE.Points;
  private dustBasePositions!: Float32Array;
  private rainLines!: THREE.LineSegments;
  private rainOffsets!: Float32Array;
  private rainCount = 340;
  private terrainMesh!: THREE.Mesh;
  private grassInstanced!: THREE.InstancedMesh;
  private grassInstances: {
    x: number;
    y: number;
    z: number;
    rotY: number;
    scale: number;
    blasted: boolean;
  }[] = [];
  private mortarDrumMesh!: THREE.Mesh;
  private mortarGroup!: THREE.Group;
  private alphaTowerGroup!: THREE.Group;
  private mortarCollider!: CircleCollider;
  private alphaTowerCollider!: CircleCollider;
  private bunkerGroup!: THREE.Group;
  private bunkerCollider!: CircleCollider;
  private charlieAmmoGroup!: THREE.Group;
  private charlieAmmoEntry!: { x: number; z: number };
  private activeAlphaPos = { x: SECTOR_ALPHA_POS.x, z: SECTOR_ALPHA_POS.z };
  private activeCharliePos = { x: SECTOR_CHARLIE_POS.x, z: SECTOR_CHARLIE_POS.z };
  private mortarDestroyed = false;
  private colliders: CircleCollider[] = [];
  private ammoCrates: { x: number; z: number }[] = [];
  private armoryPos = { x: 4.8, z: LZ_BRAVO_POS.z - 5.2 };
  private fdcPos = { x: HOWITZER_BATTERY_POS.x + 6.5, z: HOWITZER_BATTERY_POS.z + 4.5 };

  // Custom Paint & Uniform Studio Configs + Procedural Campaign State
  private customWeaponCamo: CustomCamoConfig = {
    name: 'Custom Weapon Coat',
    pattern: 'tiger',
    finish: 'candy',
    primaryHex: '#6b1c1c',
    secondaryHex: '#1b1d1a',
    accentHex: '#c89b3c',
    favoredTerrain: 'jungle',
  };
  private customUniformCamo: CustomCamoConfig = {
    name: 'Custom Field Fatigues',
    pattern: 'tiger',
    finish: 'matte',
    primaryHex: '#4f5d38',
    secondaryHex: '#252b1c',
    accentHex: '#b38b42',
    favoredTerrain: 'jungle',
  };
  private campaignState!: CampaignState;

  // Dynamic Day/Night & Weather State
  private hour24 = 7.5; // Starts 07:30 morning light
  private timeSpeedMult = 1.0; // 1.0 = 15s per game hour (6m full 24h cycle)
  private weather: WeatherKind = 'CLEAR';
  private weatherOverride: WeatherKind | 'AUTO' = 'AUTO';
  private weatherTimer = 46;
  private rainIntensity = 0;
  private lightningFlash = 0;
  private lightningCooldown = 14;

  // Career XP, RPG Classes, Attributes, Perks & Quests
  private careerXp = 0;
  private careerLevel = 1;
  private xpEventCounter = 0;
  private recentXpEvent: XpEventInfo | null = null;
  private recentXpTimer = 0;
  private soldierClass: SoldierClassId = 'rifleman';
  private rpgAttributes: RpgAttributes = { grit: 0, agility: 0, marksmanship: 0, command: 0 };
  private rpgPerks: RpgPerks = { field_medic: 0, scavenger: 0, danger_close: 0, deadeye: 0 };
  private unlockedSkillNodes = new Set<SkillTreeNodeId>();
  private bonusAttributePoints = 0;
  private bonusSkillPoints = 0;
  private totalQuestsCompleted = 0;
  private quests: RpgQuestState[] = [];
  private questArmoryTuned = false;
  private questArtyFired = false;
  private dailyDateKey = getLocalDateKey();
  private dailyRerollCount = 0;
  private dailyMissions: DailyMissionState[] = [];
  private totalDailyCompleted = 0;

  // Character Loadouts (3 persistent slots: Uniform Camo, Tactical Rig, Headgear, Weapon Kits)
  private activeLoadoutSlot = 0;
  private loadoutSlots: CharacterLoadoutConfig[] = [];

  // Heavy Field Howitzer Squad & Artillery Officer State
  private howitzers: {
    handle: HowitzerHandle;
    x: number;
    y: number;
    z: number;
    state: HowitzerGunState;
    recoilOffset: number;
    muzzleTimer: number;
    fireDelay: number;
    pendingTargetX: number;
    pendingTargetZ: number;
    pendingIsWp: boolean;
    targetYaw: number;
    targetPitch: number;
  }[] = [];
  private incomingShells: {
    mesh: THREE.Mesh;
    startPos: THREE.Vector3;
    targetX: number;
    targetZ: number;
    targetY: number;
    elapsed: number;
    flightDuration: number;
    isWp: boolean;
    whistlePlayed: boolean;
  }[] = [];
  private officerActive = false;
  private binocularZoom = false;
  private shellType: ShellType = 'HE';
  private sheafPattern: SheafPattern = 'CONVERGE';
  private artyTargetX: number | null = null;
  private artyTargetZ: number | null = null;
  private artyEtaSec: number | null = null;
  private artySalvosFired = 0;
  private artyKills = 0;

  // Viewmodels
  private viewmodels!: Record<WeaponId, ViewmodelHandle>;
  private activeWeapon: WeaponId = 'm16a1';
  private weaponStates!: Record<WeaponId, WeaponRuntimeState>;

  // Combat pools
  private enemies: EnemyActor[] = [];
  private enemyHitTargets: THREE.Object3D[] = [];
  private solidCoverObjects: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private losRaycaster = new THREE.Raycaster();
  private tracers: TracerBullet[] = [];
  private particles: ParticleSpark[] = [];
  private grenades: ActiveGrenade[] = [];
  private blastEffects: BlastEffect[] = [];
  private shrapnelPool: ShrapnelFragment[] = [];

  // Player state
  private phase: GamePhase = 'title';
  private playerPos = new THREE.Vector3(LZ_BRAVO_POS.x, 0, LZ_BRAVO_POS.z);
  private playerVel = new THREE.Vector3();
  private yaw = 0; // 0 = -Z (North)
  private pitch = 0;
  private health = 100;
  private maxHealth = 100;
  private stamina = 100;
  private bleeding = false;
  private bandages = 3;
  private bandagingTimer = 0;
  private lastBandageDuration = 1.6;
  private grenadeCount = 3;
  private isCrouching = false;
  private isSprinting = false;
  private isAds = false;
  private adsBlend = 0;
  private isReloading = false;
  private reloadTimer = 0;
  private fireCooldown = 0;
  private semiTriggerConsumed = false;
  private recoilPitchOffset = 0;
  private recoilYawOffset = 0;
  private weaponKickZ = 0;
  private muzzleFlashTimer = 0;
  private bobPhase = 0;
  private footstepAccum = 0;
  private cameraShake = 0;
  private hitstopTimer = 0;
  private hitMarkerTimer = 0;
  private hitMarkerKill = false;
  private damageFlash = 0;
  private damageAngleRad: number | null = null;
  private statusBanner: string | null = null;
  private statusBannerTimer = 0;

  // Mission progression
  private objectives: ObjectiveState[] = [];
  private extractCountdown: number | null = null;
  private extractWaveSpawned = false;
  private kills = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private elapsedSec = 0;
  private titleOrbitTime = 0;

  // Distant Artillery & Counter-Battery Sound-Ranging
  private batteries: {
    info: ArtilleryBatteryInfo;
    nextShotIn: number;
    strikeFlightTimer: number;
  }[] = [];
  private activeBatteryId: string | null = null;
  private strikeCooldownSec = 0;
  private horizonFlashMesh!: THREE.Mesh;
  private horizonFlashTimer = 0;

  // Input state
  private heldKeys = new Set<string>();
  private mouseFireHeld = false;
  private mouseAdsHeld = false;
  private pointerLocked = false;
  private sensitivity = 1.0;
  private touchInput: TouchInputState = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    firing: false,
  };
  private touchAdsToggled = false;
  private nearbyPrompt: string | null = null;
  private nearbyActionType: 'resupply' | 'objective' | 'extract' | 'armory' | 'fdc' | null = null;
  private uiTriggerHandler: ((action: 'armory' | 'map' | 'rpg') => void) | null = null;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onPhaseChange: (phase: GamePhase) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onPhaseChange = onPhaseChange;

    this.loadCareerXp();
    this.loadCustomCamos();
    this.loadCampaignState();
    this.loadCharacterLoadouts();
    this.loadProximityVoiceSetting();
    this.initRendererAndScene();
    this.buildWorld();
    this.buildViewmodels();
    this.initPools();
    this.resetMissionState('title');
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTime = performance.now();
    this.startLoop();
  }

  private initRendererAndScene(): void {
    this.isMobileDevice =
      /android|mobile|tablet|ipad|iphone/i.test(navigator.userAgent) ||
      window.matchMedia('(pointer: coarse)').matches ||
      (navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches);

    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !this.isMobileDevice,
      powerPreference: 'high-performance',
    });
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight,
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.autoClear = false;
    this.container.appendChild(this.renderer.domElement);

    const aspect =
      (this.container.clientWidth || window.innerWidth) /
      Math.max(1, this.container.clientHeight || window.innerHeight);

    this.scene = new THREE.Scene();
    this.bgColor.set('#5a6b54');
    this.scene.background = this.bgColor;
    this.fogExp = new THREE.FogExp2(this.bgColor.getHex(), 0.0085);
    this.scene.fog = this.fogExp;

    this.camera = new THREE.PerspectiveCamera(74, aspect, 0.12, 340);

    // Studio/outdoor PMREM reflection map on every device
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm tropical sun/moon key light + cool humid hemisphere fill
    this.sunLight = new THREE.DirectionalLight(0xffe7bd, 2.2);
    this.sunLight.position.set(65, 95, 42);
    const d = 115;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 260;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.applyGraphicsQuality();

    this.hemiLight = new THREE.HemisphereLight(0x9bb8b3, 0x3b4029, 0.95);
    this.scene.add(this.hemiLight);

    this.rimLight = new THREE.DirectionalLight(0xa7c5c9, 0.45);
    this.rimLight.position.set(-70, 45, -65);
    this.scene.add(this.rimLight);

    // Subtle tactical helmet illumination for night operations
    this.nightTorch = new THREE.PointLight(0xffe6ba, 0, 26, 1.4);
    this.scene.add(this.nightTorch);

    // Dedicated overlay scene for first-person weapon viewmodel (prevents wall clipping)
    this.weaponScene = new THREE.Scene();
    this.weaponScene.environment = this.scene.environment;
    this.weaponCamera = new THREE.PerspectiveCamera(60, aspect, 0.04, 10);
    const wSun = new THREE.DirectionalLight(0xffe9c8, 1.9);
    wSun.position.set(2, 4, 3);
    this.weaponScene.add(wSun);
    this.weaponScene.add(new THREE.HemisphereLight(0xa4b8af, 0x383d2a, 1.0));
  }

  private buildWorld(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const sandbagTex = createSandbagTexture(maxAniso);
    const woodTex = createWoodTexture(maxAniso);

    // Dynamic Tropical Sky Dome & Sun/Moon Discs
    this.skyDome = createTropicalSkyDome();
    this.scene.add(this.skyDome.group);

    // Terrain & River Water
    this.terrainMesh = createTerrainMesh(maxAniso);
    this.scene.add(this.terrainMesh);
    const water = createWaterMesh();
    this.scene.add(water.mesh);
    this.waterTex = water.texture;

    // Monsoon Rain Streaks (LineSegments wrapped around player position)
    const rainPos = new Float32Array(this.rainCount * 6);
    this.rainOffsets = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainOffsets[i * 3] = (Math.random() - 0.5) * 34;
      this.rainOffsets[i * 3 + 1] = Math.random() * 16;
      this.rainOffsets[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xbdd0d8,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.visible = false;
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);

    // Drifting sunlit jungle pollen/dust motes
    const moteCount = 220;
    const motePositions = new Float32Array(moteCount * 3);
    this.dustBasePositions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const mx = (Math.random() - 0.5) * PLAYABLE_RADIUS * 1.5;
      const mz = (Math.random() - 0.5) * PLAYABLE_RADIUS * 1.5;
      const my = groundHeightAt(mx, mz) + 0.8 + Math.random() * 5.2;
      motePositions[i * 3] = mx;
      motePositions[i * 3 + 1] = my;
      motePositions[i * 3 + 2] = mz;
      this.dustBasePositions[i * 3] = mx;
      this.dustBasePositions[i * 3 + 1] = my;
      this.dustBasePositions[i * 3 + 2] = mz;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xf4e3b8,
      size: 0.14,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(moteGeo, moteMat);
    this.scene.add(this.dustPoints);

    // LZ Bravo: Huey Helicopter + Firebase Perimeter + Ammo Resupply
    this.solidCoverObjects = [];
    const lzY = groundHeightAt(LZ_BRAVO_POS.x, LZ_BRAVO_POS.z);
    this.huey = buildHueyHelicopter(this.isSoftwareGl);
    this.huey.group.position.set(-8, groundHeightAt(-8, LZ_BRAVO_POS.z - 6), LZ_BRAVO_POS.z - 6);
    this.huey.group.rotation.y = -0.55;
    this.scene.add(this.huey.group);
    this.huey.group.updateMatrixWorld(true);
    for (const child of this.huey.group.children) {
      if (child !== this.huey.mainRotor && child !== this.huey.tailRotor) {
        this.solidCoverObjects.push(child);
      }
    }
    this.colliders.push({ x: -8, z: LZ_BRAVO_POS.z - 6, r: 3.1 });

    // LZ Bravo sandbag defensive arcs
    for (const [ox, oz, rot] of [
      [0, -10, 0],
      [7, -6, -0.7],
      [-7, 6, 0.4],
    ] as const) {
      const wall = buildSandbagWall(4.8, 3, sandbagTex);
      const wx = LZ_BRAVO_POS.x + ox;
      const wz = LZ_BRAVO_POS.z + oz;
      wall.position.set(wx, groundHeightAt(wx, wz), wz);
      wall.rotation.y = rot;
      this.scene.add(wall);
      wall.updateMatrixWorld(true);
      this.solidCoverObjects.push(wall);
      this.colliders.push({ x: wx, z: wz, r: 1.9 });
    }

    // LZ Bravo Guard Tower
    const lzTower = buildGuardTower(woodTex, sandbagTex);
    lzTower.position.set(11, groundHeightAt(11, LZ_BRAVO_POS.z - 4), LZ_BRAVO_POS.z - 4);
    this.scene.add(lzTower);
    lzTower.updateMatrixWorld(true);
    this.solidCoverObjects.push(lzTower);
    this.colliders.push({ x: 11, z: LZ_BRAVO_POS.z - 4, r: 1.8 });

    // LZ Bravo Ammo Crate
    const lzAmmo = buildAmmoCrate(woodTex);
    lzAmmo.position.set(3.2, lzY, LZ_BRAVO_POS.z - 4.2);
    lzAmmo.rotation.y = 0.3;
    this.scene.add(lzAmmo);
    lzAmmo.updateMatrixWorld(true);
    this.solidCoverObjects.push(lzAmmo);
    this.ammoCrates.push({ x: 3.2, z: LZ_BRAVO_POS.z - 4.2 });

    // Wooden Footbridge across the Mekong Tributary
    const bridgeZ = riverCenterZ(BRIDGE_X);
    const bridge = buildWoodenBridge(woodTex, 26);
    bridge.position.set(BRIDGE_X, -0.35, bridgeZ);
    this.scene.add(bridge);
    bridge.updateMatrixWorld(true);
    this.solidCoverObjects.push(bridge);

    // Sector Alpha: Mortar Ridge (relocated dynamically per campaign stage)
    const alphaY = groundHeightAt(SECTOR_ALPHA_POS.x, SECTOR_ALPHA_POS.z);
    const mortar = buildMortarEmplacement(sandbagTex);
    mortar.position.set(SECTOR_ALPHA_POS.x, alphaY, SECTOR_ALPHA_POS.z);
    this.scene.add(mortar);
    mortar.updateMatrixWorld(true);
    this.solidCoverObjects.push(mortar);
    this.mortarGroup = mortar;
    this.mortarCollider = { x: SECTOR_ALPHA_POS.x, z: SECTOR_ALPHA_POS.z, r: 2.3 };
    this.colliders.push(this.mortarCollider);

    // Track the ordnance drum inside mortar group for shooting/detonation
    this.mortarDrumMesh = mortar.children[mortar.children.length - 1] as THREE.Mesh;

    const alphaTower = buildGuardTower(woodTex, sandbagTex);
    alphaTower.position.set(
      SECTOR_ALPHA_POS.x - 8,
      groundHeightAt(SECTOR_ALPHA_POS.x - 8, SECTOR_ALPHA_POS.z - 6),
      SECTOR_ALPHA_POS.z - 6,
    );
    this.scene.add(alphaTower);
    alphaTower.updateMatrixWorld(true);
    this.solidCoverObjects.push(alphaTower);
    this.alphaTowerGroup = alphaTower;
    this.alphaTowerCollider = { x: SECTOR_ALPHA_POS.x - 8, z: SECTOR_ALPHA_POS.z - 6, r: 1.8 };
    this.colliders.push(this.alphaTowerCollider);

    // Sector Charlie: Comms Bunker (relocated dynamically per campaign stage)
    const charlieY = groundHeightAt(SECTOR_CHARLIE_POS.x, SECTOR_CHARLIE_POS.z);
    const bunker = buildBunkerComplex(woodTex, sandbagTex);
    bunker.position.set(SECTOR_CHARLIE_POS.x, charlieY, SECTOR_CHARLIE_POS.z);
    bunker.rotation.y = -0.35;
    this.scene.add(bunker);
    bunker.updateMatrixWorld(true);
    this.solidCoverObjects.push(bunker);
    this.bunkerGroup = bunker;
    this.bunkerCollider = { x: SECTOR_CHARLIE_POS.x, z: SECTOR_CHARLIE_POS.z, r: 3.4 };
    this.colliders.push(this.bunkerCollider);

    const charlieAmmo = buildAmmoCrate(woodTex);
    charlieAmmo.position.set(SECTOR_CHARLIE_POS.x + 5.2, groundHeightAt(SECTOR_CHARLIE_POS.x + 5.2, SECTOR_CHARLIE_POS.z + 4), SECTOR_CHARLIE_POS.z + 4);
    this.scene.add(charlieAmmo);
    charlieAmmo.updateMatrixWorld(true);
    this.solidCoverObjects.push(charlieAmmo);
    this.charlieAmmoGroup = charlieAmmo;
    this.charlieAmmoEntry = { x: SECTOR_CHARLIE_POS.x + 5.2, z: SECTOR_CHARLIE_POS.z + 4 };
    this.ammoCrates.push(this.charlieAmmoEntry);

    // LZ Bravo Armory Workbench Crate
    const armoryCrate = buildAmmoCrate(woodTex);
    armoryCrate.scale.set(1.35, 1.15, 1.15);
    armoryCrate.position.set(
      this.armoryPos.x,
      groundHeightAt(this.armoryPos.x, this.armoryPos.z),
      this.armoryPos.z,
    );
    armoryCrate.rotation.y = -0.35;
    this.scene.add(armoryCrate);
    armoryCrate.updateMatrixWorld(true);
    this.solidCoverObjects.push(armoryCrate);
    this.colliders.push({ x: this.armoryPos.x, z: this.armoryPos.z, r: 1.05 });

    // Firebase Howitzer Squad: 3x M114 155mm Heavy Field Howitzers ("THUNDER 1-3")
    const gunOffsets: [number, number][] = [
      [-7.5, -1.5],
      [0, -3.5],
      [7.5, -1.5],
    ];
    gunOffsets.forEach(([ox, oz], idx) => {
      const gx = HOWITZER_BATTERY_POS.x + ox;
      const gz = HOWITZER_BATTERY_POS.z + oz;
      const gy = groundHeightAt(gx, gz);
      const handle = buildHowitzerGun(sandbagTex);
      handle.group.position.set(gx, gy, gz);
      this.scene.add(handle.group);
      handle.group.updateMatrixWorld(true);
      this.solidCoverObjects.push(handle.group);
      this.colliders.push({ x: gx, z: gz, r: 2.5 });
      this.howitzers.push({
        handle,
        x: gx,
        y: gy,
        z: gz,
        state: {
          id: idx + 1,
          callsign: `THUNDER-${idx + 1}`,
          status: 'READY',
          reloadLeftSec: 0,
          azimuthDeg: 0,
          elevationDeg: 28,
        },
        recoilOffset: 0,
        muzzleTimer: 0,
        fireDelay: -1,
        pendingTargetX: 0,
        pendingTargetZ: 0,
        pendingIsWp: false,
        targetYaw: 0,
        targetPitch: 0.48,
      });
    });

    // FDC Command Radio Crate near the Howitzer Squad
    const fdcCrate = buildAmmoCrate(woodTex);
    fdcCrate.position.set(
      this.fdcPos.x,
      groundHeightAt(this.fdcPos.x, this.fdcPos.z),
      this.fdcPos.z,
    );
    fdcCrate.rotation.y = 0.5;
    this.scene.add(fdcCrate);
    fdcCrate.updateMatrixWorld(true);
    this.solidCoverObjects.push(fdcCrate);
    this.colliders.push({ x: this.fdcPos.x, z: this.fdcPos.z, r: 0.9 });

    // Instanced Jungle Vegetation & Boulders (zero-404, multi-frond palm crowns + broadleaf + rocks)
    this.populateJungleInstancing();
  }

  private populateJungleInstancing(): void {
    const palmCount = 260;
    const canopyCount = 210;
    const rockCount = 95;
    const grassCount = 520;

    // 1. Palm trunks & multi-frond palm crowns (InstancedMesh)
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.28, 7.6, 7);
    trunkGeo.translate(0, 3.8, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x614933, roughness: 0.92, metalness: 0.02 });
    const palmTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
    palmTrunks.castShadow = true;
    palmTrunks.receiveShadow = true;

    const crownGeo = buildPalmCrownGeometry();
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.02 });
    const palmCrowns = new THREE.InstancedMesh(crownGeo, crownMat, palmCount);
    palmCrowns.castShadow = true;

    // 2. Broadleaf Jungle Trees
    const bTrunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 5.4, 7);
    bTrunkGeo.translate(0, 2.7, 0);
    const bTrunks = new THREE.InstancedMesh(bTrunkGeo, trunkMat, canopyCount);
    bTrunks.castShadow = true;

    const bFoliageGeo = new THREE.DodecahedronGeometry(2.9, 1);
    bFoliageGeo.translate(0, 6.2, 0);
    const bFoliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.02 });
    const bCrowns = new THREE.InstancedMesh(bFoliageGeo, bFoliageMat, canopyCount);
    bCrowns.castShadow = true;

    // 3. Boulders
    const rockGeo = new THREE.DodecahedronGeometry(1.15, 0);
    rockGeo.translate(0, 0.45, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c5d54, roughness: 0.92, metalness: 0.05 });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;

    // 4. Elephant grass tufts
    const grassGeo = new THREE.ConeGeometry(0.45, 1.35, 5);
    grassGeo.translate(0, 0.65, 0);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.0 });
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);

    const dummy = new THREE.Object3D();
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const isClearZone = (x: number, z: number): boolean => {
      if (Math.hypot(x - LZ_BRAVO_POS.x, z - LZ_BRAVO_POS.z) < 16) return true;
      if (Math.hypot(x - HOWITZER_BATTERY_POS.x, z - HOWITZER_BATTERY_POS.z) < 16) return true;
      if (Math.hypot(x - SECTOR_ALPHA_POS.x, z - SECTOR_ALPHA_POS.z) < 13) return true;
      if (Math.hypot(x - SECTOR_CHARLIE_POS.x, z - SECTOR_CHARLIE_POS.z) < 13) return true;
      if (Math.hypot(x - BRIDGE_X, z - riverCenterZ(BRIDGE_X)) < 11) return true;
      if (isInRiver(x, z)) return true;
      return false;
    };

    const sampleSpot = (minR = 8, maxR = PLAYABLE_RADIUS + 28): [number, number] => {
      for (let attempt = 0; attempt < 25; attempt++) {
        const ang = rand() * Math.PI * 2;
        const rad = minR + Math.sqrt(rand()) * (maxR - minR);
        const x = Math.cos(ang) * rad;
        const z = Math.sin(ang) * rad;
        if (!isClearZone(x, z)) return [x, z];
      }
      return [95, 95];
    };

    for (let i = 0; i < palmCount; i++) {
      const [x, z] = sampleSpot();
      const y = groundHeightAt(x, z);
      const s = 0.85 + rand() * 0.35;
      dummy.position.set(x, y - 0.1, z);
      dummy.rotation.set((rand() - 0.5) * 0.18, rand() * Math.PI * 2, (rand() - 0.5) * 0.18);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      palmTrunks.setMatrixAt(i, dummy.matrix);
      palmCrowns.setMatrixAt(i, dummy.matrix);
      _color.setHSL(0.26 + rand() * 0.04, 0.42, 0.24 + rand() * 0.08);
      palmCrowns.setColorAt(i, _color);
      if (Math.hypot(x, z) < PLAYABLE_RADIUS) {
        this.colliders.push({ x, z, r: 0.48 * s });
      }
    }

    for (let i = 0; i < canopyCount; i++) {
      const [x, z] = sampleSpot(14, PLAYABLE_RADIUS + 34);
      const y = groundHeightAt(x, z);
      const s = 0.82 + rand() * 0.42;
      dummy.position.set(x, y - 0.1, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      bTrunks.setMatrixAt(i, dummy.matrix);
      bCrowns.setMatrixAt(i, dummy.matrix);
      _color.setHSL(0.24 + rand() * 0.06, 0.38, 0.2 + rand() * 0.08);
      bCrowns.setColorAt(i, _color);
      if (Math.hypot(x, z) < PLAYABLE_RADIUS) {
        this.colliders.push({ x, z, r: 0.58 * s });
      }
    }

    for (let i = 0; i < rockCount; i++) {
      const [x, z] = sampleSpot(12, PLAYABLE_RADIUS + 18);
      const y = groundHeightAt(x, z);
      const s = 0.75 + rand() * 0.9;
      dummy.position.set(x, y - 0.15, z);
      dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      dummy.scale.set(s * 1.2, s * 0.85, s);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      if (Math.hypot(x, z) < PLAYABLE_RADIUS && s > 1.0) {
        this.colliders.push({ x, z, r: 0.95 * s });
      }
    }

    this.grassInstances = [];
    for (let i = 0; i < grassCount; i++) {
      const [x, z] = sampleSpot(5, PLAYABLE_RADIUS);
      const y = groundHeightAt(x, z);
      const s = 0.7 + rand() * 0.75;
      const rotY = rand() * Math.PI * 2;
      dummy.position.set(x, y - 0.05, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      _color.setHSL(0.24 + rand() * 0.05, 0.36, 0.28 + rand() * 0.1);
      grass.setColorAt(i, _color);
      this.grassInstances.push({ x, y, z, rotY, scale: s, blasted: false });
    }
    this.grassInstanced = grass;

    [palmTrunks, palmCrowns, bTrunks, bCrowns, rocks, grass].forEach((im) => {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.scene.add(im);
      im.updateMatrixWorld(true);
    });
    // Tree trunks & boulders block line-of-sight and gunfire; leafy crowns & grass remain penetrable
    this.solidCoverObjects.push(palmTrunks, bTrunks, rocks);
  }

  private buildViewmodels(): void {
    this.viewmodels = {
      m16a1: buildViewmodelWeapon('m16a1'),
      m60: buildViewmodelWeapon('m60'),
      m1911: buildViewmodelWeapon('m1911'),
    };
    (Object.keys(this.viewmodels) as WeaponId[]).forEach((id) => {
      const vm = this.viewmodels[id];
      vm.root.visible = id === this.activeWeapon;
      this.weaponScene.add(vm.root);
    });
  }

  private initPools(): void {
    const tracerGeo = new THREE.BoxGeometry(0.045, 0.045, 0.9);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd275 });
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(tracerGeo, tracerMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({
        mesh,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        fromPlayer: true,
        damage: 0,
      });
    }

    const sparkGeo = new THREE.DodecahedronGeometry(0.14, 0);
    for (let i = 0; i < 72; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xd99b52, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(sparkGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        scale: 1,
      });
    }

    // Horizon artillery flash glow sprite/mesh
    this.horizonFlashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa43b, transparent: true, opacity: 0.85 }),
    );
    this.horizonFlashMesh.visible = false;
    this.scene.add(this.horizonFlashMesh);

    // Multi-layer artillery & ordnance blast pool
    const shockGeo = new THREE.RingGeometry(0.65, 1.0, 28);
    shockGeo.rotateX(-Math.PI / 2);
    const fireballGeo = new THREE.SphereGeometry(1, 14, 12);
    const smokeGeo = new THREE.DodecahedronGeometry(1.15, 1);

    for (let i = 0; i < 8; i++) {
      const shockwave = new THREE.Mesh(
        shockGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffd194,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      shockwave.visible = false;
      this.scene.add(shockwave);

      const fireball = new THREE.Mesh(
        fireballGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff7b1c,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      fireball.visible = false;
      this.scene.add(fireball);

      const smoke = new THREE.Mesh(
        smokeGeo,
        new THREE.MeshBasicMaterial({
          color: 0x24201c,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
        }),
      );
      smoke.visible = false;
      this.scene.add(smoke);

      const light = new THREE.PointLight(0xff8e36, 0, 38, 1.6);
      light.visible = false;
      this.scene.add(light);

      this.blastEffects.push({
        active: false,
        age: 0,
        maxAge: 1.8,
        maxRadius: 12,
        isWp: false,
        shockwave,
        fireball,
        smoke,
        light,
      });
    }

    // Physical jagged shrapnel fragments pool
    const shardGeo = new THREE.TetrahedronGeometry(0.11, 0);
    shardGeo.scale(1.8, 0.55, 0.9);
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffb357 });
      const mesh = new THREE.Mesh(shardGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shrapnelPool.push({
        active: false,
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        groundPuffDone: false,
      });
    }
  }

  public resetMissionState(targetPhase: GamePhase = 'playing'): void {
    // Clear existing enemies & grenades
    for (const e of this.enemies) {
      this.scene.remove(e.model.group);
    }
    this.enemies = [];
    this.enemyHitTargets = [];
    for (const g of this.grenades) {
      this.scene.remove(g.mesh);
    }
    this.grenades = [];

    for (const s of this.incomingShells) {
      this.scene.remove(s.mesh);
    }
    this.incomingShells = [];
    for (const b of this.blastEffects) {
      b.active = false;
      b.shockwave.visible = false;
      b.fireball.visible = false;
      b.smoke.visible = false;
      b.light.visible = false;
      b.light.intensity = 0;
    }
    for (const sh of this.shrapnelPool) {
      sh.active = false;
      sh.mesh.visible = false;
    }
    if (this.terrainMesh) {
      restoreTerrainCraters(this.terrainMesh);
    }
    if (this.grassInstanced && this.grassInstances.length > 0) {
      const dummy = new THREE.Object3D();
      let restoredAny = false;
      for (let i = 0; i < this.grassInstances.length; i++) {
        const g = this.grassInstances[i];
        if (!g.blasted) continue;
        g.blasted = false;
        dummy.position.set(g.x, g.y - 0.05, g.z);
        dummy.rotation.set(0, g.rotY, 0);
        dummy.scale.set(g.scale, g.scale, g.scale);
        dummy.updateMatrix();
        this.grassInstanced.setMatrixAt(i, dummy.matrix);
        restoredAny = true;
      }
      if (restoredAny) {
        this.grassInstanced.instanceMatrix.needsUpdate = true;
      }
    }
    this.officerActive = false;
    this.binocularZoom = false;
    this.artyTargetX = null;
    this.artyTargetZ = null;
    this.artyEtaSec = null;
    this.artySalvosFired = 0;
    this.artyKills = 0;
    for (const g of this.howitzers) {
      g.state.status = 'READY';
      g.state.reloadLeftSec = 0;
      g.recoilOffset = 0;
      g.muzzleTimer = 0;
      g.fireDelay = 0;
      g.handle.muzzleFlash.visible = false;
    }

    this.mortarDestroyed = false;
    this.mortarDrumMesh.visible = true;

    this.playerPos.set(LZ_BRAVO_POS.x, groundHeightAt(LZ_BRAVO_POS.x, LZ_BRAVO_POS.z), LZ_BRAVO_POS.z);
    this.playerVel.set(0, 0, 0);
    this.yaw = 0.08;
    this.pitch = 0;
    this.simPointmanPos.set(
      this.playerPos.x - 8.5,
      groundHeightAt(this.playerPos.x - 8.5, this.playerPos.z + 6.5) + 1.6,
      this.playerPos.z + 6.5,
    );
    this.simRtoPos.set(
      this.playerPos.x + 9.5,
      groundHeightAt(this.playerPos.x + 9.5, this.playerPos.z + 7.5) + 1.6,
      this.playerPos.z + 7.5,
    );
    this.squadChatterCooldown = 3.8 + Math.random() * 2.5;
    this.enemyRadioChatterCooldown = 3.5 + Math.random() * 3.0;
    this.lastEnemyRadioTime = -10;
    const prog = this.computeProgression(this.careerXp);
    this.careerLevel = prog.level;
    this.recomputeMaxHealth(true);
    this.stamina = 100;
    this.bleeding = false;
    const loadout = this.getActiveLoadout();
    const maxBandages = loadout.rig === 'medic_pack' ? 6 : 5;
    this.bandages = Math.min(
      maxBandages,
      (this.soldierClass === 'artillery_officer' ? 4 : 3) +
        (this.rpgPerks.field_medic >= 2 ? 1 : 0) +
        (loadout.rig === 'medic_pack' ? 2 : 0),
    );
    this.bandagingTimer = 0;
    this.grenadeCount =
      (this.soldierClass === 'machine_gunner' ? 4 : 3) +
      (this.hasSkillNode('rif_grenadier') ? 2 : 0) +
      (loadout.rig === 'grenadier_vest' ? 2 : 0);
    this.isCrouching = false;
    this.isSprinting = false;
    this.isAds = false;
    this.touchAdsToggled = false;
    this.adsBlend = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.recoilPitchOffset = 0;
    this.recoilYawOffset = 0;
    this.weaponKickZ = 0;
    this.cameraShake = 0;
    this.hitstopTimer = 0;
    this.damageFlash = 0;
    this.damageAngleRad = null;
    this.hitMarkerTimer = 0;
    this.recentXpEvent = null;
    this.recentXpTimer = 0;

    const activeStage = this.campaignState?.active
      ? this.campaignState.stages[this.campaignState.currentStageIndex]
      : null;
    const faction = CAMPAIGN_FACTIONS[this.campaignState.factionId];

    if (activeStage) {
      this.relocateObjectivesForStage(activeStage.alphaPos, activeStage.charliePos);
      this.hour24 = activeStage.hour24;
      this.weather = this.weatherOverride === 'AUTO' ? activeStage.weather : this.weatherOverride;
    } else {
      this.relocateObjectivesForStage(SECTOR_ALPHA_POS, SECTOR_CHARLIE_POS);
      this.hour24 = 7.5;
      this.weather = this.weatherOverride === 'AUTO' ? 'CLEAR' : this.weatherOverride;
    }
    this.weatherTimer = 46;
    this.rainIntensity = this.weather === 'MONSOON' ? 1 : this.weather === 'OVERCAST' ? 0.3 : 0;
    this.lightningFlash = 0;
    this.updateDayNightAndWeather(0);

    const makeWeaponRuntime = (id: WeaponId): WeaponRuntimeState => {
      const preset = loadout.weapons[id];
      return {
        mag: WEAPON_SPECS[id].magSize,
        reserve: WEAPON_SPECS[id].maxReserve,
        fireMode: WEAPON_SPECS[id].defaultFireMode,
        attachments: { ...preset.attachments },
        paint: preset.paint,
        customPaint: preset.customPaint ?? this.customWeaponCamo,
        internals: { ...preset.internals },
      };
    };

    this.activeWeapon = loadout.primaryWeapon;
    this.weaponStates = {
      m16a1: makeWeaponRuntime('m16a1'),
      m60: makeWeaponRuntime('m60'),
      m1911: makeWeaponRuntime('m1911'),
    };
    if (this.soldierClass === 'artillery_officer') {
      this.officerActive = true;
    }
    (Object.keys(this.weaponStates) as WeaponId[]).forEach((id) => {
      this.weaponStates[id].mag = this.getEffectiveMagSize(id);
      this.weaponStates[id].reserve = this.getEffectiveMaxReserve(id);
    });
    (Object.keys(this.viewmodels) as WeaponId[]).forEach((id) => {
      this.viewmodels[id].applyAttachments(this.weaponStates[id].attachments);
      this.viewmodels[id].applyPaint(
        this.weaponStates[id].paint,
        this.weaponStates[id].customPaint ?? this.customWeaponCamo,
      );
      this.viewmodels[id].applyUniform(
        loadout.uniform,
        loadout.customUniformCamo ?? this.customUniformCamo,
      );
    });
    this.updateViewmodelVisibility();

    const defaultAlphaLabel =
      faction.side === 'PAVN_NLF' ? 'Overrun Allied Mortar Pit' : 'Destroy Mortar Nest on Ridge';
    const defaultCharlieLabel =
      faction.side === 'PAVN_NLF' ? 'Capture Allied Radio Bunker' : 'Secure River Comms Bunker';

    this.objectives = [
      {
        id: 'alpha',
        code: 'ALPHA',
        label: activeStage ? activeStage.alphaLabel : defaultAlphaLabel,
        x: this.activeAlphaPos.x,
        z: this.activeAlphaPos.z,
        completed: false,
        active: true,
        progress: 0,
      },
      {
        id: 'charlie',
        code: 'CHARLIE',
        label: activeStage ? activeStage.charlieLabel : defaultCharlieLabel,
        x: this.activeCharliePos.x,
        z: this.activeCharliePos.z,
        completed: false,
        active: true,
        progress: 0,
      },
      {
        id: 'extract',
        code: 'EXFIL',
        label: activeStage ? activeStage.extractLabel : faction.extractionLabel,
        x: LZ_BRAVO_POS.x,
        z: LZ_BRAVO_POS.z,
        completed: false,
        active: false,
        progress: 0,
      },
    ];
    this.initQuests();
    this.extractCountdown = null;
    this.extractWaveSpawned = false;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.elapsedSec = 0;
    this.initArtilleryBatteries();

    this.spawnEnemies();
    this.setPhase(targetPhase);
    if (targetPhase === 'playing') {
      this.showBanner(
        activeStage
          ? `${faction.shortName} · ${activeStage.opCode} ${activeStage.title.toUpperCase()}`
          : `${faction.shortName} · ${SOLDIER_CLASSES[this.soldierClass].name.toUpperCase()} DEPLOYED`,
      );
    }
    this.emitHud();
  }

  private relocateObjectivesForStage(
    alphaPos: { x: number; z: number },
    charliePos: { x: number; z: number },
  ): void {
    this.activeAlphaPos = { x: alphaPos.x, z: alphaPos.z };
    this.activeCharliePos = { x: charliePos.x, z: charliePos.z };

    if (this.mortarGroup) {
      this.mortarGroup.position.set(
        alphaPos.x,
        groundHeightAt(alphaPos.x, alphaPos.z),
        alphaPos.z,
      );
      this.mortarGroup.updateMatrixWorld(true);
      this.mortarCollider.x = alphaPos.x;
      this.mortarCollider.z = alphaPos.z;
    }
    if (this.alphaTowerGroup) {
      const tx = alphaPos.x - 8;
      const tz = alphaPos.z - 6;
      this.alphaTowerGroup.position.set(tx, groundHeightAt(tx, tz), tz);
      this.alphaTowerGroup.updateMatrixWorld(true);
      this.alphaTowerCollider.x = tx;
      this.alphaTowerCollider.z = tz;
    }
    if (this.bunkerGroup) {
      this.bunkerGroup.position.set(
        charliePos.x,
        groundHeightAt(charliePos.x, charliePos.z),
        charliePos.z,
      );
      this.bunkerGroup.updateMatrixWorld(true);
      this.bunkerCollider.x = charliePos.x;
      this.bunkerCollider.z = charliePos.z;
    }
    if (this.charlieAmmoGroup && this.charlieAmmoEntry) {
      const cx = charliePos.x + 5.2;
      const cz = charliePos.z + 4;
      this.charlieAmmoGroup.position.set(cx, groundHeightAt(cx, cz), cz);
      this.charlieAmmoGroup.updateMatrixWorld(true);
      this.charlieAmmoEntry.x = cx;
      this.charlieAmmoEntry.z = cz;
    }
  }

  private initArtilleryBatteries(): void {
    this.activeBatteryId = null;
    this.strikeCooldownSec = 0;
    this.horizonFlashTimer = 0;
    this.horizonFlashMesh.visible = false;

    const activeStage = this.campaignState?.active
      ? this.campaignState.stages[this.campaignState.currentStageIndex]
      : null;
    const cadenceMult = activeStage ? activeStage.artyCadenceMult : 1.0;

    const defs = [
      { id: 'bat-north', callsign: 'NVA Mortar Battery 01', worldX: -390, worldZ: -780, elevationM: 146, delay: 4.5 / cadenceMult },
      { id: 'bat-west', callsign: '122mm Howitzer Ridge', worldX: -760, worldZ: -190, elevationM: 118, delay: 11.0 / cadenceMult },
      { id: 'bat-east', callsign: 'Mekong East Battery', worldX: 670, worldZ: -520, elevationM: 96, delay: 17.5 / cadenceMult },
    ];

    this.batteries = defs.map((d) => ({
      info: {
        id: d.id,
        callsign: d.callsign,
        worldX: d.worldX,
        worldZ: d.worldZ,
        elevationM: d.elevationM,
        status: 'active',
        gridRef: this.formatGridRef(d.worldX, d.worldZ),
        azimuthDeg: 0,
        rangeMeters: 0,
        acousticDelaySec: 0,
        elevationDeltaM: 0,
        lastShotAgeSec: 0,
      },
      nextShotIn: d.delay,
      strikeFlightTimer: 0,
    }));
    this.recomputeBatteryMath();
  }

  private formatGridRef(wx: number, wz: number): string {
    const easting = Math.max(100, Math.min(999, Math.round(500 + wx * 0.25)));
    const northing = Math.max(100, Math.min(999, Math.round(500 - wz * 0.25)));
    return `48P YS ${easting} ${northing}`;
  }

  private recomputeBatteryMath(): void {
    for (const b of this.batteries) {
      const dx = b.info.worldX - this.playerPos.x;
      const dz = b.info.worldZ - this.playerPos.z;
      const range = Math.hypot(dx, dz);
      const az = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      b.info.rangeMeters = Math.round(range);
      b.info.azimuthDeg = Math.round(az);
      b.info.acousticDelaySec = Number((range / 343).toFixed(2));
      b.info.elevationDeltaM = Math.round(b.info.elevationM - this.playerPos.y);
    }
  }

  private getOpposingEnemyStyle() {
    const playerSide = CAMPAIGN_FACTIONS[this.campaignState.factionId].side;
    if (playerSide === 'PAVN_NLF') {
      return {
        uniformHex: 0x465432,
        helmetHex: 0x3b482c,
        webbingHex: 0x38412a,
        alliedLook: true,
      };
    }
    return {
      uniformHex: 0x5b5b3c,
      helmetHex: 0x4b5334,
      webbingHex: 0x3b3525,
      alliedLook: false,
    };
  }

  private createEnemyActor(
    id: number,
    x: number,
    z: number,
    sector: EnemyActor['sector'],
    initialState: EnemyActor['state'] = 'patrol',
  ): EnemyActor {
    const roles: EnemyActor['role'][] = [
      'rifleman',
      'flanker',
      'suppressor',
      'grenadier',
      'rifleman',
      'commander',
    ];
    const role = roles[id % roles.length];
    const model = buildEnemySoldier({ ...this.getOpposingEnemyStyle(), role });
    const y = groundHeightAt(x, z);
    model.group.position.set(x, y, z);
    this.scene.add(model.group);
    const wpAngle = Math.random() * Math.PI * 2;
    const wpDist = 7 + Math.random() * 7;
    const activeStage = this.campaignState?.active
      ? this.campaignState.stages[this.campaignState.currentStageIndex]
      : null;
    const hpMult = activeStage ? activeStage.enemyHpMult : 1.0;
    const roleHpMult = role === 'commander' ? 1.2 : role === 'grenadier' ? 1.05 : 1.0;
    const baseHp = Math.round((sector === 'extract' ? 95 : 100) * hpMult * roleHpMult);
    const actor: EnemyActor = {
      id,
      model,
      role,
      x,
      y,
      z,
      yaw: Math.random() * Math.PI * 2,
      hp: baseHp,
      maxHp: baseHp,
      alive: true,
      deathTimer: 0,
      sector,
      homeX: x,
      homeZ: z,
      patrolWaypointX: x + Math.cos(wpAngle) * wpDist,
      patrolWaypointZ: z + Math.sin(wpAngle) * wpDist,
      patrolPauseTimer: Math.random() * 2.0,
      patrolScanPhase: Math.random() * 6,
      state: initialState,
      posture: 'stand',
      crouchBlend: 0,
      suppression: 0,
      ammoInMag: role === 'suppressor' ? 45 : 30,
      reloadTimer: 0,
      coverX: null,
      coverZ: null,
      lastKnownX: this.playerPos.x,
      lastKnownZ: this.playerPos.z,
      searchTimer: initialState === 'investigate' ? 7.0 : 0,
      tacticTimer: 1.5 + Math.random() * 2.0,
      fireCooldown: 0.6 + Math.random() * 1.1,
      windupTimer: 0,
      burstLeft: 0,
      strafeDir: id % 2 === 0 ? 1 : -1,
      strafeTimer: 1.5 + Math.random() * 1.2,
      hitFlashTimer: 0,
      walkPhase: Math.random() * 6,
      breath: 8.0,
      drownBubbleTimer: 0,
      hasLos: false,
      hasHeadOnlyLos: false,
      losTimer: Math.random() * 0.14,
      lastSeenPlayerTime: -99,
      grenadeCount: role === 'grenadier' ? 3 : role === 'rifleman' ? 1 : 0,
      grenadeCooldown: 2.5 + Math.random() * 3.0,
      healUsed: false,
      healTimer: 0,
      commandCooldown: 2.0 + Math.random() * 2.5,
      coverStayTimer: 0,
    };
    model.hitMeshes.forEach((m) => {
      m.userData.enemyId = actor.id;
      this.enemyHitTargets.push(m);
    });
    this.enemies.push(actor);
    return actor;
  }

  private spawnEnemies(): void {
    let nextId = 1;
    const activeStage = this.campaignState?.active
      ? this.campaignState.stages[this.campaignState.currentStageIndex]
      : null;
    const bonus = activeStage ? activeStage.enemyCountBonus : 0;
    const alphaExtra = Math.floor(bonus / 3);
    const charlieExtra = Math.floor(bonus / 3);
    const patrolExtra = bonus - alphaExtra - charlieExtra + (activeStage?.modifiers.includes('elite_scouts') ? 2 : 0);

    const alphaCount = 5 + alphaExtra;
    for (let i = 0; i < alphaCount; i++) {
      const a = (i / alphaCount) * Math.PI * 2;
      this.createEnemyActor(
        nextId++,
        this.activeAlphaPos.x + Math.cos(a) * 8.5,
        this.activeAlphaPos.z + Math.sin(a) * 8.5,
        'alpha',
      );
    }
    const charlieCount = 5 + charlieExtra;
    for (let i = 0; i < charlieCount; i++) {
      const a = (i / charlieCount) * Math.PI * 2;
      this.createEnemyActor(
        nextId++,
        this.activeCharliePos.x + Math.cos(a) * 9.0,
        this.activeCharliePos.z + Math.sin(a) * 9.0,
        'charlie',
      );
    }
    const basePatrols: [number, number][] = [
      [-14, -4],
      [26, 2],
      [2, -32],
      [-28, 36],
      [-40, 8],
      [42, 16],
      [14, -52],
      [-18, -58],
    ];
    const totalPatrols = 4 + patrolExtra;
    for (let i = 0; i < totalPatrols; i++) {
      const pt = basePatrols[i % basePatrols.length];
      this.createEnemyActor(nextId++, pt[0] + (i >= 8 ? 6 : 0), pt[1], 'patrol');
    }
  }

  public startGame(): void {
    this.audio.unlock();
    this.resetMissionState('playing');
  }

  public resumeGame(): void {
    this.audio.unlock();
    if (this.phase === 'paused') {
      this.setPhase('playing');
    }
  }

  public setPhase(next: GamePhase): void {
    this.phase = next;
    if (next !== 'playing' && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.heldKeys.clear();
    this.mouseFireHeld = false;
    this.mouseAdsHeld = false;
    this.onPhaseChange(next);
    this.emitHud();
  }

  public requestPointerLock(): void {
    if (this.phase !== 'playing') return;
    if (this.renderer.domElement.requestPointerLock) {
      try {
        this.renderer.domElement.requestPointerLock();
      } catch {
        // Ignore on mobile / unsupported browsers
      }
    }
  }

  public toggleMute(): boolean {
    const m = this.audio.toggleMute();
    this.emitHud();
    return m;
  }

  public setAmbienceVolume(vol: number): void {
    this.audio.setAmbienceVolume(vol);
    this.emitHud();
  }

  public setSfxVolume(vol: number): void {
    this.audio.setSfxVolume(vol);
    this.emitHud();
  }

  private loadProximityVoiceSetting(): void {
    try {
      const saved = localStorage.getItem(PROXIMITY_VOICE_KEY);
      if (saved === 'false' || saved === '0') {
        this.audio.setProximityVoiceEnabled(false);
      } else if (saved === 'true' || saved === '1') {
        this.audio.setProximityVoiceEnabled(true);
      }
    } catch {
      // ignore storage access issues
    }
  }

  public setProximityVoiceEnabled(enabled: boolean): void {
    this.audio.setProximityVoiceEnabled(enabled);
    try {
      localStorage.setItem(PROXIMITY_VOICE_KEY, enabled ? 'true' : 'false');
    } catch {
      // ignore storage access issues
    }
    this.showBanner(enabled ? 'PROXIMITY VOICE · 3D SQUAD AUDIO ON' : 'PROXIMITY VOICE · DISABLED');
    this.emitHud();
  }

  public toggleProximityVoice(): boolean {
    const next = !this.audio.isProximityVoiceEnabled();
    this.setProximityVoiceEnabled(next);
    return next;
  }

  public callCounterBatteryFire(): void {
    if (this.phase !== 'playing') return;
    if (this.strikeCooldownSec > 0) return;

    const target =
      this.batteries.find((b) => b.info.id === this.activeBatteryId && b.info.status === 'detected') ??
      this.batteries.find((b) => b.info.status === 'detected');
    if (!target) return;

    this.recomputeBatteryMath();
    target.info.status = 'striking';
    target.strikeFlightTimer = 2.2;
    const headgearMult = this.getActiveLoadout().headgear === 'comms_beret' ? 0.85 : 1.0;
    const cmdCooldownMult = Math.max(
      0.38,
      (1 - this.getEffectiveAttr('command') * 0.06 - (this.soldierClass === 'artillery_officer' ? 0.25 : 0)) *
        (this.hasSkillNode('art_acoustic_array') ? 0.75 : 1.0) *
        headgearMult,
    );
    this.strikeCooldownSec = Math.max(3.2, 9.0 * cmdCooldownMult);
    this.audio.playCounterBatteryOutgoing();
    this.showBanner(
      `COUNTER-BATTERY FIRED · BRG ${String(target.info.azimuthDeg).padStart(3, '0')}° · ${target.info.rangeMeters}M`,
    );
    this.emitHud();
  }

  public setSensitivity(sens: number): void {
    this.sensitivity = Math.max(0.4, Math.min(2.2, sens));
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphicsQuality = quality;
    this.applyGraphicsQuality();
  }

  public captureScreenshotDataUrl(): string | null {
    if (this.disposed || this.contextLost || !this.renderer) return null;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.phase === 'playing' || this.phase === 'paused') {
      this.renderer.clearDepth();
      this.renderer.render(this.weaponScene, this.weaponCamera);
    }
    this.audio.playCameraShutter();
    try {
      return this.renderer.domElement.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  public getCaptureStream(fps?: number): MediaStream | null {
    if (this.disposed || !this.renderer) return null;
    const canvas = this.renderer.domElement as HTMLCanvasElement & {
      captureStream?: (frameRate?: number) => MediaStream;
    };
    if (typeof canvas.captureStream !== 'function') return null;

    const targetFps = fps ?? (this.isMobileDevice ? 30 : 60);
    const videoStream = canvas.captureStream(targetFps);
    const audioStream = this.audio.getCaptureStream();

    const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
    }
    return new MediaStream(tracks);
  }

  private getTargetPixelRatio(): number {
    if (this.isSoftwareGl || this.graphicsQuality === 'battery') return 1;
    const dpr = window.devicePixelRatio || 1;
    if (this.graphicsQuality === 'high') return Math.min(dpr, 2);
    // Balanced mobile/tablet cap for smooth 60 FPS on Android GPUs
    return this.isMobileDevice ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
  }

  private applyGraphicsQuality(): void {
    if (!this.renderer || !this.sunLight) return;
    this.renderer.setPixelRatio(this.getTargetPixelRatio());

    const enableShadows = !this.isSoftwareGl && this.graphicsQuality !== 'battery';
    this.renderer.shadowMap.enabled = enableShadows;
    this.sunLight.castShadow = enableShadows;

    if (enableShadows) {
      const highRes =
        this.graphicsQuality === 'high' || (!this.isMobileDevice && this.graphicsQuality === 'auto');
      this.renderer.shadowMap.type = highRes ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      const targetSize = highRes ? 2048 : 1024;
      if (
        this.sunLight.shadow.mapSize.width !== targetSize ||
        this.sunLight.shadow.mapSize.height !== targetSize
      ) {
        this.sunLight.shadow.mapSize.width = targetSize;
        this.sunLight.shadow.mapSize.height = targetSize;
        if (this.sunLight.shadow.map) {
          this.sunLight.shadow.map.dispose();
          this.sunLight.shadow.map = null;
        }
      }
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  public setTouchInput(partial: Partial<TouchInputState>): void {
    if (partial.lookDeltaX !== undefined) {
      this.touchInput.lookDeltaX += partial.lookDeltaX;
    }
    if (partial.lookDeltaY !== undefined) {
      this.touchInput.lookDeltaY += partial.lookDeltaY;
    }
    if (partial.moveX !== undefined) this.touchInput.moveX = partial.moveX;
    if (partial.moveY !== undefined) this.touchInput.moveY = partial.moveY;
    if (partial.sprint !== undefined) this.touchInput.sprint = partial.sprint;
    if (partial.firing !== undefined) {
      if (partial.firing && !this.touchInput.firing) {
        this.semiTriggerConsumed = false;
      }
      this.touchInput.firing = partial.firing;
    }
  }

  public toggleAdsTouch(): void {
    this.touchAdsToggled = !this.touchAdsToggled;
  }

  public selectWeapon(id: WeaponId): void {
    if (this.activeWeapon === id) return;
    this.activeWeapon = id;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.weaponKickZ = 0.08;
    this.updateViewmodelVisibility();
    this.emitHud();
  }

  public cycleWeapon(): void {
    const order: WeaponId[] = ['m16a1', 'm60', 'm1911'];
    const next = order[(order.indexOf(this.activeWeapon) + 1) % order.length];
    this.selectWeapon(next);
  }

  private loadCareerXp(): void {
    try {
      const raw = localStorage.getItem(XP_STORAGE_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          this.careerXp = parsed;
        }
      }
      const rawProfile = localStorage.getItem(RPG_PROFILE_KEY);
      if (rawProfile) {
        const data = JSON.parse(rawProfile) as {
          soldierClass?: SoldierClassId;
          attributes?: Partial<RpgAttributes>;
          perks?: Partial<RpgPerks>;
          unlockedSkillNodes?: SkillTreeNodeId[];
          bonusAttributePoints?: number;
          bonusSkillPoints?: number;
          totalQuestsCompleted?: number;
        };
        if (data.soldierClass && SOLDIER_CLASSES[data.soldierClass]) {
          this.soldierClass = data.soldierClass;
        }
        if (data.attributes) {
          this.rpgAttributes = {
            grit: Math.max(0, Math.min(10, data.attributes.grit ?? 0)),
            agility: Math.max(0, Math.min(10, data.attributes.agility ?? 0)),
            marksmanship: Math.max(0, Math.min(10, data.attributes.marksmanship ?? 0)),
            command: Math.max(0, Math.min(10, data.attributes.command ?? 0)),
          };
        }
        if (data.perks) {
          this.rpgPerks = {
            field_medic: Math.max(0, Math.min(3, data.perks.field_medic ?? 0)),
            scavenger: Math.max(0, Math.min(3, data.perks.scavenger ?? 0)),
            danger_close: Math.max(0, Math.min(3, data.perks.danger_close ?? 0)),
            deadeye: Math.max(0, Math.min(3, data.perks.deadeye ?? 0)),
          };
        }
        if (Array.isArray(data.unlockedSkillNodes)) {
          const validIds = new Set<SkillTreeNodeId>(
            (Object.keys(CLASS_SKILL_TREES) as SoldierClassId[]).flatMap((cls) =>
              CLASS_SKILL_TREES[cls].map((n) => n.id),
            ),
          );
          this.unlockedSkillNodes = new Set(
            data.unlockedSkillNodes.filter((id): id is SkillTreeNodeId => validIds.has(id)),
          );
        }
        if (typeof data.bonusAttributePoints === 'number' && Number.isFinite(data.bonusAttributePoints)) {
          this.bonusAttributePoints = Math.max(0, data.bonusAttributePoints);
        }
        if (typeof data.bonusSkillPoints === 'number' && Number.isFinite(data.bonusSkillPoints)) {
          this.bonusSkillPoints = Math.max(0, data.bonusSkillPoints);
        }
        if (typeof data.totalQuestsCompleted === 'number' && Number.isFinite(data.totalQuestsCompleted)) {
          this.totalQuestsCompleted = Math.max(0, data.totalQuestsCompleted);
        }
      }
    } catch {
      // Ignore storage failures
    }
    this.careerLevel = this.computeProgression(this.careerXp).level;
    this.loadOrRefreshDailyMissions();
  }

  private saveCareerXp(): void {
    try {
      localStorage.setItem(XP_STORAGE_KEY, String(this.careerXp));
      localStorage.setItem(
        RPG_PROFILE_KEY,
        JSON.stringify({
          soldierClass: this.soldierClass,
          attributes: this.rpgAttributes,
          perks: this.rpgPerks,
          unlockedSkillNodes: Array.from(this.unlockedSkillNodes),
          bonusAttributePoints: this.bonusAttributePoints,
          bonusSkillPoints: this.bonusSkillPoints,
          totalQuestsCompleted: this.totalQuestsCompleted,
        }),
      );
    } catch {
      // Ignore storage failures
    }
  }

  private loadOrRefreshDailyMissions(): void {
    const today = getLocalDateKey();
    try {
      const raw = localStorage.getItem(DAILY_MISSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          dateKey?: string;
          rerollCount?: number;
          totalDailyCompleted?: number;
          missions?: { id: string; progress: number; completed: boolean; claimed: boolean }[];
        };
        if (typeof parsed.totalDailyCompleted === 'number' && Number.isFinite(parsed.totalDailyCompleted)) {
          this.totalDailyCompleted = Math.max(0, parsed.totalDailyCompleted);
        }
        if (parsed.dateKey === today && Array.isArray(parsed.missions)) {
          const reroll = Math.max(0, parsed.rerollCount ?? 0);
          const generated = generateDailyMissions(today, reroll);
          this.dailyDateKey = today;
          this.dailyRerollCount = reroll;
          this.dailyMissions = generated.map((m) => {
            const saved = parsed.missions?.find((s) => s.id === m.id);
            if (!saved) return m;
            return {
              ...m,
              progress: Math.min(m.target, Math.max(0, saved.progress ?? 0)),
              completed: Boolean(saved.completed),
              claimed: Boolean(saved.claimed),
            };
          });
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
    this.dailyDateKey = today;
    this.dailyRerollCount = 0;
    this.dailyMissions = generateDailyMissions(today, 0);
    this.saveDailyMissions();
  }

  private saveDailyMissions(): void {
    try {
      localStorage.setItem(
        DAILY_MISSIONS_KEY,
        JSON.stringify({
          dateKey: this.dailyDateKey,
          rerollCount: this.dailyRerollCount,
          totalDailyCompleted: this.totalDailyCompleted,
          missions: this.dailyMissions.map((m) => ({
            id: m.id,
            progress: m.progress,
            completed: m.completed,
            claimed: m.claimed,
          })),
        }),
      );
    } catch {
      // Ignore storage errors
    }
  }

  private hasSkillNode(nodeId: SkillTreeNodeId): boolean {
    if (!this.unlockedSkillNodes.has(nodeId)) return false;
    return CLASS_SKILL_TREES[this.soldierClass].some((n) => n.id === nodeId);
  }

  private getEffectiveAttr(key: RpgAttributeKey): number {
    return SOLDIER_CLASSES[this.soldierClass].baseAttributes[key] + this.rpgAttributes[key];
  }

  private getUnspentAttributePoints(): number {
    const earned = (this.careerLevel - 1) * 2 + this.bonusAttributePoints;
    const spent =
      this.rpgAttributes.grit +
      this.rpgAttributes.agility +
      this.rpgAttributes.marksmanship +
      this.rpgAttributes.command;
    return Math.max(0, earned - spent);
  }

  private getUnspentSkillPoints(): number {
    const earned = this.careerLevel - 1 + this.bonusSkillPoints;
    const spent =
      this.rpgPerks.field_medic +
      this.rpgPerks.scavenger +
      this.rpgPerks.danger_close +
      this.rpgPerks.deadeye +
      this.unlockedSkillNodes.size;
    return Math.max(0, earned - spent);
  }

  private createDefaultWeaponsRecord(
    overrides?: Partial<Record<WeaponId, Partial<WeaponPresetLoadout>>>,
  ): Record<WeaponId, WeaponPresetLoadout> {
    const base = (): WeaponPresetLoadout => ({
      attachments: { optic: 'iron', muzzle: 'standard', underbarrel: 'standard' },
      paint: 'parkerized',
      internals: { trigger: 'standard_trigger', bolt: 'standard_bolt', spring: 'standard_spring' },
    });
    const merge = (w: WeaponId): WeaponPresetLoadout => {
      const b = base();
      const ov = overrides?.[w];
      if (!ov) return b;
      return {
        attachments: { ...b.attachments, ...(ov.attachments ?? {}) },
        paint: ov.paint ?? b.paint,
        internals: { ...b.internals, ...(ov.internals ?? {}) },
      };
    };
    return {
      m16a1: merge('m16a1'),
      m60: merge('m60'),
      m1911: merge('m1911'),
    };
  }

  private createDefaultLoadoutSlots(): CharacterLoadoutConfig[] {
    return [
      {
        name: 'Jungle Pointman',
        uniform: 'og107_olive',
        rig: 'light_webbing',
        headgear: 'm1_helmet',
        primaryWeapon: 'm16a1',
        weapons: this.createDefaultWeaponsRecord({
          m16a1: { attachments: { optic: 'iron', muzzle: 'standard', underbarrel: 'bipod_grip' }, paint: 'od_green' },
        }),
      },
      {
        name: 'Mekong Recon',
        uniform: 'tiger_stripe',
        rig: 'grenadier_vest',
        headgear: 'boonie_hat',
        primaryWeapon: 'm16a1',
        weapons: this.createDefaultWeaponsRecord({
          m16a1: { attachments: { optic: 'oeg_dot', muzzle: 'suppressor', underbarrel: 'standard' }, paint: 'tiger_stripe' },
          m1911: { attachments: { optic: 'iron', muzzle: 'suppressor', underbarrel: 'standard' }, paint: 'od_green' },
        }),
      },
      {
        name: 'Ridge Heavy',
        uniform: 'erdl_woodland',
        rig: 'flak_jacket',
        headgear: 'm1_helmet',
        primaryWeapon: 'm60',
        weapons: this.createDefaultWeaponsRecord({
          m60: { attachments: { optic: 'iron', muzzle: 'compensator', underbarrel: 'extended_mag' }, paint: 'od_green' },
        }),
      },
    ];
  }

  private loadCustomCamos(): void {
    try {
      const raw = localStorage.getItem(CUSTOM_CAMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          weapon?: Partial<CustomCamoConfig>;
          uniform?: Partial<CustomCamoConfig>;
        };
        if (parsed.weapon) {
          this.customWeaponCamo = { ...this.customWeaponCamo, ...parsed.weapon };
        }
        if (parsed.uniform) {
          this.customUniformCamo = { ...this.customUniformCamo, ...parsed.uniform };
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveCustomCamos(): void {
    try {
      localStorage.setItem(
        CUSTOM_CAMO_STORAGE_KEY,
        JSON.stringify({
          weapon: this.customWeaponCamo,
          uniform: this.customUniformCamo,
        }),
      );
    } catch {
      // Ignore storage errors
    }
  }

  private loadCampaignState(): void {
    try {
      const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CampaignState;
        if (
          parsed &&
          Array.isArray(parsed.stages) &&
          parsed.stages.length === 5 &&
          parsed.factionId &&
          CAMPAIGN_FACTIONS[parsed.factionId]
        ) {
          this.campaignState = parsed;
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
    this.campaignState = generateCampaign(undefined, 1, 'us_macv');
    this.saveCampaignState();
  }

  private saveCampaignState(): void {
    try {
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(this.campaignState));
    } catch {
      // Ignore storage errors
    }
  }

  public setCampaignFaction(factionId: CampaignFactionId): void {
    if (!CAMPAIGN_FACTIONS[factionId]) return;
    this.campaignState = rethemeCampaignStagesForFaction(this.campaignState, factionId);
    this.saveCampaignState();
    const spec = CAMPAIGN_FACTIONS[factionId];
    if (this.phase === 'title') {
      const slot = this.getActiveLoadout();
      slot.uniform = spec.suggestedUniform;
      slot.primaryWeapon = spec.recommendedWeapon;
      this.applyActiveLoadoutToRuntime(true);
      this.saveCharacterLoadouts();
    }
    this.audio.playEmptyClick();
    this.showBanner(`FACTION SELECTED · ${spec.name.toUpperCase()}`);
    this.emitHud();
  }

  public generateNewCampaign(seed?: string, factionId?: CampaignFactionId): void {
    const fId = factionId ?? this.campaignState.factionId;
    const tour = this.campaignState.campaignCompleted ? this.campaignState.tourNumber + 1 : 1;
    this.campaignState = generateCampaign(seed, tour, fId);
    this.saveCampaignState();
    this.audio.playRankUpChime();
    this.showBanner(`NEW CAMPAIGN · ${this.campaignState.seed} (${CAMPAIGN_FACTIONS[fId].shortName})`);
    this.emitHud();
  }

  public deployCampaignStage(stageIndex: number): void {
    if (stageIndex < 0 || stageIndex >= this.campaignState.stages.length) return;
    this.campaignState.active = true;
    this.campaignState.currentStageIndex = stageIndex;
    this.saveCampaignState();
    this.audio.unlock();
    this.resetMissionState('playing');
  }

  public setQuickSkirmishMode(): void {
    this.campaignState.active = false;
    this.saveCampaignState();
    this.audio.unlock();
    this.resetMissionState('playing');
  }

  private loadCharacterLoadouts(): void {
    const defaults = this.createDefaultLoadoutSlots();
    try {
      const raw = localStorage.getItem(CHAR_LOADOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          activeSlot?: number;
          slots?: Partial<CharacterLoadoutConfig>[];
        };
        if (Array.isArray(parsed.slots) && parsed.slots.length > 0) {
          this.loadoutSlots = defaults.map((def, i) => {
            const s = parsed.slots?.[i];
            if (!s) return def;
            const uniform: UniformCamoId =
              s.uniform && MILITARY_UNIFORMS[s.uniform] ? s.uniform : def.uniform;
            const rig: TacticalRigId = s.rig && TACTICAL_RIGS[s.rig] ? s.rig : def.rig;
            const headgear: HeadgearId =
              s.headgear && HEADGEAR_OPTIONS[s.headgear] ? s.headgear : def.headgear;
            const primaryWeapon: WeaponId =
              s.primaryWeapon && WEAPON_SPECS[s.primaryWeapon] ? s.primaryWeapon : def.primaryWeapon;
            return {
              name: typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 28) : def.name,
              uniform,
              customUniformCamo: s.customUniformCamo ?? this.customUniformCamo,
              rig,
              headgear,
              primaryWeapon,
              weapons: this.createDefaultWeaponsRecord(s.weapons),
            };
          });
          const idx = typeof parsed.activeSlot === 'number' ? Math.floor(parsed.activeSlot) : 0;
          this.activeLoadoutSlot = Math.max(0, Math.min(this.loadoutSlots.length - 1, idx));
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
    this.loadoutSlots = defaults;
    this.activeLoadoutSlot = 0;
  }

  private saveCharacterLoadouts(): void {
    try {
      localStorage.setItem(
        CHAR_LOADOUT_KEY,
        JSON.stringify({
          activeSlot: this.activeLoadoutSlot,
          slots: this.loadoutSlots,
        }),
      );
    } catch {
      // Ignore storage errors
    }
  }

  private getActiveLoadout(): CharacterLoadoutConfig {
    if (this.loadoutSlots.length === 0) {
      this.loadoutSlots = this.createDefaultLoadoutSlots();
    }
    return this.loadoutSlots[this.activeLoadoutSlot] ?? this.loadoutSlots[0];
  }

  private syncActiveSlotFromWeapons(): void {
    if (!this.weaponStates) return;
    const slot = this.getActiveLoadout();
    (Object.keys(this.weaponStates) as WeaponId[]).forEach((id) => {
      const st = this.weaponStates[id];
      slot.weapons[id] = {
        attachments: { ...st.attachments },
        paint: st.paint,
        customPaint: st.customPaint ?? this.customWeaponCamo,
        internals: { ...st.internals },
      };
    });
    this.saveCharacterLoadouts();
  }

  private applyActiveLoadoutToRuntime(switchWeapon = false): void {
    const slot = this.getActiveLoadout();
    this.recomputeMaxHealth(false);
    if (this.viewmodels) {
      (Object.keys(this.viewmodels) as WeaponId[]).forEach((id) => {
        if (this.weaponStates?.[id]) {
          const preset = slot.weapons[id];
          this.weaponStates[id].attachments = { ...preset.attachments };
          this.weaponStates[id].paint = preset.paint;
          this.weaponStates[id].customPaint = preset.customPaint ?? this.customWeaponCamo;
          this.weaponStates[id].internals = { ...preset.internals };
          this.viewmodels[id].applyAttachments(preset.attachments);
          this.viewmodels[id].applyPaint(
            preset.paint,
            preset.customPaint ?? this.customWeaponCamo,
          );
        }
        this.viewmodels[id].applyUniform(
          slot.uniform,
          slot.customUniformCamo ?? this.customUniformCamo,
        );
      });
    }
    if (switchWeapon && this.weaponStates?.[slot.primaryWeapon]) {
      this.activeWeapon = slot.primaryWeapon;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.updateViewmodelVisibility();
    }
    this.grenadeCount = Math.min(this.getMaxGrenades(), this.grenadeCount);
  }

  public getCurrentTerrain(): TerrainZoneId {
    return getTerrainZoneAt(this.playerPos.x, this.playerPos.z);
  }

  public isTerrainCamoActive(terrain: TerrainZoneId = this.getCurrentTerrain()): boolean {
    const slot = this.getActiveLoadout();
    if (slot.uniform === 'custom_camo') {
      const custom = slot.customUniformCamo ?? this.customUniformCamo;
      return custom.favoredTerrain === terrain;
    }
    const uniformSpec = MILITARY_UNIFORMS[slot.uniform];
    if (uniformSpec.favoredTerrains.includes(terrain)) return true;
    if (uniformSpec.nightFavored && (this.hour24 < 6.5 || this.hour24 >= 18.2)) return true;
    return false;
  }

  public selectLoadoutSlot(slotIdx: number): void {
    if (slotIdx < 0 || slotIdx >= this.loadoutSlots.length) return;
    this.activeLoadoutSlot = slotIdx;
    this.applyActiveLoadoutToRuntime(true);
    this.saveCharacterLoadouts();
    this.audio.playReload();
    this.showBanner(`LOADOUT EQUIPPED · ${this.getActiveLoadout().name.toUpperCase()}`);
    this.emitHud();
  }

  public renameLoadoutSlot(name: string): void {
    const clean = name.trim().slice(0, 28);
    if (!clean) return;
    this.getActiveLoadout().name = clean;
    this.saveCharacterLoadouts();
    this.emitHud();
  }

  public setUniformCamo(uniform: UniformCamoId): void {
    if (!MILITARY_UNIFORMS[uniform]) return;
    const slot = this.getActiveLoadout();
    slot.uniform = uniform;
    if (this.viewmodels) {
      (Object.keys(this.viewmodels) as WeaponId[]).forEach((id) => {
        this.viewmodels[id].applyUniform(
          uniform,
          slot.customUniformCamo ?? this.customUniformCamo,
        );
      });
    }
    this.saveCharacterLoadouts();
    this.audio.playEmptyClick();
    this.showBanner(`UNIFORM · ${MILITARY_UNIFORMS[uniform].name.toUpperCase()}`);
    this.emitHud();
  }

  public setCustomUniformCamo(cfg: CustomCamoConfig): void {
    this.customUniformCamo = { ...cfg };
    const slot = this.getActiveLoadout();
    slot.uniform = 'custom_camo';
    slot.customUniformCamo = { ...cfg };
    if (this.viewmodels) {
      (Object.keys(this.viewmodels) as WeaponId[]).forEach((id) => {
        this.viewmodels[id].applyUniform('custom_camo', this.customUniformCamo);
      });
    }
    this.saveCustomCamos();
    this.saveCharacterLoadouts();
    this.emitHud();
  }

  public setCustomWeaponCamo(weaponId: WeaponId, cfg: CustomCamoConfig): void {
    this.customWeaponCamo = { ...cfg };
    const st = this.weaponStates?.[weaponId];
    if (st) {
      st.paint = 'custom';
      st.customPaint = { ...cfg };
      this.viewmodels?.[weaponId]?.applyPaint('custom', this.customWeaponCamo);
    }
    this.syncActiveSlotFromWeapons();
    this.saveCustomCamos();
    if (!this.questArmoryTuned) {
      this.questArmoryTuned = true;
      this.advanceQuest('q_armory_mastery', 1);
    }
    this.emitHud();
  }

  public setTacticalRig(rig: TacticalRigId): void {
    if (!TACTICAL_RIGS[rig]) return;
    const slot = this.getActiveLoadout();
    const prevRig = slot.rig;
    slot.rig = rig;
    this.recomputeMaxHealth(false);
    if (rig === 'grenadier_vest' && prevRig !== 'grenadier_vest') {
      this.grenadeCount = Math.min(this.getMaxGrenades(), this.grenadeCount + 2);
    } else {
      this.grenadeCount = Math.min(this.getMaxGrenades(), this.grenadeCount);
    }
    if (rig === 'medic_pack' && prevRig !== 'medic_pack') {
      this.bandages = Math.min(6, this.bandages + 2);
    }
    this.saveCharacterLoadouts();
    this.audio.playReload();
    this.showBanner(`TACTICAL RIG · ${TACTICAL_RIGS[rig].name.toUpperCase()}`);
    this.emitHud();
  }

  public setHeadgear(headgear: HeadgearId): void {
    if (!HEADGEAR_OPTIONS[headgear]) return;
    this.getActiveLoadout().headgear = headgear;
    this.recomputeMaxHealth(false);
    this.saveCharacterLoadouts();
    this.audio.playEmptyClick();
    this.showBanner(`HEADGEAR · ${HEADGEAR_OPTIONS[headgear].name.toUpperCase()}`);
    this.emitHud();
  }

  public setPrimaryLoadoutWeapon(weaponId: WeaponId): void {
    if (!WEAPON_SPECS[weaponId]) return;
    this.getActiveLoadout().primaryWeapon = weaponId;
    if (this.weaponStates?.[weaponId]) {
      this.activeWeapon = weaponId;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.updateViewmodelVisibility();
    }
    this.saveCharacterLoadouts();
    this.audio.playEmptyClick();
    this.emitHud();
  }

  public applyLoadoutPreset(
    presetId: 'jungle_stalker' | 'river_raider' | 'ridge_assault' | 'night_raider',
  ): void {
    const slot = this.getActiveLoadout();
    if (presetId === 'jungle_stalker') {
      slot.name = 'Jungle Stalker';
      slot.uniform = 'tiger_stripe';
      slot.rig = 'light_webbing';
      slot.headgear = 'boonie_hat';
      slot.primaryWeapon = 'm16a1';
      slot.weapons.m16a1 = {
        attachments: { optic: 'oeg_dot', muzzle: 'suppressor', underbarrel: 'bipod_grip' },
        paint: 'tiger_stripe',
        internals: { trigger: 'hair_trigger', bolt: 'standard_bolt', spring: 'standard_spring' },
      };
    } else if (presetId === 'river_raider') {
      slot.name = 'Mekong River Raider';
      slot.uniform = 'mekong_mud';
      slot.rig = 'medic_pack';
      slot.headgear = 'boonie_hat';
      slot.primaryWeapon = 'm16a1';
      slot.weapons.m16a1 = {
        attachments: { optic: 'oeg_dot', muzzle: 'suppressor', underbarrel: 'extended_mag' },
        paint: 'mud_camo',
        internals: { trigger: 'standard_trigger', bolt: 'chrome_bolt', spring: 'standard_spring' },
      };
    } else if (presetId === 'ridge_assault') {
      slot.name = 'Highland Ridge Breacher';
      slot.uniform = 'erdl_woodland';
      slot.rig = 'flak_jacket';
      slot.headgear = 'm1_helmet';
      slot.primaryWeapon = 'm60';
      slot.weapons.m60 = {
        attachments: { optic: 'iron', muzzle: 'compensator', underbarrel: 'extended_mag' },
        paint: 'od_green',
        internals: { trigger: 'standard_trigger', bolt: 'chrome_bolt', spring: 'heavy_buffer' },
      };
    } else {
      slot.name = 'SOG Night Raider';
      slot.uniform = 'charcoal_night';
      slot.rig = 'grenadier_vest';
      slot.headgear = 'comms_beret';
      slot.primaryWeapon = 'm16a1';
      slot.weapons.m16a1 = {
        attachments: { optic: 'colt_scope', muzzle: 'suppressor', underbarrel: 'extended_mag' },
        paint: 'parkerized',
        internals: { trigger: 'lightweight_sear', bolt: 'titanium_bcg', spring: 'overclock_spring' },
      };
    }
    this.applyActiveLoadoutToRuntime(true);
    this.saveCharacterLoadouts();
    this.audio.playRankUpChime();
    this.showBanner(`PRESET APPLIED · ${slot.name.toUpperCase()}`);
    this.emitHud();
  }

  private getMaxGrenades(): number {
    return (
      5 +
      (this.hasSkillNode('rif_grenadier') ? 2 : 0) +
      (this.getActiveLoadout().rig === 'grenadier_vest' ? 2 : 0)
    );
  }

  private getEffectiveMaxReserve(id: WeaponId): number {
    const base =
      WEAPON_SPECS[id].maxReserve + (id === 'm60' && this.hasSkillNode('mg_ammo_bearer') ? 100 : 0);
    const rigMult = this.getActiveLoadout().rig === 'grenadier_vest' ? 1.25 : 1.0;
    const factionMult = this.campaignState?.factionId === 'pavn_nva' ? 1.2 : 1.0;
    return Math.round(base * rigMult * factionMult);
  }

  private recomputeMaxHealth(fillFull = false): void {
    const classHp =
      this.soldierClass === 'machine_gunner' ? 40 : this.soldierClass === 'rifleman' ? 25 : 0;
    const factionHp = this.campaignState?.factionId === 'rok' ? 20 : 0;
    const treeHp =
      (this.hasSkillNode('rif_pointman') ? 25 : 0) + (this.hasSkillNode('mg_fortress') ? 30 : 0);
    const levelHp = Math.min(30, Math.floor((this.careerLevel - 1) / 2) * 5);
    const gritHp = this.getEffectiveAttr('grit') * 12;
    const loadout = this.getActiveLoadout();
    const gearHp =
      (loadout.rig === 'flak_jacket' ? 25 : 0) + (loadout.headgear === 'm1_helmet' ? 10 : 0);
    const prevMax = this.maxHealth;
    this.maxHealth = 100 + classHp + factionHp + treeHp + levelHp + gritHp + gearHp;
    if (fillFull) {
      this.health = this.maxHealth;
    } else if (this.maxHealth > prevMax) {
      this.health = Math.min(this.maxHealth, this.health + (this.maxHealth - prevMax));
    } else {
      this.health = Math.min(this.maxHealth, this.health);
    }
  }

  public setSoldierClass(cls: SoldierClassId): void {
    if (!SOLDIER_CLASSES[cls]) return;
    this.soldierClass = cls;
    this.saveCareerXp();
    this.recomputeMaxHealth(false);
    if (this.phase === 'title') {
      const startW = SOLDIER_CLASSES[cls].startingWeapon;
      this.getActiveLoadout().primaryWeapon = startW;
      this.activeWeapon = startW;
      this.saveCharacterLoadouts();
    }
    this.audio.playEmptyClick();
    this.emitHud();
  }

  public allocateAttribute(key: RpgAttributeKey): void {
    if (this.getUnspentAttributePoints() <= 0) return;
    if (this.rpgAttributes[key] >= 10) return;
    this.rpgAttributes[key]++;
    if (key === 'grit') {
      this.recomputeMaxHealth(false);
    }
    this.saveCareerXp();
    this.audio.playEmptyClick();
    this.emitHud();
  }

  public upgradePerk(perkId: RpgPerkId): void {
    if (this.getUnspentSkillPoints() <= 0) return;
    if (this.rpgPerks[perkId] >= 3) return;
    this.rpgPerks[perkId]++;
    if (perkId === 'field_medic' && this.rpgPerks.field_medic === 2) {
      this.bandages = Math.min(5, this.bandages + 1);
    }
    this.saveCareerXp();
    this.audio.playRankUpChime();
    this.emitHud();
  }

  public unlockSkillNode(nodeId: SkillTreeNodeId): void {
    const tree = CLASS_SKILL_TREES[this.soldierClass];
    const node = tree.find((n) => n.id === nodeId);
    if (!node) return;
    if (this.unlockedSkillNodes.has(nodeId)) return;
    if (this.getUnspentSkillPoints() <= 0) return;
    if (!node.requires.every((req) => this.unlockedSkillNodes.has(req))) return;

    this.unlockedSkillNodes.add(nodeId);
    this.recomputeMaxHealth(false);
    if (nodeId === 'rif_grenadier') {
      this.grenadeCount = Math.min(this.getMaxGrenades(), this.grenadeCount + 2);
    } else if (nodeId === 'mg_ammo_bearer') {
      this.weaponStates.m60.reserve = Math.min(
        this.getEffectiveMaxReserve('m60'),
        this.weaponStates.m60.reserve + 80,
      );
    }
    this.saveCareerXp();
    this.audio.playRankUpChime();
    this.showBanner(`SPECIALIZATION UNLOCKED · ${node.name.toUpperCase()}`);
    this.emitHud();
  }

  public respecRpg(): void {
    this.rpgAttributes = { grit: 0, agility: 0, marksmanship: 0, command: 0 };
    this.rpgPerks = { field_medic: 0, scavenger: 0, danger_close: 0, deadeye: 0 };
    this.unlockedSkillNodes.clear();
    this.recomputeMaxHealth(false);
    this.saveCareerXp();
    this.audio.playReload();
    this.showBanner('ATTRIBUTES, PERKS & SKILL TREE POINTS REFUNDED');
    this.emitHud();
  }

  private advanceDailyMission(metric: DailyMissionMetric, delta = 1): void {
    const today = getLocalDateKey();
    if (today !== this.dailyDateKey) {
      this.loadOrRefreshDailyMissions();
    }
    let changed = false;
    for (const m of this.dailyMissions) {
      if (m.metric !== metric || m.completed) continue;
      m.progress = Math.min(m.target, m.progress + delta);
      changed = true;
      if (m.progress >= m.target) {
        m.completed = true;
        this.audio.playObjectiveChime();
        this.showBanner(`DAILY OP COMPLETE · CLAIM ${m.title.toUpperCase()} IN DOSSIER [K]`);
      }
    }
    if (changed) {
      this.saveDailyMissions();
    }
  }

  public claimDailyMission(missionId: string): void {
    const m = this.dailyMissions.find((item) => item.id === missionId);
    if (!m || !m.completed || m.claimed) return;
    m.claimed = true;
    this.totalDailyCompleted++;

    const gear = m.classGear[this.soldierClass];
    const st = this.weaponStates[gear.weaponId];
    if (gear.optic) st.attachments.optic = gear.optic;
    if (gear.muzzle) st.attachments.muzzle = gear.muzzle;
    if (gear.underbarrel) st.attachments.underbarrel = gear.underbarrel;
    if (gear.paint) st.paint = gear.paint;
    if (gear.trigger) st.internals.trigger = gear.trigger;
    if (gear.bolt) st.internals.bolt = gear.bolt;
    if (gear.spring) st.internals.spring = gear.spring;

    const maxMag = this.getEffectiveMagSize(gear.weaponId);
    if (gear.underbarrel === 'extended_mag' || gear.refillAmmo) {
      st.mag = maxMag;
    }
    if (gear.refillAmmo) {
      st.reserve = this.getEffectiveMaxReserve(gear.weaponId);
    }
    if (this.viewmodels?.[gear.weaponId]) {
      this.viewmodels[gear.weaponId].applyAttachments(st.attachments);
      this.viewmodels[gear.weaponId].applyPaint(st.paint);
    }
    if (gear.bonusBandages) {
      this.bandages = Math.min(5, this.bandages + gear.bonusBandages);
    }
    if (gear.bonusGrenades) {
      this.grenadeCount = Math.min(this.getMaxGrenades(), this.grenadeCount + gear.bonusGrenades);
    }

    this.syncActiveSlotFromWeapons();
    this.saveDailyMissions();
    this.audio.playObjectiveChime();
    this.showBanner(`CLASS GEAR ISSUED · ${gear.gearName.toUpperCase()}`);
    this.awardXp(m.rewardXp, `Daily Op: ${m.title}`);
  }

  public rerollDailyMissions(): void {
    const today = getLocalDateKey();
    if (today !== this.dailyDateKey) {
      this.dailyDateKey = today;
      this.dailyRerollCount = 0;
    } else {
      this.dailyRerollCount++;
    }
    this.dailyMissions = generateDailyMissions(this.dailyDateKey, this.dailyRerollCount);
    this.saveDailyMissions();
    this.audio.playReload();
    this.showBanner('FRESH DAILY MEKONG FIELD ORDERS ISSUED');
    this.emitHud();
  }

  private initQuests(): void {
    this.questArmoryTuned = false;
    this.questArtyFired = false;
    this.quests = [
      {
        id: 'q_river_patrol',
        title: 'Riverbank Ambush Sweep',
        category: 'COMBAT',
        description: 'Eliminate 4 hostiles near the Mekong tributary or jungle trails.',
        progress: 0,
        target: 4,
        completed: false,
        claimed: false,
        rewardXp: 220,
        rewardLabel: '+220 XP · +1 Bandage & +2 Frags',
      },
      {
        id: 'q_headhunter',
        title: 'Jungle Marksman',
        category: 'PRECISION',
        description: 'Score 3 precision headshot neutralizations.',
        progress: 0,
        target: 3,
        completed: false,
        claimed: false,
        rewardXp: 260,
        rewardLabel: '+260 XP · +1 Attribute Point',
      },
      {
        id: 'q_counter_battery',
        title: 'Silence the Valley Guns',
        category: 'ORDNANCE',
        description: 'Triangulate & neutralize 2 hostile artillery batteries.',
        progress: 0,
        target: 2,
        completed: false,
        claimed: false,
        rewardXp: 320,
        rewardLabel: '+320 XP · +1 Skill Point',
      },
      {
        id: 'q_danger_close',
        title: 'Steel Rain On Target',
        category: 'ORDNANCE',
        description: 'Neutralize 3 hostiles with 155mm Howitzers, Frags, or M60 LMG.',
        progress: 0,
        target: 3,
        completed: false,
        claimed: false,
        rewardXp: 280,
        rewardLabel: '+280 XP · Full Reserve Ammo Drop',
      },
      {
        id: 'q_armory_mastery',
        title: 'Gunsmith & Forward Observer',
        category: 'TACTICAL',
        description: 'Customize a weapon in Armory (T) and call a 155mm fire mission.',
        progress: 0,
        target: 2,
        completed: false,
        claimed: false,
        rewardXp: 200,
        rewardLabel: '+200 XP · +45 HP Field Trauma Surge',
      },
    ];
  }

  private advanceQuest(id: QuestId, delta = 1): void {
    const q = this.quests.find((item) => item.id === id);
    if (!q || q.completed) return;
    q.progress = Math.min(q.target, q.progress + delta);
    if (q.progress >= q.target) {
      q.completed = true;
      q.claimed = true;
      this.totalQuestsCompleted++;
      if (id === 'q_river_patrol') {
        this.bandages = Math.min(5, this.bandages + 1);
        this.grenadeCount = Math.min(5, this.grenadeCount + 2);
      } else if (id === 'q_headhunter') {
        this.bonusAttributePoints++;
      } else if (id === 'q_counter_battery') {
        this.bonusSkillPoints++;
      } else if (id === 'q_danger_close') {
        (Object.keys(this.weaponStates) as WeaponId[]).forEach((wid) => {
          this.weaponStates[wid].reserve = this.getEffectiveMaxReserve(wid);
        });
      } else if (id === 'q_armory_mastery') {
        this.health = Math.min(this.maxHealth, this.health + 45);
      }
      this.audio.playObjectiveChime();
      this.showBanner(`QUEST COMPLETE · ${q.title.toUpperCase()} (${q.rewardLabel})`);
      this.awardXp(q.rewardXp, `Quest: ${q.title}`);
    }
  }

  private computeProgression(totalXp: number): {
    level: number;
    rankTitle: string;
    xpIntoLevel: number;
    xpForNextLevel: number;
  } {
    let lvl = 1;
    let curFloor = 0;
    let nextFloor = 200;
    let rankTitle = RANK_LADDER[0].title;

    for (let i = 0; i < RANK_LADDER.length; i++) {
      if (totalXp >= RANK_LADDER[i].minXp) {
        lvl = i + 1;
        curFloor = RANK_LADDER[i].minXp;
        rankTitle = RANK_LADDER[i].title;
        nextFloor =
          i + 1 < RANK_LADDER.length
            ? RANK_LADDER[i + 1].minXp
            : RANK_LADDER[i].minXp + 1100;
      }
    }

    return {
      level: lvl,
      rankTitle,
      xpIntoLevel: Math.max(0, totalXp - curFloor),
      xpForNextLevel: Math.max(100, nextFloor - curFloor),
    };
  }

  private awardXp(amount: number, label: string): void {
    if (amount <= 0) return;
    const beretMult = this.getActiveLoadout().headgear === 'comms_beret' ? 0.12 : 0;
    const cmdMult =
      1 +
      this.getEffectiveAttr('command') * 0.08 +
      (this.hasSkillNode('art_forward_obs') ? 0.18 : 0) +
      beretMult;
    const finalAmount = Math.round(amount * cmdMult);
    const prevLvl = this.careerLevel;
    this.careerXp += finalAmount;
    this.saveCareerXp();

    this.xpEventCounter++;
    this.recentXpEvent = { id: this.xpEventCounter, label, amount: finalAmount };
    this.recentXpTimer = 2.8;

    const prog = this.computeProgression(this.careerXp);
    if (prog.level > prevLvl) {
      this.careerLevel = prog.level;
      this.recomputeMaxHealth(false);
      this.health = Math.min(this.maxHealth, this.health + 25);
      this.audio.playRankUpChime();
      this.showBanner(
        `LEVEL ${prog.level} ${prog.rankTitle} · +2 ATTR & +1 SKILL POINT UNLOCKED [K]`,
      );
    }
    this.emitHud();
  }

  public setTimeOfDayHour(hour: number): void {
    this.hour24 = ((hour % 24) + 24) % 24;
    this.emitHud();
  }

  public setTimeSpeedMult(mult: number): void {
    this.timeSpeedMult = Math.max(0, Math.min(12, mult));
    this.emitHud();
  }

  public setWeatherOverride(mode: WeatherKind | 'AUTO'): void {
    this.weatherOverride = mode;
    if (mode !== 'AUTO') {
      this.weather = mode;
      this.showBanner(`WEATHER OVERRIDE · ${mode}`);
    } else {
      this.showBanner('WEATHER CYCLE · DYNAMIC AUTO');
    }
    this.emitHud();
  }

  public setUiTriggerHandler(handler: ((action: 'armory' | 'map' | 'rpg') => void) | null): void {
    this.uiTriggerHandler = handler;
  }

  public getEffectiveMagSize(id: WeaponId): number {
    const base = WEAPON_SPECS[id].magSize;
    const extMult = this.weaponStates[id].attachments.underbarrel === 'extended_mag' ? 1.5 : 1.0;
    const skillMult = id === 'm60' && this.hasSkillNode('mg_ammo_bearer') ? 1.25 : 1.0;
    return Math.round(base * extMult * skillMult);
  }

  public getEffectiveFireInterval(id: WeaponId): number {
    const base = WEAPON_SPECS[id].fireInterval;
    const intl = this.weaponStates[id].internals;
    let mult = 1.0;
    if (intl.trigger === 'hair_trigger') mult *= 0.86;
    else if (intl.trigger === 'lightweight_sear') mult *= 0.78;
    if (intl.bolt === 'chrome_bolt') mult *= 0.84;
    else if (intl.bolt === 'titanium_bcg') mult *= 0.72;
    if (intl.spring === 'heavy_buffer') mult *= 0.92;
    else if (intl.spring === 'overclock_spring') mult *= 0.82;
    if (id === 'm60' && this.hasSkillNode('mg_asbestos_barrel')) mult *= 0.86;
    return Math.max(0.036, base * mult);
  }

  public getEffectiveReloadDuration(id: WeaponId): number {
    const base = WEAPON_SPECS[id].reloadDuration;
    const intl = this.weaponStates[id].internals;
    let mult = 1.0;
    if (intl.bolt === 'chrome_bolt') mult *= 0.82;
    else if (intl.bolt === 'titanium_bcg') mult *= 0.75;
    const classPerk = this.soldierClass === 'rifleman' && id === 'm16a1' ? 0.85 : 1.0;
    const treePerk = this.hasSkillNode('rif_quick_mag') ? 0.85 : 1.0;
    const marksPerk = Math.max(0.65, 1 - this.getEffectiveAttr('marksmanship') * 0.04);
    const levelPerk = Math.max(0.78, 1 - (this.careerLevel - 1) * 0.025);
    const khakiBonus =
      this.getActiveLoadout().uniform === 'khaki_tan' && this.isTerrainCamoActive() ? 0.78 : 1.0;
    const factionReload = this.campaignState?.factionId === 'arvn' ? 0.85 : 1.0;
    return Math.max(0.45, base * mult * classPerk * treePerk * marksPerk * levelPerk * khakiBonus * factionReload);
  }

  public setWeaponAttachment(
    weaponId: WeaponId,
    slot: 'optic' | 'muzzle' | 'underbarrel',
    value: OpticAttachment | MuzzleAttachment | UnderbarrelAttachment,
  ): void {
    const st = this.weaponStates[weaponId];
    if (slot === 'optic') st.attachments.optic = value as OpticAttachment;
    else if (slot === 'muzzle') st.attachments.muzzle = value as MuzzleAttachment;
    else st.attachments.underbarrel = value as UnderbarrelAttachment;

    const maxMag = this.getEffectiveMagSize(weaponId);
    if (st.mag > maxMag) {
      st.reserve = Math.min(this.getEffectiveMaxReserve(weaponId), st.reserve + (st.mag - maxMag));
      st.mag = maxMag;
    }
    this.viewmodels[weaponId].applyAttachments(st.attachments);
    this.syncActiveSlotFromWeapons();
    if (!this.questArmoryTuned) {
      this.questArmoryTuned = true;
      this.advanceQuest('q_armory_mastery', 1);
    }
    this.audio.playReload();
    this.emitHud();
  }

  public setWeaponPaint(weaponId: WeaponId, paint: WeaponPaintId): void {
    const st = this.weaponStates[weaponId];
    st.paint = paint;
    this.viewmodels[weaponId].applyPaint(paint, st.customPaint ?? this.customWeaponCamo);
    this.syncActiveSlotFromWeapons();
    if (!this.questArmoryTuned) {
      this.questArmoryTuned = true;
      this.advanceQuest('q_armory_mastery', 1);
    }
    this.audio.playEmptyClick();
    this.emitHud();
  }

  public setWeaponInternalPart(
    weaponId: WeaponId,
    slot: 'trigger' | 'bolt' | 'spring',
    value: TriggerPartId | BoltPartId | SpringPartId,
  ): void {
    const intl = this.weaponStates[weaponId].internals;
    if (slot === 'trigger') intl.trigger = value as TriggerPartId;
    else if (slot === 'bolt') intl.bolt = value as BoltPartId;
    else intl.spring = value as SpringPartId;
    this.syncActiveSlotFromWeapons();
    if (!this.questArmoryTuned) {
      this.questArmoryTuned = true;
      this.advanceQuest('q_armory_mastery', 1);
    }
    this.audio.playReload();
    this.emitHud();
  }

  public toggleOfficerMode(): void {
    if (this.phase !== 'playing') return;
    this.officerActive = !this.officerActive;
    if (!this.officerActive) {
      this.binocularZoom = false;
    } else {
      this.touchAdsToggled = false;
    }
    this.updateViewmodelVisibility();
    this.showBanner(
      this.officerActive
        ? 'ARTILLERY OFFICER COMMAND · BINOS [V] · TARGET MAP [M]'
        : 'INFANTRY RIFLEMAN MODE RESTORED',
    );
    this.emitHud();
  }

  public toggleBinoculars(): void {
    if (this.phase !== 'playing') return;
    this.binocularZoom = !this.binocularZoom;
    if (this.binocularZoom) {
      this.officerActive = true;
      this.isReloading = false;
      this.reloadTimer = 0;
      this.touchAdsToggled = false;
    }
    this.updateViewmodelVisibility();
    this.emitHud();
  }

  public setShellType(t: ShellType): void {
    this.shellType = t;
    this.emitHud();
  }

  public setSheafPattern(p: SheafPattern): void {
    this.sheafPattern = p;
    this.emitHud();
  }

  public setArtilleryTarget(x: number, z: number): void {
    const radial = Math.hypot(x, z);
    if (radial > PLAYABLE_RADIUS + 18) {
      const s = (PLAYABLE_RADIUS + 18) / radial;
      x *= s;
      z *= s;
    }
    this.artyTargetX = x;
    this.artyTargetZ = z;
    this.emitHud();
  }

  public designateBinocularTargetAndFire(): void {
    if (this.phase !== 'playing') return;
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    let hitDist = -1;
    for (let d = 6; d <= 240; d += 2.5) {
      _v2.copy(this.camera.position).addScaledVector(_v1, d);
      if (_v2.y <= groundHeightAt(_v2.x, _v2.z)) {
        hitDist = d;
        break;
      }
    }
    if (hitDist < 0) {
      this.showBanner('AIM BINOCULARS ON VALLEY TERRAIN TO DESIGNATE TARGET');
      return;
    }
    this.setArtilleryTarget(_v2.x, _v2.z);
    this.fireArtillerySquadMission();
  }

  public fireArtillerySquadMission(): void {
    if (this.phase !== 'playing') return;
    if (this.artyTargetX === null || this.artyTargetZ === null) {
      this.showBanner('DESIGNATE FIRE COORDINATES ON MAP [M] OR BINOCULARS [V]');
      return;
    }
    const readyGuns = this.howitzers.filter((g) => g.state.status === 'READY');
    if (readyGuns.length === 0) {
      this.showBanner('155MM HOWITZER SQUAD RELOADING · STANDBY');
      return;
    }

    const tx = this.artyTargetX;
    const tz = this.artyTargetZ;
    const isWp = this.shellType === 'WP';

    // Perpendicular vector to line of fire from battery center for BARRAGE sheaf
    const bx = tx - HOWITZER_BATTERY_POS.x;
    const bz = tz - HOWITZER_BATTERY_POS.z;
    const bLen = Math.max(1, Math.hypot(bx, bz));
    const perpX = -bz / bLen;
    const perpZ = bx / bLen;

    readyGuns.forEach((gun, idx) => {
      let gx = tx;
      let gz = tz;
      if (this.sheafPattern === 'CONVERGE') {
        gx += (idx - 1) * 2.2;
        gz += (idx === 1 ? -1.8 : 1.5);
      } else {
        const offset = (idx - 1) * 12;
        gx += perpX * offset;
        gz += perpZ * offset;
      }

      const dx = gx - gun.x;
      const dz = gz - gun.z;
      const range = Math.max(12, Math.hypot(dx, dz));
      const azDeg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      const yawToTarget = Math.atan2(-dx, -dz);
      const elevRad = THREE.MathUtils.clamp(0.38 + (range / 220) * 0.42, 0.35, 0.85);

      gun.targetYaw = yawToTarget;
      gun.targetPitch = elevRad;
      gun.state.azimuthDeg = Math.round(azDeg);
      gun.state.elevationDeg = Math.round((elevRad * 180) / Math.PI);
      gun.state.status = 'FIRING';
      gun.fireDelay = idx * 0.26;
      gun.pendingTargetX = gx;
      gun.pendingTargetZ = gz;
      gun.pendingIsWp = isWp;
    });

    this.artySalvosFired++;
    if (!this.questArtyFired) {
      this.questArtyFired = true;
      this.advanceQuest('q_armory_mastery', 1);
    }
    const avgRange = Math.round(bLen);
    this.artyEtaSec = Number((2.2 + Math.min(1.4, avgRange / 150)).toFixed(1));
    this.showBanner(
      `THUNDER BATTERY FIRE MISSION · ${readyGuns.length}x 155MM ${this.shellType} · ${this.formatGridRef(tx, tz)}`,
    );
    this.emitHud();
  }

  private updateViewmodelVisibility(): void {
    (Object.keys(this.viewmodels) as WeaponId[]).forEach((id) => {
      this.viewmodels[id].root.visible = !this.binocularZoom && id === this.activeWeapon;
    });
  }

  public toggleFireMode(): void {
    const spec = WEAPON_SPECS[this.activeWeapon];
    if (!spec.supportsAuto) return;
    const st = this.weaponStates[this.activeWeapon];
    st.fireMode = st.fireMode === 'AUTO' ? 'SEMI' : 'AUTO';
    this.audio.playEmptyClick();
    this.emitHud();
  }

  public toggleCrouch(): void {
    this.isCrouching = !this.isCrouching;
    this.emitHud();
  }

  public triggerReload(): void {
    if (this.isReloading || this.phase !== 'playing') return;
    const st = this.weaponStates[this.activeWeapon];
    const maxMag = this.getEffectiveMagSize(this.activeWeapon);
    if (st.mag >= maxMag || st.reserve <= 0) return;
    this.isReloading = true;
    this.reloadTimer = this.getEffectiveReloadDuration(this.activeWeapon);
    this.touchAdsToggled = false;
    this.audio.playReload();
    this.emitHud();
  }

  public useBandage(): void {
    if (this.phase !== 'playing' || this.bandages <= 0 || this.bandagingTimer > 0) return;
    if (this.health >= this.maxHealth && !this.bleeding) return;
    const medicRigMult = this.getActiveLoadout().rig === 'medic_pack' ? 0.7 : 1.0;
    this.lastBandageDuration = 1.6 * Math.max(0.35, 1 - this.rpgPerks.field_medic * 0.22) * medicRigMult;
    this.bandagingTimer = this.lastBandageDuration;
    this.audio.playBandage();
    this.emitHud();
  }

  public throwGrenade(): void {
    if (this.phase !== 'playing' || this.grenadeCount <= 0) return;
    this.grenadeCount--;
    this.audio.playBandage();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b4d2b, roughness: 0.5, metalness: 0.4 }),
    );
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(_euler.set(this.pitch, this.yaw, 0, 'YXZ'));
    const startPos = this.camera.position.clone().addScaledVector(forward, 0.7);
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    const vel = forward.multiplyScalar(19).add(new THREE.Vector3(0, 5.2, 0));
    this.grenades.push({ mesh, pos: startPos, vel, fuse: 2.35, fromEnemy: false });
    this.emitHud();
  }

  public triggerContextAction(): void {
    if (this.phase !== 'playing') return;
    if (this.nearbyActionType === 'resupply') {
      (Object.keys(this.weaponStates) as WeaponId[]).forEach((id) => {
        this.weaponStates[id].reserve = this.getEffectiveMaxReserve(id);
      });
      const maxBandageCap = this.getActiveLoadout().rig === 'medic_pack' ? 6 : 4;
      this.bandages = Math.min(maxBandageCap, this.bandages + 2);
      this.grenadeCount = Math.min(this.getMaxGrenades(), this.grenadeCount + 1);
      this.audio.playReload();
      this.showBanner('RESUPPLIED AMMO & FIELD DRESSINGS');
      this.emitHud();
    } else if (this.nearbyActionType === 'objective') {
      const alpha = this.objectives.find((o) => o.id === 'alpha')!;
      if (!alpha.completed && Math.hypot(this.playerPos.x - alpha.x, this.playerPos.z - alpha.z) < 6.5) {
        this.detonateMortarNest();
      }
    } else if (this.nearbyActionType === 'armory') {
      this.uiTriggerHandler?.('armory');
    } else if (this.nearbyActionType === 'fdc') {
      if (!this.officerActive) this.toggleOfficerMode();
      else this.uiTriggerHandler?.('map');
    }
  }

  private showBanner(msg: string): void {
    this.statusBanner = msg;
    this.statusBannerTimer = 3.2;
  }

  private detonateMortarNest(): void {
    if (this.mortarDestroyed) return;
    this.mortarDestroyed = true;
    this.mortarDrumMesh.visible = false;
    this.triggerExplosion(
      new THREE.Vector3(
        this.activeAlphaPos.x,
        groundHeightAt(this.activeAlphaPos.x, this.activeAlphaPos.z) + 0.6,
        this.activeAlphaPos.z,
      ),
      10.5,
      160,
    );
    const alpha = this.objectives.find((o) => o.id === 'alpha')!;
    alpha.completed = true;
    alpha.active = false;
    alpha.progress = 1;
    this.audio.playObjectiveChime();
    this.showBanner(`SECTOR ALPHA CLEARED · ${alpha.label.toUpperCase()}`);
    const clearXp = this.hasSkillNode('rec_shadow_xp') ? 375 : 300;
    this.awardXp(clearXp, 'Sector Alpha Cleared');
    this.advanceDailyMission('sectors_cleared', 1);
    this.checkExtractionUnlock();
  }

  private checkExtractionUnlock(): void {
    const alpha = this.objectives.find((o) => o.id === 'alpha')!;
    const charlie = this.objectives.find((o) => o.id === 'charlie')!;
    const extract = this.objectives.find((o) => o.id === 'extract')!;
    if (alpha.completed && charlie.completed && !extract.active && !extract.completed) {
      extract.active = true;
      const faction = CAMPAIGN_FACTIONS[this.campaignState.factionId];
      this.showBanner(`ALL SECTORS SECURE · ${faction.extractionLabel.toUpperCase()}`);
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.weaponCamera.aspect = w / h;
    this.weaponCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.onWindowBlur();
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
    this.applyGraphicsQuality();
    this.lastTime = performance.now();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.onWindowBlur();
      if (this.phase === 'playing') {
        this.setPhase('paused');
      }
    } else {
      this.lastTime = performance.now();
    }
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  };

  private onWindowBlur = (): void => {
    this.heldKeys.clear();
    this.mouseFireHeld = false;
    this.mouseAdsHeld = false;
    this.touchInput.firing = false;
    this.touchInput.moveX = 0;
    this.touchInput.moveY = 0;
    this.touchInput.sprint = false;
    this.touchInput.lookDeltaX = 0;
    this.touchInput.lookDeltaY = 0;
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    if (!this.pointerLocked && !this.mouseAdsHeld && e.buttons === 0) return;
    if (this.pointerLocked) {
      const s = 0.0021 * this.sensitivity * (this.binocularZoom ? 0.38 : this.isAds ? 0.62 : 1.0);
      this.yaw -= e.movementX * s;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * s, -1.38, 1.38);
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    if (!this.pointerLocked && window.matchMedia('(pointer: fine)').matches) {
      this.requestPointerLock();
    }
    if (e.button === 0) {
      this.mouseFireHeld = true;
      this.semiTriggerConsumed = false;
    } else if (e.button === 2) {
      this.mouseAdsHeld = true;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseFireHeld = false;
    if (e.button === 2) this.mouseAdsHeld = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.phase !== 'playing') return;
    this.heldKeys.add(e.code);

    if (e.code === 'Digit1') this.selectWeapon('m16a1');
    else if (e.code === 'Digit2') this.selectWeapon('m60');
    else if (e.code === 'Digit3') this.selectWeapon('m1911');
    else if (e.code === 'KeyR') this.triggerReload();
    else if (e.code === 'KeyC' || e.code === 'ControlLeft') this.toggleCrouch();
    else if (e.code === 'KeyB') this.toggleFireMode();
    else if (e.code === 'KeyG') this.throwGrenade();
    else if (e.code === 'KeyH') this.useBandage();
    else if (e.code === 'KeyE') this.triggerContextAction();
    else if (e.code === 'KeyF') {
      if (this.officerActive && this.binocularZoom) {
        this.designateBinocularTargetAndFire();
      } else {
        this.callCounterBatteryFire();
      }
    } else if (e.code === 'KeyO') this.toggleOfficerMode();
    else if (e.code === 'KeyV') this.toggleBinoculars();
    else if (e.code === 'KeyT') this.uiTriggerHandler?.('armory');
    else if (e.code === 'KeyK') this.uiTriggerHandler?.('rpg');
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private startLoop(): void {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      if (!this.contextLost) {
        this.update(dt);

        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        if (this.phase === 'playing' || this.phase === 'paused') {
          this.renderer.clearDepth();
          this.renderer.render(this.weaponScene, this.weaponCamera);
        }
      }

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number): void {
    if (this.waterTex) {
      this.waterTex.offset.x = (this.waterTex.offset.x + dt * 0.032) % 1;
    }

    if (this.phase === 'title') {
      this.titleOrbitTime += dt * 0.14;
      const camX = Math.sin(this.titleOrbitTime) * 44;
      const camZ = 52 + Math.cos(this.titleOrbitTime) * 28;
      const camY = groundHeightAt(camX, camZ) + 14.5;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(0, 6.5, 4);
      this.huey.mainRotor.rotation.y += dt * 1.4;
      this.huey.tailRotor.rotation.x += dt * 3.0;
      return;
    }

    if (this.phase !== 'playing') return;

    // Brief 35ms hitstop on lethal/heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    this.elapsedSec += dt;
    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) this.statusBanner = null;
    }
    if (this.recentXpTimer > 0) {
      this.recentXpTimer -= dt;
      if (this.recentXpTimer <= 0) this.recentXpEvent = null;
    }

    this.updateDayNightAndWeather(dt);

    // Gentle drift on sunlit jungle pollen/dust motes
    if (this.dustPoints) {
      const posAttr = this.dustPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const phase = i * 0.17 + this.elapsedSec * 0.45;
        arr[i] = this.dustBasePositions[i] + Math.sin(phase) * 0.85;
        arr[i + 1] = this.dustBasePositions[i + 1] + Math.cos(phase * 0.8) * 0.35;
      }
      posAttr.needsUpdate = true;
    }

    // Consume touch look deltas smoothly across Android phones and tablets
    if (this.touchInput.lookDeltaX !== 0 || this.touchInput.lookDeltaY !== 0) {
      const widthNorm = 840 / Math.max(380, Math.min(window.innerWidth || 840, 1280));
      const ts =
        0.0042 *
        widthNorm *
        this.sensitivity *
        (this.binocularZoom ? 0.36 : this.isAds ? 0.56 : 1.0);
      this.yaw -= this.touchInput.lookDeltaX * ts;
      this.pitch = THREE.MathUtils.clamp(this.pitch - this.touchInput.lookDeltaY * ts, -1.38, 1.38);
      this.touchInput.lookDeltaX = 0;
      this.touchInput.lookDeltaY = 0;
    }

    this.updatePlayerMovement(dt);
    this.updateWeaponAndCombat(dt);
    this.updateGrenades(dt);
    this.updateHowitzerSquad(dt);
    this.updateTracers(dt);
    this.updateParticles(dt);
    this.updateBlastAndShrapnel(dt);
    this.updateEnemies(dt);
    this.updateObjectives(dt);
    this.updateArtilleryAndAmbience(dt);
    this.updateCameraAndViewmodel(dt);
    this.updateSpatialAudioAndChatter(dt);

    // Huey rotor animation
    const rotorSpeed = this.objectives.find((o) => o.id === 'extract')?.active ? 26 : 2.2;
    this.huey.mainRotor.rotation.y += dt * rotorSpeed;
    this.huey.tailRotor.rotation.x += dt * rotorSpeed * 2.1;

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateDayNightAndWeather(dt: number): void {
    // 15 real seconds = 1 game hour at 1x speed (full 24h cycle in 6 minutes)
    this.hour24 = (this.hour24 + (dt / 15) * this.timeSpeedMult) % 24;

    if (this.weatherOverride === 'AUTO') {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        const order: WeatherKind[] = ['CLEAR', 'OVERCAST', 'MONSOON', 'MIST'];
        const nextIdx = (order.indexOf(this.weather) + 1) % order.length;
        this.weather = order[nextIdx];
        this.weatherTimer = this.weather === 'MONSOON' ? 52 : 46;
        this.showBanner(`WEATHER SHIFT · ${this.weather} OVER MEKONG VALLEY`);
      }
    }

    const targetRain =
      this.weather === 'MONSOON' ? 1.0 : this.weather === 'OVERCAST' ? 0.28 : 0.0;
    this.rainIntensity = THREE.MathUtils.damp(this.rainIntensity, targetRain, 1.4, dt);

    // Sun diurnal arc: 06:00 sunrise, 12:00 zenith, 18:00 sunset
    const sunAngle = ((this.hour24 - 6) / 24) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle); // +1 noon, 0 horizon, -1 midnight
    const sunHoriz = Math.cos(sunAngle);

    const sunOrbitR = 210;
    const sx = sunHoriz * sunOrbitR * 0.85;
    const sy = sunElev * sunOrbitR;
    const sz = 65 + Math.cos(sunAngle * 0.5) * 35;

    this.skyDome.sunDisc.position.set(sx, sy, sz);
    this.skyDome.sunDisc.lookAt(0, 0, 0);
    this.skyDome.sunDisc.visible = sunElev > -0.1 && this.weather !== 'MONSOON';

    this.skyDome.moonDisc.position.set(-sx, -sy, -sz);
    this.skyDome.moonDisc.lookAt(0, 0, 0);
    this.skyDome.moonDisc.visible = sunElev < 0.1;

    // Key light follows Sun during day and Moon during night
    const isDay = sunElev >= 0;
    if (isDay) {
      this.sunLight.position.set(sx * 0.45, Math.max(12, sy * 0.45), sz * 0.45);
    } else {
      this.sunLight.position.set(-sx * 0.45, Math.max(18, -sy * 0.45), -sz * 0.45);
    }

    // Lightning flashes during Monsoon
    if (this.weather === 'MONSOON') {
      this.lightningCooldown -= dt;
      if (this.lightningCooldown <= 0) {
        this.lightningCooldown = 10 + Math.random() * 14;
        this.lightningFlash = 1.0;
        window.setTimeout(() => {
          if (!this.disposed && this.phase === 'playing') {
            this.audio.playThunder(0.85);
          }
        }, 450 + Math.random() * 800);
      }
    }
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.5);

    // Blend sky zenith, sky horizon, fog, and light intensities
    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.12) / 0.42, 0, 1);
    const twilightFactor = THREE.MathUtils.clamp(1 - Math.abs(sunElev) / 0.28, 0, 1);
    const stormDim = this.weather === 'MONSOON' ? 0.55 : this.weather === 'OVERCAST' ? 0.78 : 1.0;

    // Zenith color: night (#080f18) -> twilight (#3a4263) -> day (#2c557a)
    _color.setHex(0x080f18).lerp(_v4Color.setHex(0x2c557a), dayFactor);
    _color.lerp(_v4Color.setHex(0x3a4263), twilightFactor * 0.55);
    if (this.weather === 'MONSOON' || this.weather === 'OVERCAST') {
      _color.lerp(_v4Color.setHex(0x2d3532), 0.55);
    }
    this.skyDome.uniforms.uZenithColor.value.copy(_color);

    // Horizon / fog color: night (#121a1f) -> twilight (#c76f49) -> day (#778c77)
    this.bgColor.setHex(0x121a1f).lerp(_v4Color.setHex(0x778c77), dayFactor);
    this.bgColor.lerp(_v4Color.setHex(0xc76f49), twilightFactor * 0.58 * (1 - this.rainIntensity * 0.65));
    if (this.weather === 'MONSOON') {
      this.bgColor.lerp(_v4Color.setHex(0x3b4441), 0.55);
    } else if (this.weather === 'MIST') {
      this.bgColor.lerp(_v4Color.setHex(0x7b8879), 0.48);
    }
    if (this.lightningFlash > 0.05) {
      this.bgColor.lerp(_v4Color.setHex(0xb8c8d4), this.lightningFlash * 0.55);
    }
    this.fogExp.color.copy(this.bgColor);

    const targetFogDensity =
      this.weather === 'MONSOON'
        ? 0.0128
        : this.weather === 'MIST'
          ? 0.0155
          : this.weather === 'OVERCAST'
            ? 0.0102
            : 0.0078 + (1 - dayFactor) * 0.0028;
    this.fogExp.density = THREE.MathUtils.damp(this.fogExp.density, targetFogDensity, 2.5, dt);

    // Sun/Moon directional + hemisphere intensities
    if (isDay) {
      _v4Color.setHex(0xffe7bd).lerp(_v4Color2.setHex(0xff9b54), twilightFactor * 0.72);
      this.sunLight.color.copy(_v4Color);
      this.sunLight.intensity = (0.55 + sunElev * 1.75) * stormDim + this.lightningFlash * 2.4;
    } else {
      this.sunLight.color.setHex(0x7aa0c9);
      this.sunLight.intensity = 0.42 * stormDim + this.lightningFlash * 2.4;
    }
    this.hemiLight.intensity = (0.36 + dayFactor * 0.62) * stormDim + this.lightningFlash * 0.8;
    this.rimLight.intensity = 0.22 + dayFactor * 0.28;

    // Night tactical torch attached to player camera
    this.nightTorch.position.set(this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z);
    this.nightTorch.intensity = (1 - dayFactor) * 1.65;

    // Rain streaks update around player
    if (this.rainIntensity > 0.03) {
      this.rainLines.visible = true;
      (this.rainLines.material as THREE.LineBasicMaterial).opacity = 0.14 + this.rainIntensity * 0.36;
      const posAttr = this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const activeStreaks = Math.floor(this.rainCount * Math.min(1, this.rainIntensity + 0.15));
      const fallSpeed = 24 + this.rainIntensity * 12;
      const windTiltX = 2.4 * this.rainIntensity;
      for (let i = 0; i < this.rainCount; i++) {
        if (i >= activeStreaks) {
          arr[i * 6 + 1] = -999;
          arr[i * 6 + 4] = -999;
          continue;
        }
        this.rainOffsets[i * 3 + 1] -= fallSpeed * dt;
        this.rainOffsets[i * 3] -= windTiltX * dt;
        if (this.rainOffsets[i * 3 + 1] < -1.5) {
          this.rainOffsets[i * 3 + 1] += 16;
          this.rainOffsets[i * 3] = (Math.random() - 0.5) * 34;
          this.rainOffsets[i * 3 + 2] = (Math.random() - 0.5) * 34;
        }
        const rx = this.playerPos.x + this.rainOffsets[i * 3];
        const ry = this.playerPos.y + this.rainOffsets[i * 3 + 1];
        const rz = this.playerPos.z + this.rainOffsets[i * 3 + 2];
        arr[i * 6] = rx;
        arr[i * 6 + 1] = ry;
        arr[i * 6 + 2] = rz;
        arr[i * 6 + 3] = rx + windTiltX * 0.04;
        arr[i * 6 + 4] = ry + 0.58;
        arr[i * 6 + 5] = rz;
      }
      posAttr.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }
  }

  private computePanToWorld(wx: number, wz: number): number {
    const dx = wx - this.playerPos.x;
    const dz = wz - this.playerPos.z;
    const len = Math.max(1, Math.hypot(dx, dz));
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    return THREE.MathUtils.clamp((dx * rightX + dz * rightZ) / len, -1, 1);
  }

  private triggerEnemyRadioChatter(
    speaker: EnemyActor,
    situation: 'patrol' | 'contact' | 'flank' | 'suppress' | 'wounded' | 'commander',
  ): void {
    if (this.elapsedSec - this.lastEnemyRadioTime < 2.6) return;
    const dist = Math.hypot(speaker.x - this.playerPos.x, speaker.z - this.playerPos.z);
    if (dist > 92) return;
    this.lastEnemyRadioTime = this.elapsedSec;
    const pan = this.computePanToWorld(speaker.x, speaker.z);
    this.audio.playEnemyVietnameseRadio(
      `enemy-${speaker.id}`,
      situation,
      speaker.x,
      speaker.y + 1.55,
      speaker.z,
      dist,
      pan,
    );
  }

  private updateSpatialAudioAndChatter(dt: number): void {
    // 1. Update Web Audio 3D listener pose to match player's head & look direction
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    _v2.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.audio.updateListenerPose(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      _v1.x,
      _v1.y,
      _v1.z,
      _v2.x,
      _v2.y,
      _v2.z,
    );

    // 2. Smoothly guide simulated fireteam wingman emitters on flanks around the player
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const backX = Math.sin(this.yaw);
    const backZ = Math.cos(this.yaw);
    const sway = Math.sin(this.elapsedSec * 0.42) * 2.2;

    const targetPointmanX = this.playerPos.x - rightX * (8.5 + sway) + backX * 5.8;
    const targetPointmanZ = this.playerPos.z - rightZ * (8.5 + sway) + backZ * 5.8;
    const targetRtoX = this.playerPos.x + rightX * (9.5 - sway) + backX * 7.2;
    const targetRtoZ = this.playerPos.z + rightZ * (9.5 - sway) + backZ * 7.2;

    const followAlpha = Math.min(1, dt * 1.4);
    this.simPointmanPos.x = THREE.MathUtils.lerp(this.simPointmanPos.x, targetPointmanX, followAlpha);
    this.simPointmanPos.z = THREE.MathUtils.lerp(this.simPointmanPos.z, targetPointmanZ, followAlpha);
    this.simPointmanPos.y = groundHeightAt(this.simPointmanPos.x, this.simPointmanPos.z) + 1.6;

    this.simRtoPos.x = THREE.MathUtils.lerp(this.simRtoPos.x, targetRtoX, followAlpha);
    this.simRtoPos.z = THREE.MathUtils.lerp(this.simRtoPos.z, targetRtoZ, followAlpha);
    this.simRtoPos.y = groundHeightAt(this.simRtoPos.x, this.simRtoPos.z) + 1.6;

    this.audio.updateSpatialSource(
      'sim-pointman',
      this.simPointmanPos.x,
      this.simPointmanPos.y,
      this.simPointmanPos.z,
    );
    this.audio.updateSpatialSource(
      'sim-rto',
      this.simRtoPos.x,
      this.simRtoPos.y,
      this.simRtoPos.z,
    );

    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.audio.updateSpatialSource(`enemy-${e.id}`, e.x, e.y + 1.55, e.z);
    }

    // 3. Simulated local squad proximity voice chatter (when Proximity Voice is enabled)
    if (this.audio.isProximityVoiceEnabled()) {
      this.squadChatterCooldown -= dt;
      if (this.squadChatterCooldown <= 0) {
        const inCombat = this.enemies.some(
          (e) => e.alive && e.state !== 'patrol' && Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z) < 55,
        );
        this.squadChatterCooldown = inCombat ? 5.2 + Math.random() * 4.2 : 7.5 + Math.random() * 5.5;

        const nearbyStations: {
          id: string;
          kind: 'howitzer' | 'fdc' | 'huey' | 'sentry';
          x: number;
          y: number;
          z: number;
        }[] = [];

        for (const gun of this.howitzers) {
          if (Math.hypot(gun.x - this.playerPos.x, gun.z - this.playerPos.z) < 34) {
            nearbyStations.push({ id: `gun-${gun.state.id}`, kind: 'howitzer', x: gun.x, y: gun.y + 1.6, z: gun.z });
          }
        }
        if (Math.hypot(this.fdcPos.x - this.playerPos.x, this.fdcPos.z - this.playerPos.z) < 32) {
          nearbyStations.push({
            id: 'station-fdc',
            kind: 'fdc',
            x: this.fdcPos.x,
            y: groundHeightAt(this.fdcPos.x, this.fdcPos.z) + 1.5,
            z: this.fdcPos.z,
          });
        }
        if (this.huey?.group) {
          const hx = this.huey.group.position.x;
          const hz = this.huey.group.position.z;
          if (Math.hypot(hx - this.playerPos.x, hz - this.playerPos.z) < 34) {
            nearbyStations.push({
              id: 'station-huey',
              kind: 'huey',
              x: hx,
              y: this.huey.group.position.y + 1.7,
              z: hz,
            });
          }
        }
        const towerX = 11;
        const towerZ = LZ_BRAVO_POS.z - 4;
        if (Math.hypot(towerX - this.playerPos.x, towerZ - this.playerPos.z) < 32) {
          nearbyStations.push({
            id: 'station-sentry',
            kind: 'sentry',
            x: towerX,
            y: groundHeightAt(towerX, towerZ) + 4.2,
            z: towerZ,
          });
        }

        if (nearbyStations.length > 0 && Math.random() < 0.55) {
          const pick = nearbyStations[Math.floor(Math.random() * nearbyStations.length)];
          this.audio.playSquadProximityVoice(
            pick.id,
            pick.kind,
            pick.x,
            pick.y,
            pick.z,
            this.computePanToWorld(pick.x, pick.z),
          );
        } else if (Math.random() < 0.55) {
          this.audio.playSquadProximityVoice(
            'sim-pointman',
            'pointman',
            this.simPointmanPos.x,
            this.simPointmanPos.y,
            this.simPointmanPos.z,
            this.computePanToWorld(this.simPointmanPos.x, this.simPointmanPos.z),
          );
        } else {
          this.audio.playSquadProximityVoice(
            'sim-rto',
            'rto',
            this.simRtoPos.x,
            this.simRtoPos.y,
            this.simRtoPos.z,
            this.computePanToWorld(this.simRtoPos.x, this.simRtoPos.z),
          );
        }
      }
    }

    // 4. Random enemy AI Vietnamese radio chatter
    this.enemyRadioChatterCooldown -= dt;
    if (this.enemyRadioChatterCooldown <= 0) {
      const candidates: { enemy: EnemyActor; dist: number }[] = [];
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z);
        if (d <= 88) {
          candidates.push({ enemy: e, dist: d });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.dist - b.dist);
        const poolLimit = Math.min(candidates.length, 5);
        const chosen = candidates[Math.floor(Math.random() * poolLimit)].enemy;
        const situation: 'patrol' | 'contact' | 'flank' | 'suppress' | 'wounded' | 'commander' =
          chosen.state === 'retreat'
            ? 'wounded'
            : chosen.role === 'commander' && chosen.state !== 'patrol'
              ? 'commander'
              : chosen.state === 'flank' || chosen.state === 'bound'
                ? 'flank'
                : chosen.state === 'suppress_pin'
                  ? 'suppress'
                  : chosen.state === 'patrol'
                    ? 'patrol'
                    : 'contact';
        this.triggerEnemyRadioChatter(chosen, situation);
        const activeFire = chosen.state !== 'patrol';
        this.enemyRadioChatterCooldown = activeFire ? 4.4 + Math.random() * 4.0 : 6.8 + Math.random() * 5.2;
      } else {
        this.enemyRadioChatterCooldown = 4.0;
      }
    }
  }

  private updateArtilleryAndAmbience(dt: number): void {
    // 1. Update wind, cicadas, birds, frogs, and monsoon rain audio
    const riverDist = Math.max(0, distToRiver(this.playerPos.x, this.playerPos.z));
    const isNight = this.hour24 < 5.8 || this.hour24 >= 18.8;
    this.audio.updateAmbience(dt, this.playerPos.y, riverDist, this.rainIntensity, isNight);

    // 2. Horizon flash decay
    if (this.horizonFlashTimer > 0) {
      this.horizonFlashTimer -= dt;
      if (this.horizonFlashTimer <= 0) {
        this.horizonFlashMesh.visible = false;
      }
    }

    if (this.strikeCooldownSec > 0) {
      this.strikeCooldownSec = Math.max(0, this.strikeCooldownSec - dt);
    }

    // 3. Battery timers, acoustic detection, and friendly counter-battery strike impacts
    for (const b of this.batteries) {
      if (b.info.status === 'neutralized') continue;
      b.info.lastShotAgeSec += dt;

      if (b.info.status === 'striking') {
        b.strikeFlightTimer -= dt;
        if (b.strikeFlightTimer <= 0) {
          b.info.status = 'neutralized';
          const pan = this.computePanToWorld(b.info.worldX, b.info.worldZ);
          this.audio.playCounterBatteryImpact(pan);
          this.spawnHorizonFlash(b.info.worldX, b.info.worldZ, 0xff5a2b, 0.55);
          this.audio.playObjectiveChime();
          this.showBanner(`TARGET SPLASH · ${b.info.callsign.toUpperCase()} NEUTRALIZED`);
          this.awardXp(175, 'Counter-Battery Kill');
          this.advanceQuest('q_counter_battery', 1);
          this.advanceDailyMission('counter_battery', 1);
          const nextDetected = this.batteries.find((other) => other.info.status === 'detected');
          this.activeBatteryId = nextDetected ? nextDetected.info.id : null;
        }
        continue;
      }

      b.nextShotIn -= dt;
      if (b.nextShotIn <= 0) {
        const activeStage = this.campaignState?.active
          ? this.campaignState.stages[this.campaignState.currentStageIndex]
          : null;
        const cadenceMult = activeStage ? activeStage.artyCadenceMult : 1.0;
        b.nextShotIn = (11.5 + Math.random() * 6.5) / cadenceMult;
        b.info.lastShotAgeSec = 0;
        if (b.info.status === 'active') {
          b.info.status = 'detected';
        }
        this.activeBatteryId = b.info.id;
        this.recomputeBatteryMath();

        const pan = this.computePanToWorld(b.info.worldX, b.info.worldZ);
        this.audio.playDistantArtillery(pan, b.info.rangeMeters);
        this.spawnHorizonFlash(b.info.worldX, b.info.worldZ, 0xffaa44, 0.24);
      }
    }

    if (this.activeBatteryId) {
      this.recomputeBatteryMath();
    }
  }

  private spawnHorizonFlash(wx: number, wz: number, hex: number, duration: number): void {
    const dx = wx - this.playerPos.x;
    const dz = wz - this.playerPos.z;
    const len = Math.max(1, Math.hypot(dx, dz));
    const horizonDist = 152;
    this.horizonFlashMesh.position.set(
      this.playerPos.x + (dx / len) * horizonDist,
      19,
      this.playerPos.z + (dz / len) * horizonDist,
    );
    (this.horizonFlashMesh.material as THREE.MeshBasicMaterial).color.setHex(hex);
    this.horizonFlashMesh.visible = true;
    this.horizonFlashTimer = duration;
  }

  private updatePlayerMovement(dt: number): void {
    // Bleeding damage over time
    if (this.bleeding) {
      this.health -= dt * 1.8;
      if (this.health <= 0) {
        this.health = 0;
        this.setPhase('gameover');
        return;
      }
    }

    // Bandaging progress
    if (this.bandagingTimer > 0) {
      this.bandagingTimer -= dt;
      if (this.bandagingTimer <= 0) {
        this.bandagingTimer = 0;
        this.bandages = Math.max(0, this.bandages - 1);
        this.bleeding = false;
        const rigHeal = this.getActiveLoadout().rig === 'medic_pack' ? 15 : 0;
        const healAmt = 42 + this.rpgPerks.field_medic * 15 + rigHeal;
        this.health = Math.min(this.maxHealth, this.health + healAmt);
        this.showBanner('WOUND DRESSED · BLEEDING STOPPED');
      }
    }

    let moveForward = (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0) +
      this.touchInput.moveY;
    let moveRight = (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0) -
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0) +
      this.touchInput.moveX;

    const inputLen = Math.hypot(moveForward, moveRight);
    if (inputLen > 1) {
      moveForward /= inputLen;
      moveRight /= inputLen;
    }

    const loadout = this.getActiveLoadout();
    const currentTerrain = this.getCurrentTerrain();
    const camoActive = this.isTerrainCamoActive(currentTerrain);

    this.isAds = this.mouseAdsHeld || this.touchAdsToggled;
    const wantsSprint =
      (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight') || this.touchInput.sprint) &&
      moveForward > 0.35 &&
      !this.isAds &&
      !this.isCrouching &&
      !this.isReloading &&
      this.stamina > 6;

    this.isSprinting = wantsSprint;
    const agility = this.getEffectiveAttr('agility');
    if (this.isSprinting) {
      const drainMult =
        Math.max(0.45, 1 - agility * 0.05) * (this.hasSkillNode('rec_phantom_sprint') ? 0.75 : 1.0);
      this.stamina = Math.max(0, this.stamina - dt * 22 * drainMult);
    } else {
      const regenMult =
        (1 + agility * 0.08) *
        (this.hasSkillNode('rif_bayonet_stride') ? 1.2 : 1.0) *
        (loadout.rig === 'light_webbing' ? 1.15 : 1.0) *
        (loadout.uniform === 'og107_olive' && camoActive ? 1.18 : 1.0) *
        (this.campaignState?.factionId === 'arvn' ? 1.15 : 1.0);
      this.stamina = Math.min(100, this.stamina + dt * (inputLen > 0.1 ? 10 : 18) * regenMult);
    }

    const spec = WEAPON_SPECS[this.activeWeapon];
    const inWater = isInRiver(this.playerPos.x, this.playerPos.z);
    const speedClassMult =
      (this.soldierClass === 'recon' ? 1.14 : 1.0) *
      (this.hasSkillNode('rif_bayonet_stride') ? 1.08 : 1.0) *
      (this.hasSkillNode('rec_phantom_sprint') ? 1.12 : 1.0) *
      (loadout.rig === 'light_webbing' ? 1.08 : 1.0) *
      (loadout.uniform === 'tiger_stripe' && camoActive ? 1.1 : 1.0) *
      (loadout.uniform === 'custom_camo' && camoActive ? 1.1 : 1.0) *
      (this.campaignState?.factionId === 'vc_nlf' ? 1.12 : 1.0);
    const speedAttrMult = 1 + agility * 0.035;
    let baseSpeed = 5.4 * spec.moveSpeedMult * speedClassMult * speedAttrMult;
    if (this.isSprinting) baseSpeed *= 1.48;
    else if (this.isCrouching) baseSpeed *= loadout.headgear === 'boonie_hat' ? 0.695 : 0.62;
    else if (this.isAds) baseSpeed *= 0.7;
    if (inWater && !(loadout.uniform === 'mekong_mud' && camoActive)) baseSpeed *= 0.68;
    if (this.bandagingTimer > 0) baseSpeed *= 0.5;

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    // Forward vector is (-sinY, -cosY), Right vector is (cosY, -sinY)
    const wishX = (-sinY * moveForward + cosY * moveRight) * baseSpeed;
    const wishZ = (-cosY * moveForward - sinY * moveRight) * baseSpeed;

    const accel = 1 - Math.exp(-14 * dt);
    this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, wishX, accel);
    this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, wishZ, accel);

    this.playerPos.x += this.playerVel.x * dt;
    this.playerPos.z += this.playerVel.z * dt;

    // Obstacle circle collision push-out
    const playerRadius = 0.55;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const dx = this.playerPos.x - c.x;
      const dz = this.playerPos.z - c.z;
      const dist = Math.hypot(dx, dz);
      const minD = c.r + playerRadius;
      if (dist < minD && dist > 0.0001) {
        const push = (minD - dist) / dist;
        this.playerPos.x += dx * push;
        this.playerPos.z += dz * push;
      }
    }

    // Natural perimeter ridge boundary
    const radial = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (radial > PLAYABLE_RADIUS) {
      const scale = PLAYABLE_RADIUS / radial;
      this.playerPos.x *= scale;
      this.playerPos.z *= scale;
    }

    // Walkable bridge deck override over river
    const bridgeZ = riverCenterZ(BRIDGE_X);
    const onBridge = Math.abs(this.playerPos.x - BRIDGE_X) < 2.0 && Math.abs(this.playerPos.z - bridgeZ) < 12.8;
    const groundY = onBridge ? 0.55 : groundHeightAt(this.playerPos.x, this.playerPos.z);
    this.playerPos.y = THREE.MathUtils.damp(this.playerPos.y, groundY, 16, dt);

    // Footstep bobbing & procedural crunch/splash
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (horizSpeed > 0.6) {
      const stepRate = this.isSprinting ? 11.5 : this.isCrouching ? 5.5 : 8.2;
      this.bobPhase += dt * stepRate;
      this.footstepAccum += dt * stepRate;
      if (this.footstepAccum >= Math.PI) {
        this.footstepAccum -= Math.PI;
        this.audio.playFootstep(inWater && !onBridge);
      }
    }
  }

  private updateWeaponAndCombat(dt: number): void {
    const spec = WEAPON_SPECS[this.activeWeapon];
    const st = this.weaponStates[this.activeWeapon];

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.reloadTimer = 0;
        const maxMag = this.getEffectiveMagSize(this.activeWeapon);
        const needed = maxMag - st.mag;
        const load = Math.min(needed, st.reserve);
        st.mag += load;
        st.reserve -= load;
      }
    }

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      this.viewmodels[this.activeWeapon].muzzleFlash.visible =
        this.muzzleFlashTimer > 0 && st.attachments.muzzle !== 'suppressor';
    }
    if (this.hitMarkerTimer > 0) this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);

    // Recoil recovery
    this.recoilPitchOffset = THREE.MathUtils.damp(this.recoilPitchOffset, 0, 11, dt);
    this.recoilYawOffset = THREE.MathUtils.damp(this.recoilYawOffset, 0, 11, dt);
    this.weaponKickZ = THREE.MathUtils.damp(this.weaponKickZ, 0, 14, dt);

    const fireTriggerHeld = this.mouseFireHeld || this.touchInput.firing;
    if (this.officerActive && this.binocularZoom) {
      if (fireTriggerHeld && !this.semiTriggerConsumed) {
        this.semiTriggerConsumed = true;
        this.designateBinocularTargetAndFire();
      }
      return;
    }

    if (
      fireTriggerHeld &&
      !this.isReloading &&
      this.bandagingTimer <= 0 &&
      this.fireCooldown <= 0
    ) {
      if (st.fireMode === 'SEMI' && this.semiTriggerConsumed) {
        return;
      }
      if (st.mag <= 0) {
        this.semiTriggerConsumed = true;
        this.audio.playEmptyClick();
        if (st.reserve > 0) this.triggerReload();
        return;
      }

      this.firePlayerWeapon();
      if (st.fireMode === 'SEMI') {
        this.semiTriggerConsumed = true;
      }
    }
  }

  private firePlayerWeapon(): void {
    const spec = WEAPON_SPECS[this.activeWeapon];
    const st = this.weaponStates[this.activeWeapon];
    const att = st.attachments;
    const intl = st.internals;
    const isSuppressed = att.muzzle === 'suppressor';
    const isCompensator = att.muzzle === 'compensator';
    const hasBipodGrip = att.underbarrel === 'bipod_grip';

    st.mag--;
    this.shotsFired++;
    this.fireCooldown = this.getEffectiveFireInterval(this.activeWeapon);
    this.muzzleFlashTimer = isSuppressed ? 0 : 0.042;
    this.viewmodels[this.activeWeapon].muzzleFlash.visible = !isSuppressed;
    this.viewmodels[this.activeWeapon].muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.weaponKickZ = this.activeWeapon === 'm60' ? 0.065 : 0.045;
    this.cameraShake = Math.min(0.4, this.cameraShake + (this.activeWeapon === 'm60' ? 0.12 : 0.07));

    const marks = this.getEffectiveAttr('marksmanship');
    const adsMult = this.isAds ? 0.62 : 1.0;
    const gunnerRecoilMult =
      this.soldierClass === 'machine_gunner' && this.activeWeapon === 'm60' ? 0.75 : 1.0;
    const treeRecoilMult =
      (this.hasSkillNode('rif_controlled_burst') ? 0.8 : 1.0) *
      (this.hasSkillNode('mg_tripod_brace') && (this.activeWeapon === 'm60' || this.isCrouching) ? 0.75 : 1.0);
    const recoilMod =
      (isCompensator ? 0.7 : 1.0) *
      (hasBipodGrip ? 0.78 : 1.0) *
      (intl.spring === 'heavy_buffer' ? 0.8 : 1.0) *
      gunnerRecoilMult *
      treeRecoilMult *
      Math.max(0.55, 1 - marks * 0.04);
    this.recoilPitchOffset += spec.recoilPitch * adsMult * recoilMod;
    this.recoilYawOffset += (Math.random() - 0.5) * spec.recoilYaw * adsMult * recoilMod;

    this.audio.playGunshot(this.activeWeapon, 0, isSuppressed);

    // Alert nearby enemies to gunshot (suppressor + Recon class + terrain camo shrink noise footprint)
    const loadout = this.getActiveLoadout();
    const camoActive = this.isTerrainCamoActive();
    const camoAlertMult =
      camoActive && loadout.uniform === 'charcoal_night'
        ? 0.62
        : camoActive && loadout.uniform === 'tiger_stripe'
          ? 0.65
          : 1.0;
    const baseAlert = isSuppressed ? 22 : 62;
    const alertRadius = Math.round(
      baseAlert *
        (this.soldierClass === 'recon' ? 0.7 : 1.0) *
        (this.hasSkillNode('rec_muffled_step') ? 0.7 : 1.0) *
        camoAlertMult,
    );
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - this.playerPos.x, e.z - this.playerPos.z) < alertRadius) {
        e.lastKnownX = this.playerPos.x;
        e.lastKnownZ = this.playerPos.z;
        e.searchTimer = 7.5;
        if (e.state === 'patrol') e.state = 'investigate';
      }
    }

    // Raycast shot with attachment, internal part & RPG Marksmanship/Deadeye spread
    let baseSpread = this.isAds ? spec.adsSpread : spec.hipSpread;
    if (this.isAds && att.optic === 'colt_scope') baseSpread *= 0.65;
    else if (this.isAds && att.optic === 'oeg_dot') baseSpread *= 0.82;
    if (!this.isAds && hasBipodGrip) baseSpread *= 0.72;
    if (!this.isAds && this.hasSkillNode('rif_controlled_burst')) baseSpread *= 0.85;
    if (this.isAds && this.hasSkillNode('rec_optic_zero')) baseSpread *= 0.78;
    if (this.hasSkillNode('mg_tripod_brace') && (this.activeWeapon === 'm60' || this.isCrouching)) {
      baseSpread *= 0.78;
    }
    if (intl.spring === 'overclock_spring') baseSpread *= 0.85;
    if (this.soldierClass === 'rifleman' && this.activeWeapon === 'm16a1') baseSpread *= 0.85;
    if (this.soldierClass === 'machine_gunner' && this.activeWeapon === 'm60') baseSpread *= 0.75;
    if (this.isAds && this.rpgPerks.deadeye > 0) baseSpread *= Math.max(0.6, 1 - this.rpgPerks.deadeye * 0.08);
    const spread =
      baseSpread * (this.isCrouching ? 0.72 : 1.0) * Math.max(0.55, 1 - marks * 0.04);

    _v1.set(
      (Math.random() - 0.5) * 2 * spread,
      (Math.random() - 0.5) * 2 * spread,
      -1,
    ).normalize();
    _v1.applyQuaternion(this.camera.quaternion);

    this.raycaster.set(this.camera.position, _v1);
    this.raycaster.far = 180;

    // Check enemy hitboxes + mortar ordnance drum AND solid cover/terrain occlusion
    const targets: THREE.Object3D[] = [...this.enemyHitTargets];
    if (!this.mortarDestroyed) targets.push(this.mortarDrumMesh);
    const hits = this.raycaster.intersectObjects(targets, false);
    const firstTargetHit = hits.length > 0 ? hits[0] : null;
    const obstacleHit = this.traceWorldObstacle(this.camera.position, _v1, 180, 0.25);

    let endPoint = _v2.copy(this.camera.position).addScaledVector(_v1, 140);
    if (obstacleHit && (!firstTargetHit || obstacleHit.distance < firstTargetHit.distance - 0.08)) {
      endPoint = obstacleHit.point;
      this.spawnImpactParticles(obstacleHit.point, obstacleHit.isTerrain ? 0x8f7a58 : 0xc8bca6, 4);
    } else if (firstTargetHit) {
      const hit = firstTargetHit;
      endPoint = hit.point;
      if (hit.object === this.mortarDrumMesh) {
        this.detonateMortarNest();
      } else {
        const enemyId = hit.object.userData.enemyId as number | undefined;
        const enemy = this.enemies.find((e) => e.id === enemyId && e.alive);
        if (enemy) {
          this.shotsHit++;
          const isHead = hit.object.userData.hitZone === 'head';
          const erdlDmgBonus = camoActive && loadout.uniform === 'erdl_woodland' ? 1.12 : 1.0;
          const customDmgBonus = camoActive && loadout.uniform === 'custom_camo' ? 1.1 : 1.0;
          const factionDmgBonus = this.campaignState?.factionId === 'rok' ? 1.1 : 1.0;
          const nightHeadBonus = camoActive && loadout.uniform === 'charcoal_night' ? 0.36 : 0;
          const factionHeadBonus = this.campaignState?.factionId === 'anzac' ? 0.33 : 0;
          const dmgMult =
            (intl.trigger === 'lightweight_sear' ? 1.08 : 1.0) *
            (1 + marks * 0.04) *
            (this.hasSkillNode('rif_pointman') && this.activeWeapon === 'm16a1' ? 1.12 : 1.0) *
            (this.hasSkillNode('rec_phantom') && isSuppressed ? 1.18 : 1.0) *
            erdlDmgBonus *
            customDmgBonus *
            factionDmgBonus;
          const headMult =
            spec.headshotMultiplier +
            (this.soldierClass === 'recon' ? 0.45 : 0) +
            (this.hasSkillNode('rec_vital_shot') ? 0.35 : 0) +
            this.rpgPerks.deadeye * 0.25 +
            nightHeadBonus +
            factionHeadBonus;
          const dmg = spec.damage * dmgMult * (isHead ? headMult : 1);
          this.damageEnemy(enemy, dmg, hit.point, isHead);
        }
      }
    } else {
      // Spawn terrain impact puff if shot hits ground
      const groundDist = this.traceGroundPoint(this.camera.position, _v1, _v3);
      if (groundDist > 0) {
        endPoint = _v3;
        this.spawnImpactParticles(_v3, 0x8f7a58, 4);
      }
    }

    // Apply realistic ballistic suppression to enemies near unobstructed line of fire
    const bulletEndDist = endPoint.distanceTo(this.camera.position);
    const suppBoost = this.hasSkillNode('mg_suppression') ? 1.5 : 1.0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const toEx = e.x - this.camera.position.x;
      const toEy = (e.y + 1.1) - this.camera.position.y;
      const toEz = e.z - this.camera.position.z;
      const proj = toEx * _v1.x + toEy * _v1.y + toEz * _v1.z;
      if (proj > 2 && proj < Math.min(80, bulletEndDist + 2.5)) {
        const perpSq = toEx * toEx + toEy * toEy + toEz * toEz - proj * proj;
        if (perpSq < 25) {
          e.suppression = Math.min(1, e.suppression + (this.activeWeapon === 'm60' ? 0.55 : 0.36) * suppBoost);
          e.lastKnownX = this.playerPos.x;
          e.lastKnownZ = this.playerPos.z;
          if (e.state === 'patrol' || e.state === 'investigate') {
            e.state = 'engage';
            this.assignEnemyCover(e);
            this.alertSquadNear(e.x, e.z, 24);
          }
        }
      }
    }

    // Spawn visual tracer from camera forward
    const velMult = intl.bolt === 'titanium_bcg' ? 1.15 : 1.0;
    const tracerStart = _v4.copy(this.camera.position).addScaledVector(_v1, 1.2);
    tracerStart.y -= 0.1;
    this.spawnTracer(tracerStart, endPoint, spec.muzzleVelocity * velMult);
  }

  private traceWorldObstacle(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
    nearDist = 0.25,
  ): { distance: number; point: THREE.Vector3; isTerrain: boolean } | null {
    let bestDist = Infinity;
    let bestIsTerrain = false;

    const step = 1.15;
    let prevD = Math.max(0.2, nearDist);
    for (let d = prevD; d <= maxDist; d += step) {
      _obsTmp.copy(origin).addScaledVector(dir, d);
      const gy = groundHeightAt(_obsTmp.x, _obsTmp.z);
      if (_obsTmp.y <= gy) {
        let lo = prevD;
        let hi = d;
        for (let iter = 0; iter < 4; iter++) {
          const mid = (lo + hi) * 0.5;
          _obsTmp.copy(origin).addScaledVector(dir, mid);
          if (_obsTmp.y <= groundHeightAt(_obsTmp.x, _obsTmp.z)) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        bestDist = hi;
        bestIsTerrain = true;
        break;
      }
      prevD = d;
    }

    const meshMax = Math.min(maxDist, bestDist);
    if (this.solidCoverObjects.length > 0 && meshMax > nearDist) {
      this.losRaycaster.set(origin, dir);
      this.losRaycaster.near = nearDist;
      this.losRaycaster.far = meshMax;
      const hits = this.losRaycaster.intersectObjects(this.solidCoverObjects, true);
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (!h.object.visible) continue;
        if (h.distance < bestDist) {
          bestDist = h.distance;
          bestIsTerrain = false;
          _obsRayHit.copy(h.point);
        }
        break;
      }
    }

    if (bestDist === Infinity) return null;
    const point = new THREE.Vector3();
    if (bestIsTerrain) {
      point.copy(origin).addScaledVector(dir, bestDist);
      point.y = groundHeightAt(point.x, point.z) + 0.05;
    } else {
      point.copy(_obsRayHit);
    }
    return { distance: bestDist, point, isTerrain: bestIsTerrain };
  }

  private traceGroundPoint(origin: THREE.Vector3, dir: THREE.Vector3, out: THREE.Vector3): number {
    for (let d = 4; d < 120; d += 3) {
      out.copy(origin).addScaledVector(dir, d);
      if (out.y <= groundHeightAt(out.x, out.z)) {
        out.y = groundHeightAt(out.x, out.z) + 0.08;
        return d;
      }
    }
    return -1;
  }

  private damageEnemy(
    enemy: EnemyActor,
    dmg: number,
    hitPoint: THREE.Vector3,
    isHead: boolean,
    fromArtillery = false,
    fromGrenade = false,
  ): void {
    enemy.hp -= dmg;
    enemy.hitFlashTimer = 0.1;
    enemy.suppression = Math.min(1, enemy.suppression + 0.65);
    enemy.lastKnownX = this.playerPos.x;
    enemy.lastKnownZ = this.playerPos.z;
    if (enemy.state === 'patrol' || enemy.state === 'investigate') {
      enemy.state = enemy.role === 'flanker' ? 'flank' : 'engage';
      this.assignEnemyCover(enemy);
      this.alertSquadNear(enemy.x, enemy.z, 26);
    }
    this.spawnImpactParticles(hitPoint, 0x992b22, 6);

    const killed = enemy.hp <= 0;
    this.hitMarkerTimer = 0.16;
    this.hitMarkerKill = killed;
    this.audio.playHitConfirm(killed);

    if (killed) {
      enemy.alive = false;
      enemy.deathTimer = 0;
      enemy.model.muzzleFlash.visible = false;
      this.kills++;

      // Class & Perk kill bonuses
      if (this.soldierClass === 'rifleman') {
        this.stamina = Math.min(100, this.stamina + 15);
      }
      if (this.hasSkillNode('rif_linebreaker') && !fromArtillery) {
        this.health = Math.min(this.maxHealth, this.health + 12);
        this.stamina = Math.min(100, this.stamina + 15);
      }
      if (this.rpgPerks.deadeye > 0) {
        this.stamina = Math.min(100, this.stamina + this.rpgPerks.deadeye * 8);
      }
      if (this.rpgPerks.scavenger > 0) {
        const st = this.weaponStates[this.activeWeapon];
        const maxRes = this.getEffectiveMaxReserve(this.activeWeapon);
        st.reserve = Math.min(maxRes, st.reserve + this.rpgPerks.scavenger * 4);
        if (this.rpgPerks.scavenger >= 2 && this.kills % 4 === 0) {
          this.grenadeCount = Math.min(this.getMaxGrenades(), this.grenadeCount + 1);
        }
      }

      // Quest & Daily Mission progression tracking
      this.advanceDailyMission('kills_total', 1);
      if (enemy.sector === 'patrol' || distToRiver(enemy.x, enemy.z) < 24) {
        this.advanceQuest('q_river_patrol', 1);
        this.advanceDailyMission('kills_river', 1);
      }
      if (isHead) {
        this.advanceQuest('q_headhunter', 1);
        this.advanceDailyMission('kills_headshot', 1);
      }
      if (fromArtillery || this.activeWeapon === 'm60') {
        this.advanceQuest('q_danger_close', 1);
      }
      if (fromArtillery) {
        this.advanceDailyMission('artillery_kills', 1);
      }
      if (fromGrenade) {
        this.advanceDailyMission('grenade_kills', 1);
      }
      if (this.isCrouching && !fromArtillery) {
        this.advanceDailyMission('kills_crouched', 1);
      }

      if (fromArtillery) {
        this.artyKills++;
        const artyXp =
          (this.soldierClass === 'artillery_officer' ? 150 : 125) +
          (this.hasSkillNode('art_steel_rain') ? 45 : 0);
        this.awardXp(artyXp, '155mm Artillery Kill');
      } else if (isHead) {
        this.hitstopTimer = 0.036;
        const baseHeadXp = this.soldierClass === 'recon' ? 190 : 150;
        const headXp = this.hasSkillNode('rec_shadow_xp') ? Math.round(baseHeadXp * 1.25) : baseHeadXp;
        this.awardXp(headXp, 'Headshot Neutralization');
      } else {
        this.awardXp(100, 'Hostile Neutralized');
      }
    }
  }

  private triggerExplosion(
    center: THREE.Vector3,
    radius: number,
    maxDmg: number,
    fromArtillery = false,
    isWp = false,
    fromGrenade = false,
  ): void {
    const distToPlayer = center.distanceTo(this.playerPos);
    const pan = this.computePanToWorld(center.x, center.z);
    this.audio.playExplosion(distToPlayer, pan, fromArtillery);
    this.audio.playShrapnelHiss(distToPlayer, pan, fromArtillery ? 9 : 5);
    this.cameraShake = Math.min(
      fromArtillery ? 1.15 : 0.9,
      this.cameraShake + Math.max(0.12, (fromArtillery ? 1.05 : 0.85) * (1 - distToPlayer / 45)),
    );
    this.hitstopTimer = fromArtillery && distToPlayer < 25 ? 0.055 : 0.036;

    // 1. Physically tear up the ground into a blasted, soot-blackened crater with churned dirt rim
    if (this.terrainMesh) {
      const craterR = fromArtillery ? 5.6 : 2.55;
      const craterDepth = fromArtillery ? 1.45 : 0.52;
      deformTerrainCrater(this.terrainMesh, center.x, center.z, craterR, craterDepth);

      // Blast away nearby elephant grass tufts around the crater
      if (this.grassInstanced && this.grassInstances.length > 0) {
        const blastR = craterR * 1.4;
        const dummy = new THREE.Object3D();
        let grassChanged = false;
        for (let i = 0; i < this.grassInstances.length; i++) {
          const g = this.grassInstances[i];
          if (g.blasted) continue;
          if (Math.hypot(g.x - center.x, g.z - center.z) <= blastR) {
            g.blasted = true;
            dummy.position.set(g.x, g.y - 5, g.z);
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            this.grassInstanced.setMatrixAt(i, dummy.matrix);
            grassChanged = true;
          }
        }
        if (grassChanged) {
          this.grassInstanced.instanceMatrix.needsUpdate = true;
        }
      }

      // Snap player and nearby soldiers cleanly onto newly deformed ground/crater height
      this.playerPos.y = groundHeightAt(this.playerPos.x, this.playerPos.z);
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (Math.hypot(enemy.x - center.x, enemy.z - center.z) < craterR * 1.6) {
          enemy.y = groundHeightAt(enemy.x, enemy.z);
        }
      }
    }

    // 2. Spawn multi-layered visual shockwave, fireball, billowing smoke, and blast flash light
    const blastSlot = this.blastEffects.find((b) => !b.active);
    if (blastSlot) {
      const groundY = groundHeightAt(center.x, center.z);
      blastSlot.active = true;
      blastSlot.age = 0;
      blastSlot.maxAge = fromArtillery ? 2.1 : 1.3;
      blastSlot.maxRadius = fromArtillery ? radius * 0.95 : radius * 0.72;
      blastSlot.isWp = isWp;

      blastSlot.shockwave.position.set(center.x, groundY + 0.16, center.z);
      blastSlot.shockwave.scale.setScalar(0.5);
      (blastSlot.shockwave.material as THREE.MeshBasicMaterial).color.setHex(isWp ? 0xf5f2e8 : 0xffd08a);
      (blastSlot.shockwave.material as THREE.MeshBasicMaterial).opacity = 0.85;
      blastSlot.shockwave.visible = true;

      blastSlot.fireball.position.set(center.x, groundY + 0.8, center.z);
      blastSlot.fireball.scale.setScalar(0.7);
      (blastSlot.fireball.material as THREE.MeshBasicMaterial).color.setHex(isWp ? 0xfbf9f0 : 0xff761a);
      (blastSlot.fireball.material as THREE.MeshBasicMaterial).opacity = 0.95;
      blastSlot.fireball.visible = true;

      blastSlot.smoke.position.set(center.x, groundY + 1.2, center.z);
      blastSlot.smoke.scale.setScalar(0.9);
      (blastSlot.smoke.material as THREE.MeshBasicMaterial).color.setHex(isWp ? 0xdadbd4 : 0x26211c);
      (blastSlot.smoke.material as THREE.MeshBasicMaterial).opacity = 0.82;
      blastSlot.smoke.visible = true;

      blastSlot.light.position.set(center.x, groundY + 2.5, center.z);
      blastSlot.light.color.setHex(isWp ? 0xf5f5eb : 0xff8a2b);
      blastSlot.light.intensity = fromArtillery ? 18 : 10;
      blastSlot.light.visible = true;
    }

    // 3. Eject clods of churned soil, embers, and high-velocity physical shrapnel shards
    this.spawnImpactParticles(center, isWp ? 0xf5f2e8 : 0xff8c2b, fromArtillery ? 26 : 18);
    this.spawnImpactParticles(center, isWp ? 0xdcdcd2 : 0x3b2a1e, fromArtillery ? 24 : 14);
    this.spawnShrapnelBurst(center, fromArtillery ? 28 : 14, isWp);

    // 155mm direct support can also destroy Sector Alpha's mortar emplacement!
    if (
      fromArtillery &&
      !this.mortarDestroyed &&
      Math.hypot(center.x - this.activeAlphaPos.x, center.z - this.activeAlphaPos.z) < 14
    ) {
      this.detonateMortarNest();
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const d = Math.hypot(enemy.x - center.x, enemy.z - center.z);
      if (d < radius) {
        const dmg = maxDmg * (1 - d / radius);
        this.damageEnemy(
          enemy,
          dmg,
          new THREE.Vector3(enemy.x, enemy.y + 1.1, enemy.z),
          false,
          fromArtillery,
          fromGrenade,
        );
      } else if (d < radius * 2.2) {
        enemy.suppression = Math.min(1, enemy.suppression + 0.78);
        enemy.lastKnownX = this.playerPos.x;
        enemy.lastKnownZ = this.playerPos.z;
        if (enemy.state === 'patrol') enemy.state = 'investigate';
        this.assignEnemyCover(enemy);
      }
    }

    // 4. Lethal close-range blast core & outer high-velocity shrapnel zone for player
    const blastLoadout = this.getActiveLoadout();
    const khakiBlastMit =
      blastLoadout.uniform === 'khaki_tan' && this.isTerrainCamoActive() ? 0.8 : 1.0;
    const flakMit = blastLoadout.rig === 'flak_jacket' ? 0.82 : 1.0;
    const factionBlastMit = this.campaignState?.factionId === 'pavn_nva' ? 0.82 : 1.0;
    const dangerCloseMitigation =
      Math.max(0.3, 1 - this.rpgPerks.danger_close * 0.22) *
      (this.hasSkillNode('mg_flak_plate') ? 0.8 : 1.0) *
      khakiBlastMit *
      flakMit *
      factionBlastMit;
    const lethalCoreRadius = fromArtillery ? 7.5 : 4.2;
    const shrapnelOuterRadius = fromArtillery ? 26.0 : 13.0;
    if (distToPlayer < lethalCoreRadius) {
      // Directly inside lethal blast/shrapnel core: fatal unless mitigated heavily
      const rawDmg = fromArtillery
        ? 145 + (1 - distToPlayer / lethalCoreRadius) * 45
        : 120 + (1 - distToPlayer / lethalCoreRadius) * 40;
      const pDmg = rawDmg * dangerCloseMitigation;
      this.bleeding = true;
      if (this.health - pDmg <= 0) {
        this.showBanner(
          fromArtillery ? 'KILLED BY 155MM ARTILLERY SHRAPNEL' : 'KILLED BY FRAG SHRAPNEL',
        );
      }
      this.applyPlayerDamage(pDmg, center.x, center.z);
    } else if (distToPlayer < shrapnelOuterRadius) {
      // Mid-range shrapnel lacerations: crouching & solid cover dramatically reduce exposure
      _obsOrigin.set(center.x, center.y + 0.45, center.z);
      _obsTmp.set(
        this.playerPos.x,
        this.playerPos.y + (this.isCrouching ? 0.72 : 1.18),
        this.playerPos.z,
      );
      _obsDir.copy(_obsTmp).sub(_obsOrigin);
      const toChestLen = _obsDir.length();
      _obsDir.multiplyScalar(1 / Math.max(0.001, toChestLen));
      const shrapnelCover = this.traceWorldObstacle(_obsOrigin, _obsDir, toChestLen, 0.35);
      const inSolidCover = shrapnelCover !== null && shrapnelCover.distance < toChestLen - 0.35;

      const rangeFactor = 1 - (distToPlayer - lethalCoreRadius) / (shrapnelOuterRadius - lethalCoreRadius);
      const postureMult = this.isCrouching ? 0.45 : 1.0;
      const coverProbMult = inSolidCover ? 0.42 : 1.0;
      const coverDmgMult = inSolidCover ? 0.28 : 1.0;
      const hitChance = Math.min(0.95, (0.28 + rangeFactor * 0.7) * postureMult * coverProbMult);
      if (Math.random() < hitChance) {
        const rawShrapnel = (fromArtillery ? 44 : 30) + rangeFactor * (fromArtillery ? 56 : 38);
        const shrapnelDmg = rawShrapnel * dangerCloseMitigation * coverDmgMult;
        this.bleeding = shrapnelDmg >= 14;
        if (this.health - shrapnelDmg <= 0) {
          this.showBanner(
            fromArtillery ? 'KILLED BY 155MM ARTILLERY SHRAPNEL' : 'KILLED BY FRAG SHRAPNEL',
          );
        } else if (!inSolidCover) {
          this.showBanner('STRUCK BY SHRAPNEL · APPLY FIELD DRESSING [H]');
        }
        this.applyPlayerDamage(shrapnelDmg, center.x, center.z);
      }
    }
  }

  private spawnShrapnelBurst(origin: THREE.Vector3, count: number, isWp: boolean): void {
    let spawned = 0;
    for (const sh of this.shrapnelPool) {
      if (sh.active) continue;
      sh.active = true;
      sh.groundPuffDone = false;
      sh.pos.set(origin.x, origin.y + 0.35, origin.z);

      const yaw = Math.random() * Math.PI * 2;
      const elev = 0.05 + Math.random() * 0.42;
      const speed = 42 + Math.random() * 52;
      const horiz = Math.cos(elev) * speed;
      sh.vel.set(Math.cos(yaw) * horiz, Math.sin(elev) * speed, Math.sin(yaw) * horiz);
      sh.rotVel.set(
        (Math.random() - 0.5) * 32,
        (Math.random() - 0.5) * 32,
        (Math.random() - 0.5) * 32,
      );
      sh.life = 0.45 + Math.random() * 0.45;
      (sh.mesh.material as THREE.MeshBasicMaterial).color.setHex(
        isWp ? 0xf7f5ec : Math.random() < 0.65 ? 0xffaa44 : 0x55524c,
      );
      sh.mesh.position.copy(sh.pos);
      sh.mesh.scale.setScalar(0.85 + Math.random() * 0.8);
      sh.mesh.visible = true;

      spawned++;
      if (spawned >= count) break;
    }
  }

  private updateBlastAndShrapnel(dt: number): void {
    for (const b of this.blastEffects) {
      if (!b.active) continue;
      b.age += dt;
      const t = Math.min(1, b.age / b.maxAge);

      // Expanding ground shockwave ring
      const shockT = Math.min(1, t * 2.5);
      const shockScale = 0.5 + shockT * b.maxRadius;
      b.shockwave.scale.setScalar(shockScale);
      (b.shockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - shockT));
      b.shockwave.visible = shockT < 1;

      // Fiery core fireball dome
      const fireT = Math.min(1, t * 1.9);
      const fireScale = 0.8 + Math.sin(fireT * Math.PI * 0.6) * (b.maxRadius * 0.34);
      b.fireball.scale.set(fireScale, fireScale * 1.2, fireScale);
      b.fireball.position.y += dt * 3.4;
      (b.fireball.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.92 * (1 - fireT));
      b.fireball.visible = fireT < 1;

      // Billowing dark smoke plume rising above crater
      const smokeScale = 1.1 + t * (b.maxRadius * 0.48);
      b.smoke.scale.set(smokeScale, smokeScale * 1.35, smokeScale);
      b.smoke.position.y += dt * 4.5;
      b.smoke.rotation.y += dt * 0.45;
      (b.smoke.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.78 * (1 - t * t));

      // Blast point light flash decay
      const lightT = Math.max(0, 1 - t * 4.2);
      b.light.intensity = (b.maxRadius > 11 ? 18 : 10) * lightT * lightT;
      if (lightT <= 0) b.light.visible = false;

      if (t >= 1) {
        b.active = false;
        b.shockwave.visible = false;
        b.fireball.visible = false;
        b.smoke.visible = false;
        b.light.visible = false;
      }
    }

    for (const sh of this.shrapnelPool) {
      if (!sh.active) continue;
      sh.vel.y -= 18 * dt;
      sh.pos.addScaledVector(sh.vel, dt);
      sh.mesh.position.copy(sh.pos);
      sh.mesh.rotation.x += sh.rotVel.x * dt;
      sh.mesh.rotation.y += sh.rotVel.y * dt;
      sh.mesh.rotation.z += sh.rotVel.z * dt;
      sh.life -= dt;

      const gy = groundHeightAt(sh.pos.x, sh.pos.z);
      if (sh.pos.y <= gy + 0.08) {
        if (!sh.groundPuffDone) {
          sh.groundPuffDone = true;
          this.spawnImpactParticles(sh.pos, 0x6b523b, 2);
        }
        sh.active = false;
        sh.mesh.visible = false;
      } else if (sh.life <= 0) {
        sh.active = false;
        sh.mesh.visible = false;
      }
    }
  }

  private updateHowitzerSquad(dt: number): void {
    for (const gun of this.howitzers) {
      // Smoothly slew turret yaw & barrel elevation toward assigned firing solution
      const yawDiff = Math.atan2(
        Math.sin(gun.targetYaw - gun.handle.turretPivot.rotation.y),
        Math.cos(gun.targetYaw - gun.handle.turretPivot.rotation.y),
      );
      gun.handle.turretPivot.rotation.y += yawDiff * Math.min(1, dt * 6.5);
      gun.handle.group.updateMatrixWorld(true);
      gun.handle.barrelPivot.rotation.x = THREE.MathUtils.lerp(
        gun.handle.barrelPivot.rotation.x,
        gun.targetPitch,
        Math.min(1, dt * 6.5),
      );

      // Decay barrel recoil & muzzle flash
      gun.recoilOffset = THREE.MathUtils.damp(gun.recoilOffset, 0, 7, dt);
      gun.handle.recoilSlide.position.z = gun.recoilOffset;
      if (gun.muzzleTimer > 0) {
        gun.muzzleTimer -= dt;
        gun.handle.muzzleFlash.visible = gun.muzzleTimer > 0;
      }

      // Staggered firing cadence
      if (gun.state.status === 'FIRING') {
        gun.fireDelay -= dt;
        if (gun.fireDelay <= 0) {
          gun.state.status = 'RELOADING';
          const beretArtyMult = this.getActiveLoadout().headgear === 'comms_beret' ? 0.85 : 1.0;
          const artyReloadMult = Math.max(
            0.38,
            (1 - this.getEffectiveAttr('command') * 0.06 - (this.soldierClass === 'artillery_officer' ? 0.25 : 0)) *
              (this.hasSkillNode('art_rapid_lanyard') ? 0.82 : 1.0) *
              beretArtyMult,
          );
          gun.state.reloadLeftSec = Number((6.5 * artyReloadMult).toFixed(1));
          gun.recoilOffset = 0.75;
          gun.muzzleTimer = 0.14;
          gun.handle.muzzleFlash.visible = true;
          gun.handle.muzzleFlash.rotation.z = Math.random() * Math.PI;

          const distToGun = Math.hypot(this.playerPos.x - gun.x, this.playerPos.z - gun.z);
          const pan = this.computePanToWorld(gun.x, gun.z);
          this.audio.playHowitzerFire(distToGun, pan);
          if (distToGun < 28) {
            this.cameraShake = Math.min(0.65, this.cameraShake + 0.25 * (1 - distToGun / 28));
          }

          // Spawn visible arcing 155mm shell projectile
          const startPos = new THREE.Vector3();
          gun.handle.muzzleFlash.getWorldPosition(startPos);
          const shellMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 8, 8),
            new THREE.MeshBasicMaterial({ color: gun.pendingIsWp ? 0xf5f5eb : 0xffaa3b }),
          );
          shellMesh.position.copy(startPos);
          this.scene.add(shellMesh);

          const range = Math.hypot(gun.pendingTargetX - gun.x, gun.pendingTargetZ - gun.z);
          const flightDuration = 2.0 + Math.min(1.3, range / 160);
          this.incomingShells.push({
            mesh: shellMesh,
            startPos,
            targetX: gun.pendingTargetX,
            targetZ: gun.pendingTargetZ,
            targetY: groundHeightAt(gun.pendingTargetX, gun.pendingTargetZ) + 0.3,
            elapsed: 0,
            flightDuration,
            isWp: gun.pendingIsWp,
            whistlePlayed: false,
          });
        }
      } else if (gun.state.status === 'RELOADING') {
        gun.state.reloadLeftSec = Math.max(0, gun.state.reloadLeftSec - dt);
        if (gun.state.reloadLeftSec <= 0) {
          gun.state.status = 'READY';
          gun.state.reloadLeftSec = 0;
        }
      }
    }

    // Update arcing 155mm shells in flight
    let minEta = Infinity;
    for (let i = this.incomingShells.length - 1; i >= 0; i--) {
      const s = this.incomingShells[i];
      s.elapsed += dt;
      const t = Math.min(1, s.elapsed / s.flightDuration);
      const x = THREE.MathUtils.lerp(s.startPos.x, s.targetX, t);
      const z = THREE.MathUtils.lerp(s.startPos.z, s.targetZ, t);
      const linearY = THREE.MathUtils.lerp(s.startPos.y, s.targetY, t);
      const arcApex = 38 * 4 * t * (1 - t);
      s.mesh.position.set(x, linearY + arcApex, z);

      const rem = Math.max(0, s.flightDuration - s.elapsed);
      if (rem < minEta) minEta = rem;

      if (rem <= 0.64 && !s.whistlePlayed) {
        s.whistlePlayed = true;
        const dImpact = Math.hypot(s.targetX - this.playerPos.x, s.targetZ - this.playerPos.z);
        if (dImpact < 72) {
          this.audio.playIncomingShellWhistle(this.computePanToWorld(s.targetX, s.targetZ));
        }
      }

      if (t >= 1) {
        this.scene.remove(s.mesh);
        this.incomingShells.splice(i, 1);
        const impact = new THREE.Vector3(s.targetX, s.targetY, s.targetZ);
        const splashMult =
          (this.soldierClass === 'artillery_officer' ? 1.2 : 1.0) *
          (this.hasSkillNode('art_hc_shells') ? 1.2 : 1.0) *
          (this.hasSkillNode('art_steel_rain') ? 1.15 : 1.0);
        const dmgMult =
          (1 + this.getEffectiveAttr('command') * 0.08) *
          (this.hasSkillNode('art_wp_chemistry') ? 1.22 : 1.0) *
          (this.campaignState?.factionId === 'us_macv' ? 1.15 : 1.0);
        this.triggerExplosion(
          impact,
          (s.isWp ? 19 : 16) * splashMult,
          (s.isWp ? 175 : 225) * dmgMult,
          true,
          s.isWp,
        );
      }
    }
    this.artyEtaSec = minEta < Infinity ? Number(minEta.toFixed(1)) : null;
  }

  private updateGrenades(dt: number): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vel.y -= 16.5 * dt;
      g.pos.addScaledVector(g.vel, dt);

      const gy = groundHeightAt(g.pos.x, g.pos.z) + 0.11;
      if (g.pos.y < gy) {
        g.pos.y = gy;
        g.vel.y = Math.abs(g.vel.y) * 0.35;
        g.vel.x *= 0.65;
        g.vel.z *= 0.65;
      }
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 7;

      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
        const fragRadius = 10.0 * (!g.fromEnemy && this.hasSkillNode('rif_grenadier') ? 1.18 : 1.0);
        this.triggerExplosion(g.pos, fragRadius, g.fromEnemy ? 125 : 145, false, false, !g.fromEnemy);
      }
    }
  }

  private spawnTracer(start: THREE.Vector3, target: THREE.Vector3, speed: number): void {
    const slot = this.tracers.find((t) => !t.active);
    if (!slot) return;
    slot.active = true;
    slot.pos.copy(start);
    slot.vel.copy(target).sub(start).normalize().multiplyScalar(speed);
    slot.life = Math.min(0.65, start.distanceTo(target) / speed);
    slot.mesh.position.copy(start);
    slot.mesh.lookAt(target);
    slot.mesh.visible = true;
  }

  private updateTracers(dt: number): void {
    for (const t of this.tracers) {
      if (!t.active) continue;
      t.pos.addScaledVector(t.vel, dt);
      t.mesh.position.copy(t.pos);
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.mesh.visible = false;
      }
    }
  }

  private spawnImpactParticles(origin: THREE.Vector3, hex: number, count: number): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.pos.copy(origin);
      p.vel.set((Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8);
      p.maxLife = 0.28 + Math.random() * 0.32;
      p.life = p.maxLife;
      p.scale = 0.7 + Math.random() * 0.8;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(hex);
      p.mesh.position.copy(origin);
      p.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.vel.y -= 14 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.life -= dt;
      const ratio = Math.max(0, p.life / p.maxLife);
      p.mesh.scale.setScalar(p.scale * ratio);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private alertSquadNear(originX: number, originZ: number, radius: number): void {
    for (const ally of this.enemies) {
      if (!ally.alive) continue;
      if (Math.hypot(ally.x - originX, ally.z - originZ) <= radius) {
        ally.lastKnownX = this.playerPos.x;
        ally.lastKnownZ = this.playerPos.z;
        ally.searchTimer = 8.0;
        if (ally.state === 'patrol') {
          ally.state = ally.role === 'flanker' ? 'flank' : 'investigate';
          this.assignEnemyCover(ally);
        }
      }
    }
  }

  private assignEnemyCover(e: EnemyActor): void {
    let bestScore = Infinity;
    let bestX: number | null = null;
    let bestZ: number | null = null;
    const threatX = e.lastKnownX;
    const threatZ = e.lastKnownZ;

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (c.r < 0.45) continue;
      const dToEnemy = Math.hypot(c.x - e.x, c.z - e.z);
      if (dToEnemy > 18 || dToEnemy < 1.2) continue;

      const awayX = c.x - threatX;
      const awayZ = c.z - threatZ;
      const awayLen = Math.max(0.5, Math.hypot(awayX, awayZ));
      const coverX = c.x + (awayX / awayLen) * (c.r + 0.9);
      const coverZ = c.z + (awayZ / awayLen) * (c.r + 0.9);
      if (isInRiver(coverX, coverZ)) continue;
      const dToThreat = Math.hypot(coverX - threatX, coverZ - threatZ);
      if (dToThreat < 6) continue;

      const score = dToEnemy + (c.r > 0.7 ? -2.5 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestX = coverX;
        bestZ = coverZ;
      }
    }

    e.coverX = bestX;
    e.coverZ = bestZ;
  }

  private assignForwardOrFlankCover(e: EnemyActor): void {
    let bestScore = Infinity;
    let bestX: number | null = null;
    let bestZ: number | null = null;
    const threatX = e.lastKnownX;
    const threatZ = e.lastKnownZ;
    const curDistToThreat = Math.hypot(e.x - threatX, e.z - threatZ);

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (c.r < 0.45) continue;
      const dToEnemy = Math.hypot(c.x - e.x, c.z - e.z);
      if (dToEnemy > 24 || dToEnemy < 2.2) continue;

      const awayX = c.x - threatX;
      const awayZ = c.z - threatZ;
      const awayLen = Math.max(0.5, Math.hypot(awayX, awayZ));
      const coverX = c.x + (awayX / awayLen) * (c.r + 0.95);
      const coverZ = c.z + (awayZ / awayLen) * (c.r + 0.95);
      if (isInRiver(coverX, coverZ)) continue;

      const dToThreat = Math.hypot(coverX - threatX, coverZ - threatZ);
      if (dToThreat < 8.5 || dToThreat > curDistToThreat + 4) continue;

      const lateralBonus = e.role === 'flanker' ? -Math.abs((c.x - e.x) * awayZ - (c.z - e.z) * awayX) * 0.08 : 0;
      const advanceScore = dToEnemy + (dToThreat < curDistToThreat ? -3.5 : 1.5) + lateralBonus;
      if (advanceScore < bestScore) {
        bestScore = advanceScore;
        bestX = coverX;
        bestZ = coverZ;
      }
    }

    if (bestX !== null && bestZ !== null) {
      e.coverX = bestX;
      e.coverZ = bestZ;
    } else {
      this.assignEnemyCover(e);
    }
  }

  private assignRearCover(e: EnemyActor): void {
    let bestScore = Infinity;
    let bestX: number | null = null;
    let bestZ: number | null = null;
    const threatX = e.lastKnownX;
    const threatZ = e.lastKnownZ;
    const curDist = Math.hypot(e.x - threatX, e.z - threatZ);

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (c.r < 0.45) continue;
      const dToEnemy = Math.hypot(c.x - e.x, c.z - e.z);
      if (dToEnemy > 26 || dToEnemy < 1.5) continue;

      const awayX = c.x - threatX;
      const awayZ = c.z - threatZ;
      const awayLen = Math.max(0.5, Math.hypot(awayX, awayZ));
      const coverX = c.x + (awayX / awayLen) * (c.r + 1.0);
      const coverZ = c.z + (awayZ / awayLen) * (c.r + 1.0);
      if (isInRiver(coverX, coverZ)) continue;

      const dToThreat = Math.hypot(coverX - threatX, coverZ - threatZ);
      if (dToThreat <= curDist + 1.0) continue;

      const score = dToEnemy - (dToThreat - curDist) * 0.85;
      if (score < bestScore) {
        bestScore = score;
        bestX = coverX;
        bestZ = coverZ;
      }
    }

    if (bestX !== null && bestZ !== null) {
      e.coverX = bestX;
      e.coverZ = bestZ;
    } else {
      const awayX = e.x - threatX;
      const awayZ = e.z - threatZ;
      const len = Math.max(0.5, Math.hypot(awayX, awayZ));
      e.coverX = THREE.MathUtils.clamp(e.x + (awayX / len) * 14, -PLAYABLE_RADIUS + 8, PLAYABLE_RADIUS - 8);
      e.coverZ = THREE.MathUtils.clamp(e.z + (awayZ / len) * 14, -PLAYABLE_RADIUS + 8, PLAYABLE_RADIUS - 8);
    }
  }

  private updateEnemyLineOfSight(e: EnemyActor, dist: number): void {
    if (dist > 72) {
      e.hasLos = false;
      e.hasHeadOnlyLos = false;
      return;
    }
    const enemyEyeY = e.y + THREE.MathUtils.lerp(1.52, 1.12, e.crouchBlend);
    const playerEyeY = this.playerPos.y + (this.isCrouching ? 1.02 : 1.6);
    const playerChestY = this.playerPos.y + (this.isCrouching ? 0.72 : 1.15);

    _obsOrigin.set(e.x, enemyEyeY, e.z);
    _v4.set(this.playerPos.x, playerEyeY, this.playerPos.z).sub(_obsOrigin);
    const dEye = _v4.length();
    _obsDir.copy(_v4).multiplyScalar(1 / Math.max(0.001, dEye));
    const eyeBlocked = this.traceWorldObstacle(_obsOrigin, _obsDir, Math.max(0.6, dEye - 0.35), 0.55) !== null;

    _v4.set(this.playerPos.x, playerChestY, this.playerPos.z).sub(_obsOrigin);
    const dChest = _v4.length();
    _obsDir.copy(_v4).multiplyScalar(1 / Math.max(0.001, dChest));
    const chestBlocked =
      this.traceWorldObstacle(_obsOrigin, _obsDir, Math.max(0.6, dChest - 0.35), 0.55) !== null;

    e.hasLos = !eyeBlocked || !chestBlocked;
    e.hasHeadOnlyLos = !eyeBlocked && chestBlocked;
  }

  private throwEnemyGrenade(e: EnemyActor): void {
    if (e.grenadeCount <= 0 || e.grenadeCooldown > 0) return;
    e.grenadeCount--;
    e.grenadeCooldown = 14 + Math.random() * 6;
    e.fireCooldown = Math.max(e.fireCooldown, 1.3);

    const tx = e.lastKnownX + (Math.random() - 0.5) * 3.0;
    const tz = e.lastKnownZ + (Math.random() - 0.5) * 3.0;
    const ty = groundHeightAt(tx, tz) + 0.25;
    const startPos = new THREE.Vector3(e.x, e.y + 1.48, e.z);
    const throwDist = Math.hypot(tx - startPos.x, tz - startPos.z);
    const flightT = THREE.MathUtils.clamp(throwDist / 13.5, 0.85, 1.85);
    const vx = (tx - startPos.x) / flightT;
    const vz = (tz - startPos.z) / flightT;
    const vy = (ty - startPos.y + 0.5 * 16.5 * flightT * flightT) / flightT;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c2f24, roughness: 0.48, metalness: 0.45 }),
    );
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    this.grenades.push({
      mesh,
      pos: startPos,
      vel: new THREE.Vector3(vx, vy, vz),
      fuse: flightT + 0.65,
      fromEnemy: true,
    });

    if (throwDist < 32) {
      this.audio.playBandage();
      this.showBanner('ENEMY FRAG OUT · REPOSITION FROM COVER');
    }
  }

  private coordinateSquadTactics(cmd: EnemyActor): void {
    let squadIdx = 0;
    for (const ally of this.enemies) {
      if (!ally.alive || ally.id === cmd.id) continue;
      if (Math.hypot(ally.x - cmd.x, ally.z - cmd.z) > 28) continue;

      ally.suppression = Math.max(0, ally.suppression - 0.25);
      ally.lastKnownX = cmd.lastKnownX;
      ally.lastKnownZ = cmd.lastKnownZ;
      ally.lastSeenPlayerTime = Math.max(ally.lastSeenPlayerTime, cmd.lastSeenPlayerTime);
      ally.searchTimer = Math.max(ally.searchTimer, 8.5);
      ally.strafeDir = squadIdx % 2 === 0 ? 1 : -1;

      if (ally.state !== 'reloading' && ally.state !== 'retreat') {
        if (ally.role === 'suppressor' || (ally.role === 'rifleman' && squadIdx % 2 === 0)) {
          ally.state = 'suppress_pin';
          ally.tacticTimer = 2.8 + Math.random() * 1.4;
        } else if (ally.role === 'flanker') {
          ally.state = 'flank';
          ally.tacticTimer = 3.2;
        } else {
          ally.state = 'bound';
          ally.tacticTimer = 2.6 + Math.random() * 1.2;
          this.assignForwardOrFlankCover(ally);
        }
      }
      squadIdx++;
    }
  }

  private updateEnemies(dt: number): void {
    const lowVis = this.hour24 < 5.8 || this.hour24 >= 18.8 || this.weather === 'MONSOON';
    const loadout = this.getActiveLoadout();
    const camoActive = this.isTerrainCamoActive();
    let spotStealthMult = loadout.headgear === 'boonie_hat' ? 0.85 : 1.0;
    if (camoActive) {
      if (loadout.uniform === 'og107_olive') spotStealthMult *= 0.72;
      else if (loadout.uniform === 'tiger_stripe') spotStealthMult *= 0.65;
      else if (loadout.uniform === 'mekong_mud') spotStealthMult *= 0.75;
      else if (loadout.uniform === 'charcoal_night') spotStealthMult *= 0.62;
      else if (loadout.uniform === 'custom_camo') spotStealthMult *= 0.72;
    }
    if (this.campaignState?.factionId === 'anzac') spotStealthMult *= 0.82;
    if (this.campaignState?.factionId === 'vc_nlf' && (lowVis || this.getCurrentTerrain() === 'jungle')) {
      spotStealthMult *= 0.75;
    }
    const engageRange = (lowVis ? 36 : 48) * spotStealthMult;
    const alertRange = (lowVis ? 50 : 68) * spotStealthMult;

    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.deathTimer < 1) {
          e.deathTimer = Math.min(1, e.deathTimer + dt * 3.4);
          e.model.group.rotation.x = -e.deathTimer * (Math.PI / 2);
          e.model.group.position.y = e.y - e.deathTimer * 0.2;
        }
        continue;
      }

      if (e.hitFlashTimer > 0) e.hitFlashTimer -= dt;
      if (e.grenadeCooldown > 0) e.grenadeCooldown -= dt;
      if (e.commandCooldown > 0) e.commandCooldown -= dt;
      e.suppression = Math.max(0, e.suppression - dt * 0.24);

      const dx = this.playerPos.x - e.x;
      const dz = this.playerPos.z - e.z;
      const dist = Math.hypot(dx, dz);
      const yawToPlayer = Math.atan2(-dx, -dz);
      const yawDiff = Math.abs(Math.atan2(Math.sin(yawToPlayer - e.yaw), Math.cos(yawToPlayer - e.yaw)));
      const inSightCone = yawDiff < 1.28 || dist < 11.5;

      // Enemy breath timer & underwater check so soldiers cannot stay submerged
      const headY = e.y + THREE.MathUtils.lerp(1.56, 1.18, e.crouchBlend);
      const inRiver = isInRiver(e.x, e.z);
      const submerged = inRiver && (headY < WATER_LEVEL + 0.08 || WATER_LEVEL - e.y > 0.85);
      if (submerged) {
        e.breath = Math.max(0, e.breath - dt);
        e.posture = 'stand';
        if (e.breath <= 0) {
          e.hp -= dt * 18;
          e.drownBubbleTimer -= dt;
          if (e.drownBubbleTimer <= 0) {
            e.drownBubbleTimer = 0.45;
            this.spawnImpactParticles(
              _v1.set(e.x, WATER_LEVEL + 0.08, e.z),
              0x9ec4be,
              4,
            );
          }
          if (e.hp <= 0) {
            e.alive = false;
            e.deathTimer = 0;
            e.model.muzzleFlash.visible = false;
            this.kills++;
            this.awardXp(100, 'Hostile Drowned');
            continue;
          }
        }
      } else {
        e.breath = Math.min(8.0, e.breath + dt * 2.5);
        e.drownBubbleTimer = 0;
      }

      // Staggered solid-obstacle + terrain Line-Of-Sight checks (zero wallhacks / X-ray vision)
      e.losTimer -= dt;
      if (e.losTimer <= 0) {
        e.losTimer = dist < 24 ? 0.09 + Math.random() * 0.05 : 0.14 + Math.random() * 0.08;
        this.updateEnemyLineOfSight(e, dist);
      }

      // Soldier visual & proximity awareness strictly gated by actual line of sight
      if (e.hasLos && dist < engageRange && (inSightCone || e.state !== 'patrol')) {
        e.lastKnownX = this.playerPos.x;
        e.lastKnownZ = this.playerPos.z;
        e.lastSeenPlayerTime = this.elapsedSec;
        e.searchTimer = 8.5;
        if (e.state === 'patrol' || e.state === 'investigate') {
          e.state =
            e.role === 'flanker' && dist > 16
              ? 'flank'
              : e.role === 'suppressor'
                ? 'suppress_pin'
                : 'engage';
          this.assignEnemyCover(e);
          this.alertSquadNear(e.x, e.z, 26);
          if (Math.random() < 0.72) {
            this.triggerEnemyRadioChatter(e, 'contact');
          }
        }
      } else if (e.hasLos && dist < alertRange && inSightCone && e.state === 'patrol') {
        e.lastKnownX = this.playerPos.x;
        e.lastKnownZ = this.playerPos.z;
        e.lastSeenPlayerTime = this.elapsedSec;
        e.searchTimer = 6.5;
        e.state = 'investigate';
      } else if (dist < 7.5 && e.state === 'patrol' && this.isSprinting) {
        e.lastKnownX = this.playerPos.x;
        e.lastKnownZ = this.playerPos.z;
        e.searchTimer = 6.0;
        e.state = 'investigate';
      }

      // Wounded soldiers fall back behind rear cover once per life to bandage
      if (
        !e.healUsed &&
        !submerged &&
        e.hp > 0 &&
        e.hp <= e.maxHp * 0.34 &&
        e.state !== 'retreat' &&
        e.state !== 'reloading'
      ) {
        e.state = 'retreat';
        e.healTimer = 0;
        e.burstLeft = 0;
        e.windupTimer = 0;
        e.model.muzzleFlash.visible = false;
        this.assignRearCover(e);
        if (Math.random() < 0.65) {
          this.triggerEnemyRadioChatter(e, 'wounded');
        }
      }

      // Squad Commander rallies & coordinates pincer flanks / suppressive fire
      if (
        e.role === 'commander' &&
        e.commandCooldown <= 0 &&
        (e.state === 'engage' || e.state === 'suppress_pin' || e.state === 'bound') &&
        this.elapsedSec - e.lastSeenPlayerTime < 8.0
      ) {
        e.commandCooldown = 5.4 + Math.random() * 2.0;
        this.coordinateSquadTactics(e);
        if (Math.random() < 0.8) {
          this.triggerEnemyRadioChatter(e, 'commander');
        }
      }

      // When running out of breath underwater, prioritize scrambling onto the nearest dry riverbank
      if (submerged && e.breath < 5.5) {
        const cz = riverCenterZ(e.x);
        const hw = riverHalfWidth(e.x);
        const bankSide = e.z >= cz ? 1 : -1;
        const escapeZ = cz + bankSide * (hw + 3.2);
        e.model.muzzleFlash.visible = false;
        e.model.torso.rotation.y = THREE.MathUtils.damp(e.model.torso.rotation.y, 0, 8, dt);
        this.moveEnemyToward(e, e.x, escapeZ, 3.6, dt);
        this.animateEnemyPosture(e, dt);
        continue;
      }

      // Tactical retreat & self-bandage behind rear cover
      if (e.state === 'retreat') {
        e.model.muzzleFlash.visible = false;
        e.burstLeft = 0;
        e.windupTimer = 0;
        const hasCover = e.coverX !== null && e.coverZ !== null;
        const dCover = hasCover ? Math.hypot(e.coverX! - e.x, e.coverZ! - e.z) : 0;
        if (hasCover && dCover > 1.35) {
          e.posture = submerged ? 'stand' : 'crouch';
          this.moveEnemyToward(e, e.coverX!, e.coverZ!, 3.85, dt);
        } else {
          e.posture = submerged ? 'stand' : 'crouch';
          this.turnEnemyToward(e, yawToPlayer, dt);
          e.healTimer += dt;
          e.model.torso.rotation.z = Math.sin(e.healTimer * 6) * 0.08;
          if (e.healTimer >= 2.0) {
            e.healUsed = true;
            e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.24));
            e.suppression = Math.max(0, e.suppression - 0.5);
            e.model.torso.rotation.z = 0;
            e.state = 'engage';
            e.tacticTimer = 2.2;
          }
        }
        this.animateEnemyPosture(e, dt);
        continue;
      }

      // Reloading state takes priority when magazine runs dry
      if (e.state === 'reloading') {
        e.posture = submerged ? 'stand' : 'crouch';
        e.model.muzzleFlash.visible = false;
        e.reloadTimer -= dt;
        if (e.coverX !== null && e.coverZ !== null && Math.hypot(e.coverX - e.x, e.coverZ - e.z) > 1.2) {
          this.moveEnemyToward(e, e.coverX, e.coverZ, 3.3, dt, yawToPlayer);
        } else {
          this.turnEnemyToward(e, yawToPlayer, dt);
        }
        if (e.reloadTimer <= 0) {
          e.ammoInMag = e.role === 'suppressor' ? 45 : 30;
          e.state = e.role === 'flanker' && dist > 16 ? 'flank' : 'engage';
          e.fireCooldown = 0.45 + Math.random() * 0.4;
        }
        this.animateEnemyPosture(e, dt);
        continue;
      }

      if (e.state === 'patrol') {
        e.posture = 'stand';
        e.model.muzzleFlash.visible = false;
        const dWp = Math.hypot(e.patrolWaypointX - e.x, e.patrolWaypointZ - e.z);
        if (dWp < 1.0) {
          e.patrolPauseTimer -= dt;
          e.patrolScanPhase += dt * 1.15;
          // Stop & scan horizon realistically
          e.model.torso.rotation.y = Math.sin(e.patrolScanPhase) * 0.42;
          if (e.patrolPauseTimer <= 0) {
            let nextX = e.homeX;
            let nextZ = e.homeZ;
            for (let attempt = 0; attempt < 5; attempt++) {
              const nextA = Math.random() * Math.PI * 2;
              const nextR = 6 + Math.random() * 9;
              const candX = e.homeX + Math.cos(nextA) * nextR;
              const candZ = e.homeZ + Math.sin(nextA) * nextR;
              if (!isInRiver(candX, candZ)) {
                nextX = candX;
                nextZ = candZ;
                break;
              }
            }
            e.patrolWaypointX = nextX;
            e.patrolWaypointZ = nextZ;
            e.patrolPauseTimer = 1.6 + Math.random() * 2.2;
          }
        } else {
          e.model.torso.rotation.y = THREE.MathUtils.damp(e.model.torso.rotation.y, 0, 8, dt);
          this.moveEnemyToward(e, e.patrolWaypointX, e.patrolWaypointZ, 1.85, dt);
        }
      } else if (e.state === 'investigate') {
        e.posture = !submerged && e.suppression > 0.35 ? 'crouch' : 'stand';
        e.model.muzzleFlash.visible = false;
        e.model.torso.rotation.y = Math.sin(this.elapsedSec * 1.8 + e.id) * 0.22;
        const dLast = Math.hypot(e.lastKnownX - e.x, e.lastKnownZ - e.z);
        if (dLast > 3.5) {
          this.moveEnemyToward(e, e.lastKnownX, e.lastKnownZ, 3.0, dt);
        } else {
          e.searchTimer -= dt;
          if (e.searchTimer <= 0) {
            e.state = 'patrol';
          }
        }
      } else if (e.state === 'flank') {
        e.model.torso.rotation.y = THREE.MathUtils.damp(e.model.torso.rotation.y, 0, 8, dt);
        e.posture = !submerged && e.suppression > 0.5 ? 'crouch' : 'stand';
        e.tacticTimer -= dt;
        // Sprint along a 35-degree flanking arc around player's last known position
        const anchorX = e.hasLos ? this.playerPos.x : e.lastKnownX;
        const anchorZ = e.hasLos ? this.playerPos.z : e.lastKnownZ;
        const flankAngle = Math.atan2(e.z - anchorZ, e.x - anchorX) + e.strafeDir * 0.62;
        const targetFlankDist = Math.max(10, Math.min(22, dist * 0.78));
        const fx = anchorX + Math.cos(flankAngle) * targetFlankDist;
        const fz = anchorZ + Math.sin(flankAngle) * targetFlankDist;
        const flankSpeed = e.role === 'flanker' ? 4.4 : 4.1;
        this.moveEnemyToward(e, fx, fz, e.suppression > 0.45 ? 2.6 : flankSpeed, dt, yawToPlayer);

        if (dist < 14 || e.tacticTimer <= 0 || e.suppression > 0.72) {
          e.state = 'engage';
          e.tacticTimer = 2.4 + Math.random() * 2.2;
          this.assignEnemyCover(e);
        }
        this.handleEnemyBurstFire(e, dist, dt);
      } else if (e.state === 'suppress_pin') {
        e.model.torso.rotation.y = THREE.MathUtils.damp(e.model.torso.rotation.y, 0, 8, dt);
        const aimPinYaw = Math.atan2(-(e.lastKnownX - e.x), -(e.lastKnownZ - e.z));
        this.turnEnemyToward(e, e.hasLos ? yawToPlayer : aimPinYaw, dt);
        e.tacticTimer -= dt;
        e.posture = !submerged && (e.suppression > 0.3 || e.coverX !== null) ? 'crouch' : 'stand';
        if (e.tacticTimer <= 0 || e.suppression > 0.75 || this.elapsedSec - e.lastSeenPlayerTime > 3.6) {
          e.state = 'engage';
          e.tacticTimer = 2.2 + Math.random() * 1.6;
        }
        this.handleEnemyBurstFire(e, dist, dt);
      } else if (e.state === 'bound') {
        e.model.torso.rotation.y = THREE.MathUtils.damp(e.model.torso.rotation.y, 0, 8, dt);
        e.tacticTimer -= dt;
        e.posture = 'stand';
        if (e.coverX !== null && e.coverZ !== null && Math.hypot(e.coverX - e.x, e.coverZ - e.z) > 1.35) {
          this.moveEnemyToward(e, e.coverX, e.coverZ, e.suppression > 0.5 ? 2.8 : 3.8, dt, yawToPlayer);
        } else {
          e.state = 'engage';
          e.tacticTimer = 2.2 + Math.random() * 1.8;
        }
        if (e.tacticTimer <= 0 || dist < 11) {
          e.state = 'engage';
          e.tacticTimer = 2.2 + Math.random() * 1.8;
        }
        this.handleEnemyBurstFire(e, dist, dt);
      } else {
        // Engage: cover-seeking, grenade flush, blocked-LOS repositioning & peek-fire cadence
        e.model.torso.rotation.y = THREE.MathUtils.damp(e.model.torso.rotation.y, 0, 8, dt);
        this.turnEnemyToward(e, yawToPlayer, dt);

        if (!e.hasLos && dist < 44) {
          e.coverStayTimer += dt;
          if (
            e.grenadeCount > 0 &&
            e.grenadeCooldown <= 0 &&
            dist >= 9 &&
            dist <= 27 &&
            this.elapsedSec - e.lastSeenPlayerTime < 5.5
          ) {
            this.throwEnemyGrenade(e);
            e.coverStayTimer = 0;
          } else if (e.coverStayTimer > 1.35) {
            e.coverStayTimer = 0;
            if (e.role === 'flanker' || Math.random() < 0.45) {
              e.state = 'flank';
              e.tacticTimer = 2.6;
            } else {
              e.state = 'bound';
              e.tacticTimer = 2.4;
              this.assignForwardOrFlankCover(e);
            }
          }
        } else {
          e.coverStayTimer = 0;
        }

        e.tacticTimer -= dt;
        if (e.tacticTimer <= 0) {
          e.tacticTimer = 2.2 + Math.random() * 2.2;
          e.strafeDir *= -1;
          if (e.role === 'flanker' && dist > 15 && e.suppression < 0.35 && Math.random() < 0.58) {
            e.state = 'flank';
            e.tacticTimer = 2.8;
          } else if (e.role === 'suppressor' && e.suppression < 0.4 && Math.random() < 0.5) {
            e.state = 'suppress_pin';
            e.tacticTimer = 2.6;
          } else if (e.coverX === null || Math.random() < 0.35) {
            this.assignEnemyCover(e);
          }
        }

        const hasCover = e.coverX !== null && e.coverZ !== null;
        const distToCover = hasCover ? Math.hypot(e.coverX! - e.x, e.coverZ! - e.z) : 99;

        if (e.suppression > 0.42 && hasCover && distToCover > 1.2) {
          // Sprint to cover when pinned down
          e.posture = submerged ? 'stand' : 'crouch';
          this.moveEnemyToward(e, e.coverX!, e.coverZ!, 3.8, dt, yawToPlayer);
        } else if (hasCover && distToCover > 1.4 && dist > 11) {
          // Advance / reposition to cover
          e.posture = 'stand';
          this.moveEnemyToward(e, e.coverX!, e.coverZ!, 3.2, dt, yawToPlayer);
        } else if (!e.hasLos && dist > 12 && this.elapsedSec - e.lastSeenPlayerTime < 9.0) {
          // Step laterally around blocking cover or push toward last known position
          e.posture = 'stand';
          const sx = e.lastKnownX + Math.cos(e.yaw) * e.strafeDir * 3.5;
          const sz = e.lastKnownZ - Math.sin(e.yaw) * e.strafeDir * 3.5;
          this.moveEnemyToward(e, sx, sz, 2.7, dt, yawToPlayer);
        } else if (dist > 28) {
          // Close distance toward last known position
          e.posture = 'stand';
          this.moveEnemyToward(e, e.lastKnownX, e.lastKnownZ, 3.3, dt, yawToPlayer);
        } else if (hasCover && distToCover <= 1.5) {
          // In cover: duck low during cooldown, pop up slightly to shoot!
          e.posture = submerged || e.windupTimer > 0 || e.burstLeft > 0 ? 'stand' : 'crouch';
        } else {
          // Tactical sidestep or kneel in open terrain
          e.posture = !submerged && (e.suppression > 0.35 || e.hp < 45) ? 'crouch' : 'stand';
          if (dist > 9 && e.posture === 'stand') {
            const sx = e.x + Math.cos(e.yaw) * e.strafeDir * 2.4;
            const sz = e.z - Math.sin(e.yaw) * e.strafeDir * 2.4;
            this.moveEnemyToward(e, sx, sz, 1.85, dt, yawToPlayer);
          }
        }

        if (!e.hasLos && this.elapsedSec - e.lastSeenPlayerTime > 11.0 && dist > 18) {
          e.state = 'investigate';
          e.searchTimer = 5.5;
        }

        this.handleEnemyBurstFire(e, dist, dt);
      }

      this.animateEnemyPosture(e, dt);
    }
  }

  private handleEnemyBurstFire(e: EnemyActor, dist: number, dt: number): void {
    // Cannot fire rifle while head/weapon is submerged underwater
    const headY = e.y + THREE.MathUtils.lerp(1.56, 1.18, e.crouchBlend);
    if (headY < WATER_LEVEL + 0.02) {
      e.model.muzzleFlash.visible = false;
      e.windupTimer = 0;
      e.burstLeft = 0;
      return;
    }

    // Heavily suppressed soldiers keep heads down and delay firing
    if (e.suppression > 0.78 && e.burstLeft === 0) {
      e.model.muzzleFlash.visible = false;
      e.fireCooldown = Math.max(0.45, e.fireCooldown - dt * 0.35);
      return;
    }

    const canSuppressBlind =
      e.state === 'suppress_pin' && this.elapsedSec - e.lastSeenPlayerTime < 2.2;
    const allowedToFire = e.hasLos || canSuppressBlind;

    if (e.ammoInMag <= 0) {
      e.state = 'reloading';
      e.reloadTimer = 2.2;
      e.burstLeft = 0;
      e.windupTimer = 0;
      e.model.muzzleFlash.visible = false;
      return;
    }

    if (e.windupTimer > 0) {
      e.windupTimer -= dt;
      e.model.muzzleFlash.visible = e.windupTimer < 0.07;
      if (e.windupTimer <= 0) {
        if (!allowedToFire) {
          e.burstLeft = 0;
          e.model.muzzleFlash.visible = false;
          e.fireCooldown = 0.35;
          return;
        }
        const desiredBurst = e.role === 'suppressor' ? 5 : e.state === 'bound' ? 2 : 3;
        e.burstLeft = Math.min(desiredBurst, e.ammoInMag);
        e.fireCooldown = 0.08;
      }
    } else if (e.burstLeft > 0) {
      e.fireCooldown -= dt;
      e.model.muzzleFlash.visible = e.fireCooldown > 0.055;
      if (e.fireCooldown <= 0) {
        e.burstLeft--;
        e.ammoInMag--;
        e.fireCooldown = e.role === 'suppressor' ? 0.12 : 0.145;
        this.fireEnemyShot(e, dist);
        if (e.ammoInMag <= 0) {
          e.state = 'reloading';
          e.reloadTimer = 2.2;
          e.burstLeft = 0;
          e.model.muzzleFlash.visible = false;
        } else if (e.burstLeft === 0) {
          e.fireCooldown = (e.role === 'suppressor' ? 0.9 : 1.3) + Math.random() * 1.1;
          e.model.muzzleFlash.visible = false;
        }
      }
    } else {
      e.model.muzzleFlash.visible = false;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && dist < 58 && allowedToFire) {
        e.windupTimer = 0.32;
      }
    }
  }

  private turnEnemyToward(e: EnemyActor, targetYaw: number, dt: number): void {
    const diff = Math.atan2(Math.sin(targetYaw - e.yaw), Math.cos(targetYaw - e.yaw));
    e.yaw += diff * Math.min(1, dt * 7.5);
    e.model.group.rotation.y = e.yaw;
  }

  private animateEnemyPosture(e: EnemyActor, dt: number): void {
    const targetCrouch = e.posture === 'crouch' ? 1 : 0;
    e.crouchBlend = THREE.MathUtils.damp(e.crouchBlend, targetCrouch, 10, dt);
    e.model.torso.position.y = THREE.MathUtils.lerp(0.82, 0.48, e.crouchBlend);
    e.model.torso.rotation.x = THREE.MathUtils.lerp(
      e.state === 'engage' || e.state === 'suppress_pin' ? 0.06 : 0.0,
      e.state === 'reloading' || e.state === 'retreat' ? 0.34 : 0.22,
      e.crouchBlend,
    );
    e.model.torso.rotation.z = e.state === 'reloading' ? 0.16 : 0;

    const legScaleY = THREE.MathUtils.lerp(1.0, 0.62, e.crouchBlend);
    e.model.leftLeg.scale.y = legScaleY;
    e.model.rightLeg.scale.y = legScaleY;
    e.model.leftLeg.position.y = 0.41 * legScaleY;
    e.model.rightLeg.position.y = 0.41 * legScaleY;
  }

  private moveEnemyToward(
    e: EnemyActor,
    tx: number,
    tz: number,
    speed: number,
    dt: number,
    aimYaw?: number,
  ): void {
    const dx = tx - e.x;
    const dz = tz - e.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.35) return;

    e.x += (dx / d) * speed * dt;
    e.z += (dz / d) * speed * dt;

    // Respect terrain obstacle colliders so soldiers go around trees/rocks/bunkers
    const enemyR = 0.48;
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const ox = e.x - c.x;
      const oz = e.z - c.z;
      const od = Math.hypot(ox, oz);
      const minD = c.r + enemyR;
      if (od < minD && od > 0.0001) {
        const push = (minD - od) / od;
        e.x += ox * push;
        e.z += oz * push;
      }
    }

    e.y = groundHeightAt(e.x, e.z);
    const desiredYaw = aimYaw !== undefined ? aimYaw : Math.atan2(-dx, -dz);
    this.turnEnemyToward(e, desiredYaw, dt);
    e.model.group.position.set(e.x, e.y, e.z);

    e.walkPhase += dt * speed * 3.2;
    const strideAmp = e.posture === 'crouch' ? 0.28 : 0.45;
    e.model.leftLeg.rotation.x = Math.sin(e.walkPhase) * strideAmp;
    e.model.rightLeg.rotation.x = -Math.sin(e.walkPhase) * strideAmp;
  }

  private fireEnemyShot(e: EnemyActor, dist: number): void {
    const pan = this.computePanToWorld(e.x, e.z);
    this.audio.playEnemyAk47(dist, pan);

    const muzzleHeight = THREE.MathUtils.lerp(1.35, 0.98, e.crouchBlend);
    const muzzleWorld = _v1.set(e.x, e.y + muzzleHeight, e.z);

    const aimAtLastKnown = !e.hasLos && e.state === 'suppress_pin';
    const baseTargetX = aimAtLastKnown ? e.lastKnownX : this.playerPos.x;
    const baseTargetZ = aimAtLastKnown ? e.lastKnownZ : this.playerPos.z;
    const baseTargetY = aimAtLastKnown
      ? groundHeightAt(e.lastKnownX, e.lastKnownZ) + 1.1
      : this.playerPos.y + (e.hasHeadOnlyLos ? (this.isCrouching ? 1.05 : 1.62) : this.isCrouching ? 0.95 : 1.42);
    const scatter = aimAtLastKnown ? 2.4 : 1.45;
    const targetWorld = _v2.set(
      baseTargetX + (Math.random() - 0.5) * scatter,
      baseTargetY + (Math.random() - 0.5) * 0.52,
      baseTargetZ + (Math.random() - 0.5) * scatter,
    );

    _v3.copy(targetWorld).sub(muzzleWorld);
    const rayLen = _v3.length();
    _v3.multiplyScalar(1 / Math.max(0.001, rayLen));

    // Solid cover / terrain raycast stops bullets cleanly at walls, boulders, trees & ridges
    const obstacleHit = this.traceWorldObstacle(muzzleWorld, _v3, rayLen + 0.5, 0.55);
    if (obstacleHit && obstacleHit.distance < rayLen - 0.35) {
      this.spawnTracer(muzzleWorld, obstacleHit.point, 155);
      this.spawnImpactParticles(obstacleHit.point, obstacleHit.isTerrain ? 0x8f7a58 : 0xc8bca6, 3);
      if (obstacleHit.point.distanceTo(this.playerPos) < 6.5 && Math.random() < 0.45) {
        this.audio.playBulletCrack(THREE.MathUtils.clamp(pan + (Math.random() - 0.5) * 0.3, -1, 1));
      }
      return;
    }

    this.spawnTracer(muzzleWorld, targetWorld, 155);
    if (aimAtLastKnown) {
      if (dist < 58 && Math.random() < 0.55) {
        this.audio.playBulletCrack(THREE.MathUtils.clamp(pan + (Math.random() - 0.5) * 0.4, -1, 1));
      }
      return;
    }

    // Hit probability scales inversely with distance, player crouch, head-only peek, camo & suppression
    const riverMudMult =
      this.getActiveLoadout().uniform === 'mekong_mud' && this.isTerrainCamoActive() ? 0.75 : 1.0;
    const roleAccMult = e.role === 'commander' ? 1.12 : e.role === 'suppressor' ? 0.85 : 1.0;
    const headOnlyMult = e.hasHeadOnlyLos ? 0.58 : 1.0;
    const suppPenalty = Math.max(0.32, 1 - e.suppression * 0.72);
    const baseHitChance =
      Math.max(0.05, 0.34 - dist * 0.0055) *
      (this.isCrouching ? 0.64 : 1.0) *
      suppPenalty *
      riverMudMult *
      roleAccMult *
      headOnlyMult;
    if (Math.random() < baseHitChance) {
      this.applyPlayerDamage(8 + Math.random() * 5, e.x, e.z);
    } else if (dist < 58 && Math.random() < 0.6) {
      // Supersonic bullet crack whizzing past player on near miss
      this.audio.playBulletCrack(THREE.MathUtils.clamp(pan + (Math.random() - 0.5) * 0.4, -1, 1));
    }
  }

  private applyPlayerDamage(dmg: number, sourceX: number, sourceZ: number): void {
    const gritMitigation = Math.max(0.65, 1 - this.getEffectiveAttr('grit') * 0.03);
    const gunnerMitigation =
      this.soldierClass === 'machine_gunner' && this.isCrouching ? 0.8 : 1.0;
    const fortressMitigation = this.hasSkillNode('mg_fortress') ? 0.85 : 1.0;
    const loadout = this.getActiveLoadout();
    const erdlMit = loadout.uniform === 'erdl_woodland' && this.isTerrainCamoActive() ? 0.82 : 1.0;
    const helmetMit = loadout.headgear === 'm1_helmet' ? 0.85 : 1.0;
    const finalDmg = dmg * gritMitigation * gunnerMitigation * fortressMitigation * erdlMit * helmetMit;

    this.health = Math.max(0, this.health - finalDmg);
    this.damageFlash = 0.85;
    this.cameraShake = Math.min(0.65, this.cameraShake + 0.25);
    const angleToSource = Math.atan2(sourceX - this.playerPos.x, sourceZ - this.playerPos.z);
    this.damageAngleRad = angleToSource - this.yaw;

    if (finalDmg > 11 && Math.random() < 0.28) {
      this.bleeding = true;
    }
    if (this.health <= 0) {
      this.setPhase('gameover');
    }
  }

  private updateObjectives(dt: number): void {
    this.nearbyPrompt = null;
    this.nearbyActionType = null;

    // Armory Workbench proximity check
    if (Math.hypot(this.playerPos.x - this.armoryPos.x, this.playerPos.z - this.armoryPos.z) < 3.6) {
      this.nearbyPrompt = 'Open Weapon Armory & Attachments';
      this.nearbyActionType = 'armory';
    }

    // FDC Howitzer Squad Command proximity check
    if (Math.hypot(this.playerPos.x - this.fdcPos.x, this.playerPos.z - this.fdcPos.z) < 4.5) {
      this.nearbyPrompt = this.officerActive
        ? 'Open Artillery Fire Direction Map'
        : 'Assume Artillery Officer Command (155mm Squad)';
      this.nearbyActionType = 'fdc';
    }

    // Resupply crate proximity check
    for (const crate of this.ammoCrates) {
      if (Math.hypot(this.playerPos.x - crate.x, this.playerPos.z - crate.z) < 3.6) {
        this.nearbyPrompt = 'Resupply Ammo & Field Dressings';
        this.nearbyActionType = 'resupply';
      }
    }

    // Alpha Mortar proximity prompt
    const alpha = this.objectives.find((o) => o.id === 'alpha')!;
    if (!alpha.completed) {
      const dAlpha = Math.hypot(this.playerPos.x - alpha.x, this.playerPos.z - alpha.z);
      if (dAlpha < 6.0) {
        this.nearbyPrompt = 'Plant Satchel Charge on Mortar';
        this.nearbyActionType = 'objective';
      }
    }

    // Charlie Bunker capture progress
    const charlie = this.objectives.find((o) => o.id === 'charlie')!;
    if (!charlie.completed) {
      const dCharlie = Math.hypot(this.playerPos.x - charlie.x, this.playerPos.z - charlie.z);
      if (dCharlie < 9.5) {
        charlie.progress = Math.min(1, charlie.progress + dt * 0.34);
        this.nearbyPrompt = `Securing Radio Bunker (${Math.round(charlie.progress * 100)}%)`;
        if (charlie.progress >= 1) {
          charlie.completed = true;
          charlie.active = false;
          this.audio.playObjectiveChime();
          this.showBanner('SECTOR CHARLIE SECURED · FIELD RADIO CAPTURED');
          const clearXp = this.hasSkillNode('rec_shadow_xp') ? 375 : 300;
          this.awardXp(clearXp, 'Sector Charlie Secured');
          this.advanceDailyMission('sectors_cleared', 1);
          this.checkExtractionUnlock();
        }
      }
    }

    // Extraction LZ Bravo hold
    const extract = this.objectives.find((o) => o.id === 'extract')!;
    if (extract.active && !extract.completed) {
      const dLz = Math.hypot(this.playerPos.x - extract.x, this.playerPos.z - extract.z);
      if (dLz < 13) {
        if (!this.extractWaveSpawned) {
          this.extractWaveSpawned = true;
          this.showBanner('HUEY SPINNING UP · HOLD LZ BRAVO AGAINST COUNTERATTACK');
          // Spawn 4 counterattack soldiers south-east/west of LZ
          for (const [ox, oz] of [
            [-28, -24],
            [26, -26],
            [-32, 12],
            [30, 14],
          ] as const) {
            const sx = LZ_BRAVO_POS.x + ox;
            const sz = LZ_BRAVO_POS.z + oz;
            const actor = this.createEnemyActor(500 + this.enemies.length, sx, sz, 'extract', 'investigate');
            this.assignEnemyCover(actor);
          }
        }
        extract.progress = Math.min(1, extract.progress + dt / 8.0);
        this.extractCountdown = Math.max(0, Math.ceil((1 - extract.progress) * 8));
        if (extract.progress >= 1) {
          extract.completed = true;
          this.audio.playObjectiveChime();
          if (this.campaignState.active) {
            const st = this.campaignState.stages[this.campaignState.currentStageIndex];
            if (st) {
              const firstTime = !st.completed;
              st.completed = true;
              const runSec = Math.floor(this.elapsedSec);
              st.bestTimeSec = st.bestTimeSec === null ? runSec : Math.min(st.bestTimeSec, runSec);
              st.bestKills = st.bestKills === null ? this.kills : Math.max(st.bestKills, this.kills);
              if (firstTime) {
                this.bonusAttributePoints += st.rewardAttrPts;
                this.bonusSkillPoints += st.rewardSkillPts;
                this.saveCareerXp();
              }
              this.awardXp(firstTime ? 500 + st.rewardXp : 500, `${st.opCode} Complete`);
              if (this.campaignState.currentStageIndex >= this.campaignState.stages.length - 1) {
                this.campaignState.campaignCompleted = true;
              } else {
                this.campaignState.currentStageIndex = Math.min(
                  this.campaignState.stages.length - 1,
                  this.campaignState.currentStageIndex + 1,
                );
              }
              this.saveCampaignState();
            } else {
              this.awardXp(500, 'Extraction Complete');
            }
          } else {
            this.awardXp(500, 'Extraction Complete');
          }
          this.setPhase('victory');
        }
      } else {
        this.extractCountdown = null;
      }
    }
  }

  private updateCameraAndViewmodel(dt: number): void {
    const eyeHeight = this.isCrouching ? 1.05 : 1.66;
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const bobAmp = this.isAds ? 0.008 : this.isSprinting ? 0.055 : 0.028;
    const bobY = horizSpeed > 0.5 ? Math.sin(this.bobPhase * 2) * bobAmp : Math.sin(this.elapsedSec * 1.4) * 0.004;

    // Decaying camera shake
    this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 10, dt);
    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.05;
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.05;

    this.camera.position.set(
      this.playerPos.x + shakeX,
      this.playerPos.y + eyeHeight + bobY + shakeY,
      this.playerPos.z,
    );

    _euler.set(
      THREE.MathUtils.clamp(this.pitch + this.recoilPitchOffset, -1.42, 1.42),
      this.yaw + this.recoilYawOffset,
      0,
      'YXZ',
    );
    this.camera.quaternion.setFromEuler(_euler);

    // Smooth ADS / Optic / Binocular FOV damping
    this.adsBlend = THREE.MathUtils.damp(
      this.adsBlend,
      this.isAds && !this.isReloading && !this.binocularZoom ? 1 : 0,
      15,
      dt,
    );
    const optic = this.weaponStates[this.activeWeapon].attachments.optic;
    const opticAdsFov =
      optic === 'colt_scope'
        ? 25
        : optic === 'oeg_dot'
          ? 46
          : WEAPON_SPECS[this.activeWeapon].adsFov;
    const targetFov = this.binocularZoom
      ? 26
      : THREE.MathUtils.lerp(74, opticAdsFov, this.adsBlend);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    // Viewmodel positioning + scope optical transition + reload tilt + sprint tilt
    const vm = this.viewmodels[this.activeWeapon];
    const scopeFullOverlay = optic === 'colt_scope' && this.adsBlend > 0.72 && !this.isReloading && !this.binocularZoom;
    vm.root.visible = !this.binocularZoom && !scopeFullOverlay;

    _v1.copy(vm.hipOffset).lerp(vm.adsOffset, this.adsBlend);
    const swayX = Math.cos(this.bobPhase) * (this.isAds ? 0.002 : 0.012) * Math.min(1, horizSpeed / 5);
    const swayY = Math.abs(Math.sin(this.bobPhase)) * (this.isAds ? 0.002 : 0.014) * Math.min(1, horizSpeed / 5);

    const reloadDur = this.getEffectiveReloadDuration(this.activeWeapon);
    const reloadDip = this.isReloading
      ? Math.sin((this.reloadTimer / reloadDur) * Math.PI) * 0.14
      : 0;
    const sprintDip = this.isSprinting ? 0.05 : 0;

    vm.root.position.set(
      _v1.x + swayX,
      _v1.y - swayY - reloadDip - sprintDip,
      _v1.z + this.weaponKickZ,
    );

    const sprintRotY = this.isSprinting ? 0.38 : 0;
    const reloadRotX = this.isReloading ? -0.48 : 0;
    vm.root.rotation.set(
      reloadRotX + this.recoilPitchOffset * 0.8,
      sprintRotY,
      this.isSprinting ? 0.16 : 0,
    );
  }

  public getHudSnapshot(): HudSnapshot {
    const reloadDur = this.getEffectiveReloadDuration(this.activeWeapon);
    const rawDeg = ((-this.yaw * 180) / Math.PI) % 360;
    const headingDeg = (rawDeg + 360) % 360;
    const prog = this.computeProgression(this.careerXp);
    const hFloor = Math.floor(this.hour24);
    const mFloor = Math.floor((this.hour24 - hFloor) * 60);
    const clockStr = `${String(hFloor).padStart(2, '0')}:${String(mFloor).padStart(2, '0')}`;
    const phaseLabel =
      this.hour24 >= 5.5 && this.hour24 < 7.8
        ? 'DAWN'
        : this.hour24 >= 7.8 && this.hour24 < 17.5
          ? 'DAY'
          : this.hour24 >= 17.5 && this.hour24 < 19.6
            ? 'DUSK'
            : 'NIGHT';

    return {
      phase: this.phase,
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      stamina: Math.round(this.stamina),
      bleeding: this.bleeding,
      bandages: this.bandages,
      bandagingProgress:
        this.bandagingTimer > 0
          ? 1 - this.bandagingTimer / Math.max(0.2, this.lastBandageDuration)
          : 0,
      grenades: this.grenadeCount,
      isCrouching: this.isCrouching,
      isSprinting: this.isSprinting,
      isAds: this.isAds,
      adsBlend: Number(this.adsBlend.toFixed(3)),
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / reloadDur : 0,
      activeWeapon: this.activeWeapon,
      weapons: {
        m16a1: {
          ...this.weaponStates.m16a1,
          attachments: { ...this.weaponStates.m16a1.attachments },
          internals: { ...this.weaponStates.m16a1.internals },
        },
        m60: {
          ...this.weaponStates.m60,
          attachments: { ...this.weaponStates.m60.attachments },
          internals: { ...this.weaponStates.m60.internals },
        },
        m1911: {
          ...this.weaponStates.m1911,
          attachments: { ...this.weaponStates.m1911.attachments },
          internals: { ...this.weaponStates.m1911.internals },
        },
      },
      headingDeg,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      terrainZone: this.getCurrentTerrain(),
      terrainCamoActive: this.isTerrainCamoActive(),
      characterLoadout: {
        ...this.getActiveLoadout(),
        weapons: {
          m16a1: {
            attachments: { ...this.getActiveLoadout().weapons.m16a1.attachments },
            paint: this.getActiveLoadout().weapons.m16a1.paint,
            customPaint: this.getActiveLoadout().weapons.m16a1.customPaint,
            internals: { ...this.getActiveLoadout().weapons.m16a1.internals },
          },
          m60: {
            attachments: { ...this.getActiveLoadout().weapons.m60.attachments },
            paint: this.getActiveLoadout().weapons.m60.paint,
            customPaint: this.getActiveLoadout().weapons.m60.customPaint,
            internals: { ...this.getActiveLoadout().weapons.m60.internals },
          },
          m1911: {
            attachments: { ...this.getActiveLoadout().weapons.m1911.attachments },
            paint: this.getActiveLoadout().weapons.m1911.paint,
            customPaint: this.getActiveLoadout().weapons.m1911.customPaint,
            internals: { ...this.getActiveLoadout().weapons.m1911.internals },
          },
        },
      },
      activeLoadoutSlot: this.activeLoadoutSlot,
      loadoutSlots: this.loadoutSlots.map((s) => ({
        ...s,
        weapons: s.weapons,
      })),
      customWeaponCamo: { ...this.customWeaponCamo },
      customUniformCamo: { ...this.customUniformCamo },
      campaign: {
        ...this.campaignState,
        stages: this.campaignState.stages.map((st) => ({ ...st })),
      },
      objectives: this.objectives.map((o) => ({ ...o })),
      counterBattery: {
        activeSolution:
          this.batteries.find((b) => b.info.id === this.activeBatteryId && b.info.status === 'detected')
            ?.info ??
          this.batteries.find((b) => b.info.status === 'detected')?.info ??
          null,
        batteries: this.batteries.map((b) => ({ ...b.info })),
        strikeCooldownSec: Math.ceil(this.strikeCooldownSec),
        neutralizedCount: this.batteries.filter((b) => b.info.status === 'neutralized').length,
      },
      officer: {
        officerActive: this.officerActive,
        binocularZoom: this.binocularZoom,
        shellType: this.shellType,
        sheafPattern: this.sheafPattern,
        targetX: this.artyTargetX,
        targetZ: this.artyTargetZ,
        targetGridRef:
          this.artyTargetX !== null && this.artyTargetZ !== null
            ? this.formatGridRef(this.artyTargetX, this.artyTargetZ)
            : null,
        targetRangeM:
          this.artyTargetX !== null && this.artyTargetZ !== null
            ? Math.round(
                Math.hypot(
                  this.artyTargetX - HOWITZER_BATTERY_POS.x,
                  this.artyTargetZ - HOWITZER_BATTERY_POS.z,
                ),
              )
            : null,
        targetAzimuthDeg:
          this.artyTargetX !== null && this.artyTargetZ !== null
            ? Math.round(
                ((Math.atan2(
                  this.artyTargetX - HOWITZER_BATTERY_POS.x,
                  -(this.artyTargetZ - HOWITZER_BATTERY_POS.z),
                ) *
                  180) /
                  Math.PI +
                  360) %
                  360,
              )
            : null,
        etaSec: this.artyEtaSec,
        guns: this.howitzers.map((g) => ({
          ...g.state,
          reloadLeftSec: Number(g.state.reloadLeftSec.toFixed(1)),
        })),
        salvosFired: this.artySalvosFired,
        killsByArtillery: this.artyKills,
      },
      environment: {
        hour24: this.hour24,
        clockStr,
        phaseLabel,
        weather: this.weather,
        rainIntensity: Number(this.rainIntensity.toFixed(2)),
        timeSpeedMult: this.timeSpeedMult,
      },
      progression: {
        xp: this.careerXp,
        level: prog.level,
        rankTitle: prog.rankTitle,
        xpIntoLevel: prog.xpIntoLevel,
        xpForNextLevel: prog.xpForNextLevel,
        recentEvent: this.recentXpEvent,
        soldierClass: this.soldierClass,
        attributePoints: this.getUnspentAttributePoints(),
        skillPoints: this.getUnspentSkillPoints(),
        attributes: {
          grit: this.getEffectiveAttr('grit'),
          agility: this.getEffectiveAttr('agility'),
          marksmanship: this.getEffectiveAttr('marksmanship'),
          command: this.getEffectiveAttr('command'),
        },
        perks: { ...this.rpgPerks },
        unlockedSkillNodes: Array.from(this.unlockedSkillNodes),
        quests: this.quests.map((q) => ({ ...q })),
        totalQuestsCompleted: this.totalQuestsCompleted,
        dailyDateKey: this.dailyDateKey,
        dailyMissions: this.dailyMissions.map((m) => ({
          ...m,
          classGear: m.classGear,
        })),
        totalDailyCompleted: this.totalDailyCompleted,
      },
      nearbyPrompt: this.nearbyPrompt,
      nearbyActionType: this.nearbyActionType,
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerKill: this.hitMarkerKill,
      damageFlash: this.damageFlash,
      damageAngleRad: this.damageAngleRad,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      kills: this.kills,
      enemiesRemaining: this.enemies.filter((e) => e.alive).length,
      elapsedSec: Math.floor(this.elapsedSec),
      muted: this.audio.isMuted(),
      ambienceVolume: this.audio.getAmbienceVolume(),
      sfxVolume: this.audio.getSfxVolume(),
      proximityVoiceEnabled: this.audio.isProximityVoiceEnabled(),
      pointerLocked: this.pointerLocked,
      statusBanner: this.statusBanner,
      extractCountdown: this.extractCountdown,
      enemyGrenadeAlert: (() => {
        let bestDist = Infinity;
        let bestFuse = 0;
        for (const g of this.grenades) {
          if (!g.fromEnemy) continue;
          const d = Math.hypot(g.pos.x - this.playerPos.x, g.pos.z - this.playerPos.z);
          if (d < 15 && d < bestDist) {
            bestDist = d;
            bestFuse = g.fuse;
          }
        }
        return bestDist < Infinity
          ? {
              distanceM: Math.max(1, Math.round(bestDist)),
              fuseSec: Number(Math.max(0.1, bestFuse).toFixed(1)),
            }
          : null;
      })(),
    };
  }

  private emitHud(): void {
    this.onHudUpdate(this.getHudSnapshot());
  }

  public reloadProfileFromStorage(): void {
    this.loadCareerXp();
    this.loadCustomCamos();
    this.loadCampaignState();
    this.loadCharacterLoadouts();
    this.resetMissionState(this.phase === 'title' ? 'title' : 'paused');
    this.showBanner('GOOGLE DRIVE CLOUD SAVE RESTORED');
    this.emitHud();
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.audio.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
