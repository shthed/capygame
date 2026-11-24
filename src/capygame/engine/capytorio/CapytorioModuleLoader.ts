export interface CapytorioRuntimeBundle {
  CapytorioFactoryEngine: typeof import('../CapytorioFactoryEngine').CapytorioFactoryEngine;
  resolveCapytorioPlaceableSpec: typeof import('../CapytorioFactoryEngine').resolveCapytorioPlaceableSpec;
  capytorioGridToWorldX: typeof import('../CapytorioFactoryEngine').capytorioGridToWorldX;
  capytorioGridToWorldZ: typeof import('../CapytorioFactoryEngine').capytorioGridToWorldZ;
  worldToCapytorioGridX: typeof import('../CapytorioFactoryEngine').worldToCapytorioGridX;
  worldToCapytorioGridZ: typeof import('../CapytorioFactoryEngine').worldToCapytorioGridZ;
  getCapytorioPlacementAnchor: typeof import('../CapytorioFactoryEngine').getCapytorioPlacementAnchor;
  Capytorio3DRenderer: typeof import('../CapytorioMeshBuilder').Capytorio3DRenderer;
  resolvePediaIdFromTileInspection: typeof import('../CapytorioPedia').resolvePediaIdFromTileInspection;
  CAPYTORIO_HOTBAR_ORDER: typeof import('../CapytorioData').CAPYTORIO_HOTBAR_ORDER;
  CAPYTORIO_MACHINE_SPECS: typeof import('../CapytorioData').CAPYTORIO_MACHINE_SPECS;
  CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE: typeof import('../CapytorioData').CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE;
  CAPYTORIO_RECIPES: typeof import('../CapytorioData').CAPYTORIO_RECIPES;
  TECH_BY_ID: typeof import('../CapytorioData').TECH_BY_ID;
  ensureLiveCapytorioLuaSync: typeof import('../CapytorioData').ensureLiveCapytorioLuaSync;
  getCapytorioItemMeta: typeof import('../CapytorioData').getCapytorioItemMeta;
  getCapytorioLuaCatalogInfo: typeof import('../CapytorioData').getCapytorioLuaCatalogInfo;
  subscribeCapytorioLuaChanges: typeof import('../CapytorioData').subscribeCapytorioLuaChanges;
}

let loadedBundle: CapytorioRuntimeBundle | null = null;
let pendingBundlePromise: Promise<CapytorioRuntimeBundle> | null = null;

export function getLoadedCapytorioRuntime(): CapytorioRuntimeBundle | null {
  return loadedBundle;
}

export function loadCapytorioRuntime(): Promise<CapytorioRuntimeBundle> {
  if (loadedBundle) {
    return Promise.resolve(loadedBundle);
  }
  if (!pendingBundlePromise) {
    pendingBundlePromise = Promise.all([
      import('../CapytorioFactoryEngine'),
      import('../CapytorioMeshBuilder'),
      import('../CapytorioData'),
      import('../CapytorioPedia'),
    ])
      .then(([engineMod, meshMod, dataMod, pediaMod]) => {
        loadedBundle = {
          CapytorioFactoryEngine: engineMod.CapytorioFactoryEngine,
          resolveCapytorioPlaceableSpec: engineMod.resolveCapytorioPlaceableSpec,
          capytorioGridToWorldX: engineMod.capytorioGridToWorldX,
          capytorioGridToWorldZ: engineMod.capytorioGridToWorldZ,
          worldToCapytorioGridX: engineMod.worldToCapytorioGridX,
          worldToCapytorioGridZ: engineMod.worldToCapytorioGridZ,
          getCapytorioPlacementAnchor: engineMod.getCapytorioPlacementAnchor,
          Capytorio3DRenderer: meshMod.Capytorio3DRenderer,
          resolvePediaIdFromTileInspection: pediaMod.resolvePediaIdFromTileInspection,
          CAPYTORIO_HOTBAR_ORDER: dataMod.CAPYTORIO_HOTBAR_ORDER,
          CAPYTORIO_MACHINE_SPECS: dataMod.CAPYTORIO_MACHINE_SPECS,
          CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE: dataMod.CAPYTORIO_PLACEABLE_ITEM_TO_MACHINE,
          CAPYTORIO_RECIPES: dataMod.CAPYTORIO_RECIPES,
          TECH_BY_ID: dataMod.TECH_BY_ID,
          ensureLiveCapytorioLuaSync: dataMod.ensureLiveCapytorioLuaSync,
          getCapytorioItemMeta: dataMod.getCapytorioItemMeta,
          getCapytorioLuaCatalogInfo: dataMod.getCapytorioLuaCatalogInfo,
          subscribeCapytorioLuaChanges: dataMod.subscribeCapytorioLuaChanges,
        };
        return loadedBundle;
      })
      .catch((err) => {
        pendingBundlePromise = null;
        throw err;
      });
  }
  return pendingBundlePromise;
}
