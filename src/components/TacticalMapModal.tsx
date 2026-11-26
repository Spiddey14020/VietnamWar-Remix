import type { MouseEvent } from 'react';
import {
  BRIDGE_X,
  HOWITZER_BATTERY_POS,
  LZ_BRAVO_POS,
  PLAYABLE_RADIUS,
  riverCenterZ,
  SECTOR_ALPHA_POS,
  SECTOR_CHARLIE_POS,
} from '../game/terrain';
import { CAMPAIGN_FACTIONS, type HudSnapshot, type SheafPattern, type ShellType } from '../game/types';

interface TacticalMapModalProps {
  hud: HudSnapshot;
  onCallCounterBattery: () => void;
  onSetArtilleryTarget: (x: number, z: number) => void;
  onSetShellType: (t: ShellType) => void;
  onSetSheafPattern: (p: SheafPattern) => void;
  onFireArtillerySquad: () => void;
  onClose: () => void;
}

function worldToMap(x: number, z: number): { mx: number; my: number } {
  const scale = 145 / PLAYABLE_RADIUS;
  return {
    mx: 180 + x * scale,
    my: 180 + z * scale,
  };
}

function mapToWorld(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): { wx: number; wz: number } {
  const rect = svg.getBoundingClientRect();
  const mx = ((clientX - rect.left) / Math.max(1, rect.width)) * 360;
  const my = ((clientY - rect.top) / Math.max(1, rect.height)) * 360;
  const scale = 145 / PLAYABLE_RADIUS;
  return {
    wx: (mx - 180) / scale,
    wz: (my - 180) / scale,
  };
}

export function TacticalMapModal({
  hud,
  onCallCounterBattery,
  onSetArtilleryTarget,
  onSetShellType,
  onSetSheafPattern,
  onFireArtillerySquad,
  onClose,
}: TacticalMapModalProps) {
  const playerPt = worldToMap(hud.playerX, hud.playerZ);

  const riverPoints: string[] = [];
  for (let wx = -PLAYABLE_RADIUS; wx <= PLAYABLE_RADIUS; wx += 8) {
    const pt = worldToMap(wx, riverCenterZ(wx));
    riverPoints.push(`${pt.mx.toFixed(1)},${pt.my.toFixed(1)}`);
  }

  const bridgePt = worldToMap(BRIDGE_X, riverCenterZ(BRIDGE_X));
  const lzPt = worldToMap(LZ_BRAVO_POS.x, LZ_BRAVO_POS.z);
  const batteryPt = worldToMap(HOWITZER_BATTERY_POS.x, HOWITZER_BATTERY_POS.z);
  const alphaObj = hud.objectives.find((o) => o.id === 'alpha');
  const charlieObj = hud.objectives.find((o) => o.id === 'charlie');
  const alphaPt = worldToMap(alphaObj?.x ?? SECTOR_ALPHA_POS.x, alphaObj?.z ?? SECTOR_ALPHA_POS.z);
  const charliePt = worldToMap(charlieObj?.x ?? SECTOR_CHARLIE_POS.x, charlieObj?.z ?? SECTOR_CHARLIE_POS.z);
  const activeFaction = CAMPAIGN_FACTIONS[hud.campaign.factionId];
  const activeStage = hud.campaign.active
    ? hud.campaign.stages[hud.campaign.currentStageIndex] ?? null
    : null;
  const cbSol = hud.counterBattery.activeSolution;
  const cbCooldown = hud.counterBattery.strikeCooldownSec;

  const officer = hud.officer;
  const hasTarget = officer.targetX !== null && officer.targetZ !== null;
  const targetPt = hasTarget ? worldToMap(officer.targetX!, officer.targetZ!) : null;
  const readyCount = officer.guns.filter((g) => g.status === 'READY').length;

  const handleMapClick = (e: MouseEvent<SVGSVGElement>) => {
    const { wx, wz } = mapToWorld(e.clientX, e.clientY, e.currentTarget);
    onSetArtilleryTarget(wx, wz);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-start sm:items-center justify-center bg-[#0b0e0a]/88 p-3 sm:p-4 pointer-events-auto overflow-y-auto touch-scroll"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#161c14] border border-[#4a5640] rounded-lg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-display font-semibold tracking-wide text-[#ece9df] uppercase">
              Mekong Valley Tactical Map &amp; Fire Direction Center
            </h2>
            <p className="text-xs text-[#9ea38f]">
              {activeFaction.shortName} ·{' '}
              {activeStage ? `${activeStage.opCode} (${activeStage.regionName})` : 'Skirmish'} ·{' '}
              {hud.enemiesRemaining} Hostiles · {hud.counterBattery.neutralizedCount}/3 Batteries Silenced
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-1.5 bg-[#232b20] hover:bg-[#2f392b] border border-[#4a5640] rounded text-xs font-medium text-[#ece9df] cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <svg
            viewBox="0 0 360 360"
            onClick={handleMapClick}
            className="w-full aspect-square bg-[#1d2519] border border-[#3a4533] rounded cursor-crosshair"
          >
            {[60, 120, 180, 240, 300].map((v) => (
              <g key={v} stroke="#2c3726" strokeWidth="1">
                <line x1={v} y1="0" x2={v} y2="360" />
                <line x1="0" y1={v} x2="360" y2={v} />
              </g>
            ))}
            <circle cx="180" cy="180" r="145" fill="none" stroke="#3f4d37" strokeDasharray="5 4" />

            {/* River */}
            <polyline
              fill="none"
              stroke="#3d5863"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={riverPoints.join(' ')}
            />

            {/* Bridge */}
            <rect
              x={bridgePt.mx - 4}
              y={bridgePt.my - 11}
              width="8"
              height="22"
              fill="#8d6a43"
              stroke="#d8c39b"
              strokeWidth="1"
            />

            {/* Acoustic Bearing Ray to Active Detected Enemy Artillery */}
            {cbSol &&
              (() => {
                const rad = (cbSol.azimuthDeg * Math.PI) / 180;
                const ex = playerPt.mx + Math.sin(rad) * 165;
                const ey = playerPt.my - Math.cos(rad) * 165;
                return (
                  <g>
                    <line
                      x1={playerPt.mx}
                      y1={playerPt.my}
                      x2={ex}
                      y2={ey}
                      stroke="#e67058"
                      strokeWidth="1.75"
                      strokeDasharray="6 4"
                    />
                    <circle
                      cx={Math.max(18, Math.min(342, ex))}
                      cy={Math.max(18, Math.min(342, ey))}
                      r="5"
                      fill="#e67058"
                    />
                  </g>
                );
              })()}

            {/* Fire Mission Line & Target Crosshair */}
            {targetPt && (
              <g>
                <line
                  x1={batteryPt.mx}
                  y1={batteryPt.my}
                  x2={targetPt.mx}
                  y2={targetPt.my}
                  stroke="#d99b38"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
                <circle
                  cx={targetPt.mx}
                  cy={targetPt.my}
                  r={officer.sheafPattern === 'BARRAGE' ? 16 : 9}
                  fill="none"
                  stroke="#f0bd54"
                  strokeWidth="1.8"
                />
                <line
                  x1={targetPt.mx - 12}
                  y1={targetPt.my}
                  x2={targetPt.mx + 12}
                  y2={targetPt.my}
                  stroke="#f0bd54"
                  strokeWidth="1.4"
                />
                <line
                  x1={targetPt.mx}
                  y1={targetPt.my - 12}
                  x2={targetPt.mx}
                  y2={targetPt.my + 12}
                  stroke="#f0bd54"
                  strokeWidth="1.4"
                />
                <text
                  x={targetPt.mx}
                  y={targetPt.my - 15}
                  textAnchor="middle"
                  fill="#f7d584"
                  fontSize="9"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {officer.shellType} TARGET
                </text>
              </g>
            )}

            {/* Friendly 155mm Howitzer Squad Position */}
            <g transform={`translate(${batteryPt.mx}, ${batteryPt.my})`}>
              <rect
                x="-9"
                y="-6"
                width="18"
                height="12"
                fill="#293524"
                stroke="#9cc47d"
                strokeWidth="1.6"
              />
              <text
                y="16"
                textAnchor="middle"
                fill="#9cc47d"
                fontSize="9"
                fontFamily="IBM Plex Mono, monospace"
              >
                155MM BTY
              </text>
            </g>

            {/* LZ Bravo */}
            <g transform={`translate(${lzPt.mx}, ${lzPt.my})`}>
              <circle r="10" fill="none" stroke="#6aa65c" strokeWidth="2" />
              <text
                y="20"
                textAnchor="middle"
                fill="#a8cf9b"
                fontSize="9.5"
                fontFamily="IBM Plex Mono, monospace"
              >
                LZ BRAVO
              </text>
            </g>

            {/* Sector Alpha */}
            <g transform={`translate(${alphaPt.mx}, ${alphaPt.my})`}>
              <circle
                r="11"
                fill={alphaObj?.completed ? '#364d32' : '#5e2b24'}
                stroke={alphaObj?.completed ? '#79b86c' : '#e06354'}
                strokeWidth="2"
              />
              <text
                y="4"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="700"
                fontFamily="IBM Plex Mono, monospace"
              >
                A
              </text>
              <text
                y="22"
                textAnchor="middle"
                fill="#dfd7c0"
                fontSize="9.5"
                fontFamily="IBM Plex Mono, monospace"
              >
                ALPHA
              </text>
            </g>

            {/* Sector Charlie */}
            <g transform={`translate(${charliePt.mx}, ${charliePt.my})`}>
              <circle
                r="11"
                fill={charlieObj?.completed ? '#364d32' : '#5e2b24'}
                stroke={charlieObj?.completed ? '#79b86c' : '#e06354'}
                strokeWidth="2"
              />
              <text
                y="4"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="700"
                fontFamily="IBM Plex Mono, monospace"
              >
                C
              </text>
              <text
                y="22"
                textAnchor="middle"
                fill="#dfd7c0"
                fontSize="9.5"
                fontFamily="IBM Plex Mono, monospace"
              >
                CHARLIE
              </text>
            </g>

            {/* Player marker */}
            <g transform={`translate(${playerPt.mx}, ${playerPt.my}) rotate(${hud.headingDeg})`}>
              <polygon points="0,-11 7,8 0,4 -7,8" fill="#c89b3c" stroke="#11150f" strokeWidth="1.2" />
            </g>
          </svg>

          {/* Right Panel: 155mm Howitzer Squad Command + Counter-Battery */}
          <div className="flex flex-col justify-between gap-3 bg-[#11150f] border border-[#2f382a] rounded p-4">
            {/* Section 1: 155mm Howitzer Squad Command */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#c89b3c]">
                  155mm Howitzer Squad (Thunder)
                </span>
                <span className="text-[11px] font-mono-tabular text-[#9cc47d] tabular-nums">
                  {readyCount}/3 Ready
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono-tabular">
                {officer.guns.map((g) => (
                  <div
                    key={g.id}
                    className="px-2 py-1.5 bg-[#181e15] border border-[#2d3627] rounded"
                  >
                    <div className="text-[#ece9df] font-semibold">{g.callsign}</div>
                    <div
                      className={
                        g.status === 'READY'
                          ? 'text-[#7ab36d]'
                          : g.status === 'FIRING'
                            ? 'text-[#f0bd54]'
                            : 'text-[#9ea38f]'
                      }
                    >
                      {g.status === 'RELOADING' ? `${g.reloadLeftSec}s` : g.status}
                    </div>
                  </div>
                ))}
              </div>

              {/* Target Coordinates Readout */}
              <div className="grid grid-cols-3 gap-2 pt-1.5 text-xs font-mono-tabular border-t border-[#262e22]">
                <div>
                  <div className="text-[10px] text-[#8e9381]">Target Grid</div>
                  <div className="text-[#ece9df] tabular-nums">
                    {officer.targetGridRef ?? 'Click Map'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#8e9381]">Azimuth</div>
                  <div className="text-[#f0bd54] tabular-nums">
                    {officer.targetAzimuthDeg !== null
                      ? `${String(officer.targetAzimuthDeg).padStart(3, '0')}°`
                      : '---'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#8e9381]">Range</div>
                  <div className="text-[#ece9df] tabular-nums">
                    {officer.targetRangeM !== null ? `${officer.targetRangeM} m` : '---'}
                  </div>
                </div>
              </div>

              {/* Shell Type & Sheaf Pattern */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#181e15] border border-[#2d3627] rounded">
                  {(['HE', 'WP'] as ShellType[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSetShellType(s)}
                      className={`min-h-[34px] text-[11px] font-mono-tabular rounded cursor-pointer ${
                        officer.shellType === s
                          ? 'bg-[#c89b3c] text-[#11150f] font-bold'
                          : 'text-[#b8b39e] hover:text-white'
                      }`}
                    >
                      {s === 'HE' ? 'HE 155' : 'WP Smoke'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#181e15] border border-[#2d3627] rounded">
                  {(['CONVERGE', 'BARRAGE'] as SheafPattern[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onSetSheafPattern(p)}
                      className={`min-h-[34px] text-[11px] font-mono-tabular rounded cursor-pointer ${
                        officer.sheafPattern === p
                          ? 'bg-[#c89b3c] text-[#11150f] font-bold'
                          : 'text-[#b8b39e] hover:text-white'
                      }`}
                    >
                      {p === 'CONVERGE' ? 'Converge' : 'Barrage'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={!hasTarget || readyCount === 0}
                onClick={() => {
                  onFireArtillerySquad();
                  onClose();
                }}
                className={`min-h-[46px] w-full rounded font-display font-semibold tracking-wider uppercase text-sm transition-colors ${
                  hasTarget && readyCount > 0
                    ? 'bg-[#c89b3c] hover:bg-[#dab04f] text-[#11150f] cursor-pointer'
                    : 'bg-[#22281e] text-[#737868] border border-[#343c2e] cursor-not-allowed'
                }`}
              >
                {!hasTarget
                  ? 'Select Target on Map First'
                  : readyCount === 0
                    ? '155mm Battery Reloading...'
                    : `Fire For Effect (${readyCount}x 155mm ${officer.shellType})`}
              </button>
            </div>

            {/* Section 2: Counter-Battery Sound-Ranging */}
            <div className="pt-3 border-t border-[#262e22] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#e69a5c]">
                  Enemy Sound-Ranging
                </span>
                <span className="text-[11px] font-mono-tabular text-[#8e9381]">
                  {officer.salvosFired} Salvos · {officer.killsByArtillery} Arty KIA
                </span>
              </div>
              {cbSol ? (
                <div className="text-xs font-mono-tabular text-[#d9d5c5]">
                  {cbSol.callsign} · {cbSol.gridRef} · {String(cbSol.azimuthDeg).padStart(3, '0')}° ·{' '}
                  {cbSol.rangeMeters}m
                </div>
              ) : (
                <div className="text-[11px] text-[#8e9381]">
                  Listening for enemy valley battery reports...
                </div>
              )}

              <button
                type="button"
                disabled={!cbSol || cbCooldown > 0}
                onClick={() => {
                  onCallCounterBattery();
                  onClose();
                }}
                className={`min-h-[42px] w-full rounded font-display font-semibold tracking-wider uppercase text-xs transition-colors ${
                  cbSol && cbCooldown <= 0
                    ? 'bg-[#b53a2a] hover:bg-[#cc4533] text-white cursor-pointer'
                    : 'bg-[#1b2118] text-[#6d7363] border border-[#2d3528] cursor-not-allowed'
                }`}
              >
                {cbCooldown > 0
                  ? `Counter-Battery Cooldown (${cbCooldown}s)`
                  : cbSol
                    ? 'Call Counter-Battery Fire (F)'
                    : 'Awaiting Enemy Artillery Signature'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
