import { useRef, useState } from 'react';
import type { TouchInputState } from '../game/types';

interface TouchControlsProps {
  onTouchInput: (partial: Partial<TouchInputState>) => void;
  onToggleAds: () => void;
  onReload: () => void;
  onCrouch: () => void;
  onGrenade: () => void;
  onBandage: () => void;
  onCycleWeapon: () => void;
  onToggleFireMode: () => void;
  isAds: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  grenades: number;
  bandages: number;
  bleeding: boolean;
}

export function TouchControls({
  onTouchInput,
  onToggleAds,
  onReload,
  onCrouch,
  onGrenade,
  onBandage,
  onCycleWeapon,
  onToggleFireMode,
  isAds,
  isCrouching,
  isSprinting,
  grenades,
  bandages,
  bleeding,
}: TouchControlsProps) {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);
  const lookPointerId = useRef<number | null>(null);
  const lookLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const firePointerId = useRef<number | null>(null);
  const fireLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const updateStick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnobOffset({ x: dx, y: dy });
    const normX = dx / maxR;
    const normY = -dy / maxR;
    const sprint = dist >= maxR * 0.84 && normY > 0.52;
    onTouchInput({ moveX: normX, moveY: normY, sprint });
  };

  const resetStick = () => {
    stickPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onTouchInput({ moveX: 0, moveY: 0, sprint: false });
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none touch-none">
      {/* Full-viewport background touch-look pad (buttons and stick stopPropagation above it) */}
      <div
        className="absolute inset-0 pointer-events-auto touch-none"
        onPointerDown={(e) => {
          if (lookPointerId.current === null) {
            lookPointerId.current = e.pointerId;
            lookLastPos.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (lookPointerId.current !== e.pointerId) return;
          const dx = e.clientX - lookLastPos.current.x;
          const dy = e.clientY - lookLastPos.current.y;
          lookLastPos.current = { x: e.clientX, y: e.clientY };
          onTouchInput({ lookDeltaX: dx, lookDeltaY: dy });
        }}
        onPointerUp={(e) => {
          if (lookPointerId.current === e.pointerId) {
            lookPointerId.current = null;
          }
        }}
        onPointerCancel={(e) => {
          if (lookPointerId.current === e.pointerId) {
            lookPointerId.current = null;
          }
        }}
      />

      {/* Left-thumb Virtual Analog Stick (scales smoothly from 360px phones to 12"+ Android tablets) */}
      <div
        ref={stickRef}
        style={{
          left: 'max(0.75rem, env(safe-area-inset-left))',
          bottom: 'calc(env(safe-area-inset-bottom) + 3.65rem)',
        }}
        className="absolute w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full bg-[#151a13]/60 border-2 border-[#6b755d]/75 pointer-events-auto touch-none flex items-center justify-center"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (stickPointerId.current === null) {
            stickPointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStick(e.clientX, e.clientY);
          }
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (stickPointerId.current === e.pointerId) {
            updateStick(e.clientX, e.clientY);
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (stickPointerId.current === e.pointerId) resetStick();
        }}
        onPointerCancel={(e) => {
          e.stopPropagation();
          if (stickPointerId.current === e.pointerId) resetStick();
        }}
      >
        <div
          className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 transition-colors ${
            isSprinting
              ? 'bg-[#c89b3c]/85 border-[#f4d78f]'
              : 'bg-[#3b4533]/85 border-[#a8af98]'
          }`}
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
        {isSprinting && (
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono-tabular font-bold uppercase text-[#f4d78f] pointer-events-none">
            SPRINT
          </span>
        )}
      </div>

      {/* Right-thumb Ergonomic Combat Cluster (compact on phones so it never overlaps stick) */}
      <div
        style={{
          right: 'max(0.75rem, env(safe-area-inset-right))',
          bottom: 'calc(env(safe-area-inset-bottom) + 3.65rem)',
        }}
        className="absolute pointer-events-auto flex flex-col items-end gap-2 touch-none"
      >
        {/* Auxiliary combat row: 2x2 on narrow phones, 1x4 on tablets/landscape */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleFireMode();
            }}
            className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-[#181e15]/85 border border-[#4e5945] text-[#e6e2d3] text-[11px] font-mono-tabular active:bg-[#2a3325]"
          >
            MODE
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onCycleWeapon();
            }}
            className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-[#181e15]/85 border border-[#4e5945] text-[#e6e2d3] text-[11px] font-mono-tabular active:bg-[#2a3325]"
          >
            SWAP
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onBandage();
            }}
            className={`min-w-[44px] min-h-[44px] px-2.5 rounded-lg border text-[11px] font-mono-tabular ${
              bleeding
                ? 'bg-[#8f2c22]/90 border-[#e06a5c] text-white'
                : 'bg-[#181e15]/85 border-[#4e5945] text-[#e6e2d3]'
            }`}
          >
            MED {bandages}
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onGrenade();
            }}
            className="min-w-[44px] min-h-[44px] px-2.5 rounded-lg bg-[#181e15]/85 border border-[#4e5945] text-[#e6e2d3] text-[11px] font-mono-tabular active:bg-[#2a3325]"
          >
            FRAG {grenades}
          </button>
        </div>

        {/* Lower primary combat arc: Crouch + Reload + ADS + Drag-to-Aim FIRE */}
        <div className="flex items-end gap-2 sm:gap-2.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onCrouch();
            }}
            className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full border text-[11px] font-semibold ${
              isCrouching
                ? 'bg-[#c89b3c] border-[#f4d78f] text-[#11150f]'
                : 'bg-[#181e15]/85 border-[#56624c] text-[#ece9df]'
            }`}
          >
            DUCK
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-[#181e15]/85 border border-[#56624c] text-[#ece9df] text-[11px] font-semibold active:bg-[#2f3829]"
          >
            RLD
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleAds();
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border text-xs font-bold tracking-wide ${
              isAds
                ? 'bg-[#c89b3c] border-[#f4d78f] text-[#11150f]'
                : 'bg-[#181e15]/85 border-[#68745c] text-[#ece9df]'
            }`}
          >
            AIM
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              firePointerId.current = e.pointerId;
              fireLastPos.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
              onTouchInput({ firing: true });
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              if (firePointerId.current !== e.pointerId) return;
              const dx = e.clientX - fireLastPos.current.x;
              const dy = e.clientY - fireLastPos.current.y;
              fireLastPos.current = { x: e.clientX, y: e.clientY };
              onTouchInput({ lookDeltaX: dx, lookDeltaY: dy });
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (firePointerId.current === e.pointerId) {
                firePointerId.current = null;
                onTouchInput({ firing: false });
              }
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              if (firePointerId.current === e.pointerId) {
                firePointerId.current = null;
                onTouchInput({ firing: false });
              }
            }}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#b53a2a]/92 active:bg-[#d94a38] border-2 border-[#e89587] text-white text-xs sm:text-sm font-display font-bold tracking-wider uppercase shadow-lg touch-none"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
}
