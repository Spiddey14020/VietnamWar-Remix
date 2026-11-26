import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArmoryModal } from './components/ArmoryModal';
import { CampaignModal } from './components/CampaignModal';
import { GameHUD } from './components/GameHUD';
import { GitHubUpdateModal } from './components/GitHubUpdateModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { PauseOutcomeModal } from './components/PauseOutcomeModal';
import { RpgDossierModal, type RpgTab } from './components/RpgDossierModal';
import { TacticalMapModal } from './components/TacticalMapModal';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { VietnamGameEngine } from './game/engine';
import type {
  ControlMode,
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  TouchInputState,
  WeaponId,
} from './game/types';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VietnamGameEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [armoryOpen, setArmoryOpen] = useState(false);
  const [rpgOpen, setRpgOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [rpgInitialTab, setRpgInitialTab] = useState<RpgTab>('build');
  const [controlMode, setControlMode] = useState<ControlMode>('auto');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() => {
    try {
      const saved = localStorage.getItem('vietnam_war_gfx_quality_v1');
      if (saved === 'high' || saved === 'battery' || saved === 'auto') return saved;
    } catch {
      // ignore storage failure
    }
    return 'auto';
  });
  const [sensitivity, setSensitivity] = useState(1.0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const fine = window.matchMedia('(pointer: fine)').matches;
      const isAndroid = /android/i.test(navigator.userAgent);
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(coarse || isAndroid || (hasTouch && (!fine || window.innerWidth < 1024)));
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    syncFs();
    document.addEventListener('fullscreenchange', syncFs);
    return () => document.removeEventListener('fullscreenchange', syncFs);
  }, []);

  const showTouchControls = useMemo(() => {
    if (controlMode === 'touch') return true;
    if (controlMode === 'desktop') return false;
    return isTouchDevice;
  }, [controlMode, isTouchDevice]);

  useEffect(() => {
    if (!showTouchControls || phase !== 'playing') return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const nav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request('screen')
      .then((s) => {
        if (cancelled) {
          void s.release();
        } else {
          sentinel = s;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [showTouchControls, phase]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const engine = new VietnamGameEngine(
      el,
      (snapshot) => setHud(snapshot),
      (nextPhase) => {
        setPhase(nextPhase);
        if (nextPhase !== 'playing') {
          setMapOpen(false);
          setArmoryOpen(false);
          setRpgOpen(false);
          setCampaignOpen(false);
        }
      },
    );
    engine.setUiTriggerHandler((action) => {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      if (action === 'armory') {
        setMapOpen(false);
        setRpgOpen(false);
        setArmoryOpen((prev) => !prev);
      } else if (action === 'map') {
        setArmoryOpen(false);
        setRpgOpen(false);
        setMapOpen(true);
      } else if (action === 'rpg') {
        setArmoryOpen(false);
        setMapOpen(false);
        setRpgInitialTab('build');
        setRpgOpen((prev) => !prev);
      }
    });
    engine.setGraphicsQuality(graphicsQuality);
    engineRef.current = engine;

    return () => {
      engine.setUiTriggerHandler(null);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const handleGraphicsQualityChange = useCallback((quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    try {
      localStorage.setItem('vietnam_war_gfx_quality_v1', quality);
    } catch {
      // ignore storage failure
    }
    engineRef.current?.setGraphicsQuality(quality);
  }, []);

  const handleStart = useCallback(() => {
    setMapOpen(false);
    setArmoryOpen(false);
    setRpgOpen(false);
    setCampaignOpen(false);
    engineRef.current?.startGame();
    if (showTouchControls) {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } else {
      engineRef.current?.requestPointerLock();
    }
  }, [showTouchControls]);

  const handlePause = useCallback(() => {
    if (phase === 'playing') {
      engineRef.current?.setPhase('paused');
    } else if (phase === 'paused') {
      engineRef.current?.resumeGame();
      if (!showTouchControls) {
        engineRef.current?.requestPointerLock();
      }
    }
  }, [phase, showTouchControls]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        phase === 'title' &&
        !rpgOpen &&
        !campaignOpen &&
        !driveOpen &&
        !updatesOpen &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        handleStart();
        return;
      }
      if (e.code === 'Escape') {
        if (updatesOpen) {
          setUpdatesOpen(false);
        } else if (driveOpen) {
          setDriveOpen(false);
        } else if (campaignOpen) {
          setCampaignOpen(false);
        } else if (rpgOpen) {
          setRpgOpen(false);
        } else if (armoryOpen) {
          setArmoryOpen(false);
        } else if (mapOpen) {
          setMapOpen(false);
        } else if (phase === 'playing') {
          engineRef.current?.setPhase('paused');
        } else if (phase === 'paused') {
          engineRef.current?.resumeGame();
        }
        return;
      }
      if (e.code === 'KeyM' && (phase === 'playing' || mapOpen)) {
        setArmoryOpen(false);
        setRpgOpen(false);
        setMapOpen((prev) => {
          const next = !prev;
          if (next && document.pointerLockElement) {
            document.exitPointerLock();
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, mapOpen, armoryOpen, rpgOpen, campaignOpen, driveOpen, updatesOpen, handleStart]);

  const handleSensitivityChange = useCallback((val: number) => {
    setSensitivity(val);
    engineRef.current?.setSensitivity(val);
  }, []);

  const handleTouchInput = useCallback((partial: Partial<TouchInputState>) => {
    engineRef.current?.setTouchInput(partial);
  }, []);

  const toggleMap = useCallback(() => {
    setArmoryOpen(false);
    setRpgOpen(false);
    setMapOpen((prev) => {
      const next = !prev;
      if (next && document.pointerLockElement) {
        document.exitPointerLock();
      }
      return next;
    });
  }, []);

  const toggleArmory = useCallback(() => {
    setMapOpen(false);
    setRpgOpen(false);
    setArmoryOpen((prev) => {
      const next = !prev;
      if (next && document.pointerLockElement) {
        document.exitPointerLock();
      }
      return next;
    });
  }, []);

  const toggleRpg = useCallback(() => {
    setMapOpen(false);
    setArmoryOpen(false);
    setRpgInitialTab('build');
    setRpgOpen((prev) => {
      const next = !prev;
      if (next && document.pointerLockElement) {
        document.exitPointerLock();
      }
      return next;
    });
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0e120d]">
      {/* Isolated WebGL canvas mount */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        onClick={() => {
          if (phase === 'playing' && !showTouchControls && !mapOpen && !armoryOpen && !rpgOpen) {
            engineRef.current?.requestPointerLock();
          }
        }}
      />

      {phase === 'title' && !rpgOpen && !campaignOpen && !driveOpen && !updatesOpen && (
        <TitleScreen
          hud={hud}
          controlMode={controlMode}
          onChangeControlMode={setControlMode}
          onSelectClass={(cls) => engineRef.current?.setSoldierClass(cls)}
          onOpenRpg={() => {
            setRpgInitialTab('build');
            setRpgOpen(true);
          }}
          onOpenLoadout={() => {
            setRpgInitialTab('loadout');
            setRpgOpen(true);
          }}
          onOpenCampaign={() => setCampaignOpen(true)}
          onOpenDrive={() => setDriveOpen(true)}
          onOpenUpdates={() => setUpdatesOpen(true)}
          onStart={handleStart}
          muted={hud?.muted ?? false}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}

      {phase === 'playing' && hud && (
        <>
          <GameHUD
            hud={hud}
            showTouchControls={showTouchControls}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onToggleMap={toggleMap}
            onToggleArmory={toggleArmory}
            onToggleRpg={toggleRpg}
            onToggleOfficer={() => engineRef.current?.toggleOfficerMode()}
            onToggleBinoculars={() => engineRef.current?.toggleBinoculars()}
            onDesignateAndFire={() => engineRef.current?.designateBinocularTargetAndFire()}
            onToggleMute={() => engineRef.current?.toggleMute()}
            onPause={handlePause}
            onSelectWeapon={(id: WeaponId) => engineRef.current?.selectWeapon(id)}
            onCycleWeapon={() => engineRef.current?.cycleWeapon()}
            onContextAction={() => engineRef.current?.triggerContextAction()}
            onCallCounterBattery={() => engineRef.current?.callCounterBatteryFire()}
          />

          {showTouchControls && !mapOpen && !armoryOpen && !rpgOpen && (
            <TouchControls
              onTouchInput={handleTouchInput}
              onToggleAds={() => engineRef.current?.toggleAdsTouch()}
              onReload={() => engineRef.current?.triggerReload()}
              onCrouch={() => engineRef.current?.toggleCrouch()}
              onGrenade={() => engineRef.current?.throwGrenade()}
              onBandage={() => engineRef.current?.useBandage()}
              onCycleWeapon={() => engineRef.current?.cycleWeapon()}
              onToggleFireMode={() => engineRef.current?.toggleFireMode()}
              isAds={hud.isAds}
              isCrouching={hud.isCrouching}
              isSprinting={hud.isSprinting}
              grenades={hud.grenades}
              bandages={hud.bandages}
              bleeding={hud.bleeding}
            />
          )}
        </>
      )}

      {mapOpen && hud && (
        <TacticalMapModal
          hud={hud}
          onCallCounterBattery={() => engineRef.current?.callCounterBatteryFire()}
          onSetArtilleryTarget={(x, z) => engineRef.current?.setArtilleryTarget(x, z)}
          onSetShellType={(t) => engineRef.current?.setShellType(t)}
          onSetSheafPattern={(p) => engineRef.current?.setSheafPattern(p)}
          onFireArtillerySquad={() => engineRef.current?.fireArtillerySquadMission()}
          onClose={() => setMapOpen(false)}
        />
      )}

      {armoryOpen && hud && (
        <ArmoryModal
          hud={hud}
          onSetAttachment={(w, slot, val) => engineRef.current?.setWeaponAttachment(w, slot, val)}
          onSetPaint={(w, paint) => engineRef.current?.setWeaponPaint(w, paint)}
          onSetCustomPaint={(w, cfg) => engineRef.current?.setCustomWeaponCamo(w, cfg)}
          onSetInternalPart={(w, slot, val) => engineRef.current?.setWeaponInternalPart(w, slot, val)}
          onSelectWeapon={(id) => engineRef.current?.selectWeapon(id)}
          onClose={() => setArmoryOpen(false)}
        />
      )}

      {rpgOpen && hud && (
        <RpgDossierModal
          hud={hud}
          initialTab={rpgInitialTab}
          onSelectClass={(cls) => engineRef.current?.setSoldierClass(cls)}
          onAllocateAttribute={(key) => engineRef.current?.allocateAttribute(key)}
          onUpgradePerk={(perkId) => engineRef.current?.upgradePerk(perkId)}
          onUnlockSkillNode={(nodeId) => engineRef.current?.unlockSkillNode(nodeId)}
          onClaimDailyMission={(missionId) => engineRef.current?.claimDailyMission(missionId)}
          onRerollDailyMissions={() => engineRef.current?.rerollDailyMissions()}
          onSelectLoadoutSlot={(slotIdx) => engineRef.current?.selectLoadoutSlot(slotIdx)}
          onRenameLoadoutSlot={(name) => engineRef.current?.renameLoadoutSlot(name)}
          onSetUniform={(uniform) => engineRef.current?.setUniformCamo(uniform)}
          onSetCustomUniformCamo={(cfg) => engineRef.current?.setCustomUniformCamo(cfg)}
          onSetRig={(rig) => engineRef.current?.setTacticalRig(rig)}
          onSetHeadgear={(headgear) => engineRef.current?.setHeadgear(headgear)}
          onSetPrimaryWeapon={(weaponId) => engineRef.current?.setPrimaryLoadoutWeapon(weaponId)}
          onApplyPreset={(presetId) => engineRef.current?.applyLoadoutPreset(presetId)}
          onOpenArmory={
            phase === 'playing'
              ? () => {
                  setRpgOpen(false);
                  setArmoryOpen(true);
                }
              : undefined
          }
          onRespec={() => engineRef.current?.respecRpg()}
          onClose={() => setRpgOpen(false)}
        />
      )}

      {campaignOpen && hud && (
        <CampaignModal
          hud={hud}
          onSelectFaction={(fId) => engineRef.current?.setCampaignFaction(fId)}
          onGenerateCampaign={(seed, fId) => engineRef.current?.generateNewCampaign(seed, fId)}
          onDeployStage={(idx) => {
            setCampaignOpen(false);
            engineRef.current?.deployCampaignStage(idx);
            if (!showTouchControls) {
              engineRef.current?.requestPointerLock();
            }
          }}
          onDeploySkirmish={() => {
            setCampaignOpen(false);
            engineRef.current?.setQuickSkirmishMode();
            if (!showTouchControls) {
              engineRef.current?.requestPointerLock();
            }
          }}
          onClose={() => setCampaignOpen(false)}
        />
      )}

      {(phase === 'paused' || phase === 'victory' || phase === 'gameover') &&
        hud &&
        !armoryOpen &&
        !rpgOpen &&
        !campaignOpen &&
        !driveOpen &&
        !updatesOpen && (
          <PauseOutcomeModal
            hud={hud}
            controlMode={controlMode}
            graphicsQuality={graphicsQuality}
            sensitivity={sensitivity}
            isFullscreen={isFullscreen}
            onChangeControlMode={setControlMode}
            onChangeGraphicsQuality={handleGraphicsQualityChange}
            onChangeSensitivity={handleSensitivityChange}
            onToggleFullscreen={handleToggleFullscreen}
            onChangeAmbienceVolume={(v) => engineRef.current?.setAmbienceVolume(v)}
            onChangeSfxVolume={(v) => engineRef.current?.setSfxVolume(v)}
            onSetTimeOfDay={(h) => engineRef.current?.setTimeOfDayHour(h)}
            onSetWeather={(w) => engineRef.current?.setWeatherOverride(w)}
            onSetTimeSpeed={(m) => engineRef.current?.setTimeSpeedMult(m)}
            onToggleMute={() => engineRef.current?.toggleMute()}
            onToggleProximityVoice={() => engineRef.current?.toggleProximityVoice()}
            onOpenArmory={() => {
              engineRef.current?.resumeGame();
              setArmoryOpen(true);
            }}
            onOpenRpg={() => {
              engineRef.current?.resumeGame();
              setRpgOpen(true);
            }}
            onOpenCampaign={() => setCampaignOpen(true)}
            onOpenDrive={() => setDriveOpen(true)}
            onOpenUpdates={() => setUpdatesOpen(true)}
            onNextOperation={
              hud.campaign.active &&
              !hud.campaign.campaignCompleted &&
              hud.campaign.currentStageIndex < hud.campaign.stages.length
                ? () => {
                    engineRef.current?.deployCampaignStage(hud.campaign.currentStageIndex);
                    if (!showTouchControls) {
                      engineRef.current?.requestPointerLock();
                    }
                  }
                : undefined
            }
            onResume={() => {
              engineRef.current?.resumeGame();
              if (!showTouchControls) {
                engineRef.current?.requestPointerLock();
              }
            }}
            onRestart={handleStart}
            onReturnTitle={() => engineRef.current?.resetMissionState('title')}
          />
        )}

      {driveOpen && (
        <GoogleDriveModal
          hud={hud}
          onSaveRestored={() => engineRef.current?.reloadProfileFromStorage()}
          onClose={() => setDriveOpen(false)}
        />
      )}

      {updatesOpen && <GitHubUpdateModal onClose={() => setUpdatesOpen(false)} />}
    </div>
  );
}
