import {
  TERRAIN_ZONE_LABELS,
  type CamoPatternStyle,
  type CustomCamoConfig,
  type PaintFinishType,
  type TerrainZoneId,
} from '../game/types';

interface CustomCamoStudioProps {
  mode: 'weapon' | 'uniform';
  value: CustomCamoConfig;
  isActive: boolean;
  onChange: (cfg: CustomCamoConfig) => void;
}

const PATTERNS: { id: CamoPatternStyle; label: string }[] = [
  { id: 'solid', label: 'Solid Coat' },
  { id: 'tiger', label: 'Tiger Stripe' },
  { id: 'woodland', label: 'Woodland ERDL' },
  { id: 'splinter', label: 'Geometric Splinter' },
  { id: 'gradient', label: 'Two-Tone Fade' },
];

const FINISHES: { id: PaintFinishType; label: string; desc: string }[] = [
  { id: 'matte', label: 'Matte', desc: 'Flat tactical non-glare coat' },
  { id: 'satin', label: 'Satin', desc: 'Soft military enamel sheen' },
  { id: 'gloss', label: 'Gloss', desc: 'Deep clear-coated lacquer' },
  { id: 'metallic', label: 'Metallic', desc: 'Flaked brushed alloy luster' },
  { id: 'candy', label: 'Candy', desc: 'Deep translucent clearcoat pop' },
  { id: 'chrome', label: 'Chrome', desc: 'Mirror-polished plated finish' },
];

const QUICK_COLOR_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Olive Drab', hex: '#4b5a34' },
  { label: 'Mekong Mud', hex: '#5b4a33' },
  { label: 'Midnight', hex: '#1a1e1c' },
  { label: 'Sand Khaki', hex: '#9e8861' },
  { label: 'Candy Red', hex: '#b81d2a' },
  { label: 'Candy Cobalt', hex: '#1e5aa8' },
  { label: 'Candy Plum', hex: '#6a287e' },
  { label: 'Emerald', hex: '#1f7a4c' },
  { label: 'Sunset Gold', hex: '#d49a2a' },
  { label: 'Burnt Orange', hex: '#cc521b' },
  { label: 'Silver Chrome', hex: '#cfd6dc' },
  { label: 'Arctic Ivory', hex: '#e2dfd3' },
];

const QUICK_STUDIO_PRESETS: { label: string; cfg: Partial<CustomCamoConfig> }[] = [
  {
    label: 'Candy Ruby Tiger',
    cfg: {
      name: 'Candy Ruby Tiger',
      pattern: 'tiger',
      finish: 'candy',
      primaryHex: '#9e1422',
      secondaryHex: '#26060a',
      accentHex: '#e6505e',
    },
  },
  {
    label: 'Cobalt Metallic',
    cfg: {
      name: 'Cobalt Metallic',
      pattern: 'gradient',
      finish: 'metallic',
      primaryHex: '#1d4f91',
      secondaryHex: '#0d2242',
      accentHex: '#7cb2f0',
    },
  },
  {
    label: 'Gold & Chrome',
    cfg: {
      name: 'Command Chrome',
      pattern: 'splinter',
      finish: 'chrome',
      primaryHex: '#c8d0d6',
      secondaryHex: '#c7972e',
      accentHex: '#2c3237',
    },
  },
  {
    label: 'Candy Emerald',
    cfg: {
      name: 'Candy Emerald',
      pattern: 'woodland',
      finish: 'candy',
      primaryHex: '#187846',
      secondaryHex: '#0a331d',
      accentHex: '#63d18f',
    },
  },
];

export function buildCamoPreviewStyle(cfg: CustomCamoConfig): {
  background: string;
  boxShadow?: string;
} {
  let background = cfg.primaryHex;
  if (cfg.pattern === 'tiger') {
    background = `repeating-linear-gradient(125deg, ${cfg.primaryHex} 0 11px, ${cfg.secondaryHex} 11px 17px, ${cfg.accentHex} 17px 22px)`;
  } else if (cfg.pattern === 'woodland') {
    background = `radial-gradient(circle at 24% 30%, ${cfg.secondaryHex} 0 28%, transparent 29%), radial-gradient(circle at 74% 68%, ${cfg.accentHex} 0 26%, transparent 27%), ${cfg.primaryHex}`;
  } else if (cfg.pattern === 'splinter') {
    background = `linear-gradient(135deg, ${cfg.primaryHex} 0 38%, ${cfg.secondaryHex} 38% 68%, ${cfg.accentHex} 68% 100%)`;
  } else if (cfg.pattern === 'gradient') {
    background = `linear-gradient(135deg, ${cfg.primaryHex} 0%, ${cfg.secondaryHex} 55%, ${cfg.accentHex} 100%)`;
  }

  let sheenOverlay = '';
  let boxShadow: string | undefined;
  if (cfg.finish === 'chrome') {
    sheenOverlay =
      'linear-gradient(115deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.06) 44%, rgba(255,255,255,0.42) 62%, rgba(0,0,0,0.22) 100%), ';
    boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.45)';
  } else if (cfg.finish === 'candy') {
    sheenOverlay =
      'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0.28) 100%), ';
    boxShadow = 'inset 0 1px 2px rgba(255,255,255,0.38)';
  } else if (cfg.finish === 'metallic') {
    sheenOverlay =
      'linear-gradient(125deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.16) 100%), ';
  } else if (cfg.finish === 'gloss') {
    sheenOverlay =
      'linear-gradient(160deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 48%), ';
  }

  return {
    background: `${sheenOverlay}${background}`,
    boxShadow,
  };
}

export function CustomCamoStudio({
  mode,
  value,
  isActive,
  onChange,
}: CustomCamoStudioProps) {
  const previewStyle = buildCamoPreviewStyle(value);

  const update = (patch: Partial<CustomCamoConfig>) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  return (
    <div className="p-3.5 bg-[#11150f] border border-[#3a4433] rounded space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded border border-[#657256] shrink-0"
            style={previewStyle}
            aria-label="Live custom paint preview"
          />
          <div className="min-w-0">
            <div className="text-xs font-mono-tabular uppercase tracking-wider text-[#c89b3c]">
              {mode === 'weapon' ? 'Custom Firearm Paint Studio' : 'Custom Uniform Camo Studio'}
              {isActive ? ' · ACTIVE' : ''}
            </div>
            <div className="text-xs text-[#b8b39e] truncate">
              Any hex color · {value.pattern.toUpperCase()} · {value.finish.toUpperCase()} finish
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...value })}
          className={`min-h-[40px] px-3.5 py-1.5 rounded border text-xs font-mono-tabular uppercase tracking-wide cursor-pointer whitespace-nowrap shrink-0 ${
            isActive
              ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df] font-semibold'
              : 'bg-[#c89b3c] hover:bg-[#d8ab4c] border-[#f2d488] text-[#11150f] font-bold'
          }`}
        >
          {isActive ? 'Applied in 3D' : mode === 'weapon' ? 'Apply to Weapon' : 'Wear Custom Camo'}
        </button>
      </div>

      {/* Custom Name & Quick Studio Finishes */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-mono-tabular text-[#9ea38f] uppercase">
          Coat Name
          <input
            type="text"
            maxLength={26}
            value={value.name}
            onChange={(e) => update({ name: e.target.value })}
            className="ml-2 min-h-[36px] w-44 px-2.5 bg-[#161c14] border border-[#3a4433] rounded text-xs font-mono-tabular text-[#ece9df] focus:outline-none focus:border-[#c89b3c]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_STUDIO_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => update(preset.cfg)}
              className="min-h-[34px] px-2.5 py-1 bg-[#181f15] hover:bg-[#232d1f] border border-[#35402e] rounded text-[11px] font-mono-tabular text-[#d4d0bf] cursor-pointer whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Three Full-Spectrum Color Channels + Tactical Quick Swatches */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {(
          [
            { key: 'primaryHex', label: 'Primary Color' },
            { key: 'secondaryHex', label: 'Secondary Stripe' },
            { key: 'accentHex', label: 'Accent Fleck' },
          ] as const
        ).map((ch) => (
          <div
            key={ch.key}
            className="p-2 bg-[#161c14] border border-[#2d3628] rounded space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono-tabular text-[#c9c5b4]">{ch.label}</span>
              <span className="text-[11px] font-mono-tabular text-[#9ea38f] uppercase tabular-nums">
                {value[ch.key]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={ch.label}
                value={value[ch.key]}
                onChange={(e) => update({ [ch.key]: e.target.value })}
                className="w-10 h-9 p-0.5 bg-[#0e120d] border border-[#4a5640] rounded cursor-pointer shrink-0"
              />
              <div className="flex flex-wrap gap-1">
                {QUICK_COLOR_SWATCHES.slice(0, 6).map((sw) => (
                  <button
                    key={`${ch.key}-${sw.hex}`}
                    type="button"
                    title={sw.label}
                    aria-label={`${ch.label}: ${sw.label}`}
                    onClick={() => update({ [ch.key]: sw.hex })}
                    className="w-4 h-4 rounded-sm border border-[#4f5a44] cursor-pointer"
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
                {QUICK_COLOR_SWATCHES.slice(6).map((sw) => (
                  <button
                    key={`${ch.key}-${sw.hex}`}
                    type="button"
                    title={sw.label}
                    aria-label={`${ch.label}: ${sw.label}`}
                    onClick={() => update({ [ch.key]: sw.hex })}
                    className="w-4 h-4 rounded-sm border border-[#4f5a44] cursor-pointer"
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Camo Pattern Style */}
      <div>
        <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
          Camouflage Pattern
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {PATTERNS.map((pat) => {
            const active = value.pattern === pat.id;
            return (
              <button
                key={pat.id}
                type="button"
                onClick={() => update({ pattern: pat.id })}
                className={`min-h-[40px] px-2 py-1.5 rounded border text-xs font-mono-tabular cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df] font-semibold'
                    : 'bg-[#161c14] border-[#2d3628] text-[#b8b39e] hover:border-[#4c5944]'
                }`}
              >
                {pat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Paint Finish (Matte, Satin, Gloss, Metallic, Candy, Chrome) */}
      <div>
        <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
          Paint Finish &amp; PBR Sheen
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {FINISHES.map((fin) => {
            const active = value.finish === fin.id;
            return (
              <button
                key={fin.id}
                type="button"
                title={fin.desc}
                onClick={() => update({ finish: fin.id })}
                className={`min-h-[44px] px-2 py-1.5 rounded border text-left cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#2a3423] border-[#c89b3c] text-[#ece9df]'
                    : 'bg-[#161c14] border-[#2d3628] text-[#b8b39e] hover:border-[#4c5944]'
                }`}
              >
                <div className="text-xs font-semibold">{fin.label}</div>
                <div className="text-[10px] text-[#9ea38f] leading-tight mt-0.5 truncate">
                  {fin.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Uniform Favored Terrain Bonus Selector */}
      {mode === 'uniform' && (
        <div>
          <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#9ea38f] mb-1.5">
            Terrain Camo Bonus Affinity (-28% Detection · +10% Speed &amp; Damage in Chosen Zone)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(Object.keys(TERRAIN_ZONE_LABELS) as TerrainZoneId[]).map((tz) => {
              const active = value.favoredTerrain === tz;
              return (
                <button
                  key={tz}
                  type="button"
                  onClick={() => update({ favoredTerrain: tz })}
                  className={`min-h-[40px] px-2.5 py-1.5 rounded border text-xs font-mono-tabular cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#2a3423] border-[#9cc47d] text-[#ece9df] font-semibold'
                      : 'bg-[#161c14] border-[#2d3628] text-[#b8b39e] hover:border-[#4c5944]'
                  }`}
                >
                  {TERRAIN_ZONE_LABELS[tz]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
