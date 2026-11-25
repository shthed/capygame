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
  'envMap',
  'lightMap',
  'displacementMap',
  'specularMap',
  'transmissionMap',
] as const;

function disposeTextureIfUnshared(
  tex: unknown,
  disposedTextures: Set<THREE.Texture>
): void {
  if (
    tex &&
    tex instanceof THREE.Texture &&
    !tex.userData?.sharedAsset &&
    !disposedTextures.has(tex)
  ) {
    disposedTextures.add(tex);
    tex.dispose();
  }
}

function disposeMaterial(
  mat: THREE.Material | null | undefined,
  disposed: Set<THREE.Material>,
  disposedTextures: Set<THREE.Texture>
): void {
  if (!mat || mat.userData?.sharedAsset || disposed.has(mat)) return;
  disposed.add(mat);
  const matRecord = mat as unknown as Record<string, unknown>;
  for (let i = 0; i < TEXTURE_KEYS.length; i++) {
    disposeTextureIfUnshared(matRecord[TEXTURE_KEYS[i]], disposedTextures);
  }
  const shaderMat = mat as THREE.ShaderMaterial;
  if (shaderMat.uniforms && typeof shaderMat.uniforms === 'object') {
    const uniformKeys = Object.keys(shaderMat.uniforms);
    for (let i = 0; i < uniformKeys.length; i++) {
      const uniform = shaderMat.uniforms[uniformKeys[i]];
      if (!uniform) continue;
      const val = uniform.value;
      if (val instanceof THREE.Texture) {
        disposeTextureIfUnshared(val, disposedTextures);
      } else if (Array.isArray(val)) {
        for (let j = 0; j < val.length; j++) {
          disposeTextureIfUnshared(val[j], disposedTextures);
        }
      }
    }
  }
  mat.dispose();
}

function disposeMaterialOrArray(
  matOrArr: unknown,
  disposed: Set<THREE.Material>,
  disposedTextures: Set<THREE.Texture>
): void {
  if (!matOrArr) return;
  if (Array.isArray(matOrArr)) {
    for (let i = 0; i < matOrArr.length; i++) {
      disposeMaterial(
        matOrArr[i] as THREE.Material | null | undefined,
        disposed,
        disposedTextures
      );
    }
  } else {
    disposeMaterial(matOrArr as THREE.Material, disposed, disposedTextures);
  }
}

/**
 * Traverses a Three.js Object3D subtree (including `root` itself when renderable),
 * disposes all unshared geometries, InstancedMesh instance buffers, materials
 * (including cloned sightline occlusion materials), and unshared material/shader textures,
 * and clears child references to prevent VRAM leaks.
 */
export function disposeObject3DTree(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  root.traverse((obj) => {
    const renderable = obj as THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;
    const geo = (renderable as THREE.Mesh).geometry;
    if (
      geo &&
      typeof geo.dispose === 'function' &&
      !geo.userData?.sharedAsset &&
      !disposedGeometries.has(geo)
    ) {
      disposedGeometries.add(geo);
      geo.dispose();
    }
    disposeMaterialOrArray(
      (renderable as THREE.Mesh).material,
      disposedMaterials,
      disposedTextures
    );
    if ((obj as THREE.InstancedMesh).isInstancedMesh) {
      const inst = obj as THREE.InstancedMesh;
      if (typeof inst.dispose === 'function' && !inst.userData?.sharedAsset) {
        inst.dispose();
      }
    }
    if (obj.userData) {
      if (obj.userData.__occMaterial) {
        disposeMaterialOrArray(
          obj.userData.__occMaterial,
          disposedMaterials,
          disposedTextures
        );
        obj.userData.__occMaterial = undefined;
      }
      if (obj.userData.__origMaterial) {
        disposeMaterialOrArray(
          obj.userData.__origMaterial,
          disposedMaterials,
          disposedTextures
        );
        obj.userData.__origMaterial = undefined;
      }
      const srcGeo = obj.userData.__sourceGeometry as THREE.BufferGeometry | undefined;
      if (
        srcGeo &&
        typeof srcGeo.dispose === 'function' &&
        !srcGeo.userData?.sharedAsset &&
        !disposedGeometries.has(srcGeo)
      ) {
        disposedGeometries.add(srcGeo);
        srcGeo.dispose();
        obj.userData.__sourceGeometry = undefined;
      }
    }
  });
  while (root.children.length > 0) {
    root.remove(root.children[root.children.length - 1]);
  }
}
