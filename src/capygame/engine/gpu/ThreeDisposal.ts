import * as THREE from 'three';

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'clearcoatNormalMap',
] as const;

function disposeMaterial(
  mat: THREE.Material | null | undefined,
  disposed: Set<THREE.Material>
): void {
  if (!mat || mat.userData?.sharedAsset || disposed.has(mat)) return;
  disposed.add(mat);
  const matRecord = mat as unknown as Record<string, unknown>;
  for (let i = 0; i < TEXTURE_KEYS.length; i++) {
    const tex = matRecord[TEXTURE_KEYS[i]];
    if (tex && tex instanceof THREE.Texture && !tex.userData?.sharedAsset) {
      tex.dispose();
    }
  }
  mat.dispose();
}

function disposeMaterialOrArray(
  matOrArr: unknown,
  disposed: Set<THREE.Material>
): void {
  if (!matOrArr) return;
  if (Array.isArray(matOrArr)) {
    for (let i = 0; i < matOrArr.length; i++) {
      disposeMaterial(matOrArr[i] as THREE.Material | null | undefined, disposed);
    }
  } else {
    disposeMaterial(matOrArr as THREE.Material, disposed);
  }
}

/**
 * Traverses a Three.js Object3D subtree, disposes all unshared geometries, materials
 * (including cloned sightline occlusion materials), and unshared material textures,
 * and clears child references to prevent VRAM leaks.
 */
export function disposeObject3DTree(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  const disposedMaterials = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (obj === root) return;
    const renderable = obj as THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;
    const geo = (renderable as THREE.Mesh).geometry;
    if (geo && typeof geo.dispose === 'function' && !geo.userData?.sharedAsset) {
      geo.dispose();
    }
    disposeMaterialOrArray((renderable as THREE.Mesh).material, disposedMaterials);
    if (obj.userData) {
      if (obj.userData.__occMaterial) {
        disposeMaterialOrArray(obj.userData.__occMaterial, disposedMaterials);
        obj.userData.__occMaterial = undefined;
      }
      if (obj.userData.__origMaterial) {
        disposeMaterialOrArray(obj.userData.__origMaterial, disposedMaterials);
        obj.userData.__origMaterial = undefined;
      }
    }
  });
  while (root.children.length > 0) {
    root.remove(root.children[root.children.length - 1]);
  }
}
