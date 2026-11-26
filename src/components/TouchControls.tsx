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
    const normY = -dy / maxR; // up is positive forward
    const sprint = dist >= maxR * 0.86 && normY > 0.55;
    onTouchInput({ moveX: normX, moveY: normY, sprint });
  };

  const resetStick = () => {
    stickPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onTouchInput({ moveX: 0, moveY: 0, sprint: false });
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Right-half free-look touch pad */}
      <div
        className="absolute top-16 bottom-0 right-0 left-[38%] pointer-events-auto touch-none"
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

      {/* Left-thumb Virtual Analog Stick */}
      <div
        ref={stickRef}
        className="absolute bottom-20 left-6 w-32 h-32 rounded-full bg-[#151a13]/55 border-2 border-[#6b755d]/70 pointer-events-auto touch-none flex items-center justify-center"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (stickPointerId.current === null) {
            stickPointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStick(e.clientX, e.clientY);
          }
        }}
        onPointerMove={(e) => {
          if (stickPointerId.current === e.pointerId) {
            updateStick(e.clientX, e.clientY);
          }
        }}
        onPointerUp={(e) => {
          if (stickPointerId.current === e.pointerId) resetStick();
        }}
        onPointerCancel={(e) => {
          if (stickPointerId.current === e.pointerId) resetStick();
        }}
      >
        <div
          className={`w-14 h-14 rounded-full border-2 transition-colors ${
            isSprinting
              ? 'bg-[#c89b3c]/85 border-[#f4d78f]'
              : 'bg-[#3b4533]/85 border-[#a8af98]'
          }`}
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
      </div>

      {/* Right-thumb Ergonomic Combat Action Cluster */}
      <div className="absolute bottom-20 right-5 pointer-events-auto flex flex-col items-end gap-3">
        {/* Top auxiliary row: Swap, Mode, Frag, Bandage */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleFireMode();
            }}
            className="min-w-[48px] min-h-[48px] px-3 rounded-lg bg-[#181e15]/85 border border-[#4e5945] text-[#e6e2d3] text-xs font-mono-tabular active:bg-[#2a3325]"
          >
            MODE
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onCycleWeapon();
            }}
            className="min-w-[48px] min-h-[48px] px-3 rounded-lg bg-[#181e15]/85 border border-[#4e5945] text-[#e6e2d3] text-xs font-mono-tabular active:bg-[#2a3325]"
          >
            SWAP
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onBandage();
            }}
            className={`min-w-[48px] min-h-[48px] px-3 rounded-lg border text-xs font-mono-tabular ${
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
            className="min-w-[48px] min-h-[48px] px-3 rounded-lg bg-[#181e15]/85 border border-[#4e5945] text-[#e6e2d3] text-xs font-mono-tabular active:bg-[#2a3325]"
          >
            FRAG {grenades}
          </button>
        </div>

        {/* Lower primary combat arc: Crouch, Reload, ADS, FIRE */}
        <div className="flex items-end gap-3">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onCrouch();
            }}
            className={`w-13 h-13 rounded-full border text-xs font-semibold ${
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
            className="w-13 h-13 rounded-full bg-[#181e15]/85 border border-[#56624c] text-[#ece9df] text-xs font-semibold active:bg-[#2f3829]"
          >
            RLD
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleAds();
            }}
            className={`w-14 h-14 rounded-full border text-xs font-bold tracking-wide ${
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
              e.currentTarget.setPointerCapture(e.pointerId);
              onTouchInput({ firing: true });
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onTouchInput({ firing: false });
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              onTouchInput({ firing: false });
            }}
            className="w-20 h-20 rounded-full bg-[#b53a2a]/90 active:bg-[#d94a38] border-2 border-[#e89587] text-white text-sm font-display font-bold tracking-wider uppercase shadow-lg"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
}
