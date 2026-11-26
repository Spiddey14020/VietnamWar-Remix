import * as THREE from 'three';
import type { TerrainZoneId } from './types';

export const WORLD_SIZE = 380;
export const PLAYABLE_RADIUS = 132;
export const WATER_LEVEL = -0.35;

export const LZ_BRAVO_POS = { x: 0, z: 82 };
export const HOWITZER_BATTERY_POS = { x: -24, z: 69 };
export const SECTOR_ALPHA_POS = { x: -58, z: -42 };
export const SECTOR_CHARLIE_POS = { x: 64, z: -34 };
export const BRIDGE_X = 12;

export function riverCenterZ(x: number): number {
  return 18 + Math.sin(x * 0.028) * 14 + Math.cos(x * 0.014) * 6;
}

export function riverHalfWidth(x: number): number {
  return 9.5 + Math.sin(x * 0.045 + 1.2) * 2.2;
}

export function distToRiver(x: number, z: number): number {
  const cz = riverCenterZ(x);
  return Math.abs(z - cz) - riverHalfWidth(x);
}

export function isInRiver(x: number, z: number): boolean {
  return distToRiver(x, z) < 0 && groundHeightAt(x, z) < WATER_LEVEL + 0.05;
}

export function getTerrainZoneAt(x: number, z: number): TerrainZoneId {
  if (distToRiver(x, z) < 4.5) {
    return 'river';
  }
  const dLz = Math.hypot(x - LZ_BRAVO_POS.x, z - LZ_BRAVO_POS.z);
  const dBat = Math.hypot(x - HOWITZER_BATTERY_POS.x, z - HOWITZER_BATTERY_POS.z);
  const dAlpha = Math.hypot(x - SECTOR_ALPHA_POS.x, z - SECTOR_ALPHA_POS.z);
  const dCharlie = Math.hypot(x - SECTOR_CHARLIE_POS.x, z - SECTOR_CHARLIE_POS.z);
  if (dLz < 18 || dBat < 16 || dAlpha < 16 || dCharlie < 17) {
    return 'bunker';
  }
  const h = groundHeightAt(x, z);
  const slopeX = Math.abs(groundHeightAt(x + 1.2, z) - h) / 1.2;
  const slopeZ = Math.abs(groundHeightAt(x, z + 1.2) - h) / 1.2;
  const onTrailToBridge =
    Math.abs(x - BRIDGE_X * (1 - smoothstep(20, 82, z))) < 3.6 && z > 18 && z < 84;
  if (h >= 4.0 || Math.hypot(slopeX, slopeZ) > 0.38 || onTrailToBridge) {
    return 'ridge';
  }
  return 'jungle';
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const activeCraters: { x: number; z: number; r: number; depth: number }[] = [];

export function clearGroundCraters(): void {
  activeCraters.length = 0;
}

export function groundHeightAt(x: number, z: number): number {
  let h =
    Math.sin(x * 0.022) * Math.cos(z * 0.024) * 3.4 +
    Math.sin(x * 0.055 + 0.8) * Math.sin(z * 0.048 - 0.4) * 1.45 +
    Math.cos((x + z) * 0.09) * 0.45;

  // Flatten LZ Bravo clearing
  const dLz = Math.hypot(x - LZ_BRAVO_POS.x, z - LZ_BRAVO_POS.z);
  const lzBlend = 1 - smoothstep(12, 26, dLz);
  h = h * (1 - lzBlend) + 2.8 * lzBlend;

  // Flatten Howitzer Battery Fire Base shelf
  const dBat = Math.hypot(x - HOWITZER_BATTERY_POS.x, z - HOWITZER_BATTERY_POS.z);
  const batBlend = 1 - smoothstep(10, 21, dBat);
  h = h * (1 - batBlend) + 3.1 * batBlend;

  // Elevate & plateau Sector Alpha (Mortar Ridge)
  const dAlpha = Math.hypot(x - SECTOR_ALPHA_POS.x, z - SECTOR_ALPHA_POS.z);
  const alphaBlend = 1 - smoothstep(10, 25, dAlpha);
  h = h * (1 - alphaBlend) + 7.2 * alphaBlend;

  // Plateau Sector Charlie (Comms Bunker)
  const dCharlie = Math.hypot(x - SECTOR_CHARLIE_POS.x, z - SECTOR_CHARLIE_POS.z);
  const charlieBlend = 1 - smoothstep(10, 24, dCharlie);
  h = h * (1 - charlieBlend) + 4.4 * charlieBlend;

  // Carve Mekong river tributary channel
  const cz = riverCenterZ(x);
  const hw = riverHalfWidth(x);
  const dRiver = Math.abs(z - cz);
  if (dRiver < hw + 8) {
    const bankT = 1 - smoothstep(hw * 0.45, hw + 7, dRiver);
    h = h * (1 - bankT) + -1.45 * bankT;
  }

  // Natural mountain ridge perimeter beyond PLAYABLE_RADIUS
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > PLAYABLE_RADIUS - 10) {
    const ridgeT = smoothstep(PLAYABLE_RADIUS - 10, PLAYABLE_RADIUS + 48, distFromCenter);
    const ridgeNoise = 1 + 0.25 * Math.sin(Math.atan2(z, x) * 7);
    h += ridgeT * 26 * ridgeNoise;
  }

  // Apply active artillery / ordnance craters
  for (let i = 0; i < activeCraters.length; i++) {
    const c = activeCraters[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r * 1.38) {
      const t = d / c.r;
      if (t < 0.86) {
        const bowl = Math.cos((t / 0.86) * (Math.PI * 0.5));
        h -= c.depth * bowl * bowl;
      } else {
        const rimT = (t - 0.86) / 0.52;
        h += c.depth * 0.3 * Math.sin(rimT * Math.PI);
      }
    }
  }

  return h;
}

export interface SkyDomeHandle {
  group: THREE.Group;
  uniforms: {
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
  };
  sunDisc: THREE.Mesh;
  moonDisc: THREE.Mesh;
}

export function createTropicalSkyDome(): SkyDomeHandle {
  const group = new THREE.Group();

  const uniforms = {
    uZenithColor: { value: new THREE.Color('#2c4f6b') },
    uHorizonColor: { value: new THREE.Color('#7a8f7c') },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      varying vec3 vLocalPos;
      void main() {
        float h = clamp(normalize(vLocalPos).y * 1.45, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uZenithColor, pow(h, 0.72));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(290, 24, 16), skyMat);
  group.add(dome);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0c7, fog: false, transparent: true, opacity: 0.95 }),
  );
  sunDisc.position.set(125, 180, 80);
  sunDisc.lookAt(0, 0, 0);
  group.add(sunDisc);

  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(9.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xd4e4f7, fog: false, transparent: true, opacity: 0.9 }),
  );
  moonDisc.position.set(-125, -180, -80);
  moonDisc.lookAt(0, 0, 0);
  group.add(moonDisc);

  return { group, uniforms, sunDisc, moonDisc };
}

export function createTerrainMesh(maxAnisotropy: number): THREE.Mesh {
  const segments = 192;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const cJungle = new THREE.Color('#2c4221');
  const cMoss = new THREE.Color('#415c2a');
  const cLaterite = new THREE.Color('#804f34');
  const cMud = new THREE.Color('#4a3a28');
  const cRock = new THREE.Color('#52574d');
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    const h2 = groundHeightAt(x + 1.2, z);
    const h3 = groundHeightAt(x, z + 1.2);
    const slope = Math.hypot(h2 - y, h3 - y) / 1.2;

    const onTrailToBridge =
      Math.abs(x - BRIDGE_X * (1 - smoothstep(20, 82, z))) < 3.4 && z > 18 && z < 84;
    const dAlphaTrail = pointToSegmentDist(
      x,
      z,
      BRIDGE_X,
      riverCenterZ(BRIDGE_X) - 10,
      SECTOR_ALPHA_POS.x,
      SECTOR_ALPHA_POS.z,
    );
    const dCharlieTrail = pointToSegmentDist(
      x,
      z,
      BRIDGE_X,
      riverCenterZ(BRIDGE_X) - 10,
      SECTOR_CHARLIE_POS.x,
      SECTOR_CHARLIE_POS.z,
    );
    const dBatTrail = pointToSegmentDist(
      x,
      z,
      LZ_BRAVO_POS.x,
      LZ_BRAVO_POS.z,
      HOWITZER_BATTERY_POS.x,
      HOWITZER_BATTERY_POS.z,
    );
    const onTrail = onTrailToBridge || dAlphaTrail < 3.0 || dCharlieTrail < 3.0 || dBatTrail < 2.8;

    const dRiver = distToRiver(x, z);
    if (dRiver < 3.2) {
      tmp.copy(cMud).lerp(cLaterite, Math.max(0, dRiver / 3.2) * 0.45);
    } else if (slope > 0.55) {
      tmp.copy(cRock).lerp(cLaterite, 0.35);
    } else if (onTrail) {
      tmp.copy(cLaterite);
    } else {
      const n = 0.5 + 0.5 * Math.sin(x * 0.11 + z * 0.08);
      tmp.copy(cJungle).lerp(cMoss, n);
    }

    const jitter = (Math.sin(x * 0.73 + z * 0.51) * 0.5 + 0.5) * 0.09;
    colors[i * 3] = Math.min(1, tmp.r + jitter * 0.4);
    colors[i * 3 + 1] = Math.min(1, tmp.g + jitter * 0.5);
    colors[i * 3 + 2] = Math.min(1, tmp.b + jitter * 0.3);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const detailTex = createGroundDetailTexture(maxAnisotropy);
  const bumpTex = createGroundBumpTexture(maxAnisotropy);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTex,
    bumpMap: bumpTex,
    bumpScale: 0.25,
    roughness: 0.9,
    metalness: 0.03,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.segments = segments;
  mesh.userData.basePositions = new Float32Array(pos.array as Float32Array);
  mesh.userData.baseColors = new Float32Array(colors);
  return mesh;
}

export function restoreTerrainCraters(terrainMesh: THREE.Mesh): void {
  clearGroundCraters();
  const basePos = terrainMesh.userData.basePositions as Float32Array | undefined;
  const baseCol = terrainMesh.userData.baseColors as Float32Array | undefined;
  if (!basePos || !baseCol) return;
  const geo = terrainMesh.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  (pos.array as Float32Array).set(basePos);
  (col.array as Float32Array).set(baseCol);
  pos.needsUpdate = true;
  col.needsUpdate = true;
  geo.computeVertexNormals();
}

export function deformTerrainCrater(
  terrainMesh: THREE.Mesh,
  cx: number,
  cz: number,
  radius: number,
  depth: number,
): void {
  if (activeCraters.length >= 36) {
    activeCraters.shift();
  }
  activeCraters.push({ x: cx, z: cz, r: radius, depth });

  const geo = terrainMesh.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = geo.attributes.color as THREE.BufferAttribute;
  const segs = (terrainMesh.userData.segments as number | undefined) ?? 192;
  const stride = segs + 1;
  const half = WORLD_SIZE * 0.5;
  const step = WORLD_SIZE / segs;

  const effectR = radius * 1.42;
  const minCol = Math.max(0, Math.floor((cx - effectR + half) / step));
  const maxCol = Math.min(segs, Math.ceil((cx + effectR + half) / step));
  const minRow = Math.max(0, Math.floor((cz - effectR + half) / step));
  const maxRow = Math.min(segs, Math.ceil((cz + effectR + half) / step));

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const idx = r * stride + c;
      const vx = pos.getX(idx);
      const vz = pos.getZ(idx);
      const d = Math.hypot(vx - cx, vz - cz);
      if (d > effectR) continue;

      pos.setY(idx, groundHeightAt(vx, vz));

      const t = d / radius;
      let cr = col.getX(idx);
      let cg = col.getY(idx);
      let cb = col.getZ(idx);

      if (t < 0.72) {
        // Soot-blackened blasted crater core
        const scorch = 1 - t / 0.72;
        cr = THREE.MathUtils.lerp(cr, 0.08, 0.55 + scorch * 0.4);
        cg = THREE.MathUtils.lerp(cg, 0.065, 0.55 + scorch * 0.4);
        cb = THREE.MathUtils.lerp(cb, 0.055, 0.55 + scorch * 0.4);
      } else {
        // Freshly torn churned mud & raw laterite dirt rim
        const rimBlend = Math.max(0, 1 - (t - 0.72) / 0.7);
        cr = THREE.MathUtils.lerp(cr, 0.31, rimBlend * 0.85);
        cg = THREE.MathUtils.lerp(cg, 0.19, rimBlend * 0.85);
        cb = THREE.MathUtils.lerp(cb, 0.12, rimBlend * 0.85);
      }

      col.setXYZ(idx, cr, cg, cb);
    }
  }

  pos.needsUpdate = true;
  col.needsUpdate = true;
  geo.computeVertexNormals();
}

function pointToSegmentDist(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const c1 = wx * vx + wz * vz;
  if (c1 <= 0) return Math.hypot(px - ax, pz - az);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(px - bx, pz - bz);
  const b = c1 / c2;
  return Math.hypot(px - (ax + b * vx), pz - (az + b * vz));
}

export function createGroundDetailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbc7ba';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 7500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 2.5;
    const v = 160 + Math.floor(Math.random() * 75);
    ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    ctx.fillRect(x, y, r, r);
  }

  for (let i = 0; i < 1100; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90, 82, 56, 0.34)' : 'rgba(130, 145, 95, 0.3)';
    ctx.fillRect(x, y, 3, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(44, 44);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createGroundBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4200; i++) {
    const v = Math.floor(70 + Math.random() * 140);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(44, 44);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSandbagTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9c8a66';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(60, 48, 30, 0.25)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 0; x < size; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWoodTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#6e4e34';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 160; i++) {
    const y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(42, 26, 14, 0.35)' : 'rgba(135, 98, 66, 0.25)';
    ctx.fillRect(0, y, size, 1 + Math.random() * 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWaterMesh(): { mesh: THREE.Mesh; texture: THREE.CanvasTexture } {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, 78, 64, 16);
  geo.rotateX(-Math.PI / 2);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#434d32';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 480; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(112, 126, 86, 0.28)' : 'rgba(42, 48, 30, 0.3)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 20 + Math.random() * 32, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 4);

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0x62704b,
    roughness: 0.16,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88,
  });

  const water = new THREE.Mesh(geo, mat);
  water.position.set(0, WATER_LEVEL, 18);
  water.receiveShadow = true;
  return { mesh: water, texture: tex };
}
