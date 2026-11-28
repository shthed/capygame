export interface FactorioAutoplaceControlMgs {
  frequency?: number;
  size?: number;
  richness?: number;
}

export interface FactorioMapGenSettings {
  seed: number;
  width?: number;
  height?: number;
  starting_area?: number;
  autoplace_controls?: Record<string, FactorioAutoplaceControlMgs>;
  property_expression_names?: Record<string, string | number>;
  cliff_settings?: Record<string, unknown>;
}

export interface FactorioPlacedEntityProto {
  name: string;
  kind: 'resource' | 'tree' | 'fish' | 'enemy' | 'solid';
  color?: [number, number, number];
}

export type FactorioPlacedTuple = [
  entity: FactorioPlacedEntityProto,
  x: number,
  y: number,
  richness: number
];

export interface FactorioSampledChunk {
  tiles: Int16Array;
  tileNames: string[];
  tileColors: [number, number, number][];
  placed: FactorioPlacedTuple[];
}

export interface FactorioOverviewSurfaceChunk {
  tiles: Int16Array;
  resEntityIdx: Int16Array;
  treeEntityIdx: Int16Array;
  treeProb: Uint8Array;
  entityNames: string[];
}

export interface FactorioPreviewRenderer {
  passes: number;
  overview?: boolean;
  tileNames: string[];
  tileColors: [number, number, number][];
  trim(max: number): void;
  _sampleChunk?: (cx: number, cy: number) => FactorioSampledChunk;
  _sampleOverviewTiles?: (cx: number, cy: number) => Int16Array;
  _sampleOverviewSurface?: (cx: number, cy: number) => FactorioOverviewSurfaceChunk;
}

export interface FactorioPreviewApi {
  CHUNK: number;
  renderer(
    data: Record<string, unknown>,
    planet: string,
    mgs: FactorioMapGenSettings,
    scale?: number
  ): FactorioPreviewRenderer;
}

export declare const FactorioPreview: FactorioPreviewApi;
export default FactorioPreview;
