export interface FactorioNoiseApi {
  wasm(on?: boolean): boolean;
  heapUsed(): number;
  resetHeap(): void;
}

export declare const FactorioNoise: FactorioNoiseApi;
export default FactorioNoise;
