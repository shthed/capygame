Object.assign(globalThis, {
  GPUTextureUsage: { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 },
  GPUBufferUsage: { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 },
  GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
  GPUColorWrite: { RED: 1, GREEN: 2, BLUE: 4, ALPHA: 8, ALL: 15 },
  GPUMapMode: { READ: 1, WRITE: 2 },
  GPUFeatureName: { DepthClipControl: 'depth-clip-control', Depth32FloatStencil8: 'depth32float-stencil8', TextureCompressionBC: 'texture-compression-bc', TimestampQuery: 'timestamp-query', Float32Filterable: 'float32-filterable' },
  document: {
    createElementNS: () => ({ style: {}, width: 800, height: 600, addEventListener: () => {}, removeEventListener: () => {} }),
    createElement: () => ({ style: {}, width: 800, height: 600, getContext: () => null, addEventListener: () => {}, removeEventListener: () => {} }),
  },
  window: { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener: () => {}, removeEventListener: () => {}, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});
globalThis.self = globalThis.window;

const THREE = await import('three');
const THREE_WEBGPU = await import('three/webgpu');
const { pass, mrt, normalView, output, float, uniform, uv, vec2, vec3, vec4, mix, length, max, clamp, pow, luminance, Fn, instancedArray, instanceIndex, hash, sin, cos, If, exp } = await import('three/tsl');
const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
const { ao } = await import('three/addons/tsl/display/GTAONode.js');
const { fxaa } = await import('three/addons/tsl/display/FXAANode.js');

const logs = [];
const mockTex = (d) => ({ ...d, createView: () => ({}), destroy: () => {} });
const mockDevice = {
  features: new Set(['depth-clip-control', 'depth32float-stencil8', 'texture-compression-bc', 'float32-filterable']),
  limits: { maxTextureDimension2D: 8192, maxColorAttachments: 8, maxBindGroups: 4, maxSampledTexturesPerShaderStage: 16 },
  lost: new Promise(() => {}),
  pushErrorScope: () => {},
  popErrorScope: async () => null,
  createBuffer: () => ({ getMappedRange: () => new ArrayBuffer(65536), unmap: () => {}, destroy: () => {} }),
  createTexture: (d) => mockTex(d),
  createSampler: () => ({}),
  createBindGroupLayout: (d) => ({ _d: d }),
  createBindGroup: (d) => ({ _d: d }),
  createPipelineLayout: (d) => ({ _d: d }),
  createShaderModule: (d) => { logs.push({ type: 'shader', label: d.label, code: d.code }); return { label: d.label, code: d.code }; },
  createRenderPipeline: (d) => {
    logs.push({ type: 'pipeline', label: d.label, vertex: d.vertex?.module?.label, fragment: d.fragment?.module?.label, targets: d.fragment?.targets, multisample: d.multisample, depthStencil: d.depthStencil, buffers: d.vertex?.buffers, primitive: d.primitive });
    return { label: d.label };
  },
  createRenderPipelineAsync: async (d) => mockDevice.createRenderPipeline(d),
  createComputePipeline: (d) => ({}),
  createCommandEncoder: (d) => {
    const encLabel = d?.label;
    return {
      label: encLabel,
      beginRenderPass: () => ({
        setViewport: () => {}, setScissorRect: () => {},
        setPipeline: (p) => logs.push({ type: 'setPipeline', enc: encLabel, pipeline: p?.label }),
        setBindGroup: () => {}, setIndexBuffer: () => {}, setVertexBuffer: () => {},
        drawIndexed: (ic, inst) => logs.push({ type: 'drawIndexed', enc: encLabel, ic, inst }),
        draw: (vc, inst) => logs.push({ type: 'draw', enc: encLabel, vc, inst }),
        end: () => {},
      }),
      beginComputePass: () => ({ setPipeline: () => {}, setBindGroup: () => {}, dispatchWorkgroups: () => {}, end: () => {} }),
      copyTextureToTexture: () => {}, copyBufferToBuffer: () => {},
      finish: () => ({}),
    };
  },
  queue: { writeBuffer: () => {}, writeTexture: () => {}, submit: () => {} },
};
const mockContext = {
  configure: () => {},
  getCurrentTexture: () => mockTex({ format: 'bgra8unorm', width: 800, height: 600 }),
};
const renderer = new THREE_WEBGPU.WebGPURenderer({ device: mockDevice, context: mockContext, antialias: true });
await renderer.init();
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(58, 800/600, 0.25, 3500);
cam.position.set(0, 7.5, 14);
const dirLight = new THREE.DirectionalLight(0xfffaf0, 2.65);
dirLight.position.set(38, 72, 32);
dirLight.castShadow = true;
scene.add(dirLight, dirLight.target, new THREE.AmbientLight(0xffffff, 0.08), new THREE.HemisphereLight(0xbfe3ff, 0x263d24, 0.48));

const saucerPoints = [
  new THREE.Vector2(0.0, -0.14), new THREE.Vector2(0.18, -0.125),
  new THREE.Vector2(0.36, -0.075), new THREE.Vector2(0.47, -0.015),
  new THREE.Vector2(0.465, 0.025), new THREE.Vector2(0.35, 0.07),
  new THREE.Vector2(0.24, 0.09), new THREE.Vector2(0.22, 0.03),
  new THREE.Vector2(0.0, 0.015),
];
const saucerGeo = new THREE.LatheGeometry(saucerPoints, 32);
const titaniumMat = new THREE.MeshPhysicalMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.35 });
const saucer = new THREE.Mesh(saucerGeo, titaniumMat);
saucer.castShadow = true; saucer.receiveShadow = true;
scene.add(saucer);

// Add computeSprite just like WebGpuPipeline.ts!
const positions = instancedArray(1024, 'vec3');
const phases = instancedArray(1024, 'float');
const moteMat = new THREE_WEBGPU.PointsNodeMaterial();
moteMat.transparent = true; moteMat.depthWrite = false; moteMat.blending = THREE.AdditiveBlending;
moteMat.positionNode = positions.element(instanceIndex);
moteMat.sizeNode = float(8.5);
moteMat.colorNode = vec3(1.0, 0.94, 0.72);
moteMat.opacityNode = float(0.5);
const sprite = new THREE_WEBGPU.Sprite(moteMat);
sprite.count = 1024;
sprite.frustumCulled = false;
scene.add(sprite);

// PMREM
const pmrem = new THREE_WEBGPU.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide })));
const rt = pmrem.fromScene(envScene, 0.035);
scene.environment = rt.texture;
pmrem.dispose();

// PostProcessing
const pp = new THREE_WEBGPU.PostProcessing(renderer);
const sp = pass(scene, cam);
sp.setMRT(mrt({ output, normal: normalView }));
const spCol = sp.getTextureNode('output');
const spDepth = sp.getTextureNode('depth');
const spNorm = sp.getTextureNode('normal');
const aoPass = ao(spDepth, spNorm, cam);
const bloomPass = bloom(spCol, 0.24, 0.42, 0.82);
pp.outputNode = fxaa(spCol.mul(aoPass.getTextureNode()).add(bloomPass));
pp.render();

console.log('DRAWS:', JSON.stringify(logs.filter(l => l.type === 'drawIndexed' || l.type === 'draw')));
console.log('PIPELINES:', JSON.stringify(logs.filter(l => l.type === 'pipeline').map(p => ({ label: p.label, targets: p.targets, ms: p.multisample, ds: p.depthStencil, prim: p.primitive, bufs: p.buffers })), null, 2));
