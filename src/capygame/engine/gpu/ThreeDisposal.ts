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

function disposeMaterial(mat: THREE.Material | null | undefined): void {
  if (!mat || mat.userData?.sharedAsset) return;
  const matRecord = mat as unknown as Record<string, unknown>;
  for (let i = 0; i < TEXTURE_KEYS.length; i++) {
    const tex = matRecord[TEXTURE_KEYS[i]];
    if (tex && tex instanceof THREE.Texture && !tex.userData?.sharedAsset) {
      tex.dispose();
    }
  }
  mat.dispose();
}

/**
 * Traverses a Three.js Object3D subtree, disposes all unshared geometries, materials,
 * and unshared material textures, and clears child references to prevent VRAM leaks.
 */
export function disposeObject3DTree(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  root.traverse((obj) => {
    if (obj === root) return;
    const renderable = obj as THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;
    const geo = (renderable as THREE.Mesh).geometry;
    if (geo && typeof geo.dispose === 'function' && !geo.userData?.sharedAsset) {
      geo.dispose();
    }
    const mat = (renderable as THREE.Mesh).material;
    if (Array.isArray(mat)) {
      for (let i = 0; i < mat.length; i++) {
        disposeMaterial(mat[i]);
      }
    } else if (mat) {
      disposeMaterial(mat);
    }
  });
  while (root.children.length > 0) {
    root.remove(root.children[root.children.length - 1]);
  }
}
