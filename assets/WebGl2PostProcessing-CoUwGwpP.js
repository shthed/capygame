var E=Object.defineProperty;var U=(s,a,e)=>a in s?E(s,a,{enumerable:!0,configurable:!0,writable:!0,value:e}):s[a]=e;var h=(s,a,e)=>U(s,typeof a!="symbol"?a+"":a,e);import{aB as R,k as _,aC as M,aD as y,aE as O,aF as D,aG as L,d as B,aH as w,aI as W,aJ as G,e as H}from"./vendor-three-DZlJYfdH.js";class N extends R{constructor(e,r,i){super();h(this,"scene");h(this,"camera");h(this,"sceneCaptureTarget");h(this,"copyMaterial");h(this,"fsQuad");this.scene=e,this.camera=r,this.sceneCaptureTarget=i,this.needsSwap=!1,this.copyMaterial=new _({uniforms:y.clone(M.uniforms),vertexShader:M.vertexShader,fragmentShader:M.fragmentShader,transparent:!1,depthTest:!1,depthWrite:!1}),this.fsQuad=new O(this.copyMaterial)}render(e,r,i){const n=e.autoClear;e.autoClear=!1,this.sceneCaptureTarget?(e.setRenderTarget(this.sceneCaptureTarget),e.clear(!0,!0,!1),e.render(this.scene,this.camera),this.copyMaterial.uniforms.tDiffuse.value=this.sceneCaptureTarget.texture,e.setRenderTarget(this.renderToScreen?null:i),this.renderToScreen||e.clear(!0,!1,!1),this.fsQuad.render(e)):(e.setRenderTarget(this.renderToScreen?null:i),e.clear(!0,!0,!1),e.render(this.scene,this.camera)),e.autoClear=n}dispose(){this.copyMaterial.dispose(),this.fsQuad.dispose()}}const g=1.85,b=.35,A=.52,Q=.2;function j(s,a,e,r=g,i=A){if(!Number.isFinite(s)||!Number.isFinite(a)||!Number.isFinite(e))return 0;const n=Math.max(0,Math.min(64,s)),c=Math.max(0,Math.min(64,a)),m=Math.max(0,Math.min(64,e)),l=n*.2126+c*.7152+m*.0722;if(l<=r)return 0;const u=Math.max(n,c,m),S=Math.min(n,c,m),v=u>1e-4?(u-S)/u:0,d=Math.max(0,Math.min(1,(v-.14)/.28));if(d<=0)return 0;const t=Math.max(0,Math.min(1,(l-r)/b)),x=t*t*(3-2*t),o=l-r,f=o/(1+o*1.45)*x*d;return Math.min(i,f)/l}const P={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:g},smoothWidth:{value:b},defaultColor:{value:new H(0)},defaultOpacity:{value:0}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float luminosityThreshold;
    uniform float smoothWidth;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      bool allFinite = (texel.r == texel.r) && (texel.g == texel.g) && (texel.b == texel.b)
        && (abs(texel.r) < 65000.0) && (abs(texel.g) < 65000.0) && (abs(texel.b) < 65000.0);
      if (!allFinite) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      vec3 c = clamp(texel.rgb, vec3(0.0), vec3(64.0));
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float saturation = (maxC > 0.0001) ? ((maxC - minC) / maxC) : 0.0;

      // Reject achromatic white/warm specular reflections off shiny glass, metal & water
      float chromaGate = smoothstep(0.14, 0.42, saturation);
      float knee = smoothstep(luminosityThreshold, luminosityThreshold + max(0.05, smoothWidth), luma);
      float excess = max(0.0, luma - luminosityThreshold);
      float compressed = min(${A.toFixed(2)}, (excess / (1.0 + excess * 1.45)) * knee * chromaGate);
      float gain = (luma > 0.0001) ? (compressed / luma) : 0.0;

      gl_FragColor = vec4(c * gain, 1.0);
    }
  `};function V(s){const{renderer:a,scene:e,camera:r,renderTarget:i,sceneCaptureTarget:n,viewportWidth:c,viewportHeight:m,bloomScale:l,bloomStrength:u,bloomEnabled:S,antiAliasingEnabled:v,masterFilterShader:d}=s,t=new D(a,i);t.setPixelRatio(a.getPixelRatio()),t.setSize(c,m);const x=new N(e,r,n);t.addPass(x);const o=new L(new B(Math.max(1,Math.floor(c*l)),Math.max(1,Math.floor(m*l))),u,Q,g),f=o.materialHighPassFilter,p=y.clone(P.uniforms);p.luminosityThreshold.value=g,p.smoothWidth.value=b,o.highPassUniforms=p,o.materialHighPassFilter=new _({uniforms:p,vertexShader:P.vertexShader,fragmentShader:P.fragmentShader}),f==null||f.dispose(),o.enabled=S,t.addPass(o);const T=new w(d);t.addPass(T);const F=new W;t.addPass(F);const C=new w(G);return C.enabled=v,t.addPass(C),{composer:t,renderPass:x,bloomPass:o,masterFilterPass:T,outputPass:F,fxaaPass:C}}export{A as SPECULAR_SAFE_BLOOM_MAX_RADIANCE,Q as SPECULAR_SAFE_BLOOM_RADIUS,b as SPECULAR_SAFE_BLOOM_SOFT_KNEE,g as SPECULAR_SAFE_BLOOM_THRESHOLD,N as SceneDepthCapturePass,V as buildWebGl2PostProcessingComposer,j as evaluateSpecularSafeBloomGain};
