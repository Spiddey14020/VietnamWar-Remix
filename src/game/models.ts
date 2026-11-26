import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {
  CustomCamoConfig,
  PaintFinishType,
  UniformCamoId,
  WeaponId,
  WeaponLoadoutAttachments,
  WeaponPaintId,
} from './types';

export interface EnemyVisualStyle {
  uniformHex?: number;
  helmetHex?: number;
  webbingHex?: number;
  alliedLook?: boolean;
  role?: 'rifleman' | 'flanker' | 'suppressor' | 'grenadier' | 'commander';
}

export interface HueyHandle {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Group;
}

export interface HowitzerHandle {
  group: THREE.Group;
  turretPivot: THREE.Group;
  barrelPivot: THREE.Group;
  recoilSlide: THREE.Group;
  muzzleFlash: THREE.Mesh;
}

export interface EnemyModelHandle {
  group: THREE.Group;
  torso: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  muzzleFlash: THREE.Mesh;
  hitMeshes: THREE.Object3D[];
}

export interface ViewmodelHandle {
  root: THREE.Group;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  adsOffset: THREE.Vector3;
  baseAdsOffset: THREE.Vector3;
  scopeAdsOffset: THREE.Vector3;
  oegAdsOffset: THREE.Vector3;
  hipOffset: THREE.Vector3;
  applyAttachments: (att: WeaponLoadoutAttachments) => void;
  applyPaint: (paint: WeaponPaintId, custom?: CustomCamoConfig) => void;
  applyUniform: (uniform: UniformCamoId, custom?: CustomCamoConfig) => void;
}

export function buildPalmCrownGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frond = new THREE.ConeGeometry(0.72, 3.6, 4);
    frond.scale(1, 1, 0.28);
    frond.rotateX(Math.PI * 0.38);
    frond.translate(0, 7.6, 1.55);
    frond.rotateY(angle);
    parts.push(frond.toNonIndexed());
    frond.dispose();
  }
  const crownTop = new THREE.SphereGeometry(0.85, 6, 4);
  crownTop.translate(0, 8.0, 0);
  parts.push(crownTop.toNonIndexed());
  crownTop.dispose();

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) {
    const fallback = new THREE.ConeGeometry(2.8, 1.8, 7);
    fallback.translate(0, 7.8, 0);
    return fallback;
  }
  return merged;
}

export function buildHowitzerGun(sandbagTex: THREE.CanvasTexture): HowitzerHandle {
  const group = new THREE.Group();

  const oliveMat = new THREE.MeshStandardMaterial({
    color: 0x3b482e,
    roughness: 0.56,
    metalness: 0.28,
  });
  const gunSteelMat = new THREE.MeshStandardMaterial({
    color: 0x252a25,
    roughness: 0.34,
    metalness: 0.86,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1a1b19,
    roughness: 0.9,
    metalness: 0.04,
  });

  // Low sandbag pit arc around gun
  const frontArc = buildSandbagWall(4.2, 2, sandbagTex);
  frontArc.position.set(0, 0, -2.6);
  group.add(frontArc);

  // Split carriage trails (rear V legs)
  const trailGeo = new THREE.BoxGeometry(0.24, 0.22, 3.2);
  const trailL = new THREE.Mesh(trailGeo, oliveMat);
  trailL.position.set(-0.95, 0.24, 1.45);
  trailL.rotation.y = -0.34;
  trailL.castShadow = true;
  group.add(trailL);

  const trailR = new THREE.Mesh(trailGeo, oliveMat);
  trailR.position.set(0.95, 0.24, 1.45);
  trailR.rotation.y = 0.34;
  trailR.castShadow = true;
  group.add(trailR);

  // Turret azimuth pivot (rotates gun toward target azimuth)
  const turretPivot = new THREE.Group();
  turretPivot.position.set(0, 0.72, 0);
  group.add(turretPivot);

  // Axle & Twin Rubber Carriage Wheels
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.35, 8), gunSteelMat);
  axle.rotation.z = Math.PI / 2;
  turretPivot.add(axle);

  const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.32, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const wx of [-1.18, 1.18]) {
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.position.set(wx, -0.08, 0);
    tire.castShadow = true;
    turretPivot.add(tire);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.36, 10), oliveMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, -0.08, 0);
    turretPivot.add(hub);
  }

  // Armored Gun Shield
  const shield = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.35, 0.1), oliveMat);
  shield.position.set(0, 0.55, -0.42);
  shield.rotation.x = -0.18;
  shield.castShadow = true;
  turretPivot.add(shield);

  // Barrel Elevation Pivot
  const barrelPivot = new THREE.Group();
  barrelPivot.position.set(0, 0.42, 0.05);
  barrelPivot.rotation.x = 0.48; // ~27.5 deg baseline elevation
  turretPivot.add(barrelPivot);

  // Recoil Slide Group
  const recoilSlide = new THREE.Group();
  barrelPivot.add(recoilSlide);

  // Breech & Hydro-pneumatic recoil cradle
  const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 1.65), oliveMat);
  cradle.position.set(0, 0, -0.2);
  cradle.castShadow = true;
  recoilSlide.add(cradle);

  const recoilCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.75, 10), gunSteelMat);
  recoilCyl.rotation.x = Math.PI / 2;
  recoilCyl.position.set(0, 0.26, -0.55);
  recoilSlide.add(recoilCyl);

  // 155mm Heavy Rifled Tube + Muzzle Brake
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 4.35, 14), gunSteelMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0.04, -2.35);
  tube.castShadow = true;
  recoilSlide.add(tube);

  const brake = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.46), gunSteelMat);
  brake.position.set(0, 0.04, -4.55);
  recoilSlide.add(brake);

  const muzzleFlash = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.85, 1),
    new THREE.MeshBasicMaterial({ color: 0xffc85c, transparent: true, opacity: 0.92 }),
  );
  muzzleFlash.position.set(0, 0.04, -5.05);
  muzzleFlash.visible = false;
  recoilSlide.add(muzzleFlash);

  return { group, turretPivot, barrelPivot, recoilSlide, muzzleFlash };
}

export function buildHueyHelicopter(isSoftwareGl: boolean): HueyHandle {
  const group = new THREE.Group();

  const oliveHullMat = new THREE.MeshStandardMaterial({
    color: 0x3b4730,
    roughness: 0.58,
    metalness: 0.22,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1d201c,
    roughness: 0.35,
    metalness: 0.85,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x20353a,
    roughness: 0.1,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.88,
    clearcoat: 1.0,
  });
  const cautionMat = new THREE.MeshStandardMaterial({
    color: 0xd9a126,
    roughness: 0.45,
    metalness: 0.15,
  });

  const skidGeo = new THREE.CylinderGeometry(0.06, 0.06, 5.2, 8);
  skidGeo.rotateX(Math.PI / 2);
  for (const sx of [-1.05, 1.05]) {
    const skid = new THREE.Mesh(skidGeo, darkMetalMat);
    skid.position.set(sx, 0.08, 0.2);
    skid.castShadow = true;
    group.add(skid);

    for (const sz of [-1.2, 1.3]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.85, 6), darkMetalMat);
      strut.position.set(sx * 0.88, 0.45, sz);
      strut.rotation.z = sx > 0 ? 0.28 : -0.28;
      group.add(strut);
    }
  }

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.55, 4.4), oliveHullMat);
  hull.position.set(0, 1.55, 0.1);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.15, 1.5), oliveHullMat);
  nose.position.set(0, 1.32, -2.5);
  nose.rotation.x = 0.22;
  nose.castShadow = true;
  group.add(nose);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.92, 1.35), glassMat);
  canopy.position.set(0, 1.85, -2.15);
  canopy.rotation.x = -0.35;
  group.add(canopy);

  const cowling = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 2.3, 12), oliveHullMat);
  cowling.rotation.x = Math.PI / 2;
  cowling.position.set(0, 2.55, 0.45);
  cowling.castShadow = true;
  group.add(cowling);

  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.48, 5.4, 10), oliveHullMat);
  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 1.72, 4.7);
  tailBoom.castShadow = true;
  group.add(tailBoom);

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.45, 0.9), oliveHullMat);
  tailFin.position.set(0, 2.32, 7.2);
  tailFin.rotation.x = -0.25;
  group.add(tailFin);

  const starAccent = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.22, 0.65), cautionMat);
  starAccent.position.set(0, 1.55, 1.2);
  group.add(starAccent);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 3.15, 0.15);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.6, 10), darkMetalMat);
  mast.position.y = -0.15;
  mainRotor.add(mast);

  const bladeGeo = new THREE.BoxGeometry(10.8, 0.04, 0.34);
  const blade1 = new THREE.Mesh(bladeGeo, darkMetalMat);
  blade1.position.y = 0.12;
  blade1.castShadow = true;
  mainRotor.add(blade1);

  const tip1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.045, 0.35), cautionMat);
  tip1.position.set(5.18, 0.12, 0);
  mainRotor.add(tip1);
  const tip2 = tip1.clone();
  tip2.position.set(-5.18, 0.12, 0);
  mainRotor.add(tip2);
  group.add(mainRotor);

  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.22, 2.65, 7.38);
  const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.65, 0.16), darkMetalMat);
  tailRotor.add(tBlade);
  group.add(tailRotor);

  return { group, mainRotor, tailRotor };
}

export function buildSandbagWall(
  length: number,
  heightRows: number,
  sandbagTex: THREE.CanvasTexture,
): THREE.Group {
  const group = new THREE.Group();
  const bagMat = new THREE.MeshStandardMaterial({
    map: sandbagTex,
    color: 0xa79672,
    roughness: 0.94,
    metalness: 0.02,
  });

  const bagGeo = new THREE.BoxGeometry(0.86, 0.28, 0.48);
  const cols = Math.max(2, Math.round(length / 0.88));
  for (let row = 0; row < heightRows; row++) {
    for (let col = 0; col < cols; col++) {
      const bag = new THREE.Mesh(bagGeo, bagMat);
      const stagger = (row % 2) * 0.22;
      bag.position.set(
        (col - (cols - 1) / 2) * 0.88 + stagger * 0.4,
        0.14 + row * 0.26,
        Math.sin(col * 1.7 + row) * 0.03,
      );
      bag.rotation.y = Math.sin(col + row * 2) * 0.05;
      bag.castShadow = true;
      bag.receiveShadow = true;
      group.add(bag);
    }
  }
  return group;
}

export function buildAmmoCrate(woodTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  const crateMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x5c623d,
    roughness: 0.82,
    metalness: 0.08,
  });
  const latchMat = new THREE.MeshStandardMaterial({
    color: 0x262823,
    roughness: 0.38,
    metalness: 0.82,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd1a232,
    roughness: 0.55,
    metalness: 0.1,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.72), crateMat);
  body.position.y = 0.31;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.21, 0.1, 0.78), crateMat);
  lid.position.y = 0.65;
  lid.castShadow = true;
  group.add(lid);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.74), stripeMat);
  stripe.position.set(0.32, 0.35, 0);
  group.add(stripe);

  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.05), latchMat);
  latch.position.set(0, 0.55, 0.38);
  group.add(latch);

  return group;
}

export function buildGuardTower(woodTex: THREE.CanvasTexture, sandbagTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  const timberMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x6f5137,
    roughness: 0.88,
    metalness: 0.04,
  });
  const tinMat = new THREE.MeshStandardMaterial({
    color: 0x5d645c,
    roughness: 0.42,
    metalness: 0.75,
  });

  const postGeo = new THREE.CylinderGeometry(0.12, 0.15, 5.2, 7);
  for (const px of [-1.45, 1.45]) {
    for (const pz of [-1.45, 1.45]) {
      const post = new THREE.Mesh(postGeo, timberMat);
      post.position.set(px, 2.6, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      group.add(post);
    }
  }

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 3.4), timberMat);
  deck.position.y = 3.1;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const frontWall = buildSandbagWall(3.1, 3, sandbagTex);
  frontWall.position.set(0, 3.2, -1.42);
  group.add(frontWall);

  const backWall = buildSandbagWall(3.1, 3, sandbagTex);
  backWall.position.set(0, 3.2, 1.42);
  group.add(backWall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 3.8), tinMat);
  roof.position.y = 5.35;
  roof.rotation.x = 0.08;
  roof.castShadow = true;
  group.add(roof);

  return group;
}

export function buildBunkerComplex(
  woodTex: THREE.CanvasTexture,
  sandbagTex: THREE.CanvasTexture,
): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x676961,
    roughness: 0.9,
    metalness: 0.05,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x5d432c,
    roughness: 0.85,
    metalness: 0.05,
  });
  const radioMat = new THREE.MeshStandardMaterial({
    color: 0x2b3629,
    roughness: 0.4,
    metalness: 0.72,
  });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 6.4), concreteMat);
  slab.position.y = 0.17;
  slab.receiveShadow = true;
  group.add(slab);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.5, 0.45), concreteMat);
  backWall.position.set(0, 1.5, -2.9);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.5, 5.8), concreteMat);
  leftWall.position.set(-3.25, 1.5, 0);
  leftWall.castShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.5, 5.8), concreteMat);
  rightWall.position.set(3.25, 1.5, 0);
  rightWall.castShadow = true;
  group.add(rightWall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.4, 6.8), timberMat);
  roof.position.y = 2.95;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const frontBags = buildSandbagWall(4.8, 3, sandbagTex);
  frontBags.position.set(0, 0.34, 3.0);
  group.add(frontBags);

  const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.85), timberMat);
  table.position.set(-1.4, 0.75, -1.6);
  group.add(table);

  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.45), radioMat);
  radio.position.set(-1.4, 1.38, -1.6);
  group.add(radio);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 4.4, 6), radioMat);
  antenna.position.set(-1.1, 3.8, -1.6);
  group.add(antenna);

  return group;
}

export function buildMortarEmplacement(sandbagTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x2f352e,
    roughness: 0.36,
    metalness: 0.82,
  });
  const drumMat = new THREE.MeshStandardMaterial({
    color: 0x8f2c22,
    roughness: 0.48,
    metalness: 0.35,
  });

  for (let i = 0; i < 4; i++) {
    const arc = buildSandbagWall(3.2, 3, sandbagTex);
    const angle = (i * Math.PI) / 2;
    arc.position.set(Math.sin(angle) * 2.8, 0, Math.cos(angle) * 2.8);
    arc.rotation.y = angle;
    group.add(arc);
  }

  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.14, 10), steelMat);
  plate.position.y = 0.07;
  group.add(plate);

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.75, 12), steelMat);
  tube.position.set(0, 0.82, -0.32);
  tube.rotation.x = -0.58;
  tube.castShadow = true;
  group.add(tube);

  const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6), steelMat);
  bipodL.position.set(-0.28, 0.52, -0.58);
  bipodL.rotation.z = -0.3;
  group.add(bipodL);
  const bipodR = bipodL.clone();
  bipodR.position.x = 0.28;
  bipodR.rotation.z = 0.3;
  group.add(bipodR);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.12, 14), drumMat);
  drum.position.set(1.25, 0.56, 0.7);
  drum.castShadow = true;
  group.add(drum);

  return group;
}

export function buildWoodenBridge(woodTex: THREE.CanvasTexture, length: number): THREE.Group {
  const group = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x765436,
    roughness: 0.88,
    metalness: 0.04,
  });

  const plankCount = Math.floor(length / 0.65);
  const plankGeo = new THREE.BoxGeometry(4.2, 0.16, 0.56);
  for (let i = 0; i < plankCount; i++) {
    const p = new THREE.Mesh(plankGeo, plankMat);
    p.position.set(0, 0.85, (i - plankCount / 2) * 0.65);
    p.castShadow = true;
    p.receiveShadow = true;
    group.add(p);
  }

  const pilingGeo = new THREE.CylinderGeometry(0.14, 0.16, 2.8, 8);
  for (let z = -length / 2 + 1; z <= length / 2 - 1; z += 4.5) {
    for (const sx of [-1.95, 1.95]) {
      const post = new THREE.Mesh(pilingGeo, plankMat);
      post.position.set(sx, 0.4, z);
      post.castShadow = true;
      group.add(post);
    }
  }

  const railGeo = new THREE.BoxGeometry(0.12, 0.1, length);
  for (const sx of [-1.95, 1.95]) {
    const rail = new THREE.Mesh(railGeo, plankMat);
    rail.position.set(sx, 1.72, 0);
    group.add(rail);
  }

  return group;
}

export function buildEnemySoldier(style?: EnemyVisualStyle): EnemyModelHandle {
  const group = new THREE.Group();
  const hitMeshes: THREE.Object3D[] = [];

  const uniformMat = new THREE.MeshStandardMaterial({
    color: style?.uniformHex ?? 0x5b5b3c,
    roughness: 0.88,
    metalness: 0.04,
  });
  const webbingMat = new THREE.MeshStandardMaterial({
    color: style?.webbingHex ?? (style?.alliedLook ? 0x3f4730 : 0x3b3525),
    roughness: 0.82,
    metalness: 0.08,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc19672,
    roughness: 0.68,
    metalness: 0.02,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: style?.helmetHex ?? 0x4b5334,
    roughness: 0.72,
    metalness: style?.alliedLook ? 0.24 : 0.12,
  });
  const gunSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e201f,
    roughness: 0.34,
    metalness: 0.86,
  });
  const gunWoodMat = new THREE.MeshStandardMaterial({
    color: 0x704124,
    roughness: 0.74,
    metalness: 0.06,
  });

  const legGeo = new THREE.BoxGeometry(0.22, 0.82, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, uniformMat);
  leftLeg.position.set(-0.14, 0.41, 0);
  leftLeg.castShadow = true;
  leftLeg.userData.hitZone = 'body';
  group.add(leftLeg);
  hitMeshes.push(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, uniformMat);
  rightLeg.position.set(0.14, 0.41, 0);
  rightLeg.castShadow = true;
  rightLeg.userData.hitZone = 'body';
  group.add(rightLeg);
  hitMeshes.push(rightLeg);

  const torso = new THREE.Group();
  torso.position.y = 0.82;
  group.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.3), uniformMat);
  chest.position.y = 0.32;
  chest.castShadow = true;
  chest.userData.hitZone = 'body';
  torso.add(chest);
  hitMeshes.push(chest);

  const rig = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.33), webbingMat);
  rig.position.y = 0.26;
  torso.add(rig);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skinMat);
  head.position.y = 0.78;
  head.castShadow = true;
  head.userData.hitZone = 'head';
  torso.add(head);
  hitMeshes.push(head);

  const helmetBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.29, 0.06, 12), helmetMat);
  helmetBrim.position.y = 0.88;
  helmetBrim.userData.hitZone = 'head';
  torso.add(helmetBrim);
  hitMeshes.push(helmetBrim);

  const helmetDome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
  helmetDome.position.y = 0.89;
  helmetDome.userData.hitZone = 'head';
  torso.add(helmetDome);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.46, 0.16), uniformMat);
  armL.position.set(-0.26, 0.42, -0.18);
  armL.rotation.x = Math.PI / 3;
  torso.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.46, 0.16), uniformMat);
  armR.position.set(0.24, 0.42, -0.14);
  armR.rotation.x = Math.PI / 2.6;
  torso.add(armR);

  const akGroup = new THREE.Group();
  akGroup.position.set(0.14, 0.38, -0.35);

  const akReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.45), gunSteelMat);
  akGroup.add(akReceiver);
  const akStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.26), gunWoodMat);
  akStock.position.set(0, -0.02, 0.32);
  akGroup.add(akStock);
  const akBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.48, 6), gunSteelMat);
  akBarrel.rotation.x = Math.PI / 2;
  akBarrel.position.set(0, 0.015, -0.44);
  akGroup.add(akBarrel);
  const akMag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.08), gunSteelMat);
  akMag.position.set(0, -0.13, -0.1);
  akMag.rotation.x = 0.25;
  akGroup.add(akMag);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 }),
  );
  muzzleFlash.position.set(0, 0.02, -0.72);
  muzzleFlash.visible = false;
  akGroup.add(muzzleFlash);

  if (style?.role === 'suppressor') {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 10), gunSteelMat);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, -0.11, -0.1);
    akGroup.add(drum);
  }

  if (style?.role === 'grenadier') {
    const fragMat = new THREE.MeshStandardMaterial({ color: 0x455830, roughness: 0.55, metalness: 0.35 });
    for (const gx of [-0.14, 0, 0.14]) {
      const frag = new THREE.Mesh(new THREE.SphereGeometry(0.068, 7, 6), fragMat);
      frag.position.set(gx, 0.3, -0.19);
      torso.add(frag);
    }
  }

  if (style?.role === 'commander') {
    const radioMat = new THREE.MeshStandardMaterial({ color: 0x2a3326, roughness: 0.5, metalness: 0.65 });
    const radioPack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.16), radioMat);
    radioPack.position.set(0, 0.34, 0.22);
    torso.add(radioPack);

    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.96, 5), gunSteelMat);
    whip.position.set(0.12, 0.88, 0.24);
    whip.rotation.z = -0.08;
    torso.add(whip);

    const bandMat = new THREE.MeshStandardMaterial({ color: 0xc89b3c, roughness: 0.45, metalness: 0.5 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.23, 0.045, 12), bandMat);
    band.position.y = 0.91;
    torso.add(band);
  }

  torso.add(akGroup);

  return { group, torso, leftLeg, rightLeg, muzzleFlash, hitMeshes };
}

function createWeaponCamoTexture(kind: 'tiger' | 'mud' | 'erdl'): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (kind === 'tiger') {
    ctx.fillStyle = '#4f5c39';
    ctx.fillRect(0, 0, size, size);
    const stripes = ['#262b1c', '#6e6442', '#1b1e16'];
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = stripes[i % stripes.length];
      ctx.beginPath();
      const y = (i / 24) * size;
      ctx.ellipse(
        ((i * 37) % size),
        y,
        22 + (i % 5) * 6,
        5 + (i % 3) * 2,
        0.25,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (kind === 'erdl') {
    ctx.fillStyle = '#4e5d34';
    ctx.fillRect(0, 0, size, size);
    const patches = ['#6b573b', '#28311d', '#3e4c28'];
    for (let i = 0; i < 32; i++) {
      ctx.fillStyle = patches[i % patches.length];
      ctx.beginPath();
      ctx.ellipse(
        (i * 31) % size,
        (i * 47) % size,
        14 + (i % 4) * 5,
        8 + (i % 3) * 3,
        (i % 5) * 0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#6b4a33';
    ctx.fillRect(0, 0, size, size);
    const patches = ['#424a2b', '#876342', '#3a2d21'];
    for (let i = 0; i < 36; i++) {
      ctx.fillStyle = patches[i % patches.length];
      ctx.fillRect((i * 29) % size, (i * 43) % size, 18, 9);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createCustomCamoTexture(cfg: CustomCamoConfig): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = cfg.primaryHex;
  ctx.fillRect(0, 0, size, size);

  if (cfg.pattern === 'tiger') {
    const stripes = [cfg.secondaryHex, cfg.accentHex, cfg.secondaryHex];
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = stripes[i % stripes.length];
      ctx.beginPath();
      const y = (i / 24) * size;
      ctx.ellipse((i * 37) % size, y, 24 + (i % 5) * 6, 5 + (i % 3) * 2, 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (cfg.pattern === 'woodland') {
    const blobs = [cfg.secondaryHex, cfg.accentHex];
    for (let i = 0; i < 34; i++) {
      ctx.fillStyle = blobs[i % blobs.length];
      ctx.beginPath();
      ctx.ellipse(
        (i * 31) % size,
        (i * 47) % size,
        15 + (i % 4) * 5,
        9 + (i % 3) * 3,
        (i % 5) * 0.45,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (cfg.pattern === 'splinter') {
    const shards = [cfg.secondaryHex, cfg.accentHex];
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = shards[i % shards.length];
      const x = (i * 41) % size;
      const y = (i * 29) % size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 26, y + 6 + (i % 8));
      ctx.lineTo(x + 12, y + 22);
      ctx.closePath();
      ctx.fill();
    }
  } else if (cfg.pattern === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, cfg.primaryHex);
    grad.addColorStop(0.55, cfg.secondaryHex);
    grad.addColorStop(1, cfg.accentHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(cfg.pattern === 'gradient' ? 1 : 2, cfg.pattern === 'gradient' ? 1 : 2);
  return tex;
}

function applyFinishToMaterial(
  mat: THREE.MeshPhysicalMaterial,
  finish: PaintFinishType,
  isCloth = false,
): void {
  mat.clearcoat = 0;
  mat.clearcoatRoughness = 0.1;
  mat.sheen = isCloth ? 0.25 : 0;
  if (finish === 'matte') {
    mat.roughness = isCloth ? 0.92 : 0.78;
    mat.metalness = isCloth ? 0.04 : 0.14;
  } else if (finish === 'satin') {
    mat.roughness = isCloth ? 0.62 : 0.44;
    mat.metalness = isCloth ? 0.12 : 0.35;
  } else if (finish === 'gloss') {
    mat.roughness = 0.16;
    mat.metalness = isCloth ? 0.12 : 0.25;
    mat.clearcoat = 0.85;
    mat.clearcoatRoughness = 0.08;
  } else if (finish === 'metallic') {
    mat.roughness = 0.24;
    mat.metalness = 0.88;
    mat.clearcoat = 0.35;
    mat.clearcoatRoughness = 0.14;
  } else if (finish === 'candy') {
    mat.roughness = 0.14;
    mat.metalness = 0.72;
    mat.clearcoat = 1.0;
    mat.clearcoatRoughness = 0.04;
  } else if (finish === 'chrome') {
    mat.roughness = 0.08;
    mat.metalness = 0.98;
    mat.clearcoat = 0.9;
    mat.clearcoatRoughness = 0.03;
  }
}

export function buildViewmodelWeapon(weaponId: WeaponId): ViewmodelHandle {
  const root = new THREE.Group();
  const tigerTex = createWeaponCamoTexture('tiger');
  const mudTex = createWeaponCamoTexture('mud');
  const erdlTex = createWeaponCamoTexture('erdl');
  let customWeaponTex: THREE.CanvasTexture | null = null;
  let customUniformTex: THREE.CanvasTexture | null = null;

  const sleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0x465432,
    roughness: 0.85,
    metalness: 0.04,
  });
  const cuffMat = new THREE.MeshPhysicalMaterial({
    color: 0x354025,
    roughness: 0.82,
    metalness: 0.05,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x2a2923,
    roughness: 0.78,
    metalness: 0.06,
  });

  const receiverMetal = new THREE.MeshPhysicalMaterial({
    color: 0x202325,
    roughness: 0.32,
    metalness: 0.88,
  });
  const polymerMat = new THREE.MeshPhysicalMaterial({
    color: 0x161817,
    roughness: 0.68,
    metalness: 0.12,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb89643,
    roughness: 0.28,
    metalness: 0.9,
  });
  const oliveMat = new THREE.MeshStandardMaterial({
    color: 0x454f34,
    roughness: 0.65,
    metalness: 0.25,
  });
  const suppressorMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f1d,
    roughness: 0.48,
    metalness: 0.72,
  });
  const lensGlassMat = new THREE.MeshStandardMaterial({
    color: 0x3b6e78,
    roughness: 0.08,
    metalness: 0.25,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const amberDotMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
  const fiberMat = new THREE.MeshBasicMaterial({ color: 0xff6f1a });

  const muzzlePoint = new THREE.Object3D();

  // Attachment visual groups
  const scopeGroup = new THREE.Group();
  const oegGroup = new THREE.Group();
  const suppressorGroup = new THREE.Group();
  const compGroup = new THREE.Group();
  const extendedMagGroup = new THREE.Group();
  const bipodGripGroup = new THREE.Group();

  let standardMagMesh: THREE.Mesh;

  const buildHollowTube = (
    parent: THREE.Group,
    outerR: number,
    innerR: number,
    length: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(outerR, outerR, length, 16, 1, true),
      mat,
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.set(0, y, z);

    const innerMat = (mat as THREE.MeshStandardMaterial).clone();
    innerMat.side = THREE.BackSide;
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(innerR, innerR, length, 16, 1, true),
      innerMat,
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.set(0, y, z);

    const frontRim = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, 16), mat);
    frontRim.position.set(0, y, z - length / 2);
    frontRim.rotation.y = Math.PI;

    const rearRim = new THREE.Mesh(new THREE.RingGeometry(innerR, outerR, 16), mat);
    rearRim.position.set(0, y, z + length / 2);

    parent.add(outer, inner, frontRim, rearRim);
  };

  if (weaponId === 'm16a1') {
    // Upper + lower receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.074, 0.25), receiverMetal);
    root.add(receiver);

    // Charging handle latch & teardrop forward assist
    const chargingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.011, 0.016), receiverMetal);
    chargingHandle.position.set(0, 0.036, 0.125);
    root.add(chargingHandle);
    const forwardAssist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.009, 0.022, 8),
      receiverMetal,
    );
    forwardAssist.rotation.x = Math.PI / 2;
    forwardAssist.position.set(0.029, 0.016, 0.068);
    root.add(forwardAssist);

    // Buttstock shoulder stub
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.078, 0.16), polymerMat);
    stock.position.set(0, -0.01, 0.19);
    root.add(stock);

    // Open Carry Handle (front & rear uprights + top rail bar -> authentic open arch)
    const carryTop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.176), receiverMetal);
    carryTop.position.set(0, 0.068, 0.01);
    root.add(carryTop);
    const carryFrontLeg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.022), receiverMetal);
    carryFrontLeg.position.set(0, 0.049, -0.066);
    root.add(carryFrontLeg);
    const carryRearTower = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.03, 0.034), receiverMetal);
    carryRearTower.position.set(0, 0.049, 0.088);
    root.add(carryRearTower);

    // Historically accurate M16A1 Rear Sight (L-flip peep aperture + protective ears + windage drum)
    // Sightline Y = 0.087
    const rearSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.01, 0.024), receiverMetal);
    rearSightBase.position.set(0, 0.076, 0.088);
    root.add(rearSightBase);

    for (const side of [-1, 1]) {
      const rearEar = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.022, 0.024), receiverMetal);
      rearEar.position.set(side * 0.0145, 0.085, 0.088);
      root.add(rearEar);
    }
    const windageDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0065, 0.0065, 0.008, 10),
      receiverMetal,
    );
    windageDrum.rotation.z = Math.PI / 2;
    windageDrum.position.set(0.02, 0.082, 0.088);
    root.add(windageDrum);

    const peepMat = receiverMetal.clone();
    peepMat.side = THREE.DoubleSide;
    const peepAperture = new THREE.Mesh(new THREE.RingGeometry(0.0048, 0.0102, 16), peepMat);
    peepAperture.position.set(0, 0.087, 0.094);
    root.add(peepAperture);

    // Triangular M16A1 handguard
    const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.27, 3), polymerMat);
    handguard.rotation.x = Math.PI / 2;
    handguard.rotation.z = Math.PI;
    handguard.position.set(0, 0.006, -0.26);
    root.add(handguard);

    // Pencil barrel + 3-prong Vietnam flash suppressor
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.3, 10), receiverMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.014, -0.52);
    root.add(barrel);

    const flashCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0135, 0.013, 0.018, 10),
      receiverMetal,
    );
    flashCollar.rotation.x = Math.PI / 2;
    flashCollar.position.set(0, 0.014, -0.665);
    root.add(flashCollar);
    for (let p = 0; p < 3; p++) {
      const a = (p / 3) * Math.PI * 2 + Math.PI / 6;
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.0035, 0.03), receiverMetal);
      prong.position.set(Math.cos(a) * 0.0095, 0.014 + Math.sin(a) * 0.0095, -0.684);
      root.add(prong);
    }

    // Historically accurate M16A1 Triangular A-Frame Front Sight Base (z = -0.455)
    const fsbCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0155, 0.0155, 0.044, 10),
      receiverMetal,
    );
    fsbCollar.rotation.x = Math.PI / 2;
    fsbCollar.position.set(0, 0.014, -0.455);
    root.add(fsbCollar);

    const bayonetLug = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.015, 0.022), receiverMetal);
    bayonetLug.position.set(0, -0.002, -0.462);
    root.add(bayonetLug);

    const fsbFrontStrut = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.013), receiverMetal);
    fsbFrontStrut.position.set(0, 0.044, -0.471);
    root.add(fsbFrontStrut);

    const fsbRearStrut = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.062, 0.013), receiverMetal);
    fsbRearStrut.position.set(0, 0.043, -0.439);
    fsbRearStrut.rotation.x = 0.12;
    root.add(fsbRearStrut);

    const fsbBridge = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.007, 0.036), receiverMetal);
    fsbBridge.position.set(0, 0.072, -0.455);
    root.add(fsbBridge);

    for (const side of [-1, 1]) {
      const frontEar = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.022, 0.02), receiverMetal);
      frontEar.position.set(side * 0.0095, 0.084, -0.455);
      frontEar.rotation.z = -side * 0.08;
      root.add(frontEar);
    }

    // Fine central front sight post: top tip at exact y = 0.0870 (matches rear peep center!)
    const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.013, 0.0035), receiverMetal);
    frontPost.position.set(0, 0.0805, -0.455);
    root.add(frontPost);

    // 20-rd straight Vietnam magazine vs 30-rd curved extended mag
    standardMagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.13, 0.065), receiverMetal);
    standardMagMesh.position.set(0, -0.086, -0.06);
    root.add(standardMagMesh);

    const extMag = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.22, 0.068), receiverMetal);
    extMag.position.set(0, -0.128, -0.068);
    extMag.rotation.x = 0.14;
    extendedMagGroup.add(extMag);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.11, 0.046), polymerMat);
    grip.position.set(0, -0.075, 0.08);
    grip.rotation.x = 0.28;
    root.add(grip);

    // Colt 3x20 Scope mounted cleanly above carry handle (hollow tube + turrets + tinted glass)
    const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.02, 0.07), receiverMetal);
    scopeMount.position.set(0, 0.083, -0.01);
    scopeGroup.add(scopeMount);
    buildHollowTube(scopeGroup, 0.018, 0.0145, 0.14, 0.106, -0.005, receiverMetal);
    buildHollowTube(scopeGroup, 0.023, 0.0195, 0.042, 0.106, -0.095, receiverMetal);
    buildHollowTube(scopeGroup, 0.02, 0.0165, 0.03, 0.106, 0.08, receiverMetal);
    const turretTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.012, 8),
      receiverMetal,
    );
    turretTop.position.set(0, 0.127, -0.01);
    scopeGroup.add(turretTop);
    const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16), lensGlassMat);
    scopeLens.position.set(0, 0.106, 0.09);
    scopeGroup.add(scopeLens);

    // Armson OEG / Reflex Optical Sight on carry handle (hollow aperture ring + amber dot + fiber rod)
    const oegMount = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.058), receiverMetal);
    oegMount.position.set(0, 0.082, 0.0);
    oegGroup.add(oegMount);
    buildHollowTube(oegGroup, 0.0155, 0.0125, 0.072, 0.102, 0.0, receiverMetal);
    const oegFiber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.05, 8),
      fiberMat,
    );
    oegFiber.rotation.x = Math.PI / 2;
    oegFiber.position.set(0, 0.119, -0.005);
    oegGroup.add(oegFiber);
    const oegLens = new THREE.Mesh(new THREE.CircleGeometry(0.0122, 16), lensGlassMat);
    oegLens.position.set(0, 0.102, 0.005);
    oegGroup.add(oegLens);
    const oegAmber = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 8, 8), amberDotMat);
    oegAmber.position.set(0, 0.102, 0.005);
    oegGroup.add(oegAmber);

    // HEL E4A Suppressor
    const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.21, 12), suppressorMat);
    supp.rotation.x = Math.PI / 2;
    supp.position.set(0, 0.014, -0.74);
    suppressorGroup.add(supp);

    // Cutts Compensator
    const comp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.072), brassMat);
    comp.position.set(0, 0.014, -0.68);
    compGroup.add(comp);

    // Vertical Foregrip
    const vGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 8), polymerMat);
    vGrip.position.set(0, -0.065, -0.27);
    bipodGripGroup.add(vGrip);

    muzzlePoint.position.set(0, 0.014, -0.69);
  } else if (weaponId === 'm60') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.096, 0.36), receiverMetal);
    root.add(body);

    const feedCover = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.016, 0.22), receiverMetal);
    feedCover.position.set(0, 0.056, -0.04);
    root.add(feedCover);

    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.08, 0.27), polymerMat);
    shroud.position.set(0, 0.008, -0.31);
    root.add(shroud);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.38, 10), receiverMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.022, -0.59);
    root.add(barrel);

    const gasTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.3, 8),
      receiverMetal,
    );
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, -0.006, -0.55);
    root.add(gasTube);

    const flashCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.014, 0.06, 10),
      receiverMetal,
    );
    flashCone.rotation.x = Math.PI / 2;
    flashCone.position.set(0, 0.022, -0.785);
    root.add(flashCone);

    // Historically accurate M60 Rear Folding Leaf U-Notch Sight (z = 0.075, sightline Y = 0.088)
    const rearLeafBase = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.014, 0.026), receiverMetal);
    rearLeafBase.position.set(0, 0.068, 0.075);
    root.add(rearLeafBase);
    for (const side of [-1, 1]) {
      const leafRail = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.026, 0.008), receiverMetal);
      leafRail.position.set(side * 0.011, 0.086, 0.075);
      root.add(leafRail);
    }
    const notchFloor = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.01, 0.008), receiverMetal);
    notchFloor.position.set(0, 0.079, 0.075);
    root.add(notchFloor);
    const rearKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.01, 8),
      receiverMetal,
    );
    rearKnob.rotation.z = Math.PI / 2;
    rearKnob.position.set(-0.019, 0.082, 0.075);
    root.add(rearKnob);

    // Historically accurate M60 Front Post Sight with Protective Sheet-Metal Ears (z = -0.58)
    const frontBase = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.032, 0.032), receiverMetal);
    frontBase.position.set(0, 0.044, -0.58);
    root.add(frontBase);
    for (const side of [-1, 1]) {
      const frontEar = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.03, 0.024), receiverMetal);
      frontEar.position.set(side * 0.01, 0.076, -0.58);
      root.add(frontEar);
    }
    // Central post top at exact y = 0.0745 + 0.0135 = 0.0880
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.0034, 0.027, 0.004), receiverMetal);
    frontSight.position.set(0, 0.0745, -0.58);
    root.add(frontSight);

    standardMagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.14), oliveMat);
    standardMagMesh.position.set(-0.095, -0.04, -0.04);
    root.add(standardMagMesh);

    const extBeltBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.19, 0.17), oliveMat);
    extBeltBox.position.set(-0.11, -0.06, -0.04);
    extendedMagGroup.add(extBeltBox);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.05), brassMat);
    belt.position.set(-0.06, 0.025, -0.04);
    root.add(belt);

    // M60 Scope (hollow tube + mount rail, Y = 0.112)
    const m60Rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.022, 0.09), receiverMetal);
    m60Rail.position.set(0, 0.076, -0.03);
    scopeGroup.add(m60Rail);
    buildHollowTube(scopeGroup, 0.019, 0.0155, 0.16, 0.112, -0.03, receiverMetal);
    buildHollowTube(scopeGroup, 0.024, 0.02, 0.04, 0.112, -0.125, receiverMetal);
    const m60ScopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.0155, 16), lensGlassMat);
    m60ScopeLens.position.set(0, 0.112, 0.048);
    scopeGroup.add(m60ScopeLens);

    // M60 OEG Dot Sight (hollow hood + fiber rod + glowing amber dot, Y = 0.106)
    const m60OegBase = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.018, 0.06), receiverMetal);
    m60OegBase.position.set(0, 0.078, -0.03);
    oegGroup.add(m60OegBase);
    buildHollowTube(oegGroup, 0.0165, 0.0135, 0.075, 0.106, -0.03, receiverMetal);
    const m60Fiber = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 8), fiberMat);
    m60Fiber.rotation.x = Math.PI / 2;
    m60Fiber.position.set(0, 0.124, -0.03);
    oegGroup.add(m60Fiber);
    const m60OegLens = new THREE.Mesh(new THREE.CircleGeometry(0.013, 16), lensGlassMat);
    m60OegLens.position.set(0, 0.106, -0.02);
    oegGroup.add(m60OegLens);
    const oegAmber = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 8, 8), amberDotMat);
    oegAmber.position.set(0, 0.106, -0.02);
    oegGroup.add(oegAmber);

    const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.24, 12), suppressorMat);
    supp.rotation.x = Math.PI / 2;
    supp.position.set(0, 0.022, -0.86);
    suppressorGroup.add(supp);

    const comp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.036, 0.08), brassMat);
    comp.position.set(0, 0.022, -0.8);
    compGroup.add(comp);

    // Bipod legs
    for (const bx of [-0.045, 0.045]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), receiverMetal);
      leg.position.set(bx, -0.075, -0.45);
      leg.rotation.z = bx > 0 ? -0.35 : 0.35;
      bipodGripGroup.add(leg);
    }

    muzzlePoint.position.set(0, 0.022, -0.81);
  } else {
    // USGI Colt M1911A1 (.45 ACP)
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.038, 0.215), receiverMetal);
    slide.position.set(0, 0.019, -0.038);
    root.add(slide);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.026, 0.175), receiverMetal);
    frame.position.set(0, -0.011, -0.018);
    root.add(frame);

    const barrelTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0085, 0.0085, 0.02, 10),
      receiverMetal,
    );
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0.022, -0.15);
    root.add(barrelTip);

    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.016, 0.014), receiverMetal);
    hammer.position.set(0, 0.027, 0.074);
    hammer.rotation.x = -0.55;
    root.add(hammer);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.033, 0.11, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x5c361c, roughness: 0.72, metalness: 0.08 }),
    );
    grip.position.set(0, -0.065, 0.035);
    grip.rotation.x = 0.24;
    root.add(grip);

    standardMagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.02, 0.038), receiverMetal);
    standardMagMesh.position.set(0, -0.118, 0.048);
    root.add(standardMagMesh);

    const extFloor = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.055, 0.042), brassMat);
    extFloor.position.set(0, -0.132, 0.052);
    extFloor.rotation.x = 0.24;
    extendedMagGroup.add(extFloor);

    // Historically accurate GI M1911A1 Dovetail U-Notch Rear Sight (z = 0.056, sightline Y = 0.0475)
    const rearDovetail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.012), receiverMetal);
    rearDovetail.position.set(0, 0.039, 0.056);
    root.add(rearDovetail);
    for (const side of [-1, 1]) {
      const rearNotchWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.0068, 0.0085, 0.01),
        receiverMetal,
      );
      rearNotchWall.position.set(side * 0.0062, 0.045, 0.056);
      root.add(rearNotchWall);
    }

    // Historically accurate GI Patridge staked front sight blade: top tip at exact y = 0.0475
    const frontBlade = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0105, 0.011), receiverMetal);
    frontBlade.position.set(0, 0.04225, -0.136);
    root.add(frontBlade);

    // Pistol Scope (hollow tube on rail mount, Y = 0.068)
    const pRail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.016, 0.07), receiverMetal);
    pRail.position.set(0, 0.045, -0.035);
    scopeGroup.add(pRail);
    buildHollowTube(scopeGroup, 0.0155, 0.0125, 0.115, 0.068, -0.035, receiverMetal);
    const pScopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.0125, 16), lensGlassMat);
    pScopeLens.position.set(0, 0.068, 0.02);
    scopeGroup.add(pScopeLens);

    // Pistol Reflex / OEG Sight (hollow ring + amber dot, Y = 0.062)
    const pOegBase = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.044), receiverMetal);
    pOegBase.position.set(0, 0.043, -0.015);
    oegGroup.add(pOegBase);
    buildHollowTube(oegGroup, 0.013, 0.0105, 0.042, 0.062, -0.015, receiverMetal);
    const pOegLens = new THREE.Mesh(new THREE.CircleGeometry(0.0102, 16), lensGlassMat);
    pOegLens.position.set(0, 0.062, -0.01);
    oegGroup.add(pOegLens);
    const oegAmber = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 8, 8), amberDotMat);
    oegAmber.position.set(0, 0.062, -0.01);
    oegGroup.add(oegAmber);

    const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 10), suppressorMat);
    supp.rotation.x = Math.PI / 2;
    supp.position.set(0, 0.02, -0.24);
    suppressorGroup.add(supp);

    const comp = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.03, 0.045), brassMat);
    comp.position.set(0, 0.018, -0.175);
    compGroup.add(comp);

    const underLaser = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.06), polymerMat);
    underLaser.position.set(0, -0.03, -0.08);
    bipodGripGroup.add(underLaser);

    muzzlePoint.position.set(0, 0.02, -0.18);
  }

  root.add(
    scopeGroup,
    oegGroup,
    suppressorGroup,
    compGroup,
    extendedMagGroup,
    bipodGripGroup,
    muzzlePoint,
  );

  const muzzleFlash = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.075, 0),
    new THREE.MeshBasicMaterial({ color: 0xffc759, transparent: true, opacity: 0.92 }),
  );
  muzzleFlash.position.copy(muzzlePoint.position);
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  const hipOffset =
    weaponId === 'm1911'
      ? new THREE.Vector3(0.18, -0.19, -0.34)
      : weaponId === 'm60'
        ? new THREE.Vector3(0.24, -0.22, -0.44)
        : new THREE.Vector3(0.21, -0.2, -0.4);

  // Exact vertical eye alignment matching each weapon's iron sights, scope axis, and OEG dot axis
  const baseAdsOffset =
    weaponId === 'm1911'
      ? new THREE.Vector3(0, -0.0475, -0.28)
      : weaponId === 'm60'
        ? new THREE.Vector3(0, -0.088, -0.32)
        : new THREE.Vector3(0, -0.087, -0.25);

  const scopeAdsOffset =
    weaponId === 'm1911'
      ? new THREE.Vector3(0, -0.068, -0.22)
      : weaponId === 'm60'
        ? new THREE.Vector3(0, -0.112, -0.24)
        : new THREE.Vector3(0, -0.106, -0.2);

  const oegAdsOffset =
    weaponId === 'm1911'
      ? new THREE.Vector3(0, -0.062, -0.24)
      : weaponId === 'm60'
        ? new THREE.Vector3(0, -0.106, -0.26)
        : new THREE.Vector3(0, -0.102, -0.22);

  const adsOffset = baseAdsOffset.clone();

  const applyAttachments = (att: WeaponLoadoutAttachments) => {
    scopeGroup.visible = att.optic === 'colt_scope';
    oegGroup.visible = att.optic === 'oeg_dot';
    suppressorGroup.visible = att.muzzle === 'suppressor';
    compGroup.visible = att.muzzle === 'compensator';
    extendedMagGroup.visible = att.underbarrel === 'extended_mag';
    standardMagMesh.visible = att.underbarrel !== 'extended_mag';
    bipodGripGroup.visible = att.underbarrel === 'bipod_grip';

    if (att.optic === 'colt_scope') adsOffset.copy(scopeAdsOffset);
    else if (att.optic === 'oeg_dot') adsOffset.copy(oegAdsOffset);
    else adsOffset.copy(baseAdsOffset);
  };

  const applyPaint = (paint: WeaponPaintId, custom?: CustomCamoConfig) => {
    receiverMetal.map = null;
    polymerMat.map = null;
    receiverMetal.clearcoat = 0;
    polymerMat.clearcoat = 0;

    if (paint === 'custom' && custom) {
      customWeaponTex?.dispose();
      customWeaponTex = createCustomCamoTexture(custom);
      if (custom.pattern === 'solid') {
        receiverMetal.color.set(custom.primaryHex);
        polymerMat.color.set(custom.secondaryHex);
      } else {
        receiverMetal.color.setHex(0xffffff);
        polymerMat.color.setHex(0xffffff);
        receiverMetal.map = customWeaponTex;
        polymerMat.map = customWeaponTex;
      }
      applyFinishToMaterial(receiverMetal, custom.finish, false);
      applyFinishToMaterial(polymerMat, custom.finish, false);
    } else if (paint === 'parkerized') {
      receiverMetal.color.setHex(0x202325);
      receiverMetal.roughness = 0.32;
      receiverMetal.metalness = 0.88;
      polymerMat.color.setHex(0x161817);
      polymerMat.roughness = 0.68;
      polymerMat.metalness = 0.12;
    } else if (paint === 'od_green') {
      receiverMetal.color.setHex(0x455432);
      receiverMetal.roughness = 0.52;
      receiverMetal.metalness = 0.35;
      polymerMat.color.setHex(0x364226);
      polymerMat.roughness = 0.65;
      polymerMat.metalness = 0.14;
    } else if (paint === 'tiger_stripe') {
      receiverMetal.color.setHex(0xd8dac8);
      receiverMetal.map = tigerTex;
      receiverMetal.roughness = 0.56;
      receiverMetal.metalness = 0.25;
      polymerMat.color.setHex(0xd8dac8);
      polymerMat.map = tigerTex;
      polymerMat.roughness = 0.64;
      polymerMat.metalness = 0.14;
    } else if (paint === 'mud_camo') {
      receiverMetal.color.setHex(0xd8c8b6);
      receiverMetal.map = mudTex;
      receiverMetal.roughness = 0.64;
      receiverMetal.metalness = 0.18;
      polymerMat.color.setHex(0xd8c8b6);
      polymerMat.map = mudTex;
      polymerMat.roughness = 0.72;
      polymerMat.metalness = 0.1;
    } else if (paint === 'chrome_nickel') {
      receiverMetal.color.setHex(0xcfd7dc);
      receiverMetal.roughness = 0.14;
      receiverMetal.metalness = 0.96;
      polymerMat.color.setHex(0x1c1e20);
      polymerMat.roughness = 0.5;
      polymerMat.metalness = 0.2;
    } else if (paint === 'brass_tribute') {
      receiverMetal.color.setHex(0xcfa144);
      receiverMetal.roughness = 0.22;
      receiverMetal.metalness = 0.92;
      polymerMat.color.setHex(0x332417);
      polymerMat.roughness = 0.58;
      polymerMat.metalness = 0.14;
    }
    receiverMetal.needsUpdate = true;
    polymerMat.needsUpdate = true;
  };

  // First-person soldier forearm sleeves & gloved hands
  const armGroup = new THREE.Group();
  if (weaponId === 'm1911') {
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.085, 0.064), gloveMat);
    rGlove.position.set(0.002, -0.068, 0.036);
    rGlove.rotation.x = 0.24;
    const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.036, 0.045, 8), cuffMat);
    rCuff.rotation.x = Math.PI / 2 - 0.35;
    rCuff.position.set(0.025, -0.092, 0.115);
    const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.24, 8), sleeveMat);
    rSleeve.rotation.x = Math.PI / 2 - 0.35;
    rSleeve.rotation.z = -0.22;
    rSleeve.position.set(0.06, -0.145, 0.245);
    armGroup.add(rGlove, rCuff, rSleeve);
  } else {
    const gripZ = weaponId === 'm60' ? 0.1 : 0.085;
    const handguardZ = weaponId === 'm60' ? -0.3 : -0.25;
    const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.08, 0.06), gloveMat);
    rGlove.position.set(0.004, -0.072, gripZ);
    rGlove.rotation.x = 0.26;
    const rCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.045, 8), cuffMat);
    rCuff.rotation.x = Math.PI / 2 - 0.28;
    rCuff.position.set(0.03, -0.105, gripZ + 0.085);
    const rSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.25, 8), sleeveMat);
    rSleeve.rotation.x = Math.PI / 2 - 0.28;
    rSleeve.rotation.z = -0.22;
    rSleeve.position.set(0.068, -0.145, gripZ + 0.21);

    const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.044, 0.075), gloveMat);
    lGlove.position.set(-0.012, -0.036, handguardZ);
    const lCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.035, 0.045, 8), cuffMat);
    lCuff.rotation.x = Math.PI / 2 - 0.24;
    lCuff.rotation.z = 0.42;
    lCuff.position.set(-0.045, -0.072, handguardZ + 0.095);
    const lSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.044, 0.28, 8), sleeveMat);
    lSleeve.rotation.x = Math.PI / 2 - 0.24;
    lSleeve.rotation.z = 0.45;
    lSleeve.position.set(-0.115, -0.125, handguardZ + 0.23);

    armGroup.add(rGlove, rCuff, rSleeve, lGlove, lCuff, lSleeve);
  }
  root.add(armGroup);

  const applyUniform = (uniform: UniformCamoId, custom?: CustomCamoConfig) => {
    sleeveMat.map = null;
    sleeveMat.clearcoat = 0;
    sleeveMat.roughness = 0.85;
    sleeveMat.metalness = 0.04;
    cuffMat.clearcoat = 0;
    cuffMat.roughness = 0.82;
    cuffMat.metalness = 0.05;

    if (uniform === 'custom_camo' && custom) {
      customUniformTex?.dispose();
      customUniformTex = createCustomCamoTexture(custom);
      if (custom.pattern === 'solid') {
        sleeveMat.color.set(custom.primaryHex);
      } else {
        sleeveMat.color.setHex(0xffffff);
        sleeveMat.map = customUniformTex;
      }
      cuffMat.color.set(custom.secondaryHex);
      gloveMat.color.set(custom.accentHex);
      applyFinishToMaterial(sleeveMat, custom.finish, true);
      applyFinishToMaterial(cuffMat, custom.finish, true);
    } else if (uniform === 'og107_olive') {
      sleeveMat.color.setHex(0x465432);
      cuffMat.color.setHex(0x354025);
      gloveMat.color.setHex(0x282721);
    } else if (uniform === 'tiger_stripe') {
      sleeveMat.color.setHex(0xd4d8c4);
      sleeveMat.map = tigerTex;
      cuffMat.color.setHex(0x262c1c);
      gloveMat.color.setHex(0x1f211b);
    } else if (uniform === 'erdl_woodland') {
      sleeveMat.color.setHex(0xd6d9c6);
      sleeveMat.map = erdlTex;
      cuffMat.color.setHex(0x3a4626);
      gloveMat.color.setHex(0x2d2922);
    } else if (uniform === 'khaki_tan') {
      sleeveMat.color.setHex(0x8a7451);
      cuffMat.color.setHex(0x6b573a);
      gloveMat.color.setHex(0x3f3528);
    } else if (uniform === 'mekong_mud') {
      sleeveMat.color.setHex(0xc9b9a3);
      sleeveMat.map = mudTex;
      cuffMat.color.setHex(0x3b3122);
      gloveMat.color.setHex(0x2b251c);
    } else {
      sleeveMat.color.setHex(0x232824);
      cuffMat.color.setHex(0x151815);
      gloveMat.color.setHex(0x141514);
    }
    sleeveMat.needsUpdate = true;
    cuffMat.needsUpdate = true;
    gloveMat.needsUpdate = true;
  };

  applyAttachments({ optic: 'iron', muzzle: 'standard', underbarrel: 'standard' });
  applyPaint('parkerized');
  applyUniform('og107_olive');

  return {
    root,
    muzzlePoint,
    muzzleFlash,
    adsOffset,
    baseAdsOffset,
    scopeAdsOffset,
    oegAdsOffset,
    hipOffset,
    applyAttachments,
    applyPaint,
    applyUniform,
  };
}
