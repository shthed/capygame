const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./ForestMicroDioramaBuilder-VrWrIgm5.js","./capy-shared-core-DSsFvRq1.js","./vendor-three-DZlJYfdH.js"])))=>i.map(i=>d[i]);
var Os=Object.defineProperty;var Bs=(y,t,a)=>t in y?Os(y,t,{enumerable:!0,configurable:!0,writable:!0,value:a}):y[t]=a;var x=(y,t,a)=>Bs(y,typeof t!="symbol"?t+"":t,a);import{_ as zs}from"./vendor-react-DqobEus6.js";import{H as We,p as Ja,g as Ws,U as Ma,O as ts,e as Hs,a as Ns,C as Es,b as Us}from"./capy-shared-core-DSsFvRq1.js";import{u as Ct,i as we,N as es,h as Vs,D as ma,R as fa,f as Ke,v as Qt,A as q,H as Xs,J as Ys,K as $s,S as Z,k as Et,Q as Fa,M as D,U as Ya,W as Fs,X as Ts,d as ot,w as ct,m as B,g as as,j as O,Y as _e,e as K,G as H,V as X,Z as js,n as ra,C as rt,p as pe,I as kt,s as He,T as Da,l as Ot,o as Ne,B as Se,_ as Zs,$ as ja,a0 as qs,a1 as Ks,a2 as Za,F as ue,a as ce,b as oa,L as ss,a3 as Qs,z as os,a4 as Gt,a5 as la,a6 as Js,a7 as Ht,a8 as _a,a9 as La,r as ne,q as ie,P as de,aa as to,ab as eo,c as ao}from"./vendor-three-DZlJYfdH.js";const Oe={targetX:0,targetY:0,targetZ:0,lightX:0,lightY:85,lightZ:0,texelSizeWorld:.05},_s=6;function ga(y,t,a,s,e){const n=Math.max(0,Math.min(_s,Math.round(s))),o=Math.max(.5,Math.min(1.5,y.resolutionScale??1));let l=y.postProcessingEnabled,u=y.ssaoEnabled,d=y.bloomEnabled,r=y.shadowQuality,i=y.antiAliasing,h=o,c=t?3:a;n>=1&&t&&(c=n>=5?0:n>=3?1:2),n>=2&&u&&(u=!1),n>=3&&(h=Math.min(h,.8)),n>=4&&d&&(d=!1),n>=5&&(h=Math.min(h,.7),r==="pcf_soft"||r==="vsm"?r="pcf":r==="pcf"&&(r="off"),i==="msaa_fxaa"?i="fxaa":i==="fxaa"&&(i="none")),n>=6&&(h=Math.min(h,.65),r="off",l=!1,d=!1,u=!1,i="none");const p=e?e.disabledFeatures:[];return p.length=0,t&&c<3&&p.push(`LOD<=T${c}`),y.ssaoEnabled&&!u&&p.push("SSAO OFF"),y.bloomEnabled&&!d&&p.push("Bloom OFF"),h<o-.01&&p.push(`Scale ${h.toFixed(2)}x`),r!==y.shadowQuality&&p.push(r==="off"?"Shadows OFF":`Shadows ${r.toUpperCase()}`),i!==y.antiAliasing&&p.push(i==="none"?"AA OFF":`AA ${i.toUpperCase()}`),y.postProcessingEnabled&&!l&&p.push("Direct Pass"),e?(e.level=n,e.postProcessingEnabled=l,e.ssaoEnabled=u,e.bloomEnabled=d,e.shadowQuality=r,e.antiAliasing=i,e.resolutionScale=h,e.maxCapyLodTier=c,e.disabledFeatures=p,e):{level:n,postProcessingEnabled:l,ssaoEnabled:u,bloomEnabled:d,shadowQuality:r,antiAliasing:i,resolutionScale:h,maxCapyLodTier:c,disabledFeatures:p}}function wa(y){return`${y.postProcessingEnabled}|${y.ssaoEnabled}|${y.bloomEnabled}|${y.shadowQuality}|${y.antiAliasing}|${y.resolutionScale.toFixed(2)}|${y.maxCapyLodTier}`}function Fo(y,t,a,s){const e=wa(ga(t,a,s,y));for(let n=y+1;n<=_s;n++){const o=ga(t,a,s,n);if(wa(o)!==e)return n}return y}function To(y,t,a,s){const e=wa(ga(t,a,s,y));for(let n=y-1;n>=0;n--){const o=wa(ga(t,a,s,n));if(o!==e){let l=n;for(;l>0&&wa(ga(t,a,s,l-1))===o;)l--;return l}}return 0}function _o(y,t){return t||y==="low"||y==="performance"?.5:y==="ultra"?.65:.5}function Lo(y,t,a,s,e=1,n=!1){const o=Number.isFinite(y)&&y>0?y:1,l=Number.isFinite(e)?Math.max(.5,Math.min(1.5,e)):1;if(s)return Math.max(.5,Math.min(1,l));let u=1.5;t==="low"||t==="performance"?u=1:t==="balanced"?u=a?1.35:1.5:(t==="high"||t==="ultra")&&(u=1.5);const d=Math.min(o,u)*l;return Math.max(.5,Math.min(2.25,Math.round(d*100)/100))}function Io(y,t=!0){return t?y<=.02:!1}function Ro(y,t,a,s,e,n,o,l,u,d,r=.35){const i=l-e,h=u-n,c=d-o,p=Math.hypot(i,h,c);if(p<=.45||s<=.05)return!1;const g=1/p,m=i*g,w=h*g,f=c*g,v=y-e,b=t-n,M=a-o,S=v*m+b*w+M*f;if(S+s<=.14||S>=p-r)return!1;const A=Math.max(0,Math.min(p-r,S)),P=v-m*A,C=b-w*A,T=M-f*A,_=s*.9;return P*P+C*C+T*T<=_*_}function so(y,t,a,s=.5,e=.5,n=.5,o=.44,l=.28,u=1280,d=720,r){if(a<=.001||u<10||d<10)return 1;let i=1;if(r!==void 0&&r>0){const p=Math.max(0,Math.min(1,(r-.55)/1.65));i=p*p*(3-2*p)}const c=1+(.25*i-1)*a;return Math.max(0,Math.min(1,c))}function ko(y){return y<=7225?1:y<=18225?2:4}const Be={cameraFar:1350,skyScale:1,showMountains:!0};function Oo(y,t,a,s,e,n,o){if(o)return!0;const l=Math.max(40,n)+Math.max(0,a),u=s-y,d=e-t;return u*u+d*d<=l*l}function Bo(y,t,a,s){if(!a&&s>3.1)return Be.cameraFar=t==="performance"||t==="low"?1400:3500,Be.skyScale=1,Be.showMountains=!1,Be;const e=Number.isFinite(y)?Math.max(90,Math.min(1350,y)):650,n=Math.max(115,e);return Be.cameraFar=n,Be.skyScale=Math.min(1,n*.88/720),Be.showMountains=e>=185,Be}function zo(y,t,a,s,e,n,o,l=96){const u=Math.max(256,o),d=n*2/u,r=Math.round(y/d)*d,i=Math.round(t/d)*d,h=Math.hypot(a,s,e)||1,c=a/h,p=Math.max(.12,s/h),g=e/h,m=Math.hypot(c,p,g)||1;return Oe.targetX=r,Oe.targetY=0,Oe.targetZ=i,Oe.lightX=r+c/m*l,Oe.lightY=p/m*l,Oe.lightZ=i+g/m*l,Oe.texelSizeWorld=d,Oe}const ge={focusBlend:0,eclipticOffsetX:0,eclipticOffsetY:0,eclipticOffsetZ:0,sunDirX:.58,sunDirY:.48,sunDirZ:.65};function $a(y){return y<0?0:y>1?1:y}function Qe(y,t,a){const s=$a((a-y)/(t-y));return s*s*(3-2*s)}function oo(y,t,a,s=.34){const e=Qe(16.2,12.2,y),n=Math.cos(a)*t,o=-Math.sin(a)*t;ge.focusBlend=e,ge.eclipticOffsetX=-n*e||0,ge.eclipticOffsetY=0,ge.eclipticOffsetZ=-o*e||0;const l=t>1e-6?1/t:0,u=-n*l,d=-o*l,r=Math.cos(s),i=Math.sin(s),h=u,c=-d*i,p=d*r,g=Math.hypot(h,c,p)||1;return e>.05?(ge.sunDirX=h/g,ge.sunDirY=c/g,ge.sunDirZ=p/g):(ge.sunDirX=.58,ge.sunDirY=.48,ge.sunDirZ=.65),ge}const ca={galaxyFocusBlend:0,armOffsetX:0,armOffsetY:0,armOffsetZ:0},na=10.4,Te=1.22;function no(y,t=na,a=Te){const s=Qe(24,21.2,y),e=Math.cos(a)*t,n=-Math.sin(a)*t;return ca.galaxyFocusBlend=s,ca.armOffsetX=-e*s||0,ca.armOffsetY=0,ca.armOffsetZ=-n*s||0,ca}const ze={surfaceFocusBlend:0,planetOffsetX:0,planetOffsetY:0,planetOffsetZ:0,surfaceTargetX:0,surfaceTargetY:0,surfaceTargetZ:0},Ls=22.5,Is=42;function io(y,t=8.5,a=Ls,s=Is){const e=a*(Math.PI/180),n=s*(Math.PI/180),o=Math.cos(e)*Math.sin(n),l=Math.sin(e),u=Math.cos(e)*Math.cos(n),d=o*t,r=l*t,i=u*t,h=Qe(7.3,4.9,y);return ze.surfaceFocusBlend=h,ze.planetOffsetX=-d*h||0,ze.planetOffsetY=-r*h||0,ze.planetOffsetZ=-i*h||0,ze.surfaceTargetX=d,ze.surfaceTargetY=r,ze.surfaceTargetZ=i,ze}const aa={worldX:0,worldY:0,worldZ:0,uniformScale:.54,worldSpaceBlend:0},ro=3.85;function Wo(y,t,a,s,e,n,o,l,u,d,r,i,h,c){const p=t==="telescope_first_person"?10.8:22,g=t==="telescope_first_person"?-5.1:-7.2,m=a+n*p+u*g,w=s+o*p+d*g,f=e+l*p+r*g,v=t==="telescope_first_person"?0:Qe(2.95,1.05,y),b=i+1.85,M=h+.96,S=c-.55;return aa.worldSpaceBlend=v,aa.worldX=m+(b-m)*v,aa.worldY=w+(M-w)*v,aa.worldZ=f+(S-f)*v,aa.uniformScale=ro,aa}const _t={timeOfDayHours:9.5,dayPhaseLabel:"Daylight",sunElev:.78,dayFactor:1,duskFactor:0,nightFactor:0,sunDirX:.44,sunDirY:.82,sunDirZ:.37,moonDirX:-.44,moonDirY:.45,moonDirZ:-.37,activeShadowCaster:"sun",shadowIntensity:1,sunIntensity:2.85,moonIntensity:0,hemiIntensity:.52,ambientIntensity:.1,iblEnvIntensity:1.15,lanternBoost:.1,exposure:1.02};function lo(y,t,a=1,s=0){const e=(y%24+24)%24;let n="Starlight Night";e>=5.2&&e<8?n="Golden Dawn":e>=8&&e<17.2?n="Daylight":e>=17.2&&e<20.2&&(n="Crimson Dusk");const o=(e-6)/24*Math.PI*2,l=Math.sin(o),u=Math.cos(o),d=u*.85,r=l,i=-.44,h=Math.hypot(d,r,i)||1,c=d/h,p=r/h,g=i/h,m=-u*.72,w=Math.max(.24,-l*.92+.18),f=.42,v=Math.hypot(m,w,f)||1,b=m/v,M=w/v,S=f/v,A=Qe(-.14,.28,l),P=Math.max(0,1-Math.abs(l-.04)*4.2),C=1-A,T=1-$a(t)*.48,_=l>=.02?"sun":"moon",W=Qe(.02,.18,l),j=Qe(.02,-.18,l),Y=(_==="sun"?W:j)*(1-$a(t)*.35);return _t.timeOfDayHours=e,_t.dayPhaseLabel=n,_t.sunElev=l,_t.dayFactor=A,_t.duskFactor=P,_t.nightFactor=C,_t.sunDirX=c,_t.sunDirY=p,_t.sunDirZ=g,_t.moonDirX=b,_t.moonDirY=M,_t.moonDirZ=S,_t.activeShadowCaster=_,_t.shadowIntensity=Y,_t.sunIntensity=Math.max(0,A*3.35*T)+s*3,_t.moonIntensity=C*(.92-t*.32),_t.hemiIntensity=.22+A*(.28+t*.1),_t.ambientIntensity=.04+A*.05+s*.35,_t.iblEnvIntensity=.3+A*.42+P*.1,_t.lanternBoost=.08+C*2.25+P*.75,_t.exposure=(.94+A*.09+s*.28)*a,_t}const Xe=60,ns=32;class Ho{constructor(t=Date.now()){x(this,"fpsHistory",new Float32Array(Xe));x(this,"msHistory",new Float32Array(Xe));x(this,"sortedScratch",new Float32Array(Xe));x(this,"writeIdx",0);x(this,"sampleCount",0);x(this,"entries",[]);x(this,"nextEntryId",1);x(this,"droppedFramesCount",0);x(this,"lastAlertTimestampMs",-1e4);x(this,"lastSampleMs",16.67);x(this,"liveFps",60);x(this,"smoothedFps",60);x(this,"warmupFramesRemaining",4);x(this,"startTimestampMs",0);x(this,"lock60FpsEnabled",!0);x(this,"fpsTarget",60);x(this,"maxFpsLimit",60);x(this,"activeGovernorTier",0);x(this,"disabledFeatures",[]);x(this,"frameRecordResult",{isLagDrop:!1,shouldReduceLoad:!1});this.startTimestampMs=t,this.fpsHistory.fill(60),this.msHistory.fill(16.67)}getEffectiveTargetFps(){const t=Math.max(24,Math.min(240,Math.round(this.fpsTarget||60)));return this.maxFpsLimit>0?Math.max(24,Math.min(t,Math.round(this.maxFpsLimit))):t}getDisplayFpsCap(){return this.maxFpsLimit>0?Math.max(24,Math.min(240,Math.round(this.maxFpsLimit))):240}notifyTransitionWarmup(t=4){this.warmupFramesRemaining=Math.max(this.warmupFramesRemaining,t)}recordFrame(t,a,s,e,n,o="Monitor"){const l=this.getEffectiveTargetFps(),u=this.getDisplayFpsCap();if(this.warmupFramesRemaining>0)return this.warmupFramesRemaining--,this.liveFps=Math.min(u,Math.round(this.smoothedFps)),this.frameRecordResult.isLagDrop=!1,this.frameRecordResult.shouldReduceLoad=!1,this.frameRecordResult;const d=s?Math.max(.5,t):Math.max(.5,a),r=Math.min(240,Math.round(1e3/Math.max(4,d)*10)/10),i=Math.min(u,r);this.fpsHistory[this.writeIdx]=i,this.msHistory[this.writeIdx]=d,this.writeIdx=(this.writeIdx+1)%Xe,this.sampleCount<Xe&&this.sampleCount++,this.lastSampleMs=d,this.smoothedFps=this.smoothedFps*.72+i*.28,this.liveFps=Math.max(1,Math.min(u,Math.round(this.smoothedFps)));const h=1e3/l,c=l===60?20.5:Math.max(h*1.23,h+3.8),p=l===60?33.4:Math.max(h*2,h+14),g=l*.9,m=l*.583,w=this.maxFpsLimit>0&&!s&&t>c,f=d>p||r<m||w&&t>p,b=d>c||r<g||w||f;if(b){this.droppedFramesCount++;const M=f?400:850;n-this.lastAlertTimestampMs>=M&&this.pushEntry(n,f?"critical":"warn",Math.max(1,Math.round(r)),d,e,s?"Software GL CPU raster spike":f?`Heavy GPU/physics frame hitch (>${p.toFixed(0)}ms)`:`Frame budget exceeded (>${c.toFixed(1)}ms for ${l} FPS)`,o)}return this.frameRecordResult.isLagDrop=b,this.frameRecordResult.shouldReduceLoad=this.lock60FpsEnabled&&(b||this.getAvgFrameMs()>h*1.09),this.frameRecordResult}recordSyntheticLagSpike(t,a,s="Dropped LOD / GPU load to hit FPS target",e=Date.now()){const n=Math.max(1,Math.round(1e3/Math.max(4,t))),o=Math.min(this.getDisplayFpsCap(),n);this.fpsHistory[this.writeIdx]=o,this.msHistory[this.writeIdx]=t,this.writeIdx=(this.writeIdx+1)%Xe,this.sampleCount<Xe&&this.sampleCount++,this.lastSampleMs=t,this.smoothedFps=o,this.liveFps=o,this.droppedFramesCount++,this.pushEntry(e,t>33.4?"critical":"warn",n,t,a,`Detected ${t.toFixed(1)} ms frame spike (${n} FPS)`,s)}pushEntry(t,a,s,e,n,o,l){this.lastAlertTimestampMs=t;const u=Math.max(0,(t-this.startTimestampMs)/1e3),d=Math.floor(u/60),r=Math.floor(u%60),i=`${d}:${r<10?"0":""}${r}`,h=Math.round(e*10)/10,c=this.entries[0],p=c&&c.stageLabel===n&&(c.cause===o||c.mitigation===l||c.cause.startsWith("Detected")&&o.startsWith("Detected")||t-(c.lastTimestampMs??c.timestampMs)<5e3);if(c&&p&&t-(c.lastTimestampMs??c.timestampMs)<8e3){c.repeatCount=(c.repeatCount??1)+1,c.lastTimestampMs=t,c.lastElapsedLabel=i,c.minFps=Math.min(c.minFps??c.fps,s),c.maxFps=Math.max(c.maxFps??c.fps,s),c.frameMs=h,c.maxFrameMs=Math.max(c.maxFrameMs??c.frameMs,h),a==="critical"&&(c.severity="critical");return}if(c&&t-(c.lastTimestampMs??c.timestampMs)<1200&&c.stageLabel===n){c.repeatCount=(c.repeatCount??1)+1,c.lastTimestampMs=t,c.lastElapsedLabel=i,c.minFps=Math.min(c.minFps??c.fps,s),c.maxFps=Math.max(c.maxFps??c.fps,s),c.maxFrameMs=Math.max(c.maxFrameMs??c.frameMs,h);return}this.entries.unshift({id:this.nextEntryId++,timestampMs:t,lastTimestampMs:t,elapsedLabel:i,lastElapsedLabel:i,severity:a,fps:s,minFps:s,maxFps:s,frameMs:h,maxFrameMs:h,stageLabel:n,cause:o,mitigation:l,repeatCount:1}),this.entries.length>ns&&(this.entries.length=ns)}clear(t=Date.now()){const a=this.getEffectiveTargetFps(),s=Math.round(1e3/a*100)/100;this.entries.length=0,this.droppedFramesCount=0,this.lastAlertTimestampMs=t-1e4,this.fpsHistory.fill(a),this.msHistory.fill(s),this.lastSampleMs=s,this.smoothedFps=a,this.liveFps=a}getAvgFrameMs(){const t=Math.max(1,this.sampleCount);let a=0;for(let s=0;s<t;s++)a+=this.msHistory[s];return a/t}getSnapshot(t=Date.now()){const a=Math.max(1,this.sampleCount);let s=0,e=0,n=240,o=0;for(let c=0;c<a;c++){const p=this.fpsHistory[c],g=this.msHistory[c];s+=p,e+=g,p<n&&(n=p),g>o&&(o=g),this.sortedScratch[c]=g}for(let c=1;c<a;c++){const p=this.sortedScratch[c];let g=c-1;for(;g>=0&&this.sortedScratch[g]>p;)this.sortedScratch[g+1]=this.sortedScratch[g],g--;this.sortedScratch[g+1]=p}const l=Math.min(a-1,Math.floor(a*.95)),u=this.entries[0]??null,d=!!(u&&t-this.lastAlertTimestampMs<4e3),r=this.getEffectiveTargetFps(),i=u?u.minFps&&u.maxFps&&u.minFps!==u.maxFps?`${u.minFps}-${u.maxFps}`:`${u.fps}`:String(r),h=u&&u.repeatCount&&u.repeatCount>1?` (x${u.repeatCount})`:"";return{liveFps:this.liveFps,avgFps:Math.round(s/a),minFps:Math.round(n),avgFrameMs:Math.round(e/a*10)/10,p95FrameMs:Math.round(this.sortedScratch[l]*10)/10,maxFrameMs:Math.round(Math.max(o,this.lastSampleMs)*10)/10,droppedFramesCount:this.droppedFramesCount,alertCount:this.entries.length,activeAlert:d,lastAlertSummary:u?`${i} FPS (${u.maxFrameMs??u.frameMs}ms)${h} · ${u.stageLabel}`:null,lock60FpsEnabled:this.lock60FpsEnabled,fpsTarget:r,maxFpsLimit:this.maxFpsLimit,autoOptimizerEnabled:this.lock60FpsEnabled,activeGovernorTier:this.activeGovernorTier,disabledFeatures:this.disabledFeatures.slice(),entries:this.entries.slice()}}}const Ia={yaw:0,pitch:0},co=.0042,ya=220;function No(y,t,a,s,e=1,n=!1,o=-.68,l=1.18){const u=Number.isFinite(a)?Math.max(-ya,Math.min(ya,a)):0,d=Number.isFinite(s)?Math.max(-ya,Math.min(ya,s)):0,r=Number.isFinite(e)?Math.max(.2,Math.min(2.5,e)):1,i=co*r,h=n?-1:1;Ia.yaw=y-u*i;const c=t+d*h*i;return Ia.pitch=Math.max(o,Math.min(l,c)),Ia}function Eo(y,t,a,s){const e=Math.atan2(Math.sin(t-y),Math.cos(t-y));return y+e*(1-Math.exp(-a*s))}function ua(y){return!y||y.userData.__fastMatrixCullInstalled||(y.userData.__fastMatrixCullInstalled=!0,y.updateMatrixWorld=function(a){if(!a&&(!this.visible||!this.matrixWorldAutoUpdate)){this.matrixWorldNeedsUpdate=!0;return}Ct.prototype.updateMatrixWorld.call(this,a)}),y}function Rs(){if(typeof navigator<"u"){const y=navigator.userAgent||"";if(/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(y)||(typeof navigator.maxTouchPoints=="number"?navigator.maxTouchPoints:0)>1&&typeof window<"u"&&typeof window.matchMedia=="function"&&window.matchMedia("(pointer: coarse)").matches)return!0}return!1}function Uo(y=!1,t){if(t==="performance"||y||Rs())return!0;if(typeof navigator<"u"){const a=navigator.deviceMemory;if(typeof a=="number"&&a>0&&a<=4||typeof navigator.hardwareConcurrency=="number"&&navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4)return!0}return!1}const ha=new Set,da=new Set,va=["map","normalMap","roughnessMap","metalnessMap","aoMap","bumpMap","emissiveMap","alphaMap"];function Vo(y,t){ha.clear(),da.clear();let a=0,s=0;const e=p=>{var M,S;if(!p||da.has(p.uuid))return;da.add(p.uuid);const g=p.image,m=(M=p.source)==null?void 0:M.data,w=(g==null?void 0:g.width)||(m==null?void 0:m.width)||0,f=(g==null?void 0:g.height)||(m==null?void 0:m.height)||0,v=((S=g==null?void 0:g.data)==null?void 0:S.byteLength)||(w>0&&f>0?w*f*4:0),b=p.generateMipmaps?1.333:1;s+=v*b};y.traverse(p=>{var w,f,v;const g=p.geometry;if(g&&!ha.has(g.uuid)){ha.add(g.uuid);const b=g.attributes;if(b)for(const M in b){const S=b[M];(w=S==null?void 0:S.array)!=null&&w.byteLength&&(a+=S.array.byteLength)}(v=(f=g.index)==null?void 0:f.array)!=null&&v.byteLength&&(a+=g.index.array.byteLength)}const m=p.material;if(m)if(Array.isArray(m))for(let b=0;b<m.length;b++){const M=m[b];for(let S=0;S<va.length;S++)e(M[va[S]])}else{const b=m;for(let M=0;M<va.length;M++)e(b[va[M]])}}),e(y.environment);let n=0;if(t.shadowMapSize>0){const p=Math.max(1,t.shadowCasters??1);n+=t.shadowMapSize*t.shadowMapSize*4*p}if(t.postProcessingActive){const p=Math.max(1,Math.floor(t.viewportWidth*t.pixelRatio)),g=Math.max(1,Math.floor(t.viewportHeight*t.pixelRatio)),m=8,w=Math.max(1,t.msaaSamples||1);n+=p*g*m*(w+1),n+=p*g*4,t.ssaoEnabled&&(n+=p*g*8),t.bloomEnabled&&(n+=p*g*m*.25*1.333)}let o=null,l=null;if(typeof performance<"u"){const p=performance.memory;p&&typeof p.usedJSHeapSize=="number"&&(o=+(p.usedJSHeapSize/1048576).toFixed(1)),p&&typeof p.totalJSHeapSize=="number"&&(l=+(p.totalJSHeapSize/1048576).toFixed(1))}let u=null;if(typeof navigator<"u"){const p=navigator.deviceMemory;typeof p=="number"&&p>0&&(u=p)}const d=ha.size,r=da.size;ha.clear(),da.clear();const i=+(a/1048576).toFixed(2),h=+(s/1048576).toFixed(2),c=+(n/1048576).toFixed(2);return{jsHeapUsedMB:o,jsHeapTotalMB:l,deviceMemoryGb:u,estimatedGeoVramMB:i,estimatedTexVramMB:h,estimatedRenderTargetVramMB:c,estimatedTotalVramMB:+(i+h+c).toFixed(2),uniqueGeometries:d,uniqueTextures:r}}function is(y,t){const a=y%t;return a<0?a+t:a}function Ze(y,t,a,s){const e=is(y,a),n=is(t,a);let o=e*374761393+n*668265263+s*1442695041|0;return o=Math.imul(o^o>>>13,1274126177),((o^o>>>16)>>>0)/4294967296}function uo(y,t,a,s){const e=y*a,n=t*a,o=Math.floor(e),l=Math.floor(n),u=e-o,d=n-l,r=u*u*(3-2*u),i=d*d*(3-2*d),h=Ze(o,l,a,s),c=Ze(o+1,l,a,s),p=Ze(o,l+1,a,s),g=Ze(o+1,l+1,a,s);return h+(c-h)*r+(p-h)*i+(h-c-p+g)*r*i}function Zt(y,t,a,s,e){let n=0,o=.5,l=0,u=a;for(let d=0;d<s;d++)n+=uo(y,t,u,e+d*97)*o,l+=o,u*=2,o*=.5;return l>0?n/l:.5}function Ye(y,t,a,s){const e=y*a,n=t*a,o=Math.floor(e),l=Math.floor(n);let u=999,d=999,r=0;for(let i=-1;i<=1;i++)for(let h=-1;h<=1;h++){const c=o+h,p=l+i,g=Ze(c,p,a,s),m=Ze(c,p,a,s+7919),w=c+.15+g*.7-e,f=p+.15+m*.7-n,v=Math.hypot(w,f);v<u?(d=u,u=v,r=Ze(c,p,a,s+31337)):v<d&&(d=v)}return{f1:Math.min(1,u),f2:Math.min(1,d),edge:Math.min(1,Math.max(0,d-u)),cellId:r}}class it{static setLeanTextureMode(t){this.leanTextureMode=t}static isLeanTextureMode(){return this.leanTextureMode||Rs()}static getSurfaceMapResolution(){return this.isLeanTextureMode()?64:128}static clearSurfaceCache(){this.surfaceMapCache.clear(),this.waterPrimaryNormal=null,this.waterSecondaryNormal=null,this.furNormalTex=null,this.citrusNormalTex=null}static registerManagedTexture(t){return this.managedTextures.add(t),this.applyFilterStateToTexture(t),t}static unregisterManagedTexture(t){t&&this.managedTextures.delete(t)}static pruneNonSharedManagedTextures(){var t;for(const a of Array.from(this.managedTextures))(t=a.userData)!=null&&t.sharedAsset||this.managedTextures.delete(a)}static getRegisteredTextureCount(){return this.managedTextures.size}static applyGlobalTextureFiltering(t,a,s){const e=Math.max(1,Math.min(s,a)),n=t==="trilinear_aniso"?e:1,o=`${t}:${n}`;if(o!==this.lastAppliedFilterKey){this.lastAppliedFilterKey=o,this.currentFilterMode=t,this.currentAnisotropy=n;for(const l of this.managedTextures)this.applyFilterStateToTexture(l)}}static applyFilterStateToTexture(t){if(t.userData.__isContactShadow){t.minFilter=we,t.magFilter=we,t.anisotropy=1;return}this.currentFilterMode==="nearest_retro"?(t.generateMipmaps=!1,t.minFilter=es,t.magFilter=es,t.anisotropy=1):this.currentFilterMode==="bilinear"?(t.generateMipmaps=!1,t.minFilter=we,t.magFilter=we,t.anisotropy=1):(t.generateMipmaps=!0,t.minFilter=Vs,t.magFilter=we,t.anisotropy=this.currentAnisotropy),t.needsUpdate=!0}static bakePbrDataMapsFromHeightfield(t,a,s,e,n,o,l=!1){const u=new Float32Array(t*t);for(let g=0;g<t;g++){const m=g/t;for(let w=0;w<t;w++){const f=w/t;u[g*t+w]=n(f,m)}}const d=new Uint8Array(t*t*4),r=l?null:new Uint8Array(t*t*4),i=o?new Uint8Array(t*t*4):null,h=[128,128,128];for(let g=0;g<t;g++){const m=g===0?t-1:g-1,w=g===t-1?0:g+1;for(let f=0;f<t;f++){const v=f===0?t-1:f-1,b=f===t-1?0:f+1,M=g*t+f,S=M*4,A=u[m*t+v],P=u[m*t+f],C=u[m*t+b],T=u[g*t+v],_=u[M],W=u[g*t+b],j=u[w*t+v],Y=u[w*t+f],z=u[w*t+b],N=C+2*W+z-(A+2*T+j),F=j+2*Y+z-(A+2*P+C);let L=-N*a,V=-F*a,U=1;const I=1/Math.hypot(L,V,U);L*=I,V*=I,U*=I,d[S]=Math.max(0,Math.min(255,Math.round((L*.5+.5)*255))),d[S+1]=Math.max(0,Math.min(255,Math.round((V*.5+.5)*255))),d[S+2]=Math.max(0,Math.min(255,Math.round((U*.5+.5)*255))),d[S+3]=255;let E=1;if(r||o){const J=(A+P+C+T+W+j+Y+z)*.125,at=Math.max(0,J-_);E=Math.max(.28,Math.min(1,1-at*5.2-(1-_)*.18))}if(r){const J=Math.round(E*255),at=Math.min(1,Math.hypot(N,F)*1.5),et=q.clamp(s+(.5-_)*e+at*.08,.06,.98),tt=Math.round(et*255);r[S]=J,r[S+1]=tt,r[S+2]=J,r[S+3]=255}o&&i&&(o(f/t,g/t,_,E,h),i[S]=Math.max(0,Math.min(255,Math.round(h[0]))),i[S+1]=Math.max(0,Math.min(255,Math.round(h[1]))),i[S+2]=Math.max(0,Math.min(255,Math.round(h[2]))),i[S+3]=255)}}const c=g=>{const m=new ma(g,t,t,fa);return m.colorSpace=Ya,m.wrapS=Qt,m.wrapT=Qt,m.userData.sharedAsset=!0,this.registerManagedTexture(m),m};let p=null;return i&&(p=new ma(i,t,t,fa),p.colorSpace=Ke,p.wrapS=Qt,p.wrapT=Qt,p.userData.sharedAsset=!0,this.registerManagedTexture(p)),{albedoData:p,normal:c(d),orm:r?c(r):null}}static getSurfaceMaps(t,a,s){const e=this.surfaceMapCache.get(t);if(e)return e;a&&(a.userData.sharedAsset=!0,this.registerManagedTexture(a)),s&&(s.userData.sharedAsset=!0,this.registerManagedTexture(s));const n=this.getSurfaceMapResolution();let o;t==="cobble"?o=this.bakePbrDataMapsFromHeightfield(n,3.2,.64,.26,(r,i)=>{const h=Ye(r,i,10,419),c=q.smoothstep(h.edge,.025,.14),p=Zt(r,i,24,3,911)*.22;return c*(.74+p+h.cellId*.08)},(r,i,h,c,p)=>{const g=Ye(r,i,10,419);if(g.edge<.055)p[0]=92*c,p[1]=88*c,p[2]=82*c;else{const w=(g.cellId-.5)*26,f=(Zt(r,i,32,2,733)-.5)*18,v=(158+h*34+f)*(.72+.28*c);p[0]=v+w*.65,p[1]=v-4+w*.25,p[2]=v-12-w*.35}}):t==="grass"?o=this.bakePbrDataMapsFromHeightfield(n,2.2,.78,.22,(r,i)=>{const h=Ye(r,i,18,101),c=Zt(r*1.4,i*3.2,24,3,211);return(1-h.f1*.45)*.55+c*.45}):t==="sand"?o=this.bakePbrDataMapsFromHeightfield(n,1.85,.68,.2,(r,i)=>{const h=.5+.5*Math.sin(i*Math.PI*16+Zt(r,i,6,2,307)*2.4),c=Zt(r,i,48,2,331);return h*.65+c*.35}):t==="mountain"?o=this.bakePbrDataMapsFromHeightfield(n,3.6,.84,.22,(r,i)=>{const h=1-Math.abs(Zt(r+i*.35,i,10,4,503)*2-1),c=Ye(r,i,12,541).edge;return h*.68+c*.32}):t==="bark"?o=this.bakePbrDataMapsFromHeightfield(n,3.4,.88,.18,(r,i)=>{const h=Math.abs(Math.sin(r*Math.PI*18+Zt(r,i,8,3,601)*3.2)),c=Zt(r*2,i*.5,16,3,619);return h*.62+c*.38}):t==="foliage"?o=this.bakePbrDataMapsFromHeightfield(n,1.9,.44,.2,(r,i)=>{const h=Ye(r,i,14,701),c=Zt(r,i,24,3,719);return(1-h.f1*.6)*.65+c*.35}):t==="basalt"?o=this.bakePbrDataMapsFromHeightfield(n,2.9,.46,.28,(r,i)=>{const h=Ye(r,i,9,809),c=Zt(r,i,32,3,823);return q.smoothstep(h.edge,.02,.22)*.72+c*.28}):o=this.bakePbrDataMapsFromHeightfield(n,2.1,.66,.22,(r,i)=>{const h=Math.min(1,Math.abs(r*6%1-.5)*14),c=.5+.5*Math.sin(r*Math.PI*36+Zt(r,i*.25,12,3,907)*5);return h*(.68+c*.32)});const l=o.orm,u=o.albedoData??a??l,d={albedo:a??u,normal:o.normal,bump:s??l,orm:l,roughness:l,ao:l};return this.surfaceMapCache.set(t,d),d}static getWaterNormalMaps(){const t=this.isLeanTextureMode()?64:128;if(!this.waterPrimaryNormal||!this.waterSecondaryNormal){const a=this.bakePbrDataMapsFromHeightfield(t,2.45,.08,.04,(e,n)=>{const o=e*Math.PI*2,l=n*Math.PI*2,u=Math.sin(o*3+l*2)*.34,d=Math.cos(o*2-l*4)*.28,r=Zt(e,n,12,3,1201)*.38;return .5+(u+d)*.5+(r-.19)},void 0,!0);a.normal.repeat.set(18,18);const s=this.bakePbrDataMapsFromHeightfield(t,1.85,.08,.04,(e,n)=>{const o=e*Math.PI*2,l=n*Math.PI*2,u=Math.sin(o*5-l*3)*.32,d=Math.cos(o*4+l*6)*.26,r=Zt(e,n,20,2,1453)*.42;return .5+(u+d)*.5+(r-.21)},void 0,!0);s.normal.repeat.set(31,31),this.waterPrimaryNormal=a.normal,this.waterSecondaryNormal=s.normal}return{primary:this.waterPrimaryNormal,secondary:this.waterSecondaryNormal}}static getCapyFurNormalMap(){if(!this.furNormalTex){const t=this.bakePbrDataMapsFromHeightfield(this.isLeanTextureMode()?64:128,.58,.78,.1,(a,s)=>{const e=Zt(a*2,s*8,28,2,1607),n=Zt(a*4,s*4,16,2,1621);return e*.65+n*.35},void 0,!0);t.normal.repeat.set(2,2),this.furNormalTex=t.normal}return this.furNormalTex}static getCitrusPeelNormalMap(){if(!this.citrusNormalTex){const t=this.bakePbrDataMapsFromHeightfield(this.isLeanTextureMode()?64:128,2.35,.24,.14,(a,s)=>{const e=Ye(a,s,22,1801),n=q.smoothstep(e.f1,0,.42),o=Zt(a,s,24,2,1823)*.18;return n*.82+o},void 0,!0);t.normal.repeat.set(3,3),this.citrusNormalTex=t.normal}return this.citrusNormalTex}static getContactShadowTexture(){if(this.contactShadowTex)return this.contactShadowTex;const t=64,a=new Uint8Array(t*t*4);for(let e=0;e<t;e++){const n=e/(t-1)*2-1;for(let o=0;o<t;o++){const l=o/(t-1)*2-1,u=l*l+n*n,d=u>=1?0:Math.pow(1-u,2.2),r=(e*t+o)*4;a[r]=8,a[r+1]=12,a[r+2]=20,a[r+3]=Math.round(d*255)}}const s=new ma(a,t,t,fa);return s.colorSpace=Ke,s.userData.__isContactShadow=!0,s.userData.sharedAsset=!0,s.generateMipmaps=!1,s.minFilter=we,s.magFilter=we,s.needsUpdate=!0,this.managedTextures.add(s),this.contactShadowTex=s,s}static createStudioAndSkyEnvironmentMap(t,a=!1){if(a){const d=new Uint8Array(8192),r=.48,i=.74,h=.42,c=Math.hypot(r,i,h),p=r/c,g=i/c,m=h/c;for(let f=0;f<32;f++){const b=(1-f/31)*Math.PI,M=Math.sin(b),S=Math.cos(b);for(let A=0;A<64;A++){const C=A/64*Math.PI*2,T=-M*Math.sin(C),_=-M*Math.cos(C);let W,j,Y;if(S>=0){const L=Math.min(1,S);W=(.56*(1-L)+.16*L)*255,j=(.68*(1-L)+.36*L)*255,Y=(.8*(1-L)+.68*L)*255}else{const L=Math.min(1,-S*2.2);W=(.34*(1-L)+.14*L)*255,j=(.4*(1-L)+.2*L)*255,Y=(.44*(1-L)+.12*L)*255}const z=Math.max(0,T*p+S*g+_*m),N=Math.pow(z,28)*110,F=(f*64+A)*4;d[F]=Math.min(255,Math.round(W+N)),d[F+1]=Math.min(255,Math.round(j+N*.9)),d[F+2]=Math.min(255,Math.round(Y+N*.72)),d[F+3]=255}}const w=new ma(d,64,32,fa);return w.mapping=Xs,w.colorSpace=Ke,w.minFilter=we,w.magFilter=we,w.needsUpdate=!0,w}let s=null,e=null;const n=[],o=[];try{s=new Ys(t),e=new $s,e.traverse(r=>{if(r.isPointLight){const i=r;i.intensity=Math.min(i.intensity,140)}if(r.isMesh){const h=r.material;h&&typeof h.emissiveIntensity=="number"&&h.emissiveIntensity>1&&(h.emissiveIntensity=Math.min(1.1,.45+h.emissiveIntensity*.0065))}});const l=new Z(14,24,16),u=new Et({side:Fa,depthWrite:!1,vertexShader:`
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 sky = mix(vec3(0.44, 0.56, 0.70), vec3(0.12, 0.28, 0.54), clamp(y, 0.0, 1.0));
            vec3 ground = vec3(0.10, 0.14, 0.09);
            vec3 col = y >= 0.0 ? sky : mix(vec3(0.22, 0.27, 0.30), ground, clamp(-y * 2.4, 0.0, 1.0));
            float sunDot = max(0.0, dot(normalize(vDir), normalize(vec3(0.48, 0.74, 0.42))));
            col += vec3(0.36, 0.30, 0.22) * pow(sunDot, 16.0);
            col = min(col, vec3(1.12));
            gl_FragColor = vec4(col, 1.0);
          }
        `});return n.push(l),o.push(u),e.add(new D(l,u)),s.fromScene(e,.06).texture}catch{return null}finally{for(const l of n)l.dispose();for(const l of o)l.dispose();e&&e.traverse(l=>{var u,d;if(l.isMesh){const r=l;(u=r.geometry)==null||u.dispose(),Array.isArray(r.material)?r.material.forEach(i=>i.dispose()):(d=r.material)==null||d.dispose()}}),s==null||s.dispose()}}static prepareGeometryForPbr(t){const a=t.getAttribute("uv");if(a&&(t.getAttribute("uv1")||t.setAttribute("uv1",a),t.getAttribute("uv2")||t.setAttribute("uv2",a)),a&&t.getAttribute("position")&&t.getAttribute("normal")&&t.index)try{t.computeTangents()}catch{}return t}}x(it,"managedTextures",new Set),x(it,"surfaceMapCache",new Map),x(it,"waterPrimaryNormal",null),x(it,"waterSecondaryNormal",null),x(it,"furNormalTex",null),x(it,"citrusNormalTex",null),x(it,"contactShadowTex",null),x(it,"currentFilterMode","trilinear_aniso"),x(it,"currentAnisotropy",8),x(it,"lastAppliedFilterKey",""),x(it,"leanTextureMode",!1);const rs=["map","normalMap","roughnessMap","metalnessMap","aoMap","emissiveMap","alphaMap","bumpMap","clearcoatNormalMap","envMap","lightMap","displacementMap","specularMap","transmissionMap"];function Ra(y,t){var a;y&&y instanceof Fs&&!((a=y.userData)!=null&&a.sharedAsset)&&!t.has(y)&&(t.add(y),y.dispose())}function ls(y,t,a){var n;if(!y||(n=y.userData)!=null&&n.sharedAsset||t.has(y))return;t.add(y);const s=y;for(let o=0;o<rs.length;o++)Ra(s[rs[o]],a);const e=y;if(e.uniforms&&typeof e.uniforms=="object"){const o=Object.keys(e.uniforms);for(let l=0;l<o.length;l++){const u=e.uniforms[o[l]];if(!u)continue;const d=u.value;if(d instanceof Fs)Ra(d,a);else if(Array.isArray(d))for(let r=0;r<d.length;r++)Ra(d[r],a)}}y.dispose()}function ka(y,t,a){if(y)if(Array.isArray(y))for(let s=0;s<y.length;s++)ls(y[s],t,a);else ls(y,t,a)}function qe(y){if(!y)return;const t=new Set,a=new Set,s=new Set;for(y.traverse(e=>{var l,u,d;const n=e,o=n.geometry;if(o&&typeof o.dispose=="function"&&!((l=o.userData)!=null&&l.sharedAsset)&&!s.has(o)&&(s.add(o),o.dispose()),ka(n.material,t,a),e.isInstancedMesh){const r=e;typeof r.dispose=="function"&&!((u=r.userData)!=null&&u.sharedAsset)&&r.dispose()}if(e.userData){e.userData.__occMaterial&&(ka(e.userData.__occMaterial,t,a),e.userData.__occMaterial=void 0),e.userData.__origMaterial&&(ka(e.userData.__origMaterial,t,a),e.userData.__origMaterial=void 0);const r=e.userData.__sourceGeometry;r&&typeof r.dispose=="function"&&!((d=r.userData)!=null&&d.sharedAsset)&&!s.has(r)&&(s.add(r),r.dispose(),e.userData.__sourceGeometry=void 0)}});y.children.length>0;)y.remove(y.children[y.children.length-1])}const qa=.86,Ka=1.08,Qa=.82,ho=.52;function Xo(y,t=Ka,a=48,s=qa,e=Qa){const n=Math.max(1,Math.floor(Number.isFinite(y)?y:1)),o=Math.max(0,n-1),l=Math.max(1,Math.min(a,1+o)),u=+(1.75+s+e+Math.max(0,l-1)*t).toFixed(2);return{collectedBackFruits:o,bodySegments:l,lengthMeters:u}}function Yo(y,t,a,s){const e=s.strideRadius,n=s.fallbackRateRadPerSec??9.5;if(t>.0015){const o=t/Math.max(.08,e);return y+Math.max(o,s.hasWalkIntent?a*3.5:0)}return(s.isAirborne||s.isSwimming)&&s.hasWalkIntent?y+a*n:y}function $o(y,t,a=.4,s=1,e){const n=e??{hipPitch:0,kneePitch:0,anklePitch:0,hipDropFactor:1,suspensionBounce:0,pelvicRoll:0},o=Math.PI*2,l=(y%o+o)%o,u=o*.42,d=a*Math.max(.25,Math.min(1.35,s));let r,i,h,c=0;if(l<u){const m=l/u,w=Math.sin(m*Math.PI),f=Math.cos(m*Math.PI);r=t*f*d,i=-t*w*(.76*Math.min(1.2,s)),h=-(r*.65+i*.52)+t*w*.14,c=w}else{const m=(l-u)/(o-u),w=-Math.cos(m*Math.PI);r=t*w*d*.94;const f=Math.sin(m*Math.PI);i=t*f*.11,h=-(r+i)*.96,c=0}const p=Math.cos(r),g=Math.cos(r+i);return n.hipPitch=r,n.kneePitch=i,n.anklePitch=h,n.hipDropFactor=.49*p+.51*g,n.suspensionBounce=-.022*Math.sin(l*2)*Math.min(1,s),n.pelvicRoll=.042*Math.sin(l)*Math.min(1,s)+c*.008,n}function cs(y){let t=y%(Math.PI*2);return t>Math.PI&&(t-=Math.PI*2),t<-Math.PI&&(t+=Math.PI*2),t}function jo(y,t,a,s,e,n=Ka,o=qa,l=Qa,u=ho,d=!0){if(s<2)return;const r=i=>i===0?o:i===s-2?l:n;if(e){const i=s-1;for(let h=i;h>=1;h--){const c=h-1,p=r(c);let g=y[c]-y[h],m=t[c]-t[h],w=Math.hypot(g,m);w<1e-4&&(g=Math.sin(a[h]),m=Math.cos(a[h]),w=1);const f=Math.max(p*.96,Math.min(p,w)),v=g/w,b=m/w,M=w-f;if(d&&h===i)y[c]-=v*M,t[c]-=b*M;else{const C=d?.16:.35,T=1-C;y[h]+=v*M*C,t[h]+=b*M*C,y[c]-=v*M*T,t[c]-=b*M*T}g=y[c]-y[h],m=t[c]-t[h];const S=Math.atan2(g,m),A=a[h],P=cs(S-A);if(Math.abs(P)>u){const C=A+Math.sign(P)*u,T=y[h]+Math.sin(C)*p,_=t[h]+Math.cos(C)*p;y[c]+=(T-y[c])*.9,t[c]+=(_-t[c])*.9,a[c]=C}else a[c]=S}}else for(let i=1;i<s;i++){const h=r(i-1);let c=y[i-1]-y[i],p=t[i-1]-t[i],g=Math.hypot(c,p);g<1e-4&&(c=Math.sin(a[i-1]),p=Math.cos(a[i-1]),g=1);const m=Math.max(h*.96,Math.min(h,g)),w=c/g,f=p/g,v=g-m;if(d&&i===1)y[i]+=w*v,t[i]+=f*v;else{const A=d?.14:.35,P=1-A;y[i-1]-=w*v*A,t[i-1]-=f*v*A,y[i]+=w*v*P,t[i]+=f*v*P}c=y[i-1]-y[i],p=t[i-1]-t[i];const b=Math.atan2(c,p),M=a[i-1],S=cs(b-M);if(Math.abs(S)>u){const A=M+Math.sign(S)*u,P=y[i-1]-Math.sin(A)*h,C=t[i-1]-Math.cos(A)*h;y[i]+=(P-y[i])*.9,t[i]+=(C-t[i])*.9,a[i]=A}else a[i]=b}}function Zo(y,t,a=.85,s=.42){const e=-Math.atan2(y-t,Math.max(.25,a));return e>s?s:e<-s?-s:e}function po(y,t,a,s,e,n,o=3,l){const u=l??{x:y,y:t,z:a},d=y-s,r=t-e,i=a-n;if(d*d+r*r+i*i>=o*o)return u.x=y,u.y=t,u.z=a,u;const c=Math.hypot(d,i);if(c<.001)u.x=s+o,u.y=t,u.z=n;else{const p=(o+.35)/c;u.x=s+d*p,u.y=t,u.z=n+i*p}return u}function qo(y,t,a,s,e,n,o,l=Ka,u=qa,d=Qa,r=.44){if(e<2)return;const i=p=>p===0?u:p===e-2?d:l,h=Math.min(1,Math.max(.05,o*18)),c=e-1;for(let p=0;p<c;p++){const g=n?e-2-p:1+p,m=n?g+1:g-1,f=i(n?g:m),v=s[g],b=Math.max(0,t[m]-s[m]),M=Math.min(1,b/.48),S=t[m]-.04,A=v*.65+t[m]*.35,P=Math.max(v,A*(1-M)+S*M);let C=t[g]+(P-t[g])*h;const T=f*r,_=Math.max(v,t[m]-T),W=Math.max(v,t[m]+T);C<_?C=_:C>W&&(C=W),t[g]=C;const j=y[m]-y[g],Y=t[m]-t[g],z=a[m]-a[g],N=Math.hypot(j,Y,z),F=f*1.04;if(N>F&&N>1e-4){const L=(N-F)/N;y[g]+=j*L*.85,a[g]+=z*L*.85,t[g]=Math.max(v,t[g]+Y*L*.35)}}}const qt=new Ct,ba={x:0,y:0,z:0},$e=new X(.4,.8,.35),pa=new K,sa=new K,Oa=new K,mo=new K,fo=new K;new K;const us=new K(5078031),hs=new K,Ba=new K(10741301),ds=new ot(1280,720),go=new ot(.5,.5),ps=new Ts(.5,.5,10,.16),ms=new Ts(.5,.42,10.4,.08),xa=new X(.4,.8,.35).normalize(),Sa=new K(16775920),Ca={value:1},fs={value:0};function Ko(y){var n,o,l;if(y.userData.__occUniforms&&((n=y.userData.__occUniforms.uCapyViewport)==null?void 0:n.value)===ds&&((o=y.userData.__occUniforms.uCapySightHead)==null?void 0:o.value)===ps&&((l=y.userData.__occUniforms.uCapySightTail)==null?void 0:l.value)===ms)return y.userData.__occUniforms;y.userData.__origTransparent===void 0&&(y.userData.__origTransparent=y.transparent),y.userData.__origOpacity===void 0&&(y.userData.__origOpacity=y.opacity),y.userData.__origDepthWrite===void 0&&(y.userData.__origDepthWrite=y.depthWrite);const t={uCapyOccBlend:{value:0},uCapyOccBounds:{value:new X(.5,.5,.85)},uCapyViewport:{value:ds},uCapyHeadUv:{value:go},uCapySightHead:{value:ps},uCapySightTail:{value:ms}};y.userData.__occUniforms=t,y.userData.__occBlend=0,y.userData.__centerScreenOpacity=1,y.userData.__edgeOutlineMaxOpacity=1,y.transparent=!!(y.userData.__origTransparent??y.transparent),y.depthWrite=!!(y.userData.__origDepthWrite??!0);const a=y.type,s=y.onBeforeCompile,e=y.customProgramCacheKey;return y.customProgramCacheKey=()=>{const u=typeof e=="function"?e.call(y):"";return u?`${u}|capy_occ_bayer_dither_v3_${a}`:`capy_occ_bayer_dither_v3_${a}`},y.onBeforeCompile=(u,d)=>{typeof s=="function"&&s.call(y,u,d),u.uniforms.uCapyOccBlend=t.uCapyOccBlend,u.uniforms.uCapyOccBounds=t.uCapyOccBounds,u.uniforms.uCapyViewport=t.uCapyViewport,u.uniforms.uCapyHeadUv=t.uCapyHeadUv,u.uniforms.uCapySightHead=t.uCapySightHead,u.uniforms.uCapySightTail=t.uCapySightTail,u.fragmentShader=`uniform float uCapyOccBlend;
float capyBayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}
float capyBayer4(vec2 fragXy) {
  vec2 cell = floor(mod(fragXy, 4.0));
  return capyBayer2(floor(cell * 0.5)) * 0.25 + capyBayer2(mod(cell, 2.0));
}
float capyComputeThirdPersonOccDensity() {
  float fragViewDepth = 1.0 / max(gl_FragCoord.w, 0.0001);
  float lensAlpha = smoothstep(0.55, 2.20, fragViewDepth);
  float targetVis = 0.25 * lensAlpha;
  return mix(1.0, targetVis, clamp(uCapyOccBlend, 0.0, 1.0));
}
`+u.fragmentShader.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
        if (uCapyOccBlend > 0.001) {
          float capyOccVis = capyComputeThirdPersonOccDensity();
          if (capyOccVis < 0.995) {
            float capyDitherThresh = capyBayer4(gl_FragCoord.xy) + 0.03125;
            if (capyOccVis <= capyDitherThresh) {
              discard;
            }
          }
        }`)},t}function Qo(y,t,a,s,e,n,o,l,u,d,r,i=u,h=d-.06,c=.28){return so(y,t,a,u,d,i,h,c,o,l,r)}function Aa(y,t){const a=Math.sin(y*127.1+t*311.7)*43758.5453123;return a-Math.floor(a)}function wo(y,t){const a=Math.floor(y),s=Math.floor(t),e=y-a,n=t-s,o=e*e*(3-2*e),l=n*n*(3-2*n),u=Aa(a,s),d=Aa(a+1,s),r=Aa(a,s+1),i=Aa(a+1,s+1);return u+(d-u)*o+(r-u)*l+(u-d-r+i)*o*l}function Mo(y,t){let a=0,s=1,e=.018,n=1;for(let o=0;o<5;o++){let l=1-Math.abs(wo(y*e,t*e)*2-1);l=l*l*n,n=q.clamp(l*1.8,0,1),a+=l*s,e*=2.12,s*=.48}return a}const vt=class vt{constructor(t,a,s,e,n,o=!1){x(this,"skyMesh");x(this,"skyMaterial");x(this,"mountainMesh",new H);x(this,"alpineMountainsBuilt",!1);x(this,"cloudGroup",new H);x(this,"weatherMesh");x(this,"isSoftwareGl");x(this,"sunLight");x(this,"moonLight");x(this,"hemiLight");x(this,"ambientLight");x(this,"timeOfDayHours",9.5);x(this,"activeWeather","clear");x(this,"currentNightFactor",0);x(this,"currentDuskFactor",0);x(this,"activeShadowCaster","sun");x(this,"currentDayPhaseLabel","Daylight");x(this,"currentIblEnvIntensity",1.15);x(this,"currentSunDir",new X(.4,.8,.35).normalize());x(this,"currentMoonDir",new X(-.4,.6,.35).normalize());x(this,"currentHorizonSkyColor",new K(12248829));x(this,"lastAmbientIntensity",.28);x(this,"lastHemiIntensity",.62);x(this,"lastSunIntensity",2.6);x(this,"lastMoonIntensity",0);x(this,"lastExposure",1.02);x(this,"weatherAutoTimer",0);x(this,"lightningFlash",0);x(this,"elapsedSeconds",0);x(this,"maxWeatherParticles");x(this,"pX");x(this,"pY");x(this,"pZ");x(this,"pSpeed");x(this,"maxSplashDroplets",96);x(this,"sX",new Float32Array(96));x(this,"sY",new Float32Array(96));x(this,"sZ",new Float32Array(96));x(this,"sVx",new Float32Array(96));x(this,"sVy",new Float32Array(96));x(this,"sVz",new Float32Array(96));x(this,"sLife",new Float32Array(96));x(this,"splashSpawnCursor",0);x(this,"wettableMaterials",[]);x(this,"lastAppliedWetness",-1);x(this,"maxTextureAnisotropy");x(this,"coreTexturesReady",!1);var m,w;this.ambientLight=s,this.hemiLight=e,this.sunLight=n,this.isSoftwareGl=a;const l=((w=(m=t.capabilities)==null?void 0:m.getMaxAnisotropy)==null?void 0:w.call(m))??4,u=a?1:Math.min(8,l);this.maxTextureAnisotropy=u,o||this.ensureCoreTexturesReady(),this.moonLight=new js(9684477,.25),this.moonLight.position.set(-40,55,-35),this.moonLight.castShadow=!1;const d=a?1024:2048;this.moonLight.shadow.mapSize.set(d,d),this.moonLight.shadow.camera.near=.5,this.moonLight.shadow.camera.far=260,this.moonLight.shadow.camera.left=-38,this.moonLight.shadow.camera.right=38,this.moonLight.shadow.camera.top=38,this.moonLight.shadow.camera.bottom=-38,this.moonLight.shadow.bias=-32e-5,this.moonLight.shadow.normalBias=.024,this.moonLight.shadow.radius=2.4;const r={uSunDir:{value:new X(.4,.75,.3)},uZenithColor:{value:new K(805486)},uHorizonColor:{value:new K(12248829)},uSunColor:{value:new K(16775149)},uStarIntensity:{value:0},uCloudCover:{value:.15},uTime:{value:0},uSkyAlpha:{value:1}};this.skyMaterial=new Et({side:Fa,depthWrite:!1,transparent:!0,fog:!1,uniforms:r,vertexShader:`
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,fragmentShader:`
        varying vec3 vWorldDir;
        uniform vec3 uSunDir;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform float uStarIntensity;
        uniform float uCloudCover;
        uniform float uTime;
        uniform float uSkyAlpha;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elev = clamp(dir.y, 0.0, 1.0);
          float horizonFactor = pow(1.0 - elev, 2.4);
          vec3 sky = mix(uZenithColor, uHorizonColor, horizonFactor);

          // Mie solar scattering & crisp solar disk
          float sunCos = max(0.0, dot(dir, normalize(uSunDir)));
          float mieHalo = pow(sunCos, 12.0) * 0.42 + pow(sunCos, 96.0) * 0.65;
          float sunDisk = smoothstep(0.9982, 0.9994, sunCos);
          sky += uSunColor * (mieHalo * (1.0 - uCloudCover * 0.7) + sunDisk * 2.2 * (1.0 - uCloudCover * 0.85));

          // Opposite lunar disk at night
          float moonCos = max(0.0, dot(dir, normalize(-uSunDir)));
          float moonDisk = smoothstep(0.9988, 0.9995, moonCos) * uStarIntensity;
          float moonHalo = pow(moonCos, 48.0) * 0.22 * uStarIntensity;
          sky += vec3(0.78, 0.88, 1.0) * (moonDisk * 1.4 + moonHalo);

          // Procedural high-altitude FBM cloud veil
          if (dir.y > 0.03) {
            vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.4 + vec2(uTime * 0.012, uTime * 0.006);
            float c = noise2(cloudUv) * 0.6 + noise2(cloudUv * 2.3) * 0.4;
            float cloudMask = smoothstep(0.58 - uCloudCover * 0.38, 0.88, c) * smoothstep(0.03, 0.22, dir.y);
            vec3 cloudTint = mix(uHorizonColor * 1.08, vec3(0.24, 0.27, 0.33), uCloudCover * 0.72);
            sky = mix(sky, cloudTint, cloudMask * (0.35 + uCloudCover * 0.55));
          }

          // Crisp night-sky starfield
          if (uStarIntensity > 0.02 && dir.y > 0.04) {
            vec2 starCell = floor(dir.xz / (dir.y + 0.35) * 210.0);
            float rnd = hash(starCell);
            if (rnd > 0.993) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + rnd * 90.0);
              sky += vec3(0.9, 0.95, 1.0) * twinkle * uStarIntensity * (1.0 - uCloudCover * 0.85);
            }
          }

          gl_FragColor = vec4(sky, clamp(uSkyAlpha, 0.0, 1.0));
        }
      `}),this.skyMesh=new D(new Z(720,32,20),this.skyMaterial),this.skyMesh.frustumCulled=!1,this.skyMesh.renderOrder=-50,this.mountainMesh.name="BackgroundAlpineMountains",this.mountainMesh.userData.ignoreCameraFade=!0;const i=new O({color:16317180,roughness:.92,metalness:0,transparent:!0,opacity:.78}),h=new ra(10,1);h.scale(1.8,.48,1.25);const c=a?8:16;for(let f=0;f<c;f++){const v=f/c*Math.PI*2,b=95+f%3*42,M=new H;M.position.set(Math.cos(v)*b,52+f%4*7,Math.sin(v)*b);for(let S=0;S<3;S++){const A=new D(h,i);A.position.set((S-1)*11,S%2*2.5,(S-1)*4),A.scale.setScalar(.75+(f+S)%3*.25),M.add(A)}this.cloudGroup.add(M)}this.maxWeatherParticles=a?260:780,this.pX=new Float32Array(this.maxWeatherParticles),this.pY=new Float32Array(this.maxWeatherParticles),this.pZ=new Float32Array(this.maxWeatherParticles),this.pSpeed=new Float32Array(this.maxWeatherParticles);const p=new rt(.018,.024,.85,4),g=new pe({color:14412542,transparent:!0,opacity:.62,depthWrite:!1});this.weatherMesh=new kt(p,g,this.maxWeatherParticles),this.weatherMesh.frustumCulled=!1,this.weatherMesh.count=0;for(let f=0;f<this.maxWeatherParticles;f++)this.pX[f]=(Math.random()-.5)*68,this.pY[f]=Math.random()*28,this.pZ[f]=(Math.random()-.5)*68,this.pSpeed[f]=17+Math.random()*9}static setLeanTextureMode(t){this.leanTextureMode=t}static createSubdividedWaterDiscGeometry(t,a=36,s=12){const e=1+a*s,n=new Float32Array(e*3),o=new Float32Array(e*3),l=new Float32Array(e*2),u=[];n[0]=0,n[1]=0,n[2]=0,o[0]=0,o[1]=1,o[2]=0,l[0]=.5,l[1]=.5;let d=1;for(let h=1;h<=s;h++){const c=h/s,p=t*c;for(let g=0;g<a;g++){const m=g/a*Math.PI*2,w=Math.cos(m),f=Math.sin(m),v=w*p,b=f*p;n[d*3]=v,n[d*3+1]=0,n[d*3+2]=b,o[d*3]=0,o[d*3+1]=1,o[d*3+2]=0,l[d*2]=.5+w*c*.5,l[d*2+1]=.5+f*c*.5,d++}}for(let h=0;h<a;h++){const c=(h+1)%a;u.push(0,1+c,1+h)}for(let h=1;h<s;h++){const c=1+(h-1)*a,p=1+h*a;for(let g=0;g<a;g++){const m=(g+1)%a,w=c+g,f=c+m,v=p+g,b=p+m;u.push(w,f,b),u.push(w,b,v)}}const r=new ct;r.setAttribute("position",new B(n,3)),r.setAttribute("normal",new B(o,3));const i=new B(l,2);return r.setAttribute("uv",i),r.setAttribute("uv2",i),r.setIndex(u),it.prepareGeometryForPbr(r),r}static createWaterRippleDataTexture(t){if(this.sharedRippleDataTexture)return this.sharedRippleDataTexture;const a=t??new Uint8Array(576*4);if(!t)for(let e=0;e<576;e++)a[e*4]=128,a[e*4+1]=128,a[e*4+2]=128,a[e*4+3]=255;const s=new ma(a,24,24,fa);return s.minFilter=we,s.magFilter=we,s.wrapS=as,s.wrapT=as,s.generateMipmaps=!1,s.needsUpdate=!0,s.userData.sharedAsset=!0,this.sharedRippleDataTexture=s,it.registerManagedTexture(s),s}static createOceanWaterMaterial(t){const a=it.getWaterNormalMaps();if(t)return new O({color:223649,roughness:.16,metalness:.04,envMapIntensity:.68,normalMap:a.primary,normalScale:new ot(.55,.55)});const s=new _e({color:223649,roughness:.16,metalness:0,ior:1.333,reflectivity:.55,specularIntensity:.45,clearcoat:0,envMapIntensity:.68,normalMap:a.primary,normalScale:new ot(.62,.62)});return vt.installOceanSunGlintShader(s),s}static createRipplingWaterMaterial(t,a){const s=it.getWaterNormalMaps();if(!!(a!=null&&a.isSoftwareGl))return new O({color:(a==null?void 0:a.colorHex)??959977,roughness:.16,metalness:.04,envMapIntensity:.65,normalMap:s.primary,normalScale:new ot(.52,.52),transparent:!0,opacity:(a==null?void 0:a.opacity)??.84,depthWrite:!1});const n=new _e({color:(a==null?void 0:a.colorHex)??959977,roughness:.16,metalness:0,ior:1.333,reflectivity:.55,specularIntensity:.45,clearcoat:0,envMapIntensity:.68,normalMap:s.primary,normalScale:new ot(.55,.55),transparent:!0,opacity:(a==null?void 0:a.opacity)??.84,depthWrite:!1}),o={uRippleTex:{value:t},uWaterTime:{value:0},uRippleAmp:{value:(a==null?void 0:a.rippleAmp)??.09},uWaterSunDir:{value:xa},uWaterSunColor:{value:Sa},uWaterSunStrength:Ca};return n.userData.__waterUniforms=o,n.customProgramCacheKey=()=>"capy_pbr_water_ripple_sunglint_v2",n.onBeforeCompile=l=>{l.uniforms.uRippleTex=o.uRippleTex,l.uniforms.uWaterTime=o.uWaterTime,l.uniforms.uRippleAmp=o.uRippleAmp,l.uniforms.uWaterSunDir=o.uWaterSunDir,l.uniforms.uWaterSunColor=o.uWaterSunColor,l.uniforms.uWaterSunStrength=o.uWaterSunStrength,l.vertexShader=`uniform sampler2D uRippleTex;
uniform float uWaterTime;
uniform float uRippleAmp;
varying vec2 vRippleUv;
varying vec3 vWaterWorldPos;
`+l.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
          vRippleUv = uv;
          vec4 rSamp = texture2D(uRippleTex, clamp(uv, 0.02, 0.98));
          float fluidH = (rSamp.r - 0.5) * uRippleAmp * 2.4;
          float capillary = sin(position.x * 2.2 + uWaterTime * 3.1) * cos(position.z * 2.1 - uWaterTime * 2.5) * (uRippleAmp * 0.22);
          transformed.y += fluidH + capillary;
          vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`),l.fragmentShader=`uniform sampler2D uRippleTex;
uniform float uWaterTime;
uniform vec3 uWaterSunDir;
uniform vec3 uWaterSunColor;
uniform float uWaterSunStrength;
varying vec2 vRippleUv;
varying vec3 vWaterWorldPos;
`+l.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
          vec4 fragRipple = texture2D(uRippleTex, clamp(vRippleUv, 0.02, 0.98));
          vec2 waveGrad = (fragRipple.gb - 0.5) * 1.45;
          normal = normalize(normal + vec3(waveGrad.x, 0.0, waveGrad.y));`).replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
          if (uWaterSunStrength > 0.01) {
            vec3 sunW = normalize(uWaterSunDir);
            if (sunW.y > 0.02) {
              vec3 viewW = normalize(cameraPosition - vWaterWorldPos);
              vec3 halfW = normalize(sunW + viewW);
              vec2 wp = vWaterWorldPos.xz;
              float wt = uWaterTime;
              float wx1 = cos(wp.x * 3.4 + wt * 2.2) * cos(wp.y * 2.9 - wt * 1.7);
              float wz1 = sin(wp.x * 2.7 - wt * 1.9) * sin(wp.y * 3.6 + wt * 2.4);
              float wx2 = sin(wp.x * 9.5 - wp.y * 5.2 + wt * 3.5);
              float wz2 = cos(wp.x * 6.1 + wp.y * 8.8 - wt * 3.1);
              vec3 microN1 = normalize(vec3(wx1 * 0.16 + wx2 * 0.09, 1.0, wz1 * 0.16 + wz2 * 0.09));
              vec3 microN2 = normalize(vec3(wx2 * 0.24 - wx1 * 0.11, 1.0, wz2 * 0.24 + wz1 * 0.11));
              float specBroad = pow(max(dot(microN1, halfW), 0.0), 380.0);
              float specPin = pow(max(dot(microN2, halfW), 0.0), 1050.0);
              float fres = 0.35 + 0.65 * pow(1.0 - max(viewW.y, 0.0), 3.0);
              float glint = min(0.85, (specBroad * 0.45 + specPin * 0.78) * fres * uWaterSunStrength);
              reflectedLight.directSpecular += uWaterSunColor * glint;
            }
          }`)},n}static installOceanSunGlintShader(t){t.customProgramCacheKey=()=>"capy_ocean_sunglint_v2",t.onBeforeCompile=a=>{a.uniforms.uWaterTime=fs,a.uniforms.uWaterSunDir={value:xa},a.uniforms.uWaterSunColor={value:Sa},a.uniforms.uWaterSunStrength=Ca,a.vertexShader=`varying vec3 vOceanWorldPos;
`+a.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
          vOceanWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`),a.fragmentShader=`uniform float uWaterTime;
uniform vec3 uWaterSunDir;
uniform vec3 uWaterSunColor;
uniform float uWaterSunStrength;
varying vec3 vOceanWorldPos;
`+a.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
          if (uWaterSunStrength > 0.01) {
            vec3 sunW = normalize(uWaterSunDir);
            if (sunW.y > 0.02) {
              vec3 viewW = normalize(cameraPosition - vOceanWorldPos);
              vec3 halfW = normalize(sunW + viewW);
              vec2 wp = vOceanWorldPos.xz;
              float wt = uWaterTime;
              float distFade = 1.0 - smoothstep(140.0, 330.0, length(wp));
              float wx1 = cos(wp.x * 1.15 + wt * 1.6) * cos(wp.y * 0.95 - wt * 1.3);
              float wz1 = sin(wp.x * 0.92 - wt * 1.4) * sin(wp.y * 1.25 + wt * 1.7);
              float wx2 = sin(wp.x * 3.8 - wp.y * 2.7 + wt * 2.9);
              float wz2 = cos(wp.x * 2.9 + wp.y * 3.9 - wt * 2.5);
              vec3 microN1 = normalize(vec3(wx1 * 0.14 + wx2 * 0.08, 1.0, wz1 * 0.14 + wz2 * 0.08));
              vec3 microN2 = normalize(vec3(wx2 * 0.22 - wx1 * 0.10, 1.0, wz2 * 0.22 + wz1 * 0.10));
              float specBroad = pow(max(dot(microN1, halfW), 0.0), 420.0);
              float specPin = pow(max(dot(microN2, halfW), 0.0), 1150.0);
              float fres = 0.28 + 0.72 * pow(1.0 - max(viewW.y, 0.0), 3.2);
              float glint = min(0.85, (specBroad * 0.42 + specPin * 0.75) * fres * distFade * uWaterSunStrength);
              reflectedLight.directSpecular += uWaterSunColor * glint;
            }
          }`)}}ensureCoreTexturesReady(){this.coreTexturesReady||(this.coreTexturesReady=!0,vt.ensureCoreTextures(this.maxTextureAnisotropy))}static getTextureSet(t,a=8){const s=this.textureCache.get(t);if(s)return s;if(t==="cobble"){const f=it.getSurfaceMaps("cobble"),v={albedo:f.albedo,normal:f.normal,bump:f.bump,roughness:f.roughness,ao:f.ao};return v.albedo.repeat.set(8,8),v.normal.repeat.set(8,8),v.bump.repeat.set(8,8),v.roughness.repeat.set(8,8),v.ao.repeat.set(8,8),this.textureCache.set(t,v),v}const e=this.leanTextureMode?t==="grass"||t==="mountain"||t==="sand"?256:128:t==="grass"||t==="mountain"||t==="sand"?512:256,n=document.createElement("canvas");n.width=e,n.height=e;const o=n.getContext("2d"),l=document.createElement("canvas");l.width=e,l.height=e;const u=l.getContext("2d"),d=document.createElement("canvas");d.width=e,d.height=e;const r=d.getContext("2d");let i=t.charCodeAt(0)*1337+t.charCodeAt(1)*7919;const h=()=>(i=i*1664525+1013904223>>>0,i/4294967296);if(t==="grass"){o.fillStyle="#2f6f34",o.fillRect(0,0,e,e),u.fillStyle="#707070",u.fillRect(0,0,e,e),r.fillStyle="#c8c8c8",r.fillRect(0,0,e,e);for(let v=0;v<180;v++){const b=h()*e,M=h()*e,S=10+h()*28,A=o.createRadialGradient(b,M,1,b,M,S);A.addColorStop(0,h()>.3?"rgba(34, 92, 38, 0.45)":"rgba(92, 68, 42, 0.28)"),A.addColorStop(1,"rgba(47, 111, 52, 0)"),o.fillStyle=A,o.beginPath(),o.arc(b,M,S,0,Math.PI*2),o.fill()}const f=["#3f8f42","#4ea84f","#2e6b32","#65b755","#347839"];for(let v=0;v<7200;v++){const b=h()*e,M=h()*e,S=3.2+h()*6.4,A=h()*Math.PI*2;o.strokeStyle=f[v%f.length],o.lineWidth=.9+h()*1.1,o.beginPath(),o.moveTo(b,M),o.lineTo(b+Math.cos(A)*S,M+Math.sin(A)*S),o.stroke();const P=Math.floor(110+h()*135);u.strokeStyle=`rgb(${P},${P},${P})`,u.lineWidth=1.1,u.beginPath(),u.moveTo(b,M),u.lineTo(b+Math.cos(A)*S,M+Math.sin(A)*S),u.stroke()}}else if(t==="sand"){o.fillStyle="#d6b882",o.fillRect(0,0,e,e),u.fillStyle="#808080",u.fillRect(0,0,e,e),r.fillStyle="#b0b0b0",r.fillRect(0,0,e,e);for(let f=0;f<e;f+=8)o.fillStyle=f%16===0?"rgba(245,228,190,0.16)":"rgba(160,128,84,0.14)",o.fillRect(0,f,e,4),u.fillStyle=f%16===0?"rgba(210,210,210,0.22)":"rgba(90,90,90,0.22)",u.fillRect(0,f,e,4);for(let f=0;f<5200;f++){const v=h()*e,b=h()*e,M=.7+h()*2.1,S=Math.floor(165+h()*80);o.fillStyle=`rgb(${S}, ${Math.floor(S*.87)}, ${Math.floor(S*.65)})`,o.fillRect(v,b,M,M);const A=Math.floor(90+h()*150);u.fillStyle=`rgb(${A},${A},${A})`,u.fillRect(v,b,M,M)}}else if(t==="mountain"){o.fillStyle="#cbd5e1",o.fillRect(0,0,e,e),u.fillStyle="#808080",u.fillRect(0,0,e,e),r.fillStyle="#d4d4d4",r.fillRect(0,0,e,e);for(let f=0;f<420;f++){const v=h()*e,b=h()*e,M=18+h()*65,S=4+h()*16,A=Math.floor(148+h()*88);o.save(),o.translate(v,b),o.rotate(-.35+(h()-.5)*.4),o.fillStyle=`rgba(${A}, ${A-2}, ${A-5}, 0.52)`,o.fillRect(-M/2,-S/2,M,S),o.restore();const P=Math.floor(55+h()*185);u.save(),u.translate(v,b),u.rotate(-.35+(h()-.5)*.4),u.fillStyle=`rgba(${P}, ${P}, ${P}, 0.65)`,u.fillRect(-M/2,-S/2,M,S),u.restore()}}else if(t==="bark"){o.fillStyle="#4a3222",o.fillRect(0,0,e,e),u.fillStyle="#686868",u.fillRect(0,0,e,e),r.fillStyle="#e2e2e2",r.fillRect(0,0,e,e);for(let f=0;f<650;f++){const v=h()*e,b=h()*e,M=24+h()*60,S=2+h()*5,A=h()>.45;o.fillStyle=A?"#2d1c11":"#6b4932",o.fillRect(v,b,S,M),u.fillStyle=A?"#282828":"#dcdcdc",u.fillRect(v,b,S,M)}}else if(t==="foliage"){o.fillStyle="#1e5e2a",o.fillRect(0,0,e,e),u.fillStyle="#707070",u.fillRect(0,0,e,e),r.fillStyle="#8f8f8f",r.fillRect(0,0,e,e);const f=["#166534","#228b3b","#15803d","#3a9d42","#14532d"];for(let v=0;v<1100;v++){const b=h()*e,M=h()*e,S=5+h()*9,A=2.5+h()*4.5,P=h()*Math.PI;o.save(),o.translate(b,M),o.rotate(P),o.fillStyle=f[v%f.length],o.beginPath(),o.ellipse(0,0,S,A,0,0,Math.PI*2),o.fill(),o.restore();const C=Math.floor(105+h()*135);u.save(),u.translate(b,M),u.rotate(P),u.fillStyle=`rgb(${C},${C},${C})`,u.beginPath(),u.ellipse(0,0,S*.9,A*.9,0,0,Math.PI*2),u.fill(),u.restore()}}else if(t==="basalt"){o.fillStyle="#475569",o.fillRect(0,0,e,e),u.fillStyle="#808080",u.fillRect(0,0,e,e),r.fillStyle="#686868",r.fillRect(0,0,e,e);for(let f=0;f<420;f++){const v=h()*e,b=h()*e,M=4+h()*18,S=Math.floor(52+h()*68);o.fillStyle=h()>.86?"rgba(54, 108, 52, 0.42)":`rgba(${S}, ${S+6}, ${S+14}, 0.55)`,o.beginPath(),o.arc(v,b,M,0,Math.PI*2),o.fill();const A=Math.floor(60+h()*175);u.fillStyle=`rgba(${A},${A},${A},0.5)`,u.beginPath(),u.arc(v,b,M,0,Math.PI*2),u.fill()}}else{o.fillStyle="#7c4a24",o.fillRect(0,0,e,e),u.fillStyle="#808080",u.fillRect(0,0,e,e),r.fillStyle="#b4b4b4",r.fillRect(0,0,e,e);for(let f=0;f<360;f++){const v=h()*e;o.fillStyle=f%2===0?"rgba(92,52,22,0.36)":"rgba(154,98,52,0.28)",o.fillRect(v,0,1.5+h()*3,e),u.fillStyle=f%2===0?"rgba(95,95,95,0.4)":"rgba(185,185,185,0.4)",u.fillRect(v,0,2,e)}}const c=new He(n);c.colorSpace=Ke,c.wrapS=Qt,c.wrapT=Qt,c.anisotropy=a,c.userData.sharedAsset=!0;const p=new He(l);p.colorSpace=Ya,p.wrapS=Qt,p.wrapT=Qt,p.anisotropy=a,p.userData.sharedAsset=!0;const g=it.getSurfaceMaps(t,c,p),m=t==="grass"?18:t==="sand"?16:t==="mountain"?1:t==="basalt"||t==="timber"||t==="foliage"?3:2,w={albedo:c,normal:g.normal,bump:p,roughness:g.roughness,ao:g.ao};return m>1&&(w.albedo.repeat.set(m,m),w.normal.repeat.set(m,m),w.bump.repeat.set(m,m),w.roughness.repeat.set(m,m),w.ao.repeat.set(m,m)),this.textureCache.set(t,w),w}static getWaterRippleTexture(){if(this.waterNormalTex)return this.waterNormalTex;const t=this.leanTextureMode?128:256,a=document.createElement("canvas");a.width=t,a.height=t;const s=a.getContext("2d");s.fillStyle="#808080",s.fillRect(0,0,t,t);for(let n=0;n<t;n+=2)for(let o=0;o<t;o+=2){const l=o/t*Math.PI*2,u=n/t*Math.PI*2,d=Math.sin(l*4+Math.cos(u*3))*.4+Math.cos(u*5-Math.sin(l*4))*.35+Math.sin((l+u)*6)*.25,r=Math.floor(128+d*95);s.fillStyle=`rgb(${r},${r},${r})`,s.fillRect(o,n,2,2)}const e=new He(a);return e.colorSpace=Ya,e.wrapS=Qt,e.wrapT=Qt,e.repeat.set(16,16),e.userData.sharedAsset=!0,this.waterNormalTex=e,e}static getPeelBump(){if(this.peelBumpTex)return this.peelBumpTex;const t=document.createElement("canvas");t.width=128,t.height=128;const a=t.getContext("2d");a.fillStyle="#909090",a.fillRect(0,0,128,128);for(let e=0;e<400;e++){const n=e*73%128,o=e*41%128;a.fillStyle=e%2===0?"#505050":"#d0d0d0",a.fillRect(n,o,2,2)}const s=new He(t);return s.wrapS=Qt,s.wrapT=Qt,s.userData.sharedAsset=!0,this.peelBumpTex=s,s}static ensureCoreTextures(t){const a=["grass","sand","mountain","bark","foliage","basalt","timber","cobble"];for(const s of a)this.getTextureSet(s,t);it.registerManagedTexture(this.getWaterRippleTexture()),it.getWaterNormalMaps()}registerWettableMaterial(t,a){this.wettableMaterials.push({mat:t,dryRoughness:a}),this.lastAppliedWetness=-1}static buildAlpineMountainGeometry(t){const n=(t+1)*29,o=new Float32Array(n*3),l=new Float32Array(n*3),u=new Float32Array(n*2),d=[],r=new K(3829310),i=new K(9209213),h=new K(16317180),c=new K;let p=0,g=0;for(let f=0;f<=28;f++){const v=f/28,b=390+v*230,M=Math.sin(Math.pow(v,.78)*Math.PI);for(let S=0;S<=t;S++){const A=S/t,P=A*Math.PI*2,C=Math.cos(P)*b,T=Math.sin(P)*b,_=Math.pow(Math.min(1,Math.abs(Math.sin(P*2))*1.45),1.35),W=Mo(C,T),j=.72+.35*Math.sin(P*5+.8)+.2*Math.cos(P*9),Y=-1.25+W*j*M*_*52;o[p]=C,o[p+1]=Y,o[p+2]=T,Y<11?c.copy(r).lerp(i,q.clamp(Y/11,0,1)):Y<26?c.copy(i):c.copy(i).lerp(h,q.clamp((Y-24)/11,0,1)),l[p]=c.r,l[p+1]=c.g,l[p+2]=c.b,p+=3,u[g]=A*28,u[g+1]=v*10,g+=2}}for(let f=0;f<28;f++)for(let v=0;v<t;v++){const b=f*(t+1)+v,M=b+1,S=b+(t+1),A=S+1;d.push(b,M,S),d.push(M,A,S)}const m=new ct;m.setAttribute("position",new B(o,3)),m.setAttribute("color",new B(l,3));const w=new B(u,2);return m.setAttribute("uv",w),m.setAttribute("uv2",w),m.setIndex(d),m.computeVertexNormals(),it.prepareGeometryForPbr(m),m}buildAlpineMountainRange(t){const a=vt.buildAlpineMountainGeometry(t),s=vt.getTextureSet("mountain"),e=new O({vertexColors:!0,map:s.albedo,normalMap:s.normal,normalScale:new ot(1.15,1.15),roughnessMap:s.roughness,aoMap:s.ao,aoMapIntensity:.72,roughness:.86,metalness:.06});this.registerWettableMaterial(e,.86);const n=new D(a,e);return n.receiveShadow=!0,n.name="BackgroundAlpineMountains",n}createHomePool(t,a){const s=new H;s.name="CapyHomePool",s.position.set(t,0,a);const e=3.85,n=-.42,o=.16,l=.34,u=vt.getTextureSet("basalt"),d=vt.getTextureSet("sand"),r=vt.getTextureSet("timber"),i=new O({color:9741240,map:d.albedo,normalMap:d.normal,normalScale:new ot(.55,.55),roughnessMap:d.roughness,roughness:.55,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),h=new D(it.prepareGeometryForPbr(new rt(e,e-.25,.24,32)),i);h.position.set(0,-.02,0),h.receiveShadow=!0,h.userData.ignoreCameraFade=!0,s.add(h);const c=new O({color:6583435,map:u.albedo,normalMap:u.normal,normalScale:new ot(.85,.85),roughnessMap:u.roughness,aoMap:u.ao,aoMapIntensity:.65,roughness:.42,metalness:.12});this.registerWettableMaterial(c,.42);const p=[],g=20;for(let tt=0;tt<g;tt++){const st=tt/g*Math.PI*2;if(Math.abs(Math.atan2(Math.sin(st),Math.cos(st)))<.46){const ht=new D(new rt(.55,.65,.14,10),c);ht.position.set(Math.cos(st)*(e-.1),.07,Math.sin(st)*(e-.1)),ht.receiveShadow=!0,ht.userData.ignoreCameraFade=!0,s.add(ht);continue}const Q=.58,gt=new ra(Q,1),Dt=new D(gt,c),Ut=Math.cos(st)*e,ee=Math.sin(st)*e;Dt.position.set(Ut,.24,ee),Dt.scale.set(1.12,.72,1.12),Dt.rotation.set(tt*.4,st,tt*.2),Dt.castShadow=!0,Dt.receiveShadow=!0,Dt.userData.ignoreCameraFade=!0,s.add(Dt),p.push({x:t+Ut,z:a+ee,radius:.56})}const m=vt.createWaterRippleDataTexture(),w=vt.createRipplingWaterMaterial(m,{colorHex:959977,opacity:.84,rippleAmp:.09,isSoftwareGl:this.isSoftwareGl}),f=new D(vt.createSubdividedWaterDiscGeometry(e-.18,36,12),w);f.position.set(0,o+.08,0),f.receiveShadow=!0,f.renderOrder=2,f.userData.ignoreCameraFade=!0,s.add(f);const v=new O({color:11828040,map:r.albedo,normalMap:r.normal,normalScale:new ot(.65,.65),roughnessMap:r.roughness,roughness:.72});this.registerWettableMaterial(v,.72);const b=new H;b.name="HomePoolTapFixtureGroup",b.userData.__occluderRoot=b,s.add(b);const M=-e+.35,S=new D(new rt(.18,.22,2.35,12),v);S.position.set(M,1.15,0),S.castShadow=!0,b.add(S),p.push({x:t+M,z:a,radius:.28});const A=new O({color:14251782,metalness:.86,roughness:.28,envMapIntensity:.62}),P=new D(new rt(.075,.075,1.45,10),A);P.rotation.z=Math.PI/2,P.position.set(M+.72,2.02,0),P.castShadow=!0,b.add(P);const C=new D(new Da(.14,.03,8,16),A);C.rotation.x=Math.PI/2,C.position.set(M+.35,2.18,0),b.add(C);const T=M+1.38,_=new D(new rt(.085,.068,.28,10),A);_.position.set(T,1.92,0),b.add(_);const W=this.isSoftwareGl?new O({color:14742270,roughness:.18,metalness:0,transparent:!0,opacity:.78}):new _e({color:14742270,roughness:.18,metalness:0,ior:1.333,specularIntensity:.4,clearcoat:0,envMapIntensity:.62,transparent:!0,opacity:.78}),j=new D(new rt(.065,.125,1.68,12),W);j.position.set(T,1.02,0),j.userData.ignoreCameraFade=!0,s.add(j);const Y=new pe({color:15792639,transparent:!0,opacity:.8,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:Ot}),z=new D(new Ne(.14,.42,20),Y);z.rotation.x=Math.PI/2,z.position.set(T,o+.1,0),z.userData.ignoreCameraFade=!0,s.add(z);const N=new D(new Se(.36,.44,.36),v);N.position.set(M,2.52,0);const F=new D(new Z(.14,10,10),new pe({color:16707722}));F.position.set(M,2.52,0),b.add(N,F);const L=new Zs(16498468,.4,18,1.8);L.position.set(M,2.6,0),s.add(L);const V=new H;V.visible=!1;const U=this.isSoftwareGl?new O({color:223649,roughness:.08,metalness:0,transparent:!0,opacity:.85,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}):new _e({color:223649,roughness:.18,metalness:0,ior:1.333,specularIntensity:.4,clearcoat:0,envMapIntensity:.62,transparent:!0,opacity:.85,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),I=new O({color:4533278,roughness:.18,metalness:.02,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),E=[];for(let tt=0;tt<10;tt++){const st=tt/10*Math.PI*2+.25,Q=e+.85+tt%3*.55,gt=new D(new ja(1.15+tt%3*.35,18),tt%3===0?I:U);gt.rotation.x=-Math.PI/2,gt.position.set(Math.cos(st)*Q,.025+tt%3*.004,Math.sin(st)*Q),gt.scale.setScalar(.01),gt.userData.ignoreCameraFade=!0,V.add(gt),E.push(gt)}s.add(V);const J=new Z(.085,6,6),at=new O({color:14742270,roughness:.05,metalness:0}),et=new kt(J,at,this.maxSplashDroplets);et.frustumCulled=!1,et.userData.ignoreCameraFade=!0;for(let tt=0;tt<this.maxSplashDroplets;tt++)this.sLife[tt]=0,qt.position.set(0,-20,0),qt.scale.setScalar(.001),qt.updateMatrix(),et.setMatrixAt(tt,qt.matrix);return et.instanceMatrix.needsUpdate=!0,s.add(et),{group:s,tapFixtureGroup:b,centerX:t,centerZ:a,basinRadius:e,floorY:n,baseWaterY:o,rimY:l,tapStreamWorldX:t+T,tapStreamWorldZ:a,tapNozzleY:1.92,waterMesh:f,waterMat:w,tapStreamMesh:j,tapFoamRing:z,lanternLight:L,rimColliders:p,messGroup:V,messLobes:E,splashInstanced:et}}triggerPondSplashBurst(t,a=14){for(let s=0;s<a;s++){const e=this.splashSpawnCursor;this.splashSpawnCursor=(this.splashSpawnCursor+1)%this.maxSplashDroplets;const n=Math.random()*Math.PI*2,o=(t.basinRadius-.4)*(.4+Math.random()*.6);this.sX[e]=Math.cos(n)*o,this.sY[e]=t.waterMesh.position.y+.12,this.sZ[e]=Math.sin(n)*o;const l=2.6+Math.random()*4.2;this.sVx[e]=Math.cos(n)*l,this.sVy[e]=3.5+Math.random()*4.5,this.sVz[e]=Math.sin(n)*l,this.sLife[e]=.65+Math.random()*.45}}updateHomePoolEffects(t,a,s,e,n){const o=t.baseWaterY+Math.min(.28,s)+(e?Math.sin(this.elapsedSeconds*9)*.035:0);t.waterMesh.position.y=q.lerp(t.waterMesh.position.y,o,1-Math.exp(-8*a)),e?(t.waterMesh.rotation.x=Math.sin(this.elapsedSeconds*6.5)*.04,t.waterMesh.rotation.z=Math.cos(this.elapsedSeconds*5.8)*.04,this.triggerPondSplashBurst(t,3)):(t.waterMesh.rotation.x*=.9,t.waterMesh.rotation.z*=.9);const l=1+Math.sin(this.elapsedSeconds*18)*.08;t.tapStreamMesh.scale.set(l,1,l),t.tapFoamRing.position.y=t.waterMesh.position.y+.1,t.tapFoamRing.scale.setScalar(.92+Math.sin(this.elapsedSeconds*12)*.14);const u=t.waterMat.userData.__waterUniforms;u&&(u.uWaterTime.value=this.elapsedSeconds);const d=vt.getWaterRippleTexture();if(d.offset.x=this.elapsedSeconds*.045%1,d.offset.y=this.elapsedSeconds*.032%1,n>.01){t.messGroup.visible=!0;for(let i=0;i<t.messLobes.length;i++){const h=q.clamp(n*(.75+i%3*.22),.01,1.45);t.messLobes[i].scale.setScalar(h)}}else t.messGroup.visible=!1;let r=!1;for(let i=0;i<this.maxSplashDroplets;i++)this.sLife[i]<=0||(r=!0,this.sLife[i]-=a,this.sLife[i]<=0||this.sY[i]<0?(this.sLife[i]=0,qt.position.set(0,-20,0),qt.scale.setScalar(.001)):(this.sVy[i]-=16.5*a,this.sX[i]+=this.sVx[i]*a,this.sY[i]+=this.sVy[i]*a,this.sZ[i]+=this.sVz[i]*a,qt.position.set(this.sX[i],this.sY[i],this.sZ[i]),qt.scale.setScalar(.65+this.sLife[i]*.6)),qt.updateMatrix(),t.splashInstanced.setMatrixAt(i,qt.matrix));r&&(t.splashInstanced.instanceMatrix.needsUpdate=!0)}static getProceduralLeafGeometry(){if(this.sharedLeafGeo)return this.sharedLeafGeo;const t=6,a=4,s=(t+1)*(a+1),e=new Float32Array(s*3),n=new Float32Array(s*2),o=[];let l=0,u=0;for(let i=0;i<=t;i++){const h=i/t,c=h<.12?.12+h/.12*.25:1,p=Math.sin(Math.pow(h,.78)*Math.PI)*.36*c,g=1+Math.sin(h*Math.PI*10)*.045,m=Math.sin(h*Math.PI*.85)*.11-h*h*.16;for(let w=0;w<=a;w++){const f=w/a*2-1,v=Math.abs(f),b=f*p*g,M=v*.055*Math.sin(h*Math.PI),S=h*1;e[l++]=b,e[l++]=m+M,e[l++]=S,n[u++]=w/a,n[u++]=h}}const d=a+1;for(let i=0;i<t;i++)for(let h=0;h<a;h++){const c=i*d+h,p=c+1,g=c+d,m=g+1;o.push(c,g,p),o.push(p,g,m)}const r=new ct;return r.setAttribute("position",new B(e,3)),r.setAttribute("uv",new B(n,2)),r.setIndex(o),r.computeVertexNormals(),r.userData.sharedAsset=!0,this.sharedLeafGeo=r,r}static getMergedBlossomCorollaGeometry(){if(this.sharedBlossomCorollaGeo)return this.sharedBlossomCorollaGeo;const t=4,a=2,s=[],e=[];for(let m=0;m<=t;m++){const w=m/t,f=Math.sin(Math.pow(w,.7)*Math.PI)*.34,v=Math.sin(w*Math.PI)*.14;for(let b=0;b<=a;b++){const M=b/a*2-1;s.push(M*f,v-M*M*.04,w)}}const n=a+1;for(let m=0;m<t;m++)for(let w=0;w<a;w++){const f=m*n+w,v=f+1,b=f+n,M=b+1;e.push(f,b,v,v,b,M)}const o=[],l=[],u=s.length/3,d=new qs,r=new Ks(0,0,0,"XYZ"),i=new X(1.45,1.45,1.45),h=new X,c=new X,p=new Za;for(let m=0;m<5;m++){r.set(-.35,m/5*Math.PI*2+.3,0,"XYZ"),p.setFromEuler(r),d.compose(c,p,i);const w=m*u;for(let f=0;f<u;f++)h.set(s[f*3],s[f*3+1],s[f*3+2]).applyMatrix4(d),o.push(h.x,h.y,h.z);for(let f=0;f<e.length;f++)l.push(e[f]+w)}const g=new ct;return g.setAttribute("position",new ue(o,3)),g.setIndex(l),g.computeVertexNormals(),g.userData.sharedAsset=!0,this.sharedBlossomCorollaGeo=g,g}static getMergedCalyxGeometry(){if(this.sharedCalyxStarGeo)return this.sharedCalyxStarGeo;const t=[],a=.85,s=new rt(.08,.11,a,6);s.translate(0,.88+a*.42,0),t.push(s);for(let d=0;d<5;d++){const r=new ce(.12,.36,4);r.rotateX(Math.PI*.48),r.translate(0,0,.14),r.rotateY(d/5*Math.PI*2),r.translate(0,.88,0),t.push(r)}const e=[],n=[],o=[];let l=0;for(const d of t){const r=d.getAttribute("position"),i=d.getAttribute("normal");for(let c=0;c<r.count;c++)e.push(r.getX(c),r.getY(c),r.getZ(c)),n.push(i.getX(c),i.getY(c),i.getZ(c));const h=d.getIndex();if(h)for(let c=0;c<h.count;c++)o.push(h.getX(c)+l);l+=r.count,d.dispose()}const u=new ct;return u.setAttribute("position",new ue(e,3)),u.setAttribute("normal",new ue(n,3)),u.setIndex(o),u.userData.sharedAsset=!0,this.sharedCalyxStarGeo=u,u}static getUnitRibbedFruitGeometry(){if(this.sharedUnitRibbedFruitGeo)return this.sharedUnitRibbedFruitGeo;const t=16,a=24,s=[],e=[],n=[];for(let u=0;u<=t;u++){const d=u/t,r=d*Math.PI,i=Math.sin(r),h=Math.cos(r),c=1-.12*Math.pow(Math.abs(h),6);for(let p=0;p<=a;p++){const g=p/a,m=g*Math.PI*2,w=1+.036*Math.cos(m*9)*i*i,f=c*w;s.push(-f*Math.cos(m)*i*1.03,f*h*.91,f*Math.sin(m)*i*1.03),e.push(g*2,d*2)}}const o=a+1;for(let u=0;u<t;u++)for(let d=0;d<a;d++){const r=u*o+d,i=r+1,h=r+o,c=h+1;n.push(r,h,i,i,h,c)}const l=new ct;return l.setAttribute("position",new ue(s,3)),l.setAttribute("uv",new ue(e,2)),l.setIndex(n),l.computeVertexNormals(),l.userData.sharedAsset=!0,this.sharedUnitRibbedFruitGeo=l,l}appendProceduralLimbTube(t,a,s,e,n,o,l,u,d,r){const i=new oa(t),h=i.computeFrenetFrames(n,!1),c=u.length/3,p=new X;for(let m=0;m<=n;m++){const w=m/n;i.getPointAt(w,p);const f=h.normals[m],v=h.binormals[m],b=q.lerp(a,s,Math.pow(w,.78));for(let M=0;M<=e;M++){const S=M/e,A=S*Math.PI*2,P=l>0?1+l*(1-w*.75)*Math.cos(A*o+w*2.2):1,C=b*P,T=Math.cos(A),_=Math.sin(A);u.push(p.x+(T*f.x+_*v.x)*C,p.y+(T*f.y+_*v.y)*C,p.z+(T*f.z+_*v.z)*C),d.push(S*2,w*3.5)}}const g=e+1;for(let m=0;m<n;m++)for(let w=0;w<e;w++){const f=c+m*g+w,v=f+1,b=f+g,M=b+1;r.push(f,b,v,v,b,M)}}createExponentialTree(t,a,s,e,n,o){const l=Math.pow(1.48,a),u=+(.24*l).toFixed(3),d=.28*l,r=1.42*l;let i=t*977+a*313+104729>>>0;const h=()=>(i=i*1664525+1013904223>>>0,i/4294967296),c=vt.getTextureSet("bark"),p=vt.getTextureSet("foliage"),g=We[o]??We[0],m=new H;m.name=`ProceduralFruitTree_${t}_Tier${a}`,m.position.set(s,0,e),m.userData.__occluderRoot=m;const w=new O({color:g.colorHex,emissive:g.emissiveHex,emissiveIntensity:.04,roughness:.52,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),f=new D(new Ne(d*1.2,d*1.72,24),w);f.rotation.x=-Math.PI/2,f.position.y=.03,f.userData.ignoreCameraFade=!0,m.add(f);const v=new H;m.add(v);const b=new O({color:9200196,map:c.albedo,bumpMap:c.bump,bumpScale:.15,roughness:.88,side:Ot});this.registerWettableMaterial(b,.88);const M=[],S=[],A=[];let P=0;const C=(2.12+h()*.24)*l,T=(h()-.5)*.26*l,_=(h()-.5)*.26*l,W=new X(T*.85,C,_*.85);this.appendProceduralLimbTube([new X(0,-.05,0),new X(T*.35,C*.34,_*.35),new X(-T*.2,C*.68,_*.55),W],d*1.24,d*.62,12,9,5+t%3,.14,M,S,A);const j=5;for(let Mt=0;Mt<j;Mt++){const xt=Mt/j*Math.PI*2+h()*.45,St=d*(2.05+h()*.65),Wt=C*(.24+h()*.08);this.appendProceduralLimbTube([new X(Math.cos(xt)*d*.42,Wt,Math.sin(xt)*d*.42),new X(Math.cos(xt+.12)*St*.62,Wt*.32,Math.sin(xt+.12)*St*.62),new X(Math.cos(xt+.2)*St,-.04,Math.sin(xt+.2)*St)],d*.42,d*.09,7,5,3,.08,M,S,A),P++}const Y=[],z=[],N=5+(a>=2?1:0),F=2.39996323,L=h()*Math.PI*2;for(let Mt=0;Mt<N;Mt++){const xt=L+Mt*F+(h()-.5)*.28,St=.42+Mt/N*.38+(h()-.5)*.1,Wt=(1.05+h()*.32)*l,Lt=new X(W.x*(.82+.18*(Mt/N)),C*(.76+.22*(Mt/N)),W.z*(.82+.18*(Mt/N))),Xt=new X(Math.cos(xt)*Math.cos(St),Math.sin(St),Math.sin(xt)*Math.cos(St)).normalize(),Yt=Lt.clone().addScaledVector(Xt,Wt*.52).add(new X(0,.12*l,0)),It=Lt.clone().addScaledVector(Xt,Wt).add(new X(0,-.05*l,0)),Vt=d*.44;this.appendProceduralLimbTube([Lt,Yt,It],Vt,Vt*.54,8,6,4,.06,M,S,A),P++,Y.push({pos:Yt.clone(),dir:Xt.clone(),radius:.42*l});const Jt=2+Mt%2;for(let ae=0;ae<Jt;ae++){const Pe=(ae-(Jt-1)*.5)*.68+(h()-.5)*.22,ye=xt+Pe,ve=St*.72+.18+(h()-.5)*.22,be=Wt*(.58+h()*.2),se=new X(Math.cos(ye)*Math.cos(ve),Math.sin(ve),Math.sin(ye)*Math.cos(ve)).normalize(),Re=ae===0?It:Yt.clone().lerp(It,.65),Bt=Re.clone().addScaledVector(se,be*.55).add(new X(0,.05*l,0)),ut=Re.clone().addScaledVector(se,be).add(new X(0,-.11*l,0)),bt=Vt*.52;this.appendProceduralLimbTube([Re,Bt,ut],bt,bt*.36,6,5,0,0,M,S,A),P++,Y.push({pos:Bt.clone(),dir:se.clone(),radius:.36*l}),Y.push({pos:ut.clone(),dir:se.clone(),radius:.44*l}),ae===0&&z.push({pos:ut.clone(),dir:se.clone()});const dt=ye+(ae%2===0?.52:-.52),xe=new X(Math.cos(dt)*.85,.42+h()*.25,Math.sin(dt)*.85).normalize(),ta=be*.52,ke=Bt.clone().addScaledVector(xe,ta);this.appendProceduralLimbTube([Bt,ke],bt*.42,bt*.18,5,3,0,0,M,S,A),P++,Y.push({pos:ke,dir:xe,radius:.34*l})}}const V=W.clone(),U=W.clone().add(new X(0,.92*l,0));this.appendProceduralLimbTube([V,U],d*.42,d*.14,7,4,0,0,M,S,A),P++,Y.push({pos:U,dir:new X(0,1,0),radius:.52*l});const I=new ct;I.setAttribute("position",new ue(M,3)),I.setAttribute("uv",new ue(S,2)),I.setIndex(A),I.computeVertexNormals(),I.computeBoundingSphere();const E=new D(I,b);E.name="ProceduralTreeBranchSkeleton",E.userData.__ownOccluderMaterials=!0,E.castShadow=!0,E.receiveShadow=!0,v.add(E);const J=new O({color:16777215,map:p.albedo,bumpMap:p.bump,bumpScale:.08,roughness:.56,metalness:.04,side:Ot});this.registerWettableMaterial(J,.56);const at=15,et=Y.length*at,tt=new kt(vt.getProceduralLeafGeometry(),J,et);tt.name="ProceduralBotanicalLeafCanopy",tt.userData.__ownOccluderMaterials=!0,tt.castShadow=!0,tt.receiveShadow=!0;const st=[2278750,1483594,4906624,1409085,6660877],Q=new K,gt=new Ct;let Dt=0;for(let Mt=0;Mt<Y.length;Mt++){const xt=Y[Mt];for(let St=0;St<at;St++){const Wt=St*F+Mt*.7,Lt=xt.radius*(.14+.86*Math.sqrt((St+.5)/at)),Xt=(St%3-1)*.14*l;gt.position.set(xt.pos.x+Math.cos(Wt)*Lt,xt.pos.y+Xt,xt.pos.z+Math.sin(Wt)*Lt),gt.rotation.set(.22+(h()-.5)*.45,Wt+Math.PI*.5,(h()-.5)*.35);const Yt=(.46+h()*.28)*l;gt.scale.set(Yt,Yt,Yt),gt.updateMatrix(),tt.setMatrixAt(Dt,gt.matrix),Q.setHex(st[(Mt+St)%st.length]),xt.pos.y>C*1.15&&Q.lerp(Ba,.28),tt.setColorAt(Dt,Q),Dt++}}tt.instanceMatrix.needsUpdate=!0,tt.instanceColor&&(tt.instanceColor.needsUpdate=!0),tt.computeBoundingSphere(),v.add(tt);const Ut=[],ee=vt.getPeelBump(),ht=vt.getUnitRibbedFruitGeometry(),Ae=vt.getMergedBlossomCorollaGeometry(),Ee=vt.getMergedCalyxGeometry(),Je=new O({color:1467700,roughness:.62,side:Ot}),Le=new O({color:16776171,roughness:.55,metalness:0,side:Ot}),Ie=Math.min(5,z.length);for(let Mt=0;Mt<Ie;Mt++){const xt=z[Mt],St=new X(xt.pos.x,xt.pos.y-u*.75,xt.pos.z),Wt=new O({color:g.colorHex,emissive:g.emissiveHex,emissiveIntensity:0,bumpMap:ee,bumpScale:.038,roughness:.22,metalness:.03}),Lt=new H;Lt.position.copy(St);const Xt=new H,Yt=new D(Ee,Je);Yt.scale.setScalar(u),Xt.add(Yt),Lt.add(Xt);const It=new H;It.position.y=u*.72;const Vt=new D(Ae,Le);Vt.scale.setScalar(u),It.add(Vt),Lt.add(It);const Jt=new D(ht,Wt);Jt.userData.targetRadius=u,Jt.scale.setScalar(u),Jt.castShadow=!0,Jt.receiveShadow=!0,Lt.add(Jt),v.add(Lt);const ae=Mt<4?1:.18,Pe={mesh:Lt,fruitSphere:Jt,blossomGroup:It,calyxGroup:Xt,fruitMat:Wt,localOffset:St,baseY:St.y,growth:ae,growthRate:.14+Mt%3*.03,stage:ae>=.88?"ripe":"blossom"};this.applyProceduralFruitGrowthVisuals(Pe,g.colorHex),Ut.push(Pe)}return{id:t,tier:a,scale:l,fruitRadius:u,crownRadius:r,trunkHeight:C,matchesPlayerHead:n,varietyIndex:o,x:s,z:e,trunkRadius:d,branchCount:P,leafCount:et,rootGroup:m,swayPivot:v,skeletonMesh:E,leafInstancedMesh:tt,ringMat:w,swayX:0,swayZ:0,swayVelX:0,swayVelZ:0,bumpCooldown:0,slots:Ut}}applyProceduralFruitGrowthVisuals(t,a){const s=t.growth;if(hs.setHex(a),s<.28){t.stage="blossom";const d=q.smoothstep(s,.05,.24);t.blossomGroup.visible=!0,t.blossomGroup.scale.setScalar(.55+d*.65)}else if(s<.55){t.stage="ovary_bud";const d=1-q.smoothstep(s,.28,.44);t.blossomGroup.visible=d>.02,t.blossomGroup.scale.setScalar(Math.max(.01,d*1.1))}else s<.88?(t.stage="swelling",t.blossomGroup.visible=!1):(t.stage="ripe",t.blossomGroup.visible=!1);const e=q.lerp(.42,1,q.smoothstep(s,.06,.6));t.calyxGroup.scale.setScalar(e);const n=Math.max(.08,Math.pow(s,1.12)),o=q.lerp(.84,1.04,s),l=t.fruitSphere.userData.targetRadius||.24;t.fruitSphere.scale.set(l*n*o,l*n,l*n*o);const u=s*s*l*.36;if(t.mesh.position.y=t.baseY-u,t.localOffset.y=t.mesh.position.y,s<.52)t.fruitMat.color.copy(us),t.fruitMat.roughness=.46,t.fruitMat.emissiveIntensity=0;else if(s<.78){const d=(s-.52)/.26;t.fruitMat.color.copy(us).lerp(Ba,d),t.fruitMat.roughness=q.lerp(.46,.3,d),t.fruitMat.emissiveIntensity=0}else{const d=q.clamp((s-.78)/.2,0,1);t.fruitMat.color.copy(Ba).lerp(hs,d),t.fruitMat.roughness=q.lerp(.3,.21,d),t.fruitMat.emissiveIntensity=0}}tickTrees(t,a){for(let s=0;s<t.length;s++){const e=t[s];e.bumpCooldown>0&&(e.bumpCooldown-=a);const n=this.activeWeather==="storm"?.038:this.activeWeather==="rain"?.018:.008,o=Math.sin(this.elapsedSeconds*1.7+e.id)*n,l=5.5;e.swayVelX+=(-38*(e.swayX-o)-l*e.swayVelX)*a,e.swayVelZ+=(-38*e.swayZ-l*e.swayVelZ)*a,e.swayX+=e.swayVelX*a,e.swayZ+=e.swayVelZ*a,e.swayPivot.rotation.z=-e.swayX,e.swayPivot.rotation.x=e.swayZ;const u=We[e.varietyIndex]??We[0];for(let d=0;d<e.slots.length;d++){const r=e.slots[d];r.growth<1&&(r.growth=Math.min(1,r.growth+r.growthRate*a),this.applyProceduralFruitGrowthVisuals(r,u.colorHex))}}}getDayPhaseLabel(){const t=(this.timeOfDayHours%24+24)%24;return t>=5.2&&t<8?"Golden Dawn":t>=8&&t<17.2?"Daylight":t>=17.2&&t<20.2?"Crimson Dusk":"Starlight Night"}getWeatherLabel(){switch(this.activeWeather){case"clear":return"Clear Skies";case"rain":return"Warm Rain";case"storm":return"Thunderstorm";case"mist":return"Mountain Mist";case"snow":return"Alpine Snow"}}tickAtmosphereAndWeather(t,a,s,e,n,o,l,u,d,r,i=1,h=1,c=1,p=!1,g,m,w){this.elapsedSeconds+=t;const f=it.getWaterNormalMaps();if(f.primary.offset.x=this.elapsedSeconds*.018%1,f.primary.offset.y=this.elapsedSeconds*.012%1,f.secondary.offset.x=-this.elapsedSeconds*.026%1,f.secondary.offset.y=this.elapsedSeconds*.021%1,a&&h>.001?this.timeOfDayHours=(this.timeOfDayHours+t*.165*h)%24:this.timeOfDayHours=(s%24+24)%24,e==="auto"){if(this.weatherAutoTimer+=t,this.weatherAutoTimer>=28){this.weatherAutoTimer=0;const I=["clear","rain","clear","storm","snow"],J=(I.indexOf(this.activeWeather)+1)%I.length;this.activeWeather=I[J]}}else this.activeWeather=e==="mist"?"clear":e;const v=this.activeWeather==="storm"?.92:this.activeWeather==="rain"?.72:this.activeWeather==="snow"?.68:.14;this.activeWeather==="storm"?this.lightningFlash>0?this.lightningFlash=Math.max(0,this.lightningFlash-t*5.5):Math.random()<t*.35&&(this.lightningFlash=1):this.lightningFlash=0;const b=lo(this.timeOfDayHours,v,i,this.lightningFlash),M=b.dayFactor,S=b.duskFactor,A=b.nightFactor;this.currentNightFactor=A,this.currentDuskFactor=S,this.activeShadowCaster=b.activeShadowCaster,this.currentDayPhaseLabel=b.dayPhaseLabel,this.currentIblEnvIntensity=b.iblEnvIntensity,$e.set(b.sunDirX,b.sunDirY,b.sunDirZ).normalize(),this.currentSunDir.copy($e),this.currentMoonDir.set(b.moonDirX,b.moonDirY,b.moonDirZ).normalize();const P=this.sunLight.target.position;if(this.sunLight.position.set(P.x+$e.x*96,Math.max(12,$e.y*96),P.z+$e.z*96),this.moonLight.position.set(P.x+this.currentMoonDir.x*84,Math.max(14,this.currentMoonDir.y*84),P.z+this.currentMoonDir.z*84),pa.setHex(132631).lerp(mo.setHex(481669),M),sa.setHex(988970).lerp(fo.setHex(12248829),M),S>.01&&(sa.lerp(Oa.setHex(16347926),S*.72*(1-v*.6)),pa.lerp(Oa.setHex(3223169),S*.38)),v>.3){const I=Oa.setHex(M>.4?4674921:988970);pa.lerp(I,(v-.2)*.65),sa.lerp(I,(v-.2)*.65)}const C=this.skyMaterial.uniforms;C.uSunDir.value.copy($e),C.uZenithColor.value.copy(pa),C.uHorizonColor.value.copy(sa),C.uSunColor.value.setHex(S>.35?16486972:16776171),C.uStarIntensity.value=A,C.uCloudCover.value=v,C.uTime.value=this.elapsedSeconds,this.currentHorizonSkyColor.copy(sa),this.lastSunIntensity=b.sunIntensity,this.lastMoonIntensity=b.moonIntensity,this.lastHemiIntensity=b.hemiIntensity,this.lastAmbientIntensity=b.ambientIntensity,this.lastExposure=b.exposure,this.sunLight.intensity=b.sunIntensity,this.sunLight.color.setHex(S>.35?16757867:16771266),this.moonLight.intensity=b.moonIntensity,this.moonLight.color.setHex(9684477),this.hemiLight.color.copy(sa).lerp(pa,.28),this.hemiLight.groundColor.setHex(M>.3?1977370:725280),this.hemiLight.intensity=b.hemiIntensity,this.ambientLight.intensity=b.ambientIntensity,l.environmentIntensity=b.iblEnvIntensity,u.toneMappingExposure=b.exposure,b.activeShadowCaster==="moon"&&A>.25?(xa.copy(this.currentMoonDir),Sa.setHex(9684477),Ca.value=q.clamp(A*.42*(1-v*.78),0,.42)):(xa.copy($e),Sa.copy(this.sunLight.color),Ca.value=q.clamp(M*(1-v*.78),0,1)),fs.value=this.elapsedSeconds,r&&(r.intensity=b.lanternBoost+(v>.6?.55:0)),l.fog!==null&&(l.fog=null);const T=p?0:this.activeWeather==="storm"?.58:this.activeWeather==="rain"?.42:0;if(Math.abs(T-this.lastAppliedWetness)>.002){this.lastAppliedWetness=T;for(let I=0;I<this.wettableMaterials.length;I++){const E=this.wettableMaterials[I];E.mat.roughness=Math.max(.12,E.dryRoughness*(1-T))}}this.cloudGroup.visible=!p,p||(this.cloudGroup.rotation.y+=t*(this.activeWeather==="storm"?.028:.007));const _=this.activeWeather==="rain"||this.activeWeather==="storm",W=this.activeWeather==="snow";if(!_&&!W){this.weatherMesh.count=0;return}const j=this.activeWeather==="storm"?this.maxWeatherParticles:Math.floor(this.maxWeatherParticles*.65),Y=p?Math.min(120,j):j;this.weatherMesh.count=Y;const z=this.weatherMesh.material;z.color.setHex(W?16777215:12573694),z.opacity=W?.82:.52;const N=W?.24:this.activeWeather==="storm"?1.35:1,F=this.activeWeather==="storm"?.26:_?.1:0,L=g??n,V=m??6.8,U=w??o-10;for(let I=0;I<Y;I++)this.pY[I]-=this.pSpeed[I]*N*t,this.pX[I]+=F*14*t+(W?Math.sin(this.elapsedSeconds*2+I)*t:0),this.pY[I]<0&&(this.pY[I]=24+I%7,this.pX[I]=n+(I*73%64-32),this.pZ[I]=o+(I*137%64-32)),po(this.pX[I],this.pY[I],this.pZ[I],L,V,U,3.2,ba),qt.position.set(ba.x,ba.y,ba.z),qt.rotation.set(0,0,-F),W?qt.scale.set(1.55,.16,1.55):qt.scale.set(1,this.activeWeather==="storm"?1.35:1,1),qt.updateMatrix(),this.weatherMesh.setMatrixAt(I,qt.matrix);this.weatherMesh.instanceMatrix.needsUpdate=!0}isAlpineMountainsBuilt(){return this.alpineMountainsBuilt}ensureAlpineMountainsBuilt(){if(this.alpineMountainsBuilt)return;this.alpineMountainsBuilt=!0;const t=this.buildAlpineMountainRange(this.isSoftwareGl?72:128);t.userData.ignoreCameraFade=!0,this.mountainMesh.add(t)}dispose(){var t;this.wettableMaterials.length=0,it.pruneNonSharedManagedTextures(),qe(this.skyMesh),qe(this.mountainMesh),this.alpineMountainsBuilt=!1,qe(this.cloudGroup),qe(this.weatherMesh),(t=this.moonLight)==null||t.dispose()}};x(vt,"textureCache",new Map),x(vt,"waterNormalTex",null),x(vt,"peelBumpTex",null),x(vt,"sharedLeafGeo",null),x(vt,"sharedBlossomCorollaGeo",null),x(vt,"sharedCalyxStarGeo",null),x(vt,"sharedUnitRibbedFruitGeo",null),x(vt,"sharedRippleDataTexture",null),x(vt,"leanTextureMode",!1);let Me=vt;const zt=new Ct;class yt{static setLeanTextureMode(t){this.leanTextureMode=t}static getCachedGeo(t,a){const s=this.geoCache.get(t);if(s)return s;const e=a();return e.userData.sharedAsset=!0,this.geoCache.set(t,e),e}static getCachedMat(t,a){const s=this.matCache.get(t);if(s)return s;const e=a();return e.userData.sharedAsset=!0,this.matCache.set(t,e),e}static getFurAlbedoTexture(t){const a=this.furAlbedoCache.get(t);if(a)return a;const s=this.leanTextureMode?128:256,e=s/256,n=document.createElement("canvas");n.width=s,n.height=s;const o=n.getContext("2d"),l=new K(t),u=l.clone().multiplyScalar(.84),d=l.clone().lerp(new K(16771266),.16),r=l.clone().lerp(new K(16774619),.28);if(o){o.fillStyle=`#${l.getHexString()}`,o.fillRect(0,0,s,s);for(let p=0;p<42;p++){const g=(p*67+19)%256*e,m=(p*113+31)%256*e,w=(20+p%4*6)*e,f=p%2===0?d:u,v=`rgba(${Math.round(f.r*255)},${Math.round(f.g*255)},${Math.round(f.b*255)},0.10)`,b=`rgba(${Math.round(f.r*255)},${Math.round(f.g*255)},${Math.round(f.b*255)},0)`;for(let M=-1;M<=1;M++)for(let S=-1;S<=1;S++){const A=g+M*s,P=m+S*s;if(A<-w||A>s+w||P<-w||P>s+w)continue;const C=o.createRadialGradient(A,P,1,A,P,w);C.addColorStop(0,v),C.addColorStop(1,b),o.fillStyle=C,o.beginPath(),o.arc(A,P,w,0,Math.PI*2),o.fill()}}const h=[`#${u.getHexString()}`,`#${l.getHexString()}`,`#${d.getHexString()}`,`#${r.getHexString()}`],c=this.leanTextureMode?1400:3600;o.lineCap="round";for(let p=0;p<c;p++){const g=(p*97+p%13*11)%256*e,m=(p*53+p%17*7)%256*e;o.strokeStyle=h[p%h.length],o.globalAlpha=.045+p%4*.015,o.lineWidth=(.65+p%3*.16)*e;const w=(p%5-2)*.26*e,f=(2.6+p%3*.85)*e;o.beginPath(),o.moveTo(g,m),o.lineTo(g+w,m+f),o.stroke()}o.globalAlpha=1}const i=new He(n);return i.colorSpace=Ke,i.wrapS=Qt,i.wrapT=Qt,i.repeat.set(2,2),i.needsUpdate=!0,i.userData.sharedAsset=!0,it.registerManagedTexture(i),this.furAlbedoCache.set(t,i),i}static getCitrusPeelBumpTexture(){if(this.sharedCitrusBumpMap)return this.sharedCitrusBumpMap;const t=document.createElement("canvas");t.width=128,t.height=128;const a=t.getContext("2d");if(a){a.fillStyle="#909090",a.fillRect(0,0,128,128);for(let e=0;e<650;e++){const n=(e*47+e%11*5)%128,o=(e*83+e%7*9)%128,l=1.1+e%3*.55;a.fillStyle=e%3===0?"#525252":"#b8b8b8",a.beginPath(),a.arc(n,o,l,0,Math.PI*2),a.fill()}}const s=new He(t);return s.wrapS=Qt,s.wrapT=Qt,s.repeat.set(2,2),s.userData.sharedAsset=!0,it.registerManagedTexture(s),this.sharedCitrusBumpMap=s,s}static createFurMaterial(t,a=!0){const s=()=>{const e=this.skinColors[t]??this.skinColors.classic,n=new K(e).lerp(new K(16773590),.58);return new _e({color:16777215,map:this.getFurAlbedoTexture(e),normalMap:it.getCapyFurNormalMap(),normalScale:new ot(.18,.15),roughness:t==="golden"?.42:.78,metalness:t==="golden"?.34:.02,sheen:.78,sheenRoughness:.56,sheenColor:n})};return a?this.getCachedMat(`fur:${t}`,s):s()}static createMuzzleMaterial(t,a=!0){const s=()=>{const e=new K(this.skinColors[t]??this.skinColors.classic),n=new K(t==="classic"?6765602:5386528),o=e.clone().lerp(n,t==="classic"?.58:.34),l=o.clone().lerp(new K(16771276),.42);return new _e({color:o,normalMap:it.getCapyFurNormalMap(),normalScale:new ot(.14,.12),roughness:.8,metalness:.02,sheen:.6,sheenRoughness:.64,sheenColor:l})};return a?this.getCachedMat(`muzzle:${t}`,s):s()}static createUnderbellyMaterial(t,a=!0){const s=()=>{const e=new K(this.skinColors[t]??this.skinColors.classic);return e.lerp(new K(16708564),.44),new _e({color:e,normalMap:it.getCapyFurNormalMap(),normalScale:new ot(.14,.12),roughness:.84,metalness:.01,sheen:.68,sheenRoughness:.62,sheenColor:new K(16775399)})};return a?this.getCachedMat(`belly:${t}`,s):s()}static getTorsoGeometry(){if(this.sharedTorsoGeo)return this.sharedTorsoGeo;const t=[new ot(.001,-.82),new ot(.32,-.76),new ot(.52,-.6),new ot(.6,-.34),new ot(.615,-.02),new ot(.585,.3),new ot(.535,.56),new ot(.41,.76),new ot(.19,.86),new ot(.001,.89)],a=new ss(t,28);return a.rotateX(Math.PI/2),a.scale(.98,1.03,1),a.computeVertexNormals(),it.prepareGeometryForPbr(a),a.userData.sharedAsset=!0,this.sharedTorsoGeo=a,a}static getHeadGeometry(){if(this.sharedHeadGeo)return this.sharedHeadGeo;const t=new Z(.41,28,22),a=t.attributes.position;for(let s=0;s<a.count;s++){let e=a.getX(s),n=a.getY(s),o=a.getZ(s);const l=n>0?1-Math.pow(n/.41,2)*.14:1+Math.abs(n/.41)*.06;e*=.94*l,n*=.88,o*=1.12,o>.12&&n>.04&&(n-=(o-.12)*.08),a.setXYZ(s,e,n,o)}return t.computeVertexNormals(),it.prepareGeometryForPbr(t),t.userData.sharedAsset=!0,this.sharedHeadGeo=t,t}static getSnoutGeometry(){if(this.sharedSnoutGeo)return this.sharedSnoutGeo;const t=new Z(.32,24,18),a=t.attributes.position;for(let s=0;s<a.count;s++){let e=a.getX(s),n=a.getY(s),o=a.getZ(s);e*=.96,n*=.86,o*=.96,o>.18&&(o=.18+(o-.18)*.56),a.setXYZ(s,e,n,o)}return t.computeVertexNormals(),it.prepareGeometryForPbr(t),t.userData.sharedAsset=!0,this.sharedSnoutGeo=t,t}static getFurTuftGeometry(){if(this.sharedFurTuftGeo)return this.sharedFurTuftGeo;const t=new Z(.036,8,6);return t.scale(.86,.36,1.32),t.userData.sharedAsset=!0,this.sharedFurTuftGeo=t,t}static getDachshundBarrelGeometry(){if(this.sharedDachshundBarrelGeo)return this.sharedDachshundBarrelGeo;const t=[new ot(.001,-.82),new ot(.32,-.77),new ot(.49,-.58),new ot(.535,-.24),new ot(.54,0),new ot(.535,.24),new ot(.49,.58),new ot(.32,.77),new ot(.001,.82)],a=new ss(t,22);return a.rotateX(Math.PI/2),a.scale(.92,1,1),a.computeVertexNormals(),it.prepareGeometryForPbr(a),a.userData.sharedAsset=!0,this.sharedDachshundBarrelGeo=a,a}static buildDetailedLimb(t,a,s,e,n){const o=new H,l=this.getCachedGeo("limb_upper",()=>{const P=new rt(.175,.142,.3,14);return P.translate(0,-.14,0),P}),u=new D(l,s);u.name="capyBody",u.castShadow=!0,o.add(u);const d=this.getCachedGeo(t?"limb_haunch_f":"limb_haunch_b",()=>{const P=new Z(t?.215:.255,14,12);return P.scale(.86,1.12,t?1.06:1.2),P}),r=new D(d,s);r.name="capyBody",r.position.set(a?.02:-.02,.02,-.02),o.add(r),e.push(r);const i=new H;i.position.set(0,-.26,0),o.add(i);const h=this.getCachedGeo("limb_lower",()=>{const P=new rt(.125,.135,.28,10);return P.translate(0,-.14,0),P}),c=new D(h,this.legMaterial);c.castShadow=!0,i.add(c);const p=new H;p.position.set(0,-.25,0),i.add(p);const g=this.getCachedGeo("limb_paw_pad",()=>new Se(.25,.08,.32)),m=new D(g,this.webbingMaterial);m.position.set(0,0,.06),p.add(m),e.push(m);const w=new H;w.position.set(0,0,.16);const f=t?4:3,v=t?.22:.2,b=this.getCachedGeo("limb_toe",()=>{const P=new Qs(.032,.09,4,6);return P.rotateX(Math.PI/2),P}),M=this.getCachedGeo("limb_claw",()=>{const P=new ce(.024,.075,5);return P.rotateX(Math.PI*.56),P});for(let P=0;P<f;P++){const C=P/(f-1)-.5,T=C*v,_=Math.cos(C*1.4)*.06,W=new D(b,this.legMaterial);W.position.set(T,.005,_),W.rotation.y=-C*.32,w.add(W);const j=new D(M,this.clawMaterial);j.position.set(T*1.08,-.01,_+.075),j.rotation.y=-C*.32,w.add(j)}const S=this.getCachedGeo("limb_web",()=>new rt(.13,.14,.025,8,1,!1,-Math.PI*.4,Math.PI*.8)),A=new D(S,this.webbingMaterial);return A.position.set(0,-.01,.01),w.add(A),p.add(w),n.push(w),o.userData.lowerJoint=i,o.userData.pawGroup=p,o}static createSculptedHeadOrange(t,a,s,e=!0){const n=new H,o=()=>new O({color:t,emissive:a,emissiveIntensity:0,normalMap:it.getCitrusPeelNormalMap(),normalScale:new ot(.24,.24),bumpMap:this.getCitrusPeelBumpTexture(),bumpScale:.008,roughness:.24,metalness:.04}),l=e?this.getCachedMat(`orange:${t}:${a}`,o):o(),u=this.getCachedGeo("head_orange_main",()=>{const w=new Z(.255,22,18);return w.scale(1.04,.88,1.04),w}),d=new D(u,l);d.position.set(0,.2,0),d.castShadow=!0,n.add(d);const r=this.getCachedGeo("head_orange_base_leaf",()=>{const w=new ce(.065,.17,6);return w.scale(1.3,1,.35),w.rotateZ(Math.PI/3),w}),i=new D(r,this.leafMaterial);i.position.set(.08,.42,0),n.add(i);const h=new H;h.position.set(0,.41,0);const c=new D(this.getCachedGeo("head_orange_stem",()=>new rt(.018,.026,.09,6)),this.stemMaterial);c.position.set(0,.035,0),c.rotation.z=-.15,h.add(c);const p=this.getCachedGeo("head_orange_sepal",()=>{const w=new ce(.028,.085,4);return w.rotateX(Math.PI*.46),w});for(let w=0;w<5;w++){const f=new D(p,this.leafMaterial);f.rotation.y=w/5*Math.PI*2,f.translateZ(.035),h.add(f)}const g=this.getCachedGeo("head_orange_second_leaf",()=>{const w=new Z(.075,8,6);return w.scale(1.55,.22,.65),w}),m=new D(g,this.leafMaterial);return m.position.set(-.085,.025,.03),m.rotation.set(.2,.4,-.35),h.add(m),n.add(h),s.push(h),{group:n,fruitMesh:d,fruitMat:l}}static getDefaultOrangeForSkin(t){const a=this.skinDefaultOrangeIndex[t]??0;return We[a]||We[0]}static createTextBannerTexture(t,a="",s="#0f172a",e="#fbbf24"){const n=document.createElement("canvas");n.width=256,n.height=128;const o=n.getContext("2d");o.fillStyle=s,o.beginPath(),o.roundRect(4,4,248,120,14),o.fill(),o.lineWidth=5,o.strokeStyle=e,o.stroke(),o.fillStyle="#ffffff",o.textAlign="center",o.textBaseline="middle",o.font=a?"900 36px system-ui, sans-serif":"900 55px system-ui, sans-serif",o.fillText(t,128,a?52:66),a&&(o.fillStyle=e,o.font="700 18px system-ui, sans-serif",o.fillText(a,128,92));const l=new He(n);return l.colorSpace=Ke,l.needsUpdate=!0,l}static createCapybara(t="yuzu",a=1,s="classic",e=[],n=3,o,l=!0){const u=new H,d=this.createFurMaterial(s,l),r=this.createMuzzleMaterial(s,l),i=this.createUnderbellyMaterial(s,l),h=new H,c=new H,p=new H;u.add(h,c,p);const g=[],m=[],w=new D(this.getTorsoGeometry(),d);w.name="capyBody",w.position.set(0,.74,.04),w.castShadow=!0,w.receiveShadow=!0,u.add(w);const f=this.getCachedGeo("capy_belly",()=>{const k=new Z(.49,18,12);return k.scale(.86,.56,1.38),k}),v=new D(f,i);v.position.set(0,.49,.06),h.add(v);const b=this.getCachedGeo("capy_chest_fluff",()=>{const k=new Z(.36,16,12);return k.scale(.88,.74,1.15),k}),M=new D(b,i);M.position.set(0,.48,.44),h.add(M);const S=this.getCachedGeo("capy_dewlap",()=>{const k=new Z(.42,18,14);return k.scale(.94,.84,1.02),k}),A=new D(S,d);A.name="capyBody",A.position.set(0,.82,.55),c.add(A);const P=new H;P.position.set(0,1.02,.82);const C=new D(this.getHeadGeometry(),d);C.name="capyHead",C.position.set(0,.14,.02),C.castShadow=!0,C.receiveShadow=!0,P.add(C);const T=new D(this.getSnoutGeometry(),r);T.name="capyMuzzle",T.position.set(0,.045,.4),T.castShadow=!0,P.add(T);const _=new H,W=this.getCachedGeo("capy_jaw",()=>{const k=new Z(.22,14,10);return k.scale(.92,.44,1.24),k}),j=new D(W,i);j.position.set(0,-.145,.27),_.add(j);const Y=this.getCachedGeo("capy_rhinarium",()=>{const k=new Z(.155,16,12);return k.scale(1.16,.7,.48),k}),z=new D(Y,this.rhinariumMaterial);z.position.set(0,.125,.635),_.add(z);const N=new D(this.getCachedGeo("capy_philtrum",()=>new Se(.018,.165,.032)),this.rhinariumMaterial);N.position.set(0,.015,.648),_.add(N);const F=this.getCachedGeo("capy_smile_arc",()=>new Da(.052,.01,6,12,Math.PI*.78)),L=new D(F,this.rhinariumMaterial);L.position.set(-.046,-.048,.645),L.rotation.set(.18,-.12,Math.PI*1.11);const V=new D(F,this.rhinariumMaterial);V.position.set(.046,-.048,.645),V.rotation.set(.18,.12,Math.PI*1.11),_.add(L,V),P.add(_),g.push(_);const U=this.getCachedGeo("capy_nostril",()=>{const k=new Z(.036,10,8);return k.scale(1.22,.66,.6),k}),I=new D(U,this.rhinariumMaterial);I.position.set(-.098,.142,.678),I.rotation.z=.38;const E=I.clone();E.position.x=.098,E.rotation.z=-.38,P.add(I,E);const J=this.getCachedGeo("capy_eye",()=>{const k=new Z(.088,18,14);return k.scale(.88,1.02,1.06),k}),at=new D(J,this.eyeMaterial);at.position.set(-.32,.255,.17);const et=at.clone();et.position.x=.32,P.add(at,et);const tt=this.getCachedGeo("capy_catch",()=>new Z(.028,8,8)),st=new D(tt,this.eyeCatchlightMaterial);st.position.set(-.368,.285,.212);const Q=st.clone();Q.position.x=.368;const gt=this.getCachedGeo("capy_catch_sub",()=>new Z(.013,6,6)),Dt=new D(gt,this.eyeCatchlightMaterial);Dt.position.set(-.37,.236,.145);const Ut=Dt.clone();Ut.position.x=.37,P.add(st,Q,Dt,Ut),g.push(st,Q,Dt,Ut);const ee=new H,ht=this.getCachedGeo("capy_jowl",()=>{const k=new Z(.225,16,12);return k.scale(.92,.84,1.24),k}),Ae=new D(ht,d);Ae.name="capyHead",Ae.position.set(-.22,-.04,.2);const Ee=Ae.clone();Ee.position.x=.22,ee.add(Ae,Ee);const Je=this.getCachedGeo("capy_cheek_blush",()=>{const k=new Z(.078,12,10);return k.scale(.22,.56,.92),k}),Le=new D(Je,this.cheekBlushMaterial);Le.position.set(-.352,.088,.19);const Ie=Le.clone();Ie.position.x=.352,ee.add(Le,Ie);const Mt=this.getCachedGeo("capy_brow_soft",()=>{const k=new Z(.04,10,8);return k.scale(.58,.42,1.45),k}),xt=new D(Mt,this.dachshundTanPointMaterial);xt.position.set(-.285,.358,.18);const St=xt.clone();St.position.x=.285,ee.add(xt,St);const Wt=this.getCachedGeo("capy_incisor",()=>new Se(.044,.04,.02)),Lt=new D(Wt,this.incisorMaterial);Lt.position.set(-.025,-.092,.618);const Xt=Lt.clone();Xt.position.x=.025,ee.add(Lt,Xt),P.add(ee),m.push(ee);const Yt=this.getCachedGeo("capy_eyelid",()=>new Z(.092,14,10,0,Math.PI*2,0,Math.PI*.52)),It=new D(Yt,d);It.name="capyHead",It.position.set(-.32,.268,.17),It.rotation.z=.12,It.scale.y=.09;const Vt=It.clone();Vt.position.x=.32,Vt.rotation.z=-.12,P.add(It,Vt),m.push(It,Vt);const Jt=this.getCachedGeo("capy_outer_ear",()=>{const k=new Z(.132,14,12);return k.scale(.56,1.04,.92),k}),ae=this.getCachedGeo("capy_ear_rim",()=>{const k=new Z(.095,10,8);return k.scale(.42,.72,.78),k}),Pe=this.getCachedGeo("capy_inner_ear",()=>{const k=new Z(.088,10,8);return k.scale(.48,.88,.62),k}),ye=k=>{const lt=new H,At=k?-1:1;lt.position.set(At*.31,.365,-.095),lt.rotation.set(.16,At*-.28,At*.28);const oe=new D(Jt,r);oe.name="capyMuzzle",oe.rotation.x=-Math.PI*.18,oe.castShadow=!0,lt.add(oe);const wt=new D(ae,r);wt.name="capyMuzzle",wt.position.set(At*.028,-.068,.015),wt.rotation.set(.08,0,At*-.12),lt.add(wt);const Rt=new D(Pe,this.innerEarMaterial);return Rt.position.set(At*.012,-.01,.042),lt.add(Rt),g.push(Rt),lt},ve=ye(!0),be=ye(!1);P.add(ve,be);const se=new H,Re=this.getCachedGeo("capy_whisker",()=>{const k=new rt(.003,.011,.36,5);return k.translate(0,.18,0),k.rotateZ(Math.PI/2),k});for(let k=-1;k<=1;k+=2){for(let lt=0;lt<6;lt++){const At=Math.floor(lt/2),oe=lt%2,wt=new D(Re,this.whiskerMaterial);wt.position.set(k*.24,.06-At*.055,.5+oe*.08);const Rt=k*(.18+oe*.22),Pt=-.12-At*.14;wt.scale.set(k,1,1),wt.rotation.set(0,Rt,k*Pt),se.add(wt)}for(let lt=0;lt<2;lt++){const At=new D(Re,this.whiskerMaterial);At.scale.set(k*.58,.7,.7),At.position.set(k*.31,.37,.14+lt*.05),At.rotation.set(0,k*.15,k*.55),se.add(At)}}P.add(se);const Bt=this.getDefaultOrangeForSkin(s),ut=o??Bt.colorHex,bt=We.find(k=>k.colorHex===ut)??Bt,dt=this.createSculptedHeadOrange(ut,bt.emissiveHex,m,l),xe=dt.group;xe.position.set(0,.42,.04);const ta=[],ke=this.getCachedGeo("capy_head_stack_orange",()=>{const k=new Z(.185,14,12);return k.scale(1.04,.88,1.04),k});for(let k=0;k<6;k++){const lt=new D(ke,dt.fruitMat);lt.position.set(0,.48+k*.27,0),lt.scale.setScalar(Math.pow(.93,k)),lt.castShadow=!0,lt.visible=!1,xe.add(lt),ta.push(lt)}P.add(xe);const nt=new H;nt.position.set(0,.42,.04),this.attachHat(nt,t),P.add(nt),u.add(P);const mt=this.buildDetailedLimb(!0,!0,d,g,m);mt.position.set(-.36,.53,.52);const Nt=this.buildDetailedLimb(!0,!1,d,g,m);Nt.position.set(.36,.53,.52),u.add(mt,Nt);const Tt=new H,me=this.buildDetailedLimb(!1,!0,d,g,m);me.position.set(-.37,.53,-.48);const $t=this.buildDetailedLimb(!1,!1,d,g,m);$t.position.set(.37,.53,-.48);const Ge=this.getCachedGeo("capy_tail",()=>{const k=new Z(.115,10,10);return k.scale(.9,.85,1.15),k}),Ue=new D(Ge,r);Ue.name="capyMuzzle",Ue.position.set(0,.68,-.86),Tt.add(me,$t,Ue),u.add(Tt);const ea=this.getFurTuftGeometry(),fe=72,jt=new kt(ea,d,fe);jt.name="capyBody",jt.receiveShadow=!0,jt.frustumCulled=!1;for(let k=0;k<fe;k++){const lt=Math.floor(k/18),At=k%18,oe=-.1+lt*.22,wt=Math.PI+(At/17-.5)*Math.PI*.62,Rt=.51-lt*.025,Pt=Math.sin(wt)*Rt*.86,ks=.72+Math.cos(wt)*Rt*.84;zt.position.set(Pt,ks,oe),zt.rotation.set(.14,wt*.12,-wt*.94);const Ta=.96+k%3*.1;zt.scale.set(Ta,Ta*.72,Ta*1.15),zt.updateMatrix(),jt.setMatrixAt(k,zt.matrix)}jt.instanceMatrix.needsUpdate=!0,p.add(jt);const De=24,te=new kt(ea,d,De);te.name="capyBody",te.receiveShadow=!0,te.frustumCulled=!1;for(let k=0;k<De;k++){const lt=Math.floor(k/12),At=k%12,oe=-.44-lt*.16,wt=Math.PI+(At/11-.5)*Math.PI*.52,Rt=.44-lt*.05;zt.position.set(Math.sin(wt)*Rt*.84,.7+Math.cos(wt)*Rt*.82,oe),zt.rotation.set(.14,wt*.12,-wt*.94);const Pt=.92+k%3*.08;zt.scale.set(Pt,Pt*.7,Pt),zt.updateMatrix(),te.setMatrixAt(k,zt.matrix)}te.instanceMatrix.needsUpdate=!0,Tt.add(te),h.userData.linkedNodes=g,c.userData.linkedNodes=m,p.userData.linkedNodes=[se,te];const Ve=new H;return u.add(Ve),this.attachMutations(Ve,e),a!==1&&u.scale.setScalar(a),u.userData={legFL:mt,legFR:Nt,legBL:me,legBR:$t,head:P,earL:ve,earR:be,eyelidL:It,eyelidR:Vt,hatGroup:nt,headOrangeGroup:xe,headOrangeMesh:dt.fruitMesh,headOrangeMat:dt.fruitMat,headStackMeshes:ta,headOrangeColorHex:ut,mutationGroup:Ve,rearAssemblyGroup:Tt,lodTier1Group:h,lodTier2Group:c,lodTier3Group:p,furInstancedMesh:jt,rearFurInstancedMesh:te,walkCycle:0,blinkTimer:1.5+Math.random()*2.5,lodTier:n,skin:s},this.applyLodTier(u,n),u}static applyLodTier(t,a){var d,r,i;if(!(t!=null&&t.userData))return;t.userData.lodTier=a;const s=a>=1,e=a>=2,n=a>=3;t.userData.lodTier1Group.visible=s;const o=(d=t.userData.lodTier1Group.userData)==null?void 0:d.linkedNodes;if(o)for(let h=0;h<o.length;h++)o[h].visible=s;t.userData.lodTier2Group.visible=e;const l=(r=t.userData.lodTier2Group.userData)==null?void 0:r.linkedNodes;if(l)for(let h=0;h<l.length;h++)l[h].visible=e;t.userData.lodTier3Group.visible=n;const u=(i=t.userData.lodTier3Group.userData)==null?void 0:i.linkedNodes;if(u)for(let h=0;h<u.length;h++)u[h].visible=n;t.userData.furInstancedMesh.count=n?72:0,t.userData.rearFurInstancedMesh.count=n?24:0}static createDachshundSegment(t="classic",a=16742912,s=0,e=3){const n=new H,o=this.createFurMaterial(t),l=this.createUnderbellyMaterial(t),u=new D(this.getDachshundBarrelGeometry(),o);u.name="capyBody",u.position.set(0,.72,0),u.castShadow=!0,u.receiveShadow=!0,n.add(u);const d=new H,r=new H,i=new H;n.add(d,r,i);const h=this.getCachedGeo("dac_belly_long",()=>{const C=new Z(.45,16,10);return C.scale(.82,.5,1.5),C}),c=new D(h,l);c.position.set(0,.45,0),d.add(c);const p=new O({color:a,emissive:8138002,emissiveIntensity:0,normalMap:it.getCitrusPeelNormalMap(),normalScale:new ot(.46,.46),bumpMap:this.getCitrusPeelBumpTexture(),bumpScale:.022,roughness:.24,metalness:.06}),g=new H;g.position.set(0,1.32,0),g.visible=!1;const m=new D(this.getCachedGeo("dac_mini_orange",()=>new Z(.2,14,12)),p);m.scale.set(1.05,.88,1.05),m.castShadow=!0;const w=new D(this.getCachedGeo("dac_mini_stem",()=>new rt(.018,.024,.075,6)),this.stemMaterial);w.position.set(0,.18,0),m.add(w);const f=new D(this.getCachedGeo("dac_mini_leaf",()=>new ce(.052,.13,5)),this.leafMaterial);f.rotation.z=Math.PI/3,f.position.set(.065,.175,0),m.add(f),g.add(m),n.add(g);const v=[],b=[],M=this.buildDetailedLimb(!1,!0,o,v,b);M.position.set(-.35,.49,0),M.scale.set(.88,.92,.88);const S=this.buildDetailedLimb(!1,!1,o,v,b);S.position.set(.35,.49,0),S.scale.set(.88,.92,.88),n.add(M,S),d.userData.linkedNodes=v,r.userData.linkedNodes=b;const A=24,P=new kt(this.getFurTuftGeometry(),o,A);P.name="capyBody",P.receiveShadow=!0,P.frustumCulled=!1;for(let C=0;C<A;C++){const T=C%2===0?-1:1,W=-.58+Math.floor(C/2)/11*1.16,j=Math.PI+T*(.28+C%3*.14);zt.position.set(Math.sin(j)*.42,.72+Math.cos(j)*.44,W),zt.rotation.set(.08,j*.12,-j*.94);const Y=.92+C%3*.08;zt.scale.set(Y,Y*.68,Y*1.15),zt.updateMatrix(),P.setMatrixAt(C,zt.matrix)}return P.instanceMatrix.needsUpdate=!0,i.add(P),n.userData={bodyMat:o,lodTier1Group:d,lodTier2Group:r,lodTier3Group:i,furInstancedMesh:P,midLegL:M,midLegR:S,walkCycle:s*1.15,riderOrangeGroup:g,riderOrangeMat:p,segmentIndex:s,lodTier:e},this.applySegmentLodTier(n,e),n}static applySegmentLodTier(t,a){var u,d;if(!(t!=null&&t.userData))return;t.userData.lodTier=a;const s=a>=1,e=a>=2,n=a>=3;t.userData.lodTier1Group.visible=s;const o=(u=t.userData.lodTier1Group.userData)==null?void 0:u.linkedNodes;if(o)for(let r=0;r<o.length;r++)o[r].visible=s;t.userData.lodTier2Group.visible=e;const l=(d=t.userData.lodTier2Group.userData)==null?void 0:d.linkedNodes;if(l)for(let r=0;r<l.length;r++)l[r].visible=e;t.userData.lodTier3Group.visible=n,t.userData.furInstancedMesh.count=n?24:0}static createDachshundCaboose(t="classic",a=3){const s=new H,e=this.createFurMaterial(t),n=new H,o=new H,l=new H;s.add(n,o,l);const u=[],d=[],r=this.getCachedGeo("dac_rump_hybrid",()=>{const M=new Z(.54,20,16);return M.scale(.93,1,1.24),M}),i=new D(r,e);i.name="capyBody",i.position.set(0,.72,.04),i.castShadow=!0,i.receiveShadow=!0,s.add(i);const h=this.buildDetailedLimb(!1,!0,e,u,d);h.position.set(-.37,.53,-.06);const c=this.buildDetailedLimb(!1,!1,e,u,d);c.position.set(.37,.53,-.06),s.add(h,c);const p=new H;p.position.set(0,.68,-.58);const g=this.getCachedGeo("dac_capy_tail_nub",()=>{const M=new Z(.115,12,10);return M.scale(.92,.86,1.22),M}),m=new D(g,e);m.name="capyBody",m.position.set(0,0,-.04),m.castShadow=!0;const w=this.getCachedGeo("dac_capy_tail_tip",()=>{const M=new Z(.068,10,8);return M.scale(.9,.85,1.15),M}),f=new D(w,this.createMuzzleMaterial(t));f.position.set(0,-.01,-.09),f.castShadow=!0,m.add(f),p.add(m),s.add(p);const v=28,b=new kt(this.getFurTuftGeometry(),e,v);b.name="capyBody",b.receiveShadow=!0,b.frustumCulled=!1;for(let M=0;M<v;M++){const S=Math.floor(M/14),A=M%14,P=-.18-S*.18,C=Math.PI+(A/13-.5)*Math.PI*.54,T=.43-S*.04;zt.position.set(Math.sin(C)*T*.84,.7+Math.cos(C)*T*.82,P),zt.rotation.set(.14,C*.12,-C*.94);const _=.92+M%3*.08;zt.scale.set(_,_*.68,_),zt.updateMatrix(),b.setMatrixAt(M,zt.matrix)}return b.instanceMatrix.needsUpdate=!0,l.add(b),n.userData.linkedNodes=u,o.userData.linkedNodes=d,s.userData={bodyMat:e,legBL:h,legBR:c,tailGroup:p,lodTier1Group:n,lodTier2Group:o,lodTier3Group:l,furInstancedMesh:b,walkCycle:0,lodTier:a},this.applyCabooseLodTier(s,a),s}static applyCabooseLodTier(t,a){var u,d;if(!(t!=null&&t.userData))return;t.userData.lodTier=a;const s=a>=1,e=a>=2,n=a>=3;t.userData.lodTier1Group.visible=s;const o=(u=t.userData.lodTier1Group.userData)==null?void 0:u.linkedNodes;if(o)for(let r=0;r<o.length;r++)o[r].visible=s;t.userData.lodTier2Group.visible=e;const l=(d=t.userData.lodTier2Group.userData)==null?void 0:d.linkedNodes;if(l)for(let r=0;r<l.length;r++)l[r].visible=e;t.userData.lodTier3Group.visible=n,t.userData.furInstancedMesh.count=n?28:0}static createCollectibleOrange(t=16742912,a=8138002,s=.28){const e=new H,n=new H,o=new H;n.add(o),e.add(n);const l=new O({color:t,emissive:a,emissiveIntensity:0,normalMap:it.getCitrusPeelNormalMap(),normalScale:new ot(.52,.52),bumpMap:this.getCitrusPeelBumpTexture(),bumpScale:.028,roughness:.22,metalness:.04}),u=this.getCachedGeo("unit_orange_sphere",()=>{const w=new Z(1,20,16);return w.scale(1.03,.94,1.03),w}),d=new D(u,l);d.scale.setScalar(s),d.castShadow=!0,d.receiveShadow=!0,o.add(d);const r=new H;r.position.set(0,s*.88,0);const i=s/.28,h=new D(this.getCachedGeo("unit_orange_stem",()=>new rt(.02,.028,.09,6)),this.stemMaterial);h.scale.setScalar(i),h.position.y=.035*i,r.add(h);const c=this.getCachedGeo("unit_orange_leaf",()=>{const w=new Z(.095,8,6);return w.scale(1.5,.24,.68),w}),p=new D(c,this.leafMaterial);p.scale.setScalar(i),p.position.set(.09*i,.028*i,0),p.rotation.z=.28,r.add(p),o.add(r);const g=new pe({color:t,side:Ot,transparent:!0,opacity:.42,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),m=new D(this.getCachedGeo("unit_orange_halo",()=>new Ne(.92,1.22,24)),g);return m.scale.setScalar(s),m.rotation.x=Math.PI/2,m.position.y=-s+.02,m.userData.ignoreCameraFade=!0,e.add(m),e.userData={rollGroup:o,squashGroup:n,fruitMat:l,haloRing:m,haloMat:g,leafGroup:r,radius:s},e}static setHeadFruitStackCount(t,a){var e;if(!((e=t==null?void 0:t.userData)!=null&&e.headStackMeshes))return;const s=t.userData.headStackMeshes;for(let n=0;n<s.length;n++)s[n].visible=!1}static setDachshundSegmentFruitState(t,a,s,e=8138002){var n;(n=t==null?void 0:t.userData)!=null&&n.riderOrangeGroup&&(t.userData.riderOrangeGroup.visible=a,a&&t.userData.riderOrangeMat&&typeof s=="number"&&(t.userData.riderOrangeMat.color.setHex(s),t.userData.riderOrangeMat.emissive.setHex(e)))}static setHeadOrangeColor(t,a,s=8138002){var e;(e=t==null?void 0:t.userData)!=null&&e.headOrangeMat&&(t.userData.headOrangeColorHex=a,t.userData.headOrangeMat.color.setHex(a),t.userData.headOrangeMat.emissive.setHex(s))}static updateCapyAppearance(t,a,s,e,n,o){this.attachHat(t.userData.hatGroup,a),this.attachMutations(t.userData.mutationGroup,e),t.userData.skin=s;const l=typeof o=="number"&&Number.isFinite(o)?o:this.skinColors[s]??this.skinColors.classic,u=this.getFurAlbedoTexture(l),d=new K(l).lerp(new K(16773590),.58),r=new K(l).lerp(new K(s==="classic"?6765602:5386528),s==="classic"?.58:.34),i=r.clone().lerp(new K(16771276),.42);if(t.traverse(c=>{if(c instanceof D&&(c.name==="capyBody"||c.name==="capyHead")){const p=c.material;p.color.setHex(16777215),p.map=u,p.roughness=s==="golden"?.42:.78,p.metalness=s==="golden"?.34:.02,p.sheenColor&&(p.sheen=.78,p.sheenRoughness=.56,p.sheenColor.copy(d)),p.needsUpdate=!0}else if(c instanceof D&&c.name==="capyMuzzle"){const p=c.material;p.color.copy(r),p.sheenColor&&p.sheenColor.copy(i),p.needsUpdate=!0}}),t.userData.furInstancedMesh){const c=t.userData.furInstancedMesh.material;c.map=u,c.sheenColor&&c.sheenColor.copy(d),c.needsUpdate=!0}if(t.userData.rearFurInstancedMesh){const c=t.userData.rearFurInstancedMesh.material;c.map=u,c.sheenColor&&c.sheenColor.copy(d),c.needsUpdate=!0}const h=n!==void 0?We.find(c=>c.colorHex===n)??this.getDefaultOrangeForSkin(s):this.getDefaultOrangeForSkin(s);this.setHeadOrangeColor(t,n??h.colorHex,h.emissiveHex)}static attachHat(t,a){for(;t.children.length>0;)t.remove(t.children[0]);if(a!=="yuzu"){if(a==="crown"){const s=this.getCachedMat("hat_crown",()=>new O({color:16766720,metalness:.86,roughness:.26,envMapIntensity:.62})),e=this.getCachedGeo("hat_crown",()=>new rt(.31,.28,.14,8,1,!0)),n=new D(e,s);n.position.set(0,.1,0),t.add(n)}else if(a==="flower"){const s=this.getCachedMat("hat_flower",()=>new O({color:16738740,roughness:.4})),e=this.getCachedGeo("hat_flower_petal",()=>{const n=new Z(.11,8,8);return n.scale(1.2,.35,.6),n});for(let n=0;n<5;n++){const o=new D(e,s);o.position.set(-.22,.1,.08),o.rotation.y=n*Math.PI*2/5,o.translateX(.09),t.add(o)}}else if(a==="party"){const s=new D(this.getCachedGeo("hat_party_cone",()=>new ce(.14,.34,12)),this.getCachedMat("hat_party_cone",()=>new O({color:11032055,roughness:.3})));s.position.set(-.22,.32,-.06),s.rotation.z=.35;const e=new D(this.getCachedGeo("hat_party_pom",()=>new Z(.055,8,8)),this.getCachedMat("hat_party_pom",()=>new O({color:16436245})));e.position.set(-.33,.48,-.06),t.add(s,e)}else if(a==="wizard"){const s=this.getCachedMat("hat_wizard",()=>new O({color:1920728,roughness:.4})),e=new D(this.getCachedGeo("hat_wizard_brim",()=>new Ne(.26,.44,18)),s);e.rotation.x=Math.PI/2,e.position.set(0,.03,0),t.add(e)}else if(a==="halo"){const s=new D(this.getCachedGeo("hat_halo",()=>new Da(.3,.038,12,24)),this.getCachedMat("hat_halo",()=>new O({color:16707722,emissive:16436245,emissiveIntensity:.6,roughness:.1})));s.rotation.x=Math.PI/2,s.position.set(0,.56,0),t.add(s)}}}static attachMutations(t,a){for(;t.children.length>0;)t.remove(t.children[0]);if(a.includes("tusks")){const s=this.getCachedMat("mut_tusk",()=>new O({color:16710888,roughness:.25})),e=this.getCachedGeo("mut_tusk",()=>{const l=new ce(.06,.38,8);return l.rotateX(Math.PI/3),l}),n=new D(e,s);n.position.set(-.28,1,1.44);const o=n.clone();o.position.x=.28,t.add(n,o)}if(a.includes("horn")){const s=this.getCachedMat("mut_horn",()=>new O({color:3718648,emissive:165063,emissiveIntensity:.5,metalness:.7,roughness:.15})),e=new D(this.getCachedGeo("mut_horn",()=>new ce(.09,.52,10)),s);e.rotation.x=Math.PI/4.2,e.position.set(0,1.48,1.24),t.add(e)}if(a.includes("shell")){const s=this.getCachedMat("mut_shell",()=>new O({color:1409085,roughness:.5,metalness:.2})),e=new D(this.getCachedGeo("mut_shell",()=>new Z(.64,16,12,0,Math.PI*2,0,Math.PI*.55)),s);e.scale.set(.96,.75,1.25),e.position.set(0,.84,.02),t.add(e);const n=this.getCachedGeo("mut_shell_spike",()=>new ce(.085,.24,6));for(let o=-1;o<=1;o++){const l=new D(n,this.yuzuMaterial);l.position.set(0,1.38,o*.42),t.add(l)}}if(a.includes("wings")){const s=this.getCachedMat("mut_wing",()=>new O({color:16317180,roughness:.3,metalness:.1})),e=this.getCachedGeo("mut_wing",()=>new Se(.95,.08,.55)),n=new D(e,s);n.position.set(-.85,1.05,.12),n.rotation.z=.25;const o=new D(e,s);o.position.set(.85,1.05,.12),o.rotation.z=-.25,t.add(n,o)}if(a.includes("flippers")){const s=this.getCachedMat("mut_flipper",()=>new O({color:440020,roughness:.35})),e=this.getCachedGeo("mut_flipper",()=>new Se(.32,.06,.42)),n=[[-.36,.04,.58],[.36,.04,.58]];for(const[o,l,u]of n){const d=new D(e,s);d.position.set(o,l,u),t.add(d)}}if(a.includes("glow_tail")){const s=this.getCachedMat("mut_glow_plume",()=>{const l=new O({color:12616956,emissive:11032055,emissiveIntensity:.75,roughness:.18});return l.userData.isBioluminescentTail=!0,l}),e=new D(this.getCachedGeo("mut_glow_plume",()=>new ce(.22,.68,12)),s);e.userData.isBioluminescentTail=!0,e.rotation.x=-Math.PI/3,e.position.set(0,.88,-1.02);const n=this.getCachedMat("mut_glow_tip",()=>{const l=new O({color:3718648,emissive:2282478,emissiveIntensity:.95,roughness:.12});return l.userData.isBioluminescentTail=!0,l}),o=new D(this.getCachedGeo("mut_glow_orb",()=>new Z(.11,10,10)),n);o.userData.isBioluminescentTail=!0,o.position.set(0,1.06,-1.32),t.add(e,o)}}static createBuildingByType(t,a=1){switch(t){case"hot_spring":return this.createHotSpring(a);case"yuzu_orchard":return this.createYuzuTree(a);case"trampoline_pad":return this.createMushroomPad(a);case"bamboo_grove":return this.createBambooGrove(a);case"zen_pagoda":return this.createZenPagoda(a);case"capy_statue":return this.createCapyMonument(a)}}static createHotSpring(t=1){const a=new H;a.userData.ignoreCameraFade=!0;const s=Me.getTextureSet("basalt"),e=Me.getTextureSet("timber"),n=new O({color:6583435,map:s.albedo,normalMap:s.normal,normalScale:new ot(.85,.85),roughnessMap:s.roughness,roughness:.62,metalness:.12}),o=2.4;for(let c=0;c<12;c++){const p=c/12*Math.PI*2,g=new D(new ra(.48),n);g.position.set(Math.cos(p)*o,.25,Math.sin(p)*o),g.scale.set(1.15,.75,1.15),g.castShadow=!0,g.receiveShadow=!0,a.add(g)}const l=it.getWaterNormalMaps(),u=this.leanTextureMode?new O({color:959977,roughness:.14,metalness:.12,normalMap:l.primary,normalScale:new ot(.45,.45),transparent:!0,opacity:.86}):new _e({color:959977,roughness:.18,clearcoat:0,specularIntensity:.42,envMapIntensity:.65,normalMap:l.primary,normalScale:new ot(.45,.45),transparent:!0,opacity:.86}),d=new D(new rt(o-.2,o-.2,.22,24),u);d.position.set(0,.16,0),d.userData.ignoreCameraFade=!0,a.add(d);const r=new O({color:11828040,map:e.albedo,normalMap:e.normal,normalScale:new ot(.65,.65),roughnessMap:e.roughness,roughness:.7}),i=new D(new rt(.12,.12,1.2,8),r);i.position.set(-o+.3,.6,0),a.add(i);const h=new D(new rt(.08,.08,.9,8),r);h.rotation.z=-Math.PI/3,h.position.set(-o+.7,1,0),a.add(h);for(let c=0;c<4;c++){const p=new D(new Z(.14,10,10),this.yuzuMaterial);p.position.set(Math.cos(c*1.7)*.9,.28,Math.sin(c*1.7)*.9),a.add(p)}return a}static createYuzuTree(t=1){const a=new H,s=Me.getTextureSet("bark"),e=Me.getTextureSet("foliage"),n=new D(new rt(.24,.38,2.3,10),new O({color:9200196,map:s.albedo,bumpMap:s.bump,bumpScale:.12,roughness:.85}));n.position.set(0,1.15,0),n.castShadow=!0,a.add(n);const o=new O({color:4906624,map:e.albedo,bumpMap:e.bump,bumpScale:.1,roughness:.76}),l=new D(new os(1.3,2),o);l.position.set(0,2.6,0),l.castShadow=!0;const u=new D(new os(.95,2),o);u.position.set(.55,3.05,.25),u.castShadow=!0,a.add(l,u);for(let d=0;d<7;d++){const r=d/7*Math.PI*2,i=new D(new Z(.17,10,10),this.yuzuMaterial);i.position.set(Math.cos(r)*1.05,2.25+d%2*.45,Math.sin(r)*1.05),a.add(i)}return a}static createMushroomPad(t=1){const a=new H,s=Me.getTextureSet("timber"),e=new D(new rt(.55,.7,1.1,14),new O({color:16708551,bumpMap:s.bump,bumpScale:.04,roughness:.7}));e.position.set(0,.55,0),e.castShadow=!0,a.add(e);const n=new D(new rt(1.6,1.85,.45,24),new O({color:15680580,bumpMap:this.getCitrusPeelBumpTexture(),bumpScale:.03,roughness:.35}));n.position.set(0,1.2,0),n.castShadow=!0,a.add(n);const o=new O({color:16777215,roughness:.3});for(let l=0;l<6;l++){const u=l/6*Math.PI*2,d=new D(new rt(.25,.25,.06,12),o);d.position.set(Math.cos(u)*.95,1.44,Math.sin(u)*.95),a.add(d)}return a}static createBambooGrove(t=1){const a=new H,s=Me.getTextureSet("timber"),e=new O({color:4906624,bumpMap:s.bump,bumpScale:.05,roughness:.38}),n=new O({color:1467700,roughness:.6}),o=[[-.6,-.4],[.5,-.5],[0,.4],[-.4,.6],[.7,.3]];for(const[l,u]of o){const d=3.2+Math.random()*1.4,r=new D(new rt(.14,.16,d,10),e);r.position.set(l,d/2,u),r.castShadow=!0,a.add(r);for(let i=.8;i<d;i+=.9){const h=new D(new Da(.155,.025,6,12),n);h.rotation.x=Math.PI/2,h.position.set(l,i,u),a.add(h)}}return a}static createZenPagoda(t=1){const a=new H,s=Me.getTextureSet("timber"),e=Me.getTextureSet("basalt"),n=new O({color:14427686,map:s.albedo,bumpMap:s.bump,bumpScale:.06,roughness:.52}),o=new O({color:3359061,map:e.albedo,bumpMap:e.bump,bumpScale:.08,roughness:.38,metalness:.35}),l=new O({color:16436245,metalness:.86,roughness:.26,envMapIntensity:.62}),u=new O({color:16708551,emissive:16096779,emissiveIntensity:.45,roughness:.22});u.userData.isNightLantern=!0;for(let h=0;h<3;h++){const c=1-h*.22,p=h*1.35,g=new D(new Se(2.2*c,1.1,2.2*c),n);g.position.set(0,p+.55,0),g.castShadow=!0,a.add(g);const m=new D(new Se(2.24*c,.34,1.18*c),u);m.position.set(0,p+.58,0);const w=new D(new Se(1.18*c,.34,2.24*c),u);w.position.set(0,p+.58,0),a.add(m,w);const f=new D(new ce(2.15*c,.65,4),o);if(f.rotation.y=Math.PI/4,f.position.set(0,p+1.35,0),f.castShadow=!0,a.add(f),h<2){const v=1.42*c,b=[[v,v],[-v,v],[v,-v],[-v,-v]];for(const[M,S]of b){const A=new D(new rt(.11,.1,.24,8),u);A.position.set(M,p+.96,S),a.add(A)}}}const d=new D(new rt(.06,.14,1.1,10),l);d.position.set(0,4.6,0),a.add(d);const r=new pe({color:16498468,transparent:!0,opacity:.06,blending:Gt,depthWrite:!1,side:Ot}),i=new D(new ja(3.4,24),r);return i.rotation.x=-Math.PI/2,i.position.set(0,.06,0),i.userData.ignoreCameraFade=!0,a.add(i),a.userData.pagodaGlowMat=r,a.userData.pagodaLanternMat=u,a}static createCapyMonument(t=1){const a=new H,s=Me.getTextureSet("basalt"),e=new D(new rt(1.4,1.65,1.1,16),new O({color:13358561,map:s.albedo,bumpMap:s.bump,bumpScale:.09,roughness:.55}));e.position.set(0,.55,0),e.castShadow=!0,a.add(e);const n=this.createCapybara("crown",1.25,"golden",[],2);return n.position.set(0,1.1,0),a.add(n),a}static createWorldPortal(t,a,s,e){const n=new H,o=new O({color:s,emissive:s,emissiveIntensity:.18,roughness:.25,metalness:.6});o.userData.isPortalFrame=!0;const l=new rt(.24,.28,3.6,12),u=new D(l,o);u.position.set(-1.6,1.8,0),u.castShadow=!0;const d=u.clone();d.position.x=1.6,n.add(u,d);const r=new O({color:16777215,emissive:s,emissiveIntensity:.75,roughness:.12});r.userData.isPortalBeacon=!0;const i=new D(new Z(.26,12,12),r);i.position.set(-1.6,3.72,0);const h=i.clone();h.position.x=1.6,n.add(i,h);const c=new O({color:s,emissive:s,emissiveIntensity:.5,transparent:!0,opacity:.68,roughness:.1,side:Ot});c.userData.isPortalVortex=!0;const p=new D(new rt(1.45,1.45,.12,24),c);p.rotation.x=Math.PI/2,p.position.set(0,1.8,0),n.add(p);const g=this.createTextBannerTexture(t,a,"#0f172a",e),m=new pe({map:g}),w=new D(new Se(3.5,1.25,.22),m);return w.position.set(0,3.9,0),n.add(w),n.userData.vortexMat=c,n.userData.frameMat=o,n.userData.beaconMat=r,n}}x(yt,"skinColors",{classic:10183739,golden:15381256,sakura:16020150,matcha:4906624,cosmic:6514417}),x(yt,"skinDefaultOrangeIndex",{classic:0,golden:1,sakura:2,matcha:3,cosmic:4}),x(yt,"LOD_TRIANGLE_ESTIMATES",{0:760,1:1840,2:3420,3:6480}),x(yt,"LOD_LABELS",{0:"Performance LOD",1:"Balanced LOD",2:"High Detail LOD",3:"Ultra Bristle LOD"}),x(yt,"furAlbedoCache",new Map),x(yt,"sharedCitrusBumpMap",null),x(yt,"rhinariumMaterial",Object.assign(new O({color:2495758,roughness:.24,metalness:.06}),{userData:{sharedAsset:!0}})),x(yt,"eyeMaterial",Object.assign(new O({color:1182471,roughness:.06,metalness:.12}),{userData:{sharedAsset:!0}})),x(yt,"eyeCatchlightMaterial",Object.assign(new pe({color:16777215}),{userData:{sharedAsset:!0}})),x(yt,"innerEarMaterial",Object.assign(new O({color:10906457,roughness:.76,metalness:.02}),{userData:{sharedAsset:!0}})),x(yt,"cheekBlushMaterial",Object.assign(new O({color:13204323,roughness:.9,metalness:0}),{userData:{sharedAsset:!0}})),x(yt,"incisorMaterial",Object.assign(new O({color:16710119,roughness:.22,metalness:.04}),{userData:{sharedAsset:!0}})),x(yt,"legMaterial",Object.assign(new O({color:6699550,roughness:.82,metalness:.03}),{userData:{sharedAsset:!0}})),x(yt,"webbingMaterial",Object.assign(new O({color:4663316,roughness:.66,metalness:.04}),{userData:{sharedAsset:!0}})),x(yt,"clawMaterial",Object.assign(new O({color:2693648,roughness:.3,metalness:.16}),{userData:{sharedAsset:!0}})),x(yt,"whiskerMaterial",Object.assign(new O({color:15193536,roughness:.42,metalness:.05}),{userData:{sharedAsset:!0}})),x(yt,"yuzuMaterial",Object.assign(new O({color:16746496,normalMap:it.getCitrusPeelNormalMap(),normalScale:new ot(.24,.24),roughness:.24,metalness:.06}),{userData:{sharedAsset:!0}})),x(yt,"leafMaterial",Object.assign(new O({color:1409085,roughness:.48,metalness:.02}),{userData:{sharedAsset:!0}})),x(yt,"stemMaterial",Object.assign(new O({color:4531985,roughness:.82,metalness:.02}),{userData:{sharedAsset:!0}})),x(yt,"dachshundTanPointMaterial",Object.assign(new _e({color:14657379,roughness:.82,metalness:.02,sheen:.62,sheenRoughness:.6,sheenColor:new K(16707796)}),{userData:{sharedAsset:!0}})),x(yt,"sharedTorsoGeo",null),x(yt,"sharedHeadGeo",null),x(yt,"sharedSnoutGeo",null),x(yt,"sharedFurTuftGeo",null),x(yt,"sharedDachshundBarrelGeo",null),x(yt,"geoCache",new Map),x(yt,"matCache",new Map),x(yt,"leanTextureMode",!1);const he=`
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise3D(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  mat3 rot = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 3; i++) {
    v += a * noise3D(p);
    p = rot * p * 2.04 + vec3(13.7, 7.3, 5.1);
    a *= 0.5;
  }
  return v;
}

float fbm4(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  mat3 rot = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 4; i++) {
    v += a * noise3D(p);
    p = rot * p * 2.03 + vec3(13.7, 7.3, 5.1);
    a *= 0.5;
  }
  return v;
}

float fbm5(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  mat3 rot = mat3(
    0.00,  0.80,  0.60,
   -0.80,  0.36, -0.48,
   -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 5; i++) {
    v += a * noise3D(p);
    p = rot * p * 2.05 + vec3(17.1, 9.2, 3.7);
    a *= 0.5;
  }
  return v;
}

float ridgedFbm3(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  float weight = 1.0;
  for (int i = 0; i < 3; i++) {
    float n = 1.0 - abs(noise3D(p) * 2.0 - 1.0);
    n = n * n * weight;
    weight = clamp(n * 1.8, 0.0, 1.0);
    v += n * a;
    p = p * 2.12 + vec3(5.3, 11.9, 8.4);
    a *= 0.48;
  }
  return v;
}

float ridgedFbm4(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  float weight = 1.0;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(noise3D(p) * 2.0 - 1.0);
    n = n * n * weight;
    weight = clamp(n * 1.8, 0.0, 1.0);
    v += n * a;
    p = p * 2.12 + vec3(5.3, 11.9, 8.4);
    a *= 0.48;
  }
  return v;
}

vec3 acesToneMap(vec3 x) {
  x = max(x, vec3(0.0));
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
`;function re(y,t){const a=q.clamp(y,2e3,4e4)/100;let s,e,n;return a<=66?(s=255,e=99.4708025861*Math.log(a)-161.1195681661,n=a<=19?0:138.5177312231*Math.log(a-10)-305.0447927307):(s=329.698727446*Math.pow(a-60,-.1332047592),e=288.1221695283*Math.pow(a-60,-.0755148492),n=255),t.setRGB(q.clamp(s/255,0,1),q.clamp(e/255,0,1),q.clamp(n/255,0,1)),t}function le(y={}){const{baseSize:t=16,minPixelSize:a=1.8,maxPixelSize:s=44,diffractionStrength:e=.55,opacity:n=1,additive:o=!0}=y;return new Et({transparent:!0,depthWrite:!1,blending:o?Gt:la,uniforms:{uBaseSize:{value:t},uMinPx:{value:a},uMaxPx:{value:s},uDiffraction:{value:e},uOpacity:{value:n},uTime:{value:0}},vertexShader:`
      attribute vec3 color;
      attribute float aScale;
      attribute float aLuminosity;
      varying vec3 vStarColor;
      varying float vLum;
      varying float vFluxAtten;
      uniform float uBaseSize;
      uniform float uMinPx;
      uniform float uMaxPx;

      void main() {
        vStarColor = color;
        vLum = aLuminosity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = max(0.35, -mvPosition.z);
        float rawPx = uBaseSize * aScale * (28.0 / dist);
        // Conserve luminous flux when physical point size falls below uMinPx
        vFluxAtten = clamp(rawPx / uMinPx, 0.18, 1.0);
        gl_PointSize = clamp(rawPx, uMinPx, uMaxPx);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,fragmentShader:`
      varying vec3 vStarColor;
      varying float vLum;
      varying float vFluxAtten;
      uniform float uDiffraction;
      uniform float uOpacity;

      void main() {
        vec2 uv = (gl_PointCoord - 0.5) * 2.0;
        float r = length(uv);
        if (r > 1.0) discard;

        // Sharp Airy core + smooth optical halo falloff (zero square corners)
        float core = exp(-r * r * 22.0);
        float halo = 0.42 * exp(-r * 4.4) * (1.0 - smoothstep(0.68, 1.0, r));

        // Subtle 45-deg rotated HST 4-vane secondary-mirror spider diffraction spikes
        vec2 rotUv = vec2(uv.x * 0.966 - uv.y * 0.259, uv.x * 0.259 + uv.y * 0.966);
        float spikeX = exp(-abs(rotUv.y) * 30.0) * exp(-abs(rotUv.x) * 2.8);
        float spikeY = exp(-abs(rotUv.x) * 30.0) * exp(-abs(rotUv.y) * 2.8);
        float spikes = (spikeX + spikeY) * uDiffraction * smoothstep(0.45, 1.0, vLum) * (1.0 - r);

        float intensity = (core * 1.45 + halo + spikes) * (0.45 + 0.85 * vLum) * vFluxAtten;
        vec3 hdr = mix(vStarColor, vec3(1.0, 0.99, 0.97), clamp(core * 0.78, 0.0, 1.0)) * intensity;
        // Soft highlight compression prevents harsh white square clipping
        vec3 mapped = hdr / (vec3(1.0) + hdr * 0.42);
        float alpha = clamp(intensity * uOpacity, 0.0, 1.0);
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(mapped, alpha);
      }
    `})}function Pa(y=.92){return new Et({transparent:!0,depthWrite:!1,blending:Gt,uniforms:{uOpacity:{value:y}},vertexShader:`
      attribute vec3 color;
      attribute float aScale;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vSeed;

      void main() {
        vColor = color;
        vSeed = aSeed;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = max(1.0, -mvPosition.z);
        gl_PointSize = clamp(aScale * (120.0 / dist), 2.2, 26.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,fragmentShader:`
      varying vec3 vColor;
      varying float vSeed;
      uniform float uOpacity;

      void main() {
        vec2 p = (gl_PointCoord - 0.5) * 2.0;
        float angle = vSeed * 6.2831853;
        float ca = cos(angle);
        float sa = sin(angle);
        vec2 q = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
        // Inclination squash simulates edge-on vs face-on deep-field galaxies
        float incl = 0.32 + 0.68 * fract(vSeed * 7.13);
        q.y /= incl;
        float r = length(q);
        if (r > 1.0) discard;

        float isSpiral = step(0.35, fract(vSeed * 13.7));
        float theta = atan(q.y, q.x);
        float armWave = 0.5 + 0.5 * cos(2.0 * theta - 7.5 * log(max(0.06, r)));
        float bulge = exp(-r * r * 18.0);
        float disk = exp(-r * 3.4) * mix(1.0, 0.45 + 0.75 * armWave, isSpiral * smoothstep(0.1, 0.45, r));
        float edgeFade = 1.0 - smoothstep(0.65, 1.0, r);
        float lum = (bulge * 1.3 + disk * 0.75) * edgeFade;

        vec3 coreCol = vec3(1.0, 0.93, 0.78);
        vec3 col = mix(vColor, coreCol, clamp(bulge * 1.2, 0.0, 1.0)) * lum;
        col = col / (vec3(1.0) + col * 0.5);
        gl_FragColor = vec4(col, clamp(lum * uOpacity, 0.0, 0.95));
      }
    `})}function Ga(y){const{seedOffset:t=0,hubblePaletteMix:a=.35,opacity:s=.88,isInnerCore:e=!1}=y;return new Et({transparent:!0,depthWrite:!1,side:Ot,blending:la,uniforms:{uTime:{value:0},uSeed:{value:t},uHubbleMix:{value:a},uOpacity:{value:s},uInnerCore:{value:e?1:0}},vertexShader:`
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vViewDir;
      varying vec3 vNormalView;

      void main() {
        vUv = uv;
        vLocalPos = position;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,fragmentShader:`
      ${he}
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vViewDir;
      varying vec3 vNormalView;
      uniform float uTime;
      uniform float uSeed;
      uniform float uHubbleMix;
      uniform float uOpacity;
      uniform float uInnerCore;

      void main() {
        vec2 centered = (vUv - 0.5) * 2.0;
        float r2d = length(centered);
        // Smooth radial falloff to strict 0 before quad perimeter -> zero polygon edges!
        float radialMask = pow(clamp(1.0 - r2d, 0.0, 1.0), 1.85);
        if (radialMask <= 0.002) discard;

        vec3 sampleCoord = vLocalPos * 0.14 + vec3(uSeed * 3.7, uSeed * 1.9, uTime * 0.012);
        // Fast streamlined turbulent gas filaments (Orion / Carina H-II shock structure)
        vec3 warp = vec3(
          fbm3(sampleCoord * 1.15 + vec3(1.2, 4.5, 2.1)),
          fbm3(sampleCoord * 1.15 + vec3(6.8, 2.3, 8.4)),
          0.5
        );
        float gas = fbm4(sampleCoord * 1.6 + (warp - 0.5) * 2.2);
        float ridges = ridgedFbm3(sampleCoord * 2.1 + (warp - 0.5) * 1.7);
        float dust = fbm3(sampleCoord * 2.6 - warp * 1.3 + vec3(11.0));

        // Central stellar-wind cavity (Trapezium-like blown bubble) + bright ionization wall
        float cavity = smoothstep(0.06, 0.44, r2d + (gas - 0.5) * 0.26);
        float ionWall = exp(-pow((r2d - 0.34 + (ridges - 0.5) * 0.22) * 3.8, 2.0));

        // Natural Broadband (H-alpha crimson-rose + O-III cyan-teal + reflection blue)
        vec3 hAlphaNat = vec3(0.88, 0.16, 0.30);
        vec3 oIII_Nat  = vec3(0.10, 0.68, 0.86);
        vec3 reflBlue  = vec3(0.22, 0.44, 0.95);

        // Hubble SHO Narrowband (S-II ruby-gold, H-alpha warm gold-emerald, O-III deep sapphire-cyan)
        vec3 sII_Sho   = vec3(0.95, 0.46, 0.14);
        vec3 hAlphaSho = vec3(0.86, 0.66, 0.24);
        vec3 oIII_Sho  = vec3(0.08, 0.62, 0.88);

        vec3 colOuter = mix(hAlphaNat, sII_Sho, uHubbleMix);
        vec3 colMid   = mix(reflBlue, hAlphaSho, uHubbleMix);
        vec3 colInner = mix(oIII_Nat, oIII_Sho, uHubbleMix);

        float o3Weight = clamp(ionWall * 0.9 + (1.0 - r2d) * 0.55 + uInnerCore * 0.35, 0.0, 1.0);
        vec3 emission = mix(colOuter, colMid, clamp(ridges, 0.0, 1.0));
        emission = mix(emission, colInner, o3Weight);

        // Bright ionization shock ridges without whiteout
        float shockGlow = pow(clamp(ridges, 0.0, 1.0), 2.4) * 1.35 + ionWall * 0.75;
        vec3 hdr = emission * (0.42 + gas * 1.15 + shockGlow) * mix(0.62, 1.0, cavity);

        // Dark foreground Bok-globule dust lanes absorbing background emission!
        float dustLane = smoothstep(0.54, 0.82, dust) * smoothstep(0.15, 0.75, r2d);
        vec3 dustTint = vec3(0.035, 0.022, 0.028);
        vec3 toneMapped = acesToneMap(hdr * 1.15);
        vec3 finalRgb = mix(toneMapped, dustTint, dustLane * 0.84);

        float density = clamp((gas * 0.72 + ridges * 0.52 + dustLane * 0.45) * radialMask, 0.0, 1.0);
        float alpha = clamp(density * uOpacity, 0.0, 0.88);
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(finalRgb, alpha);
      }
    `})}function gs(y){const{seed:t=1,hubblePaletteMix:a=.45,opacity:s=.96}=y;return new Et({transparent:!0,depthWrite:!1,side:Ot,blending:la,uniforms:{uTime:{value:0},uSeed:{value:t},uHubbleMix:{value:a},uOpacity:{value:s}},vertexShader:`
      varying vec2 vUv;
      varying vec3 vLocalPos;

      void main() {
        vUv = uv;
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec2 vUv;
      varying vec3 vLocalPos;
      uniform float uTime;
      uniform float uSeed;
      uniform float uHubbleMix;
      uniform float uOpacity;

      void main() {
        // vUv.y: 0.0 = wide dusty base, 1.0 = photo-evaporating protostellar tip
        float y = vUv.y;
        float x = (vUv.x - 0.5) * 2.0;

        vec3 p = vec3(x * 2.4, y * 4.6, uSeed * 5.3 + uTime * 0.01);
        float billow = fbm3(p * 1.45);
        float crags  = ridgedFbm3(p * 2.6 + vec3(billow * 1.2));

        // Tapering trunk width with organic FBM billowing fingers near top
        float halfWidth = mix(0.62, 0.20, pow(y, 0.82)) + (billow - 0.5) * 0.38;
        // Rounded protostellar head cap around y ~ 0.84, fading to wispy evaporating streamers above
        float capDist = length(vec2(x / max(0.12, halfWidth), max(0.0, (y - 0.82) / 0.16)));
        float bodyField = 1.0 - smoothstep(0.58, 1.02, max(abs(x) / max(0.12, halfWidth), capDist - 0.12));
        // Soft base fade so bottom never shows a flat horizontal cut
        float baseFade = smoothstep(0.0, 0.22, y);
        float silhouette = clamp(bodyField * baseFade * (0.65 + 0.65 * billow), 0.0, 1.0);

        // Outer UV-ionized photo-evaporative halo & crisp rim lighting from OB stars above (+Y)
        float outerHalo = (1.0 - smoothstep(0.75, 1.42, max(abs(x) / max(0.14, halfWidth), capDist - 0.05))) * baseFade;
        float rimBand = clamp(outerHalo - silhouette * 0.82, 0.0, 1.0);
        float topIllum = smoothstep(0.32, 0.92, y + (crags - 0.5) * 0.25);

        // Cold opaque dark dust core vs warm infrared dust folds vs bright ionized rim
        vec3 darkCore = vec3(0.032, 0.020, 0.024);
        vec3 warmFold = mix(vec3(0.34, 0.13, 0.07), vec3(0.42, 0.20, 0.06), uHubbleMix);
        vec3 rimGold  = mix(vec3(0.95, 0.42, 0.24), vec3(1.0, 0.72, 0.26), uHubbleMix);
        vec3 rimCyan  = vec3(0.14, 0.78, 0.96);

        vec3 interior = mix(darkCore, warmFold, clamp(crags * 0.65 * (0.35 + 0.65 * topIllum), 0.0, 0.85));
        vec3 rimHdr = rimGold * (rimBand * (1.6 + 1.8 * topIllum)) + rimCyan * (outerHalo * 0.45 * topIllum);

        // Embedded nascent protostar IR glint right inside the pillar tip
        float tipDist = length(vec2(x * 2.8, (y - 0.80) * 5.5));
        vec3 irStar = vec3(1.0, 0.82, 0.52) * exp(-tipDist * tipDist * 9.0) * 1.4;

        vec3 rgb = acesToneMap(interior + rimHdr + irStar);
        float edgeFadeX = 1.0 - smoothstep(0.68, 0.98, abs(x));
        float edgeFadeY = 1.0 - smoothstep(0.84, 0.99, y);
        float alpha = clamp((silhouette * 0.94 + outerHalo * 0.36 * topIllum) * edgeFadeX * edgeFadeY * uOpacity, 0.0, 0.96);
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(rgb, alpha);
      }
    `})}function yo(y){const{arms:t=2,opacity:a=.94,morphology:s="spiral"}=y,e=s==="barred_spiral"?1:s==="elliptical"?2:s==="irregular"?3:0;return new Et({transparent:!0,depthWrite:!1,side:Ot,blending:la,uniforms:{uArms:{value:t},uOpacity:{value:a},uTime:{value:0},uMorphology:{value:e}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec2 vUv;
      uniform float uArms;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uMorphology;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;

        float theta = atan(p.y, p.x);
        vec3 nCoord = vec3(p * 4.5, uTime * 0.01);
        vec3 mapped = vec3(0.0);
        float alpha = 0.0;

        if (uMorphology < 0.5) {
          // --- 0. GRAND-DESIGN SPIRAL GALAXY ---
          float logR = log(max(0.035, r));
          float spiralPhase = uArms * theta - 4.8 * logR;
          float arm = pow(0.5 + 0.5 * cos(spiralPhase), 2.2);
          float spur = pow(0.5 + 0.5 * cos(spiralPhase * 2.0 + 1.1), 3.5) * 0.45;
          // Orion-Cygnus Spur bridge around Earth's galactic location (~26,000 ly = 0.495 R_gal, theta ~ 1.22)
          vec2 orionLocal = p - vec2(0.495 * cos(1.22), 0.495 * sin(1.22));
          float orionSpur = exp(-dot(orionLocal, orionLocal) * 32.0) * 0.65;

          float turb = fbm3(nCoord + vec3(cos(spiralPhase) * 0.4, sin(spiralPhase) * 0.4, 0.0));
          float dustNoise = ridgedFbm3(nCoord * 1.9 + vec3(3.1));

          float bulge = exp(-pow(r / 0.19, 1.35)) * 2.4 + exp(-r * r * 140.0) * 2.2;
          float discEnv = exp(-r * 3.1) * (1.0 - smoothstep(0.76, 1.0, r));
          float armDensity = discEnv * (0.28 + 1.25 * (arm + spur + orionSpur) * (0.55 + 0.75 * turb));

          float dustPhase = pow(0.5 + 0.5 * cos(spiralPhase + 0.58), 5.0);
          float dustLane = dustPhase * dustNoise * smoothstep(0.08, 0.24, r) * (1.0 - smoothstep(0.68, 0.95, r));
          float hiiKnots = (pow(arm, 4.0) + orionSpur * 0.55) * smoothstep(0.58, 0.85, turb) * smoothstep(0.14, 0.35, r) * discEnv;

          vec3 bulgeCol = vec3(1.0, 0.86, 0.64);
          vec3 armCol   = vec3(0.48, 0.70, 1.0);
          vec3 hiiCol   = vec3(0.96, 0.24, 0.48);
          vec3 dustCol  = vec3(0.035, 0.022, 0.026);

          vec3 hdr = bulgeCol * bulge + armCol * armDensity * 1.35 + hiiCol * hiiKnots * 2.6;
          mapped = acesToneMap(hdr);
          mapped = mix(mapped, dustCol, clamp(dustLane * 1.35, 0.0, 0.88));
          alpha = clamp((bulge * 0.55 + armDensity * 1.15 + dustLane * 0.55), 0.0, 0.95) * uOpacity;
        } else if (uMorphology < 1.5) {
          // --- 1. BARRED SPIRAL GALAXY (SBb) ---
          float barDist = length(vec2(p.x * 0.9, p.y * 3.2));
          float barBody = exp(-pow(barDist / 0.42, 2.0)) * smoothstep(0.48, 0.04, abs(p.y)) * 2.9;
          float barBulge = exp(-pow(r / 0.16, 1.35)) * 3.1 + exp(-r * r * 160.0) * 2.4;

          float logR = log(max(0.18, r));
          float barSpiralPhase = 2.0 * theta - 4.4 * logR + 0.75;
          float barArm = pow(0.5 + 0.5 * cos(barSpiralPhase), 2.8) * smoothstep(0.24, 0.55, r);
          vec2 orionLocal = p - vec2(0.495 * cos(1.22), 0.495 * sin(1.22));
          float orionSpur = exp(-dot(orionLocal, orionLocal) * 30.0) * 0.6;

          float turb = fbm3(nCoord * 1.1 + vec3(0.4, 0.8, 0.0));
          float dustNoise = ridgedFbm3(nCoord * 2.2 + vec3(1.7));
          float discEnv = exp(-r * 2.9) * (1.0 - smoothstep(0.78, 1.0, r));
          float barArmDensity = discEnv * (0.24 + 1.35 * (barArm + orionSpur) * (0.6 + 0.7 * turb));

          // Leading-edge dust lanes along stellar bar and inner spiral arms
          float barDust = smoothstep(0.03, 0.12, abs(p.y)) * smoothstep(0.45, 0.05, abs(p.y)) * smoothstep(0.05, 0.38, abs(p.x)) * dustNoise * 0.85;
          float armDust = pow(0.5 + 0.5 * cos(barSpiralPhase + 0.62), 4.6) * dustNoise * smoothstep(0.22, 0.75, r);
          float totalDust = clamp(barDust + armDust, 0.0, 1.0);

          float hiiKnots = (pow(barArm, 3.5) + orionSpur * 0.5) * smoothstep(0.55, 0.82, turb) * smoothstep(0.25, 0.45, r) * discEnv;

          vec3 bulgeCol = vec3(1.0, 0.88, 0.66);
          vec3 barCol   = vec3(0.95, 0.82, 0.60);
          vec3 armCol   = vec3(0.44, 0.68, 1.0);
          vec3 hiiCol   = vec3(0.98, 0.22, 0.46);
          vec3 dustCol  = vec3(0.03, 0.018, 0.022);

          vec3 hdr = bulgeCol * barBulge + barCol * barBody * 1.2 + armCol * barArmDensity * 1.4 + hiiCol * hiiKnots * 2.8;
          mapped = acesToneMap(hdr);
          mapped = mix(mapped, dustCol, clamp(totalDust * 1.3, 0.0, 0.88));
          alpha = clamp((barBulge * 0.55 + barBody * 0.65 + barArmDensity * 1.1 + totalDust * 0.5), 0.0, 0.95) * uOpacity;
        } else if (uMorphology < 2.5) {
          // --- 2. GIANT ELLIPTICAL GALAXY (E3) ---
          float ellipR = length(vec2(p.x, p.y * 1.35));
          float deVauc = exp(-7.67 * (pow(max(0.001, ellipR / 0.32), 0.25) - 1.0));
          float ellipCore = exp(-pow(ellipR / 0.13, 1.2)) * 3.4;
          float ellipHalo = exp(-ellipR * 2.3) * (1.0 - smoothstep(0.80, 1.0, ellipR));

          float subtleGranulation = fbm3(vec3(p * 2.5, uTime * 0.005)) * 0.12;

          vec3 ellipCenterCol = vec3(1.0, 0.90, 0.72);
          vec3 ellipMidCol    = vec3(0.96, 0.78, 0.54);
          vec3 ellipOuterCol  = vec3(0.85, 0.62, 0.40);
          vec3 col = mix(ellipCenterCol, ellipMidCol, smoothstep(0.05, 0.45, ellipR));
          col = mix(col, ellipOuterCol, smoothstep(0.45, 0.85, ellipR));

          vec3 hdr = col * (deVauc * 1.85 + ellipCore + ellipHalo * 0.9 + subtleGranulation);
          mapped = acesToneMap(hdr);
          alpha = clamp((deVauc * 1.45 + ellipCore * 0.75 + ellipHalo * 0.85), 0.0, 0.95) * uOpacity;
        } else {
          // --- 3. CLUMPY IRREGULAR / STARBURST GALAXY (Irr / LMC) ---
          vec2 irrP = p - vec2(0.12, -0.09);
          float irrR = length(irrP);
          float irrTurb = fbm3(vec3(p * 3.6, uTime * 0.012));
          float irrTurb2 = fbm3(vec3((p + 1.4) * 5.4, uTime * 0.018));
          float dustNoise = ridgedFbm3(vec3(p * 3.2, 0.5));

          float irrCore = exp(-pow(irrR / 0.24, 1.4)) * 2.4;
          float discEnv = exp(-length(p) * 2.2) * (1.0 - smoothstep(0.74, 1.0, length(p)));
          float irrClumps = pow(irrTurb, 2.2) * discEnv * 3.8;
          float hiiStarburst = pow(irrTurb2, 3.2) * smoothstep(0.42, 0.82, irrTurb) * discEnv * 4.2;

          // Asymmetric chaotic dust ribbons
          float irrDust = dustNoise * smoothstep(0.35, 0.75, irrTurb) * smoothstep(0.1, 0.6, length(p));

          vec3 coreCol = vec3(1.0, 0.85, 0.66);
          vec3 clumpCol = vec3(0.45, 0.74, 1.0);
          vec3 hiiCol = vec3(0.98, 0.20, 0.52);
          vec3 dustCol = vec3(0.03, 0.02, 0.025);

          vec3 hdr = coreCol * irrCore + clumpCol * irrClumps * 1.35 + hiiCol * hiiStarburst * 2.5;
          mapped = acesToneMap(hdr);
          mapped = mix(mapped, dustCol, clamp(irrDust * 1.1, 0.0, 0.84));
          alpha = clamp((irrCore * 0.65 + irrClumps * 1.1 + hiiStarburst * 0.85 + irrDust * 0.4), 0.0, 0.95) * uOpacity;
        }

        alpha *= 1.0 - smoothstep(0.82, 1.0, r);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(mapped, alpha);
      }
    `})}function za(y=.55){return new Et({transparent:!0,depthWrite:!1,side:Ot,blending:Gt,uniforms:{uOpacity:{value:y},uTime:{value:0}},vertexShader:`
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec2 vUv;
      varying vec3 vPos;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        // Transverse cross-section fade: 0 at ribbon edges, 1 along central gravitational spine
        float crossProfile = pow(sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265), 2.2);
        float endFade = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265);
        float n = fbm4(vPos * 0.35 + vec3(0.0, 0.0, uTime * 0.02));
        float density = crossProfile * pow(endFade, 0.55) * (0.45 + 0.85 * n);

        // Warm golden cluster nodes at ends -> cool cobalt-violet WHIM baryon bridge in voids
        float nodeProximity = 1.0 - endFade;
        vec3 whimCol = mix(vec3(0.28, 0.46, 0.92), vec3(0.98, 0.78, 0.42), pow(nodeProximity, 1.6));
        vec3 col = acesToneMap(whimCol * density * 1.35);
        float alpha = clamp(density * uOpacity, 0.0, 0.75);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `})}function ws(y=.82){return new Et({transparent:!0,depthWrite:!1,side:Fa,uniforms:{uOpacity:{value:y},uTime:{value:0}},vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vDir;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        // Acoustic baryon-photon oscillation peaks (1 deg scale speckles + Sachs-Wolfe quadrupole)
        float largeScale = fbm3(vDir * 2.6);
        float acousticPeak = fbm4(vDir * 14.5 + vec3(largeScale * 0.8));
        float fineScale = noise3D(vDir * 36.0) * 0.22;
        float dt = clamp(0.48 * acousticPeak + 0.34 * largeScale + fineScale, 0.0, 1.0);

        // Authentic Planck Collaboration microkelvin temperature colormap
        vec3 coldDeep = vec3(0.02, 0.08, 0.34);
        vec3 coldCyan = vec3(0.08, 0.48, 0.78);
        vec3 neutral  = vec3(0.88, 0.89, 0.76);
        vec3 warmGold = vec3(0.94, 0.54, 0.14);
        vec3 hotRed   = vec3(0.62, 0.08, 0.05);

        vec3 col;
        if (dt < 0.35) {
          col = mix(coldDeep, coldCyan, dt / 0.35);
        } else if (dt < 0.52) {
          col = mix(coldCyan, neutral, (dt - 0.35) / 0.17);
        } else if (dt < 0.72) {
          col = mix(neutral, warmGold, (dt - 0.52) / 0.20);
        } else {
          col = mix(warmGold, hotRed, (dt - 0.72) / 0.28);
        }

        gl_FragColor = vec4(col * 0.88, uOpacity);
      }
    `})}function vo(){return new Et({transparent:!0,depthWrite:!0,uniforms:{uTime:{value:0},uOpacity:{value:1},uAlphaRatio:{value:1}},vertexShader:`
      varying vec3 vNormalObj;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vNormalObj = normalize(position);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vNormalObj;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uAlphaRatio;

      void main() {
        float mu = clamp(dot(vNormalView, vViewDir), 0.0, 1.0);
        // Eddington solar limb darkening law I(mu) = 0.4 + 0.6*mu
        float limb = pow(mu, 0.52);

        vec3 p = vNormalObj * 9.5 + vec3(uTime * 0.08, -uTime * 0.05, uTime * 0.06);
        float gran = fbm5(p * 2.2);
        float superGran = ridgedFbm4(vNormalObj * 5.0 + vec3(uTime * 0.04));
        float spotField = fbm4(vNormalObj * 3.8 + vec3(2.4));
        float sunspot = smoothstep(0.73, 0.81, spotField) * smoothstep(0.55, 0.15, abs(vNormalObj.y));

        vec3 coreWhite = vec3(1.0, 0.97, 0.88);
        vec3 midGold   = vec3(1.0, 0.72, 0.22);
        vec3 limbAmber = vec3(0.88, 0.32, 0.06);
        vec3 umbra     = vec3(0.18, 0.05, 0.01);

        vec3 photo = mix(limbAmber, midGold, smoothstep(0.0, 0.58, limb));
        photo = mix(photo, coreWhite, smoothstep(0.45, 1.0, limb) * (0.55 + 0.45 * gran));
        photo += vec3(0.28, 0.16, 0.04) * superGran * (1.0 - limb * 0.5);
        photo = mix(photo, umbra, sunspot * 0.85);

        float alphaBoost = clamp(uAlphaRatio, 0.55, 2.3);
        vec3 tempTint = mix(vec3(0.86, 0.94, 1.06), vec3(1.10, 0.94, 0.82), smoothstep(0.65, 1.85, alphaBoost));
        photo *= tempTint * (0.78 + 0.22 * alphaBoost);

        gl_FragColor = vec4(acesToneMap(photo * 1.45), uOpacity);
      }
    `})}function Wa(y,t){const a=((t==null?void 0:t.sanctuaryDir)??new X(.6188,.3827,.6867)).clone().normalize();return new Et({transparent:!0,depthWrite:!0,uniforms:{uSunDir:{value:y.clone().normalize()},uTime:{value:0},uOpacity:{value:1},uUseSphereDirAttr:{value:t!=null&&t.useSphereDirAttr?1:0},uDetailScale:{value:0},uSanctuaryDir:{value:a}},vertexShader:`
      ${t!=null&&t.useSphereDirAttr?"attribute vec3 aSphereDir;":""}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vObjPos = ${t!=null&&t.useSphereDirAttr?"normalize(aSphereDir)":"normalize(position)"};
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDetailScale;
      uniform vec3 uSanctuaryDir;

      void main() {
        vec3 p = normalize(vObjPos);
        float detailWeight = clamp(uDetailScale, 0.0, 1.0);

        vec3 warp = vec3(
          noise3D(p * 2.2 + vec3(1.7)) - 0.5,
          noise3D(p * 2.2 + vec3(8.3)) - 0.5,
          noise3D(p * 2.2 + vec3(4.9)) - 0.5
        );
        float cont = fbm3(p * 2.75 + warp * 0.95);
        float ridges = ridgedFbm3(p * 10.5 + warp * 1.3);
        float detail = fbm3(p * 24.0);

        // Anchor the primary Sanctuary continent & archipelago smoothly around uSanctuaryDir (22.5N, 42.0E)
        vec3 sDir = normalize(uSanctuaryDir);
        vec3 relP = p - sDir;
        float dSanc = length(relP);
        float continentPedestal = exp(-pow(dSanc / 0.24, 2.0)) * 0.165;
        float islandArchipelago = exp(-pow(dSanc / 0.042, 2.0)) * 0.075;

        // Multi-scale organic FBM terrain & fjord coastlines (zero radial bullseye rings or high-freq hash aliasing!)
        if (detailWeight > 0.01) {
          float regionalMtn = ridgedFbm3(p * 42.0 + warp * 0.55);
          float coastalFbm = fbm3(p * 145.0) - 0.48;
          float valleyDetail = (fbm3(p * 320.0 + vec3(regionalMtn * 0.6)) - 0.50) * 0.09;
          // Gently calm extreme jagged ridge height right inside the landing valley so it reads as a lush emerald basin
          float valleyCalm = smoothstep(0.014, 0.068, dSanc);
          cont += (coastalFbm * 0.11 + valleyDetail + (regionalMtn - 0.34) * 0.075 * valleyCalm) * detailWeight;
          ridges = mix(ridges, clamp(ridges * 0.48 + regionalMtn * 0.62, 0.0, 1.0), detailWeight * 0.72 * valleyCalm);
          detail = mix(detail, clamp(detail * 0.48 + (coastalFbm + 0.5) * 0.60, 0.0, 1.0), detailWeight * 0.78);
        }
        cont += continentPedestal + islandArchipelago;

        float seaLevel = 0.505;
        float coastFeather = mix(0.012, 0.0038, detailWeight);
        float isLand = smoothstep(seaLevel - coastFeather * 0.7, seaLevel + coastFeather, cont);
        float elev = clamp((cont - seaLevel) / (1.0 - seaLevel), 0.0, 1.0);
        float mountain = pow(ridges, 1.85) * smoothstep(0.04, 0.36, elev);

        // Single-pass hardware derivatives compute crisp terrain normal shading without screen-space sparkle
        float reliefVal = cont + mountain * 0.28;
        vec3 dPosX = dFdx(vWorldPos);
        vec3 dPosY = dFdy(vWorldPos);
        vec3 gradSurf = vec3(dFdx(reliefVal), dFdy(reliefVal), 0.0);
        float bumpStrength = mix(10.0, 16.0, detailWeight) * isLand;
        vec3 baseN = normalize(vWorldNormal);
        vec3 tangPerturb = normalize(dPosX + vec3(1e-6)) * (-gradSurf.x * bumpStrength)
                         + normalize(dPosY + vec3(1e-6)) * (-gradSurf.y * bumpStrength);
        vec3 N = normalize(baseN + clamp(tangPerturb, -0.38, 0.38));
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float lat = abs(p.y);
        float polarIce = smoothstep(0.76 - detail * 0.08, 0.86, lat + mountain * 0.18);

        // Bathymetric ocean colors (deep sapphire ocean -> turquoise coral reefs)
        float shelf = smoothstep(seaLevel - 0.085, seaLevel, cont);
        vec3 abyssalOcean = vec3(0.012, 0.055, 0.16);
        vec3 shallowReef  = vec3(0.04, 0.38, 0.52);
        vec3 beachSand    = vec3(0.76, 0.70, 0.54);
        vec3 oceanAlbedo  = mix(abyssalOcean, shallowReef, pow(shelf, 2.0));

        // Lush Sanctuary rainforest + alpine granite peaks + high-elevation snowcaps
        float aridity = smoothstep(0.18, 0.40, lat) * (1.0 - smoothstep(0.40, 0.64, lat)) * smoothstep(0.42, 0.72, detail);
        aridity *= smoothstep(0.03, 0.16, dSanc);

        vec3 lushForest  = vec3(0.068, 0.31, 0.105);
        vec3 brightCanopy = vec3(0.145, 0.44, 0.165);
        vec3 gladeMeadow  = vec3(0.22, 0.54, 0.21);
        vec3 desertSand  = vec3(0.62, 0.50, 0.34);
        vec3 alpineRock  = vec3(0.28, 0.30, 0.33);
        vec3 snowCap     = vec3(0.92, 0.96, 1.0);

        vec3 landAlbedo = mix(lushForest, brightCanopy, smoothstep(0.30, 0.74, detail));
        landAlbedo = mix(landAlbedo, desertSand, aridity * 0.78);
        float rockMask = smoothstep(0.28, 0.58, mountain + elev * 0.36) * smoothstep(0.018, 0.065, dSanc);
        landAlbedo = mix(landAlbedo, alpineRock, rockMask);
        landAlbedo = mix(landAlbedo, snowCap, smoothstep(0.56, 0.80, mountain + elev * 0.30) * smoothstep(0.025, 0.075, dSanc));
        // Coherent sunlit emerald valley & central glade clearing hint around uSanctuaryDir
        float valleyGreen = (1.0 - smoothstep(0.012, 0.055, dSanc)) * detailWeight;
        float centerClearing = (1.0 - smoothstep(0.002, 0.011, dSanc)) * detailWeight;
        landAlbedo = mix(landAlbedo, brightCanopy, valleyGreen * 0.45);
        landAlbedo = mix(landAlbedo, gladeMeadow, centerClearing * 0.65);

        // Slim sandy coral shoreline strictly along coast threshold
        float beachMask = (1.0 - smoothstep(0.0, 0.015, elev)) * isLand * detailWeight;
        landAlbedo = mix(landAlbedo, beachSand, beachMask * 0.65);

        vec3 albedo = mix(oceanAlbedo, landAlbedo, isLand);
        albedo = mix(albedo, snowCap, polarIce);

        // Solar illumination + warm sunset terminator scattering + Fresnel ocean sun-glint
        float ndl = dot(N, L);
        float dayFactor = smoothstep(-0.08, 0.12, ndl);
        float diffuse = max(0.0, ndl);
        float twilight = exp(-pow((ndl + 0.01) * 9.5, 2.0)) * 0.35;

        vec3 H = normalize(L + V);
        float fresnel = 0.03 + 0.97 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
        float spec = pow(max(0.0, dot(N, H)), 96.0) * (1.0 - isLand) * (1.0 - polarIce) * dayFactor;
        vec3 glint = vec3(1.0, 0.90, 0.72) * spec * (0.65 + 0.85 * fresnel);

        float nightMask = smoothstep(0.02, -0.18, ndl) * isLand * (1.0 - polarIce);
        float coastal = (1.0 - smoothstep(0.0, 0.16, elev));
        float cityClusters = pow(smoothstep(0.60, 0.82, detail), 2.5) * coastal;
        vec3 nightLights = vec3(1.0, 0.72, 0.32) * cityClusters * nightMask * 0.55;

        vec3 ambientNight = albedo * mix(0.025, 0.10, detailWeight);
        vec3 sunsetTint = vec3(0.92, 0.36, 0.14) * twilight * albedo * 1.4;
        vec3 lit = albedo * (diffuse * 1.35) + sunsetTint + glint + nightLights + ambientNight;

        gl_FragColor = vec4(acesToneMap(lit), uOpacity);
      }
    `})}function Ms(y,t){const a=((t==null?void 0:t.sanctuaryDir)??new X(.6188,.3827,.6867)).clone().normalize();return new Et({transparent:!0,depthWrite:!1,side:t!=null&&t.doubleSide?Ot:Js,uniforms:{uSunDir:{value:y.clone().normalize()},uTime:{value:0},uOpacity:{value:.88},uUseSphereDirAttr:{value:t!=null&&t.useSphereDirAttr?1:0},uDetailScale:{value:0},uCloudClear:{value:0},uSanctuaryDir:{value:a}},vertexShader:`
      ${t!=null&&t.useSphereDirAttr?"attribute vec3 aSphereDir;":""}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;

      void main() {
        vObjPos = ${t!=null&&t.useSphereDirAttr?"normalize(aSphereDir)":"normalize(position)"};
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDetailScale;
      uniform float uCloudClear;
      uniform vec3 uSanctuaryDir;

      void main() {
        vec3 dir = normalize(vObjPos);
        vec3 p = dir * 3.4 + vec3(uTime * 0.008, 0.0, -uTime * 0.006);
        // Coriolis zonal trade-wind swirl
        p.x += sin(dir.y * 7.0) * 0.45;
        vec3 warp = vec3(fbm3(p * 1.3), fbm3(p * 1.3 + vec3(5.2)), fbm3(p * 1.3 + vec3(9.1)));
        float n = fbm3(p * 1.85 + (warp - 0.5) * 1.6);

        if (uDetailScale > 0.02) {
          float fineCumulus = noise3D(dir * 48.0 + vec3(uTime * 0.02, 0.0, -uTime * 0.015));
          float billow = noise3D(dir * 16.0 - vec3(uTime * 0.01, 0.0, uTime * 0.012));
          n = mix(
            n,
            clamp(n * 0.45 + billow * 0.35 + fineCumulus * 0.34, 0.0, 1.0),
            clamp(uDetailScale, 0.0, 1.0) * 0.72
          );
        }

        // Smoothly open a sunlit atmospheric descent window over the emerald valley framed by a rich cumulus cloud ring
        float dSanc = length(dir - normalize(uSanctuaryDir));
        float approachRing = smoothstep(0.012, 0.048, dSanc) * (1.0 - smoothstep(0.11, 0.24, dSanc));
        n = clamp(n + approachRing * clamp(uDetailScale, 0.0, 1.0) * 0.24, 0.0, 1.0);
        float clearWindow = mix(1.0, smoothstep(0.008, 0.036, dSanc), clamp(uCloudClear, 0.0, 1.0));

        float cloud = smoothstep(0.40, 0.66, n) * clearWindow;
        if (cloud < 0.01) discard;

        float ndl = dot(normalize(vWorldNormal), normalize(uSunDir));
        float day = smoothstep(-0.14, 0.22, ndl);
        float sunset = exp(-pow((ndl + 0.02) * 7.5, 2.0));

        vec3 dayWhite = vec3(0.98, 0.99, 1.0);
        vec3 duskCoral = vec3(0.98, 0.56, 0.32);
        vec3 nightCloud = vec3(0.02, 0.035, 0.06);

        vec3 col = mix(nightCloud, dayWhite * (0.48 + 0.62 * max(0.0, ndl)), day);
        col += duskCoral * sunset * 0.35;
        gl_FragColor = vec4(acesToneMap(col), cloud * uOpacity);
      }
    `})}function ys(y){const{sunDir:t,rayleighColor:a=new K(.18,.54,1),intensity:s=1.35}=y;return new Et({transparent:!0,depthWrite:!1,side:Fa,blending:Gt,uniforms:{uSunDir:{value:t.clone().normalize()},uRayleigh:{value:a},uIntensity:{value:s},uOpacity:{value:1}},vertexShader:`
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      uniform vec3 uSunDir;
      uniform vec3 uRayleigh;
      uniform float uIntensity;
      uniform float uOpacity;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // BackSide normal faces outward from sphere center; grazing limb is where dot(N, -V) -> 0
        float viewGrazing = clamp(1.0 - abs(dot(N, V)), 0.0, 1.0);
        float limbOpticalDepth = pow(viewGrazing, 2.8) * smoothstep(0.0, 0.42, viewGrazing);

        float sunAngle = dot(N, L);
        float dayScatter = smoothstep(-0.28, 0.45, sunAngle);
        float terminatorGlow = exp(-pow((sunAngle + 0.06) * 5.2, 2.0));
        // Forward Mie scattering when looking near the Sun behind the planet limb
        float cosTheta = clamp(dot(-V, L), 0.0, 1.0);
        float mieForward = pow(cosTheta, 6.0) * 0.55;

        vec3 sunsetAmber = vec3(1.0, 0.38, 0.12);
        vec3 scatterCol = mix(uRayleigh, sunsetAmber, clamp(terminatorGlow * 0.72, 0.0, 0.85));
        vec3 hdr = scatterCol * limbOpticalDepth * (dayScatter + terminatorGlow * 0.55 + mieForward) * uIntensity;
        vec3 mapped = acesToneMap(hdr);
        float alpha = clamp(length(mapped) * uOpacity, 0.0, 0.95);
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(mapped, alpha);
      }
    `})}function Ha(y){const{sunDir:t,baseColorHex:a=9141876,highlandColorHex:s=13358561}=y;return new Et({transparent:!0,depthWrite:!0,uniforms:{uSunDir:{value:t.clone().normalize()},uBaseCol:{value:new K(a)},uHighCol:{value:new K(s)},uOpacity:{value:1}},vertexShader:`
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;

      void main() {
        vObjPos = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;
      uniform vec3 uBaseCol;
      uniform vec3 uHighCol;
      uniform float uOpacity;

      float craterHeight(vec3 p) {
        float maria = fbm4(p * 2.2);
        float r1 = ridgedFbm4(p * 7.5);
        float r2 = ridgedFbm4(p * 18.0) * 0.45;
        return maria * 0.55 + r1 * 0.32 + r2 * 0.18;
      }

      void main() {
        vec3 p = vObjPos;
        float h = craterHeight(p);
        float eps = 0.01;
        float dx = craterHeight(p + vec3(eps, 0.0, 0.0)) - h;
        float dy = craterHeight(p + vec3(0.0, eps, 0.0)) - h;
        vec3 N = normalize(vWorldNormal + vec3(dx, dy, 0.0) * 6.5);
        vec3 L = normalize(uSunDir);

        // Lommel-Seeliger lunar regolith reflectance (authentic crisp opposition & terminator!)
        float ndl = max(0.0, dot(N, L));
        vec3 albedo = mix(uBaseCol * 0.52, uHighCol, smoothstep(0.38, 0.72, h));
        // Bright ray-crater ejecta streaks
        float rays = pow(clamp(ridgedFbm4(p * 14.0), 0.0, 1.0), 4.0);
        albedo += vec3(0.18) * rays;

        vec3 lit = albedo * (ndl * 1.42 + 0.012);
        gl_FragColor = vec4(acesToneMap(lit), uOpacity);
      }
    `})}function bo(y){return new Et({transparent:!0,depthWrite:!0,uniforms:{uSunDir:{value:y.clone().normalize()},uTime:{value:0},uOpacity:{value:1}},vertexShader:`
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;

      void main() {
        vObjPos = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vObjPos;
      varying vec3 vWorldNormal;
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uOpacity;

      void main() {
        vec3 p = vObjPos;
        float lat = asin(clamp(p.y, -1.0, 1.0));
        float lon = atan(p.z, p.x);

        // Kelvin-Helmholtz shear eddies along alternating zonal ammonia/hydrosulfide cloud belts
        float eddy = fbm5(vec3(p.x * 5.5 + uTime * 0.03, lat * 12.0, p.z * 5.5));
        float fineCurl = fbm4(vec3(p.x * 14.0 - eddy * 2.2, lat * 26.0, p.z * 14.0));
        float warpedLat = lat + (eddy - 0.5) * 0.16 + (fineCurl - 0.5) * 0.06;

        float band1 = sin(warpedLat * 18.0);
        float band2 = cos(warpedLat * 34.0) * 0.45;
        float beltFactor = clamp(0.5 + 0.36 * band1 + 0.22 * band2, 0.0, 1.0);

        // Great Anticyclonic Vortex at southern tropical belt (lat ~ -0.36)
        float dLon = mod(lon - 1.1 + 3.14159, 6.28318) - 3.14159;
        vec2 stormCoord = vec2(dLon * 2.4, (lat + 0.36) * 6.2);
        float stormR = length(stormCoord);
        float stormMask = 1.0 - smoothstep(0.55, 1.05, stormR);
        float stormSwirl = fbm4(vec3(stormCoord * 3.5, stormR * 4.0 - uTime * 0.12));

        vec3 ammoniaCream = vec3(0.93, 0.86, 0.74);
        vec3 ochreBelt    = vec3(0.76, 0.48, 0.28);
        vec3 deepUmber    = vec3(0.42, 0.24, 0.16);
        vec3 polarHaze    = vec3(0.38, 0.44, 0.54);
        vec3 vortexRust   = vec3(0.84, 0.31, 0.16);

        vec3 col = mix(deepUmber, ochreBelt, smoothstep(0.18, 0.52, beltFactor));
        col = mix(col, ammoniaCream, smoothstep(0.52, 0.86, beltFactor));
        col = mix(col, mix(vortexRust, ammoniaCream, stormSwirl * 0.42), stormMask * 0.92);
        col = mix(col, polarHaze, smoothstep(0.72, 0.96, abs(p.y)));

        float ndl = max(0.0, dot(normalize(vWorldNormal), normalize(uSunDir)));
        // Subtle atmospheric limb softening
        vec3 lit = col * (pow(ndl, 0.85) * 1.32 + 0.015);
        gl_FragColor = vec4(acesToneMap(lit), uOpacity);
      }
    `})}function Na(y){const{innerRadius:t,outerRadius:a,planetRadius:s,sunDir:e}=y;return new Et({transparent:!0,depthWrite:!1,side:Ot,uniforms:{uInner:{value:t},uOuter:{value:a},uPlanetR:{value:s},uSunDir:{value:e.clone().normalize()},uOpacity:{value:.92}},vertexShader:`
      uniform float uPlanetR;
      varying vec3 vLocalPos;
      varying vec3 vRelWorld;
      varying float vScaledPlanetR;

      void main() {
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 planetCenterWorld = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vRelWorld = wp.xyz - planetCenterWorld;
        float worldScale = length(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
        vScaledPlanetR = uPlanetR * worldScale;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vLocalPos;
      varying vec3 vRelWorld;
      varying float vScaledPlanetR;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uSunDir;
      uniform float uOpacity;

      void main() {
        // RingGeometry lies in XY plane before rotation
        float r = length(vLocalPos.xy);
        float u = clamp((r - uInner) / max(0.001, uOuter - uInner), 0.0, 1.0);
        if (u <= 0.001 || u >= 0.999) discard;

        // Multi-frequency radial ringlets + Cassini Division (u ~ 0.61..0.67) + Encke Gap (u ~ 0.88)
        float ringlets = 0.55 + 0.45 * sin(u * 190.0) * cos(u * 73.0);
        float fineRinglets = 0.75 + 0.25 * sin(u * 520.0);
        float cRing = smoothstep(0.0, 0.16, u) * 0.35 + smoothstep(0.16, 0.22, u) * 0.65;
        float cassini = 1.0 - 0.92 * exp(-pow((u - 0.64) * 34.0, 2.0));
        float encke   = 1.0 - 0.78 * exp(-pow((u - 0.88) * 95.0, 2.0));
        float outerFade = 1.0 - smoothstep(0.94, 1.0, u);

        float opticalDepth = clamp(cRing * ringlets * fineRinglets * cassini * encke * outerFade, 0.0, 1.0);

        // Crisp cylindrical shadow cast by the gas giant body onto the anti-solar side of the rings!
        vec3 L = normalize(uSunDir);
        float alongSun = dot(vRelWorld, L);
        float perpDist = length(vRelWorld - L * alongSun);
        float inShadow = alongSun < 0.0
          ? 1.0 - smoothstep(vScaledPlanetR * 0.96, vScaledPlanetR * 1.04, perpDist)
          : 0.0;

        vec3 iceCream = vec3(0.95, 0.89, 0.78);
        vec3 dustyTan = vec3(0.74, 0.62, 0.48);
        vec3 col = mix(dustyTan, iceCream, smoothstep(0.2, 0.6, u) * ringlets);
        col *= mix(1.15, 0.035, inShadow);

        float alpha = opticalDepth * 0.86 * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(acesToneMap(col), alpha);
      }
    `})}function vs(y){const{isHomeUniverse:t=!1,opacity:a=.88}=y;return new Et({transparent:!0,depthWrite:!1,side:Ot,blending:la,uniforms:{uIsHomeUniverse:{value:t?1:0},uOpacity:{value:a},uTime:{value:0}},vertexShader:`
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,fragmentShader:`
      ${he}
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      uniform float uIsHomeUniverse;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        float NdotV = abs(dot(N, V));
        float fresnel = pow(1.0 - NdotV, 2.4);

        // Thin-film interference thickness modulated by quantum vacuum ripples
        vec3 p = vWorldPos * 0.12 + vec3(uTime * 0.02, -uTime * 0.015, uTime * 0.01);
        float noise = fbm3(p * 2.2);
        float filmThickness = noise * 1.8 + fresnel * 1.2;

        // Chromatic interference color cycle
        vec3 iridescentCol;
        iridescentCol.r = 0.5 + 0.5 * cos(filmThickness * 6.28318 + 0.0);
        iridescentCol.g = 0.5 + 0.5 * cos(filmThickness * 6.28318 + 2.094);
        iridescentCol.b = 0.5 + 0.5 * cos(filmThickness * 6.28318 + 4.188);

        // Core deep-vacuum interior
        vec3 deepVoid = vec3(0.04, 0.015, 0.08);
        vec3 baseCol = mix(deepVoid, iridescentCol, fresnel * 0.85 + noise * 0.25);

        // Quantum vacuum shimmer glints
        float glint = pow(noise3D(vWorldPos * 1.8 + vec3(uTime * 0.08)), 6.0) * 2.2;
        baseCol += vec3(0.7, 0.85, 1.0) * glint;

        // Home universe entrance corona
        if (uIsHomeUniverse > 0.5) {
          float pulse = 0.85 + 0.15 * sin(uTime * 2.5);
          vec3 coronaCol = vec3(1.0, 0.82, 0.45);
          float rimGlow = pow(1.0 - NdotV, 1.6) * 1.6 * pulse;
          baseCol = mix(baseCol, coronaCol, rimGlow * 0.65) + coronaCol * (rimGlow * 0.5);
        }

        float alpha = clamp((fresnel * 0.82 + noise * 0.18 + (uIsHomeUniverse > 0.5 ? 0.25 : 0.08)), 0.0, 0.95) * uOpacity;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(acesToneMap(baseCol), alpha);
      }
    `})}function xo(y){const{opacity:t=.82}=y||{};return new Et({transparent:!0,depthWrite:!1,side:Ot,blending:la,uniforms:{uOpacity:{value:t},uTime:{value:0}},vertexShader:`
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      ${he}
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;

        // Metric expansion grid lines (guarded against zero fwidth on grazing angles/software GL)
        vec2 gridFw = max(fwidth(p * 14.0), vec2(0.0001));
        vec2 grid = abs(fract(p * 14.0 - 0.5) - 0.5) / gridFw;
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);

        // Relic Baryon Acoustic Oscillation (BAO) spherical acoustic sound wave ripples
        float baoSpeed = uTime * 0.05;
        float baoWave = sin((r * 22.0 - baoSpeed * 6.28318)) * 0.5 + 0.5;
        float baoShell = pow(baoWave, 3.5) * smoothstep(0.1, 0.8, r);

        // Expanding Hubble horizon glow ring at outer rim
        float horizonRing = smoothstep(0.85, 0.98, r) * (1.0 - smoothstep(0.98, 1.0, r));

        // Central gravitational curvature well
        float centralWell = exp(-r * 4.2) * 2.5;

        vec3 gridCol    = vec3(0.25, 0.50, 0.95);
        vec3 baoCol     = vec3(0.40, 0.85, 1.0);
        vec3 horizonCol = vec3(0.70, 0.40, 1.0);
        vec3 centerCol  = vec3(1.0, 0.90, 0.65);

        vec3 col = gridCol * (line * 0.65)
                 + baoCol * (baoShell * 0.85)
                 + horizonCol * (horizonRing * 2.0)
                 + centerCol * (centralWell * 0.7);

        float alpha = clamp(line * 0.55 + baoShell * 0.45 + horizonRing * 0.85 + centralWell * 0.5, 0.0, 0.95) * uOpacity;
        alpha *= (1.0 - smoothstep(0.92, 1.0, r));
        if (alpha < 0.004) discard;

        gl_FragColor = vec4(acesToneMap(col), alpha);
      }
    `})}const bs=12,xs=7.1,Ea=9,Ss=9.65,Cs=.04365,As=5,Ps=.032,$=new Ct,R=new K,Gs=new K,pt=new X,je=new X,Ft=new X,Ua=new X,Fe=new X,ia=new X(0,1,0),Kt=new X(.82,.28,.5).normalize(),Va=Ls*(Math.PI/180),Ds=Is*(Math.PI/180),Ce=new X(Math.cos(Va)*Math.sin(Ds),Math.sin(Va),Math.cos(Va)*Math.cos(Ds)).normalize(),So=new Za,Co=new Za().setFromUnitVectors(Ce,ia),Xa={focusBlend:0,navActiveWeight:0};function G(y){const t=Math.sin(y*12.9898+78.233)*43758.5453;return t-Math.floor(t)}function ft(y,t,a){const s=q.clamp((a-y)/(t-y),0,1);return s*s*(3-2*s)}function Jo(y){if(y>=28)return 0;if(y<=23.4)return 13.8;const t=q.clamp((28-y)/(28-23.4),0,1);return+(13.8*Math.pow(t,1.35)).toFixed(2)}class tn{constructor(t=!1){x(this,"rootGroup",new H);x(this,"forestGroveGroup",new H);x(this,"celestialBackdropGroup",new H);x(this,"isSoftwareGl");x(this,"layers",[]);x(this,"woodlandCapys",[]);x(this,"markerAnchors",[]);x(this,"projectedMarkerPool",[]);x(this,"activeProjectedMarkers",[]);x(this,"celestialBackdropMats",[]);x(this,"glowWarmTex",null);x(this,"glowCoolTex",null);x(this,"nextWarmLayerIdx",0);x(this,"elapsed",0);x(this,"lastGammaApplied",-1);x(this,"photonElectricPositions",null);x(this,"photonMagneticPositions",null);x(this,"photonElectricLine",null);x(this,"photonMagneticLine",null);x(this,"photonVectorGroup",null);x(this,"solarPlanets",[]);x(this,"solarFocusContainer",null);x(this,"solarEclipticGroup",null);x(this,"capyEarthPlanet",null);x(this,"solarSunMesh",null);x(this,"solarCoronaSprite",null);x(this,"sunStarBeacon",null);x(this,"solarBeltPoints",null);x(this,"solarBeltBaseAu",null);x(this,"solarOortPoints",null);x(this,"orbitTimeScaleId","1_orbit_min");x(this,"multiverseHomeBubbleMesh",null);x(this,"multiverseHomeBubbleMat",null);x(this,"atomicOrbitalsWaveHalo",null);x(this,"singleElectronHalo",null);x(this,"singlePhotonCore",null);x(this,"spiralGalaxyTiltGroup",null);x(this,"spiralGalaxySpinGroup",null);x(this,"spiralGalaxyDiscMesh",null);x(this,"spiralGalaxyBulgeHalo",null);x(this,"spiralGalaxyArmRibbons",[]);x(this,"lastGalaxyFocusBlend",0);x(this,"planetarySystemGroup",null);x(this,"planetaryMoonMesh",null);x(this,"planetaryMoonPivot",null);x(this,"planetaryMinimoonPivot",null);x(this,"planetaryRingMesh",null);x(this,"planetSurfaceAlignGroup",null);x(this,"planetGlobeContainer",null);x(this,"planetSurfaceAnchorGroup",null);x(this,"planetGlobeMesh",null);x(this,"planetGlobeMat",null);x(this,"planetCloudMesh",null);x(this,"planetCloudSphereMat",null);x(this,"planetRayleighMesh",null);x(this,"planetRayleighMat",null);x(this,"planetOrbitalGlint",null);x(this,"planetLod1Mesh",null);x(this,"planetLod2Mesh",null);x(this,"planetLod3Mesh",null);x(this,"planetLodMats",[]);x(this,"planetCloudPatchMeshes",[]);x(this,"planetCloudPatchMats",[]);x(this,"atomicNuclearClusterGroup",null);x(this,"nucleonMeshes",[]);x(this,"quarkMeshes",[]);x(this,"electronMarkers",[]);x(this,"planckFoamGridGeo",null);x(this,"planckFoamBaseZ",null);x(this,"layersBuilt",!1);x(this,"groveBuilt",!1);x(this,"bigBangSpeedScale",1);x(this,"fineStructureInverse",137.036);x(this,"fineStructureRatio",1);x(this,"atomicCloudPoints",null);x(this,"singleElectronTorus",null);x(this,"solarSunMat",null);x(this,"capyEarthRingMesh",null);x(this,"capyEarthBodyMat",null);x(this,"atmosphereRayleighMat",null);x(this,"atmosphereCloudMats",[]);x(this,"ecosystemMeadowMat",null);x(this,"ecosystemRiverMat",null);x(this,"cellNucleusMesh",null);x(this,"cellNucleusMat",null);x(this,"chromatinBridgeGroup",null);x(this,"chromatinBridgeMats",[]);x(this,"galaxyMorphology","spiral");x(this,"spiralGalaxyDiscMat",null);x(this,"forestDiorama",null);x(this,"activeForestSpecimenId",Ja());x(this,"celestialStarPoints",null);x(this,"celestialStarMat",null);x(this,"quantumFieldPoints",null);x(this,"quantumFieldMat",null);x(this,"pendingProceduralBiome",null);x(this,"woodlandElapsed",0);this.isSoftwareGl=t,this.rootGroup.name="SeamlessUniverseSimulatorRoot",this.rootGroup.visible=!1,this.rootGroup.matrixWorldAutoUpdate=!1,this.rootGroup.userData.ignoreCameraFade=!0,ua(this.rootGroup),this.celestialBackdropGroup.name="DeepSkyCelestialBackdrop",this.celestialBackdropGroup.visible=!1,this.celestialBackdropGroup.matrixWorldAutoUpdate=!1,this.celestialBackdropGroup.userData.ignoreCameraFade=!0,ua(this.celestialBackdropGroup),this.forestGroveGroup.name="WoodlandCapybaraForestGrove",this.forestGroveGroup.visible=!1,this.forestGroveGroup.matrixWorldAutoUpdate=!1,this.forestGroveGroup.userData.ignoreCameraFade=!0,ua(this.forestGroveGroup);for(let a=0;a<bs;a++)this.projectedMarkerPool.push({id:"",label:"",sublabel:"",screenX:0,screenY:0,colorCss:"#38bdf8",targetLogMeters:0,isSubPixel:!1})}getActiveForestSpecimenSpec(){return Ws(this.activeForestSpecimenId)}rerollForestSpecimen(t){return this.activeForestSpecimenId=t??Ja(Math.random,this.activeForestSpecimenId),this.forestDiorama&&this.forestDiorama.setActiveSpecimen(this.activeForestSpecimenId),this.getActiveForestSpecimenSpec()}setGalaxyMorphology(t){var a;if(this.galaxyMorphology=t,this.spiralGalaxyDiscMat&&((a=this.spiralGalaxyDiscMat.uniforms)!=null&&a.uMorphology)){const s=t==="barred_spiral"?1:t==="elliptical"?2:t==="irregular"?3:0;this.spiralGalaxyDiscMat.uniforms.uMorphology.value=s}}getGalaxyMorphology(){return this.galaxyMorphology}getSpiralArmNavigationState(t){const a=this.lastGalaxyFocusBlend,s=Math.cos(Te)*na,e=-Math.sin(Te)*na,n=this.spiralGalaxySpinGroup?this.spiralGalaxySpinGroup.rotation.y:0,o=Math.cos(n),l=Math.sin(n);return t.set(s*o+e*l,0,-s*l+e*o),this.spiralGalaxyTiltGroup&&t.applyQuaternion(this.spiralGalaxyTiltGroup.quaternion),t.lengthSq()>1e-6?t.normalize():t.set(.35,.25,-.9).normalize(),Xa.focusBlend=a,Xa.navActiveWeight=Math.sin(Math.PI*q.clamp(a,0,1)),Xa}getSharedSunDir(){return Kt}ensureWoodlandGroveBuilt(){this.groveBuilt||(this.groveBuilt=!0,this.buildWoodlandCapybaraGrove())}ensureLayersBuilt(){this.layersBuilt||(this.layersBuilt=!0,this.buildCelestialStarBackdrop(),this.buildAllScaleLayers())}warmNextPendingLayer(){for(this.layersBuilt||this.ensureLayersBuilt();this.nextWarmLayerIdx<this.layers.length;){const t=this.layers[this.nextWarmLayerIdx++];if(!t.populated)return this.populateScaleLayer(t),this.nextWarmLayerIdx<this.layers.length}return!1}createSoftRadialTexture(t,a,s="rgba(0,0,0,0)"){const e=this.isSoftwareGl?64:128,n=document.createElement("canvas");n.width=e,n.height=e;const o=n.getContext("2d");if(o){const u=e*.5,d=o.createRadialGradient(u,u,0,u,u,u);d.addColorStop(0,t),d.addColorStop(.28,a),d.addColorStop(1,s),o.fillStyle=d,o.fillRect(0,0,e,e)}const l=new He(n);return l.colorSpace=Ke,l}createSinglePointGlint(t,a=9,s=.35){const e=new ct,n=new Float32Array([0,0,0]);R.setHex(t);const o=new Float32Array([R.r,R.g,R.b]),l=new Float32Array([1]),u=new Float32Array([.92]);e.setAttribute("position",new B(n,3)),e.setAttribute("color",new B(o,3)),e.setAttribute("aScale",new B(l,1)),e.setAttribute("aLuminosity",new B(u,1));const d=le({baseSize:a,minPixelSize:2.6,maxPixelSize:22,diffractionStrength:s,opacity:.95}),r=new Ht(e,d);return r.frustumCulled=!1,r}createOrbitHairline(t,a,s,e=96){const n=e+1,o=new Float32Array(n*3),l=new Float32Array(n*3),u=Math.sqrt(Math.max(.1,1-a*a));for(let i=0;i<=e;i++){const h=i/e*Math.PI*2,c=Math.cos(h)-a,p=Math.sin(h)*u;o[i*3]=c,o[i*3+1]=0,o[i*3+2]=p,l[i*3]=c*t,l[i*3+1]=0,l[i*3+2]=p*t}const d=new ct;d.setAttribute("position",new B(l,3));const r=new _a(d,new La({color:s,transparent:!0,opacity:.34,depthWrite:!1}));return r.visible=!1,{line:r,unitCoords:o}}registerMarkerAnchor(t){this.markerAnchors.push(t)}buildCelestialStarBackdrop(){const t=this.isSoftwareGl?900:2800,a=new Float32Array(t*3),s=new Float32Array(t*3),e=new Float32Array(t),n=new Float32Array(t);for(let w=0;w<t;w++){const f=w%20<11,v=G(w*7+1)*Math.PI*2;let b;if(f){const Y=(G(w*7+2)+G(w*7+3)-1)*.24;b=q.clamp(Y,-.99,.99)}else b=2*G(w*7+2)-1;const M=Math.sqrt(Math.max(0,1-b*b)),S=880+G(w*7+4)*80,A=S*M*Math.cos(v),P=S*b,C=S*M*Math.sin(v),T=1.08;a[w*3]=A,a[w*3+1]=P*Math.cos(T)-C*Math.sin(T),a[w*3+2]=P*Math.sin(T)+C*Math.cos(T);const _=G(w*7+5),W=_<.58?3100+_*3600:_<.88?5400+(_-.58)*12e3:11e3+(_-.88)*14e4;re(W,R),s[w*3]=R.r,s[w*3+1]=R.g,s[w*3+2]=R.b;const j=Math.pow(G(w*7+6),3.2);e[w]=.55+j*2.6,n[w]=.25+j*.75}const o=new ct;o.setAttribute("position",new B(a,3)),o.setAttribute("color",new B(s,3)),o.setAttribute("aScale",new B(e,1)),o.setAttribute("aLuminosity",new B(n,1));const l=le({baseSize:66,minPixelSize:1.9,maxPixelSize:18,diffractionStrength:.62,opacity:1}),u=new Ht(o,l);u.frustumCulled=!1,this.celestialStarPoints=u,this.celestialStarMat=l,this.celestialBackdropGroup.add(u);const d=this.isSoftwareGl?90:180,r=new Float32Array(d*3),i=new Float32Array(d*3),h=new Float32Array(d),c=new Float32Array(d);for(let w=0;w<d;w++){const f=460+G(w*5+1)*380,v=Math.acos(2*G(w*5+2)-1),b=G(w*5+3)*Math.PI*2;r[w*3]=f*Math.sin(v)*Math.cos(b),r[w*3+1]=f*Math.cos(v),r[w*3+2]=f*Math.sin(v)*Math.sin(b);const M=G(w*5+4);R.setHSL(M<.45?.54:M<.8?.76:.13,.85,.65),i[w*3]=R.r,i[w*3+1]=R.g,i[w*3+2]=R.b,h[w]=.65+G(w*5+5)*1.45,c[w]=.25+G(w*7+1)*.45}const p=new ct;p.setAttribute("position",new B(r,3)),p.setAttribute("color",new B(i,3)),p.setAttribute("aScale",new B(h,1)),p.setAttribute("aLuminosity",new B(c,1));const g=le({baseSize:48,minPixelSize:1.5,maxPixelSize:12,diffractionStrength:0,opacity:.45}),m=new Ht(p,g);m.frustumCulled=!1,m.visible=!1,this.quantumFieldPoints=m,this.quantumFieldMat=g,this.celestialBackdropGroup.add(m),this.celestialBackdropMats=this.collectLayerMaterials(this.celestialBackdropGroup)}buildAllScaleLayers(){this.glowWarmTex=this.createSoftRadialTexture("rgba(255,252,235,1)","rgba(251,191,36,0.42)"),this.glowWarmTex.userData.sharedAsset=!0,this.glowCoolTex=this.createSoftRadialTexture("rgba(235,248,255,1)","rgba(56,189,248,0.38)"),this.glowCoolTex.userData.sharedAsset=!0;for(let t=0;t<Ma.length;t++){const a=Ma[t],s=new H;s.name=`ScaleLayer_${a.id}`,s.visible=!1,s.matrixWorldAutoUpdate=!1,s.userData.ignoreCameraFade=!0,ua(s),this.rootGroup.add(s),this.layers.push({index:t,spec:a,group:s,materials:[],populated:!1})}}populateScaleLayer(t){if(t.populated)return;t.populated=!0,this.glowWarmTex||(this.glowWarmTex=this.createSoftRadialTexture("rgba(255,252,235,1)","rgba(251,191,36,0.42)"),this.glowWarmTex.userData.sharedAsset=!0),this.glowCoolTex||(this.glowCoolTex=this.createSoftRadialTexture("rgba(235,248,255,1)","rgba(56,189,248,0.38)"),this.glowCoolTex.userData.sharedAsset=!0);const a=this.glowWarmTex,s=this.glowCoolTex,{spec:e,group:n}=t;let o;switch(e.id){case"multiverse":o=this.populateMultiverseLayer(n,a);break;case"big_bang":o=this.populateBigBangLayer(n,a);break;case"universe":o=this.populateUniverseManifoldLayer(n);break;case"observable":o=this.populateObservableUniverseLayer(n);break;case"cosmic_web":o=this.populateCosmicWebLayer(n);break;case"filament":o=this.populateFilamentLayer(n);break;case"supercluster":o=this.populateSuperclusterLayer(n,a);break;case"cluster":o=this.populateClusterLayer(n,s);break;case"galaxy":o=this.populateGalaxyLayer(n,a);break;case"spiral_arms":o=this.populateSpiralArmsLayer(n,s);break;case"nebulas":o=this.populateNebulaLayer(n,s);break;case"stellar_systems":o=this.populateSolarSystemLayer(n,a);break;case"planetary_system":o=this.populatePlanetarySystemLayer(n);break;case"planet":o=this.populatePlanetGlobeLayer(n);break;case"atmosphere":o=this.populateAtmosphereLayer(n);break;case"land_masses":o=this.populateLandMassesLayer(n);break;case"ecosystems":o=this.populateEcosystemsLayer(n);break;case"capybara_forest":o=this.populateForestCanopyMotesLayer(n,a);break;case"leaf_fur_micro":o=this.populateLeafAndFurMicroLayer(t,n,a);break;case"biological_cells":o=this.populateBiologicalCellsLayer(n);break;case"dna_molecules":o=this.populateDnaHelixLayer(n,s);break;case"atomic_orbitals":o=this.populateAtomicOrbitalsLayer(n,s);break;case"atomic_nucleus":o=this.populateAtomicNucleusLayer(n,a);break;case"quarks_gluons":o=this.populateQuarksGluonsLayer(n,a);break;case"single_electron":o=this.populateSingleElectronLayer(n,s);break;case"single_photon":o=this.populateSinglePhotonLayer(n,a);break;case"planck_quantum_foam":o=this.populatePlanckQuantumFoamLayer(n,s);break}t.materials=this.collectLayerMaterials(n),t.tickFn=o,this.pendingProceduralBiome&&this.applyProceduralConfig(this.pendingProceduralBiome),e.id==="galaxy"&&this.galaxyMorphology!=="spiral"&&this.setGalaxyMorphology(this.galaxyMorphology),e.id==="leaf_fur_micro"&&this.forestDiorama&&this.forestDiorama.setActiveSpecimen(this.activeForestSpecimenId)}collectLayerMaterials(t){const a=[],s=new Set;return t.traverse(e=>{var l,u,d;e.userData.ignoreCameraFade=!0;const n=e;if(!n.material)return;const o=Array.isArray(n.material)?n.material:[n.material];for(let r=0;r<o.length;r++){const i=o[r];if(!i||s.has(i))continue;s.add(i),i.transparent=!0;const h=i,c=(l=h.uniforms)==null?void 0:l.uOpacity,p=(u=h.uniforms)==null?void 0:u.uTime,g=(d=h.uniforms)==null?void 0:d.uHubbleMix,m=c?Number(c.value):i.opacity!==void 0?i.opacity:1;a.push({mat:i,baseOpacity:m,defaultDepthWrite:i.depthWrite,shaderOpacityUniform:c,shaderTimeUniform:p,shaderHubbleUniform:g})}}),a}populateMultiverseLayer(t,a){const s=new Z(9.8,this.isSoftwareGl?32:56,this.isSoftwareGl?24:40),e=vs({isHomeUniverse:!0,opacity:.94}),n=new D(s,e);this.multiverseHomeBubbleMesh=n,this.multiverseHomeBubbleMat=e,t.add(n);const o=new ne(new ie({map:a,color:12616956,blending:Gt,depthWrite:!1,opacity:.78}));o.scale.setScalar(24),t.add(o);const l=this.isSoftwareGl?8:16,u=vs({isHomeUniverse:!1,opacity:.72});for(let m=0;m<l;m++){const w=2.4+G(m*7+1)*4.6,f=18+G(m*7+2)*22,v=Math.acos(2*G(m*7+3)-1),b=G(m*7+4)*Math.PI*2,M=f*Math.sin(v)*Math.cos(b),S=f*Math.cos(v)*.72,A=f*Math.sin(v)*Math.sin(b),P=new D(new Z(w,this.isSoftwareGl?18:28,16),u);P.position.set(M,S,A),t.add(P)}const d=this.isSoftwareGl?400:1200,r=new Float32Array(d*3),i=new Float32Array(d*3),h=new Float32Array(d),c=new Float32Array(d);for(let m=0;m<d;m++){const w=12+Math.pow(G(m*5+1),1.2)*36,f=Math.acos(2*G(m*5+2)-1),v=G(m*5+3)*Math.PI*2;r[m*3]=w*Math.sin(f)*Math.cos(v),r[m*3+1]=w*Math.cos(f)*.65,r[m*3+2]=w*Math.sin(f)*Math.sin(v);const b=G(m*5+4);R.setHSL(.72+b*.35,.85,.65),i[m*3]=R.r,i[m*3+1]=R.g,i[m*3+2]=R.b,h[m]=.6+G(m*5+5)*1.5,c[m]=.4+G(m*7+1)*.6}const p=new ct;p.setAttribute("position",new B(r,3)),p.setAttribute("color",new B(i,3)),p.setAttribute("aScale",new B(h,1)),p.setAttribute("aLuminosity",new B(c,1)),t.add(new Ht(p,le({baseSize:11,diffractionStrength:.45,opacity:.82})));const g=new Ct;return t.add(g),this.registerMarkerAnchor({id:"marker_home_pocket_universe",label:"Home Universe Bubble",sublabel:"Nucleating Inflationary Singularity · 10^+28 m",node:g,layerBandId:"multiverse",minLog:28.5,maxLog:30.5,targetLogMeters:28,colorCss:"#a855f7",physicalRadiusWorldAtOneToOne:9.8}),(m,w)=>{t.rotation.y+=m*.02;const f=23.5+Math.sin(w*1.4)*1.2;o.scale.setScalar(f)}}populateBigBangLayer(t,a){for(let i=0;i<2;i++){const h=new D(new de(28,28),Ga({seedOffset:11.4+i*5.3,hubblePaletteMix:.75,opacity:.68,isInnerCore:i===0}));h.rotation.set(i*.72,i*(Math.PI*.45),i*.35),t.add(h)}const s=new ne(new ie({map:a,color:16775149,blending:Gt,depthWrite:!1,opacity:.85}));s.scale.setScalar(18),t.add(s);const e=this.isSoftwareGl?800:2600,n=new Float32Array(e*3),o=new Float32Array(e*3),l=new Float32Array(e),u=new Float32Array(e);for(let i=0;i<e;i++){const h=Math.pow(G(i*5+1),1.6)*20.5,c=Math.acos(2*G(i*5+2)-1),p=G(i*5+3)*Math.PI*2;n[i*3]=h*Math.sin(c)*Math.cos(p),n[i*3+1]=h*Math.cos(c),n[i*3+2]=h*Math.sin(c)*Math.sin(p);const g=q.lerp(28e3,3200,Math.min(1,h/19));re(g,R),o[i*3]=R.r,o[i*3+1]=R.g,o[i*3+2]=R.b,l[i]=.6+G(i*5+4)*1.8,u[i]=.45+(1-h/21)*.55}const d=new ct;d.setAttribute("position",new B(n,3)),d.setAttribute("color",new B(o,3)),d.setAttribute("aScale",new B(l,1)),d.setAttribute("aLuminosity",new B(u,1)),t.add(new Ht(d,le({baseSize:14,diffractionStrength:.35,opacity:.9})));const r=new Ct;return t.add(r),this.registerMarkerAnchor({id:"marker_inflation_singularity",label:"Cosmic Inflation Envelope",sublabel:"Relativistic Quark-Gluon Plasma · 10^+27.2 m",node:r,layerBandId:"big_bang",minLog:27.2,maxLog:29.5,targetLogMeters:27.2,colorCss:"#fef08a",physicalRadiusWorldAtOneToOne:18}),(i,h)=>{t.rotation.y+=i*.06*this.bigBangSpeedScale;const c=17.2+Math.sin(h*1.8*this.bigBangSpeedScale)*1.1;s.scale.setScalar(c)}}populateUniverseManifoldLayer(t){const a=new D(new de(52,52,this.isSoftwareGl?32:54,this.isSoftwareGl?32:54),xo({opacity:.88}));a.rotation.x=-Math.PI/2.35,t.add(a);const s=new D(new Z(22,this.isSoftwareGl?24:44,this.isSoftwareGl?18:32),ws(.22));t.add(s);const e=this.isSoftwareGl?500:1600,n=new Float32Array(e*3),o=new Float32Array(e*3),l=new Float32Array(e),u=new Float32Array(e);for(let i=0;i<e;i++){const h=Math.pow(G(i*7+1),.75)*20,c=Math.acos(2*G(i*7+2)-1),p=G(i*7+3)*Math.PI*2;n[i*3]=h*Math.sin(c)*Math.cos(p),n[i*3+1]=h*Math.cos(c)*.45,n[i*3+2]=h*Math.sin(c)*Math.sin(p),re(q.lerp(18e3,3800,h/20),R),o[i*3]=R.r,o[i*3+1]=R.g,o[i*3+2]=R.b,l[i]=.5+G(i*7+4)*1.6,u[i]=.4+G(i*7+5)*.6}const d=new ct;d.setAttribute("position",new B(n,3)),d.setAttribute("color",new B(o,3)),d.setAttribute("aScale",new B(l,1)),d.setAttribute("aLuminosity",new B(u,1)),t.add(new Ht(d,le({baseSize:12,diffractionStrength:.28,opacity:.88})));const r=new Ct;return t.add(r),this.registerMarkerAnchor({id:"marker_observable_horizon",label:"Observable Horizon (CMB)",sublabel:"93.0 Gly Particle Horizon · 10^+26.94 m",node:r,layerBandId:"universe",minLog:26.8,maxLog:27.8,targetLogMeters:26.94,colorCss:"#60a5fa",physicalRadiusWorldAtOneToOne:.15}),i=>{t.rotation.y+=i*.024}}populateObservableUniverseLayer(t){const a=new D(new Z(21.5,this.isSoftwareGl?32:56,this.isSoftwareGl?24:40),ws(.84));t.add(a);const s=this.isSoftwareGl?700:2400,e=new Float32Array(s*3),n=new Float32Array(s*3),o=new Float32Array(s),l=new Float32Array(s);for(let r=0;r<s;r++){const i=19.8*Math.cbrt(G(r*7+1)),h=Math.acos(2*G(r*7+2)-1),c=G(r*7+3)*Math.PI*2;e[r*3]=i*Math.sin(h)*Math.cos(c),e[r*3+1]=i*Math.cos(h),e[r*3+2]=i*Math.sin(h)*Math.sin(c);const p=i/19.8;re(q.lerp(9500,2900,p),R),n[r*3]=R.r,n[r*3+1]=R.g,n[r*3+2]=R.b,o[r]=.7+G(r*7+4)*1.6,l[r]=G(r*7+5)}const u=new ct;u.setAttribute("position",new B(e,3)),u.setAttribute("color",new B(n,3)),u.setAttribute("aScale",new B(o,1)),u.setAttribute("aSeed",new B(l,1)),t.add(new Ht(u,Pa(.92)));const d=new Ct;return t.add(d),this.registerMarkerAnchor({id:"marker_cosmic_web",label:"Cosmic Web Filaments",sublabel:"Dark Matter Halos & 100 Mly Boötes Voids · 10^+25.2 m",node:d,layerBandId:"observable",minLog:25,maxLog:27.2,targetLogMeters:25.2,colorCss:"#818cf8",physicalRadiusWorldAtOneToOne:.12}),r=>{t.rotation.y+=r*.035}}populateCosmicWebLayer(t){const a=[new X(0,0,0)],s=18;for(let c=1;c<s;c++){const p=Math.acos(2*G(c*13+1)-1),g=G(c*13+2)*Math.PI*2,m=8.5+G(c*13+3)*15;a.push(new X(m*Math.sin(p)*Math.cos(g),m*Math.cos(p)*.65,m*Math.sin(p)*Math.sin(g)))}const e=[],n=za(.42);for(let c=0;c<a.length;c++)for(let p=c+1;p<a.length;p++){const g=a[c],m=a[p],w=g.distanceTo(m);if(w<14.5||c===0&&w<18){const f=new X().addVectors(g,m).multiplyScalar(.5),v=c*31+p*17;f.x+=(G(v+1)-.5)*w*.32,f.y+=(G(v+2)-.5)*w*.32,f.z+=(G(v+3)-.5)*w*.32;const b=new to(g,f,m);e.push(b);const M=this.isSoftwareGl?8:14;for(let S=0;S<2;S++){const A=new de(1,1,1,M),P=A.attributes.position,C=c===0?.95:.65;for(let T=0;T<=M;T++){const _=T/M;b.getPoint(_,pt),b.getTangent(_,je),S===0?(Ft.crossVectors(je,ia),Ft.lengthSq()<.001&&Ft.set(1,0,0),Ft.normalize()):(Ft.crossVectors(je,ia).normalize(),Ft.crossVectors(Ft,je).normalize());const W=C*(1.35-.55*Math.sin(_*Math.PI));P.setXYZ(T*2,pt.x-Ft.x*W,pt.y-Ft.y*W,pt.z-Ft.z*W),P.setXYZ(T*2+1,pt.x+Ft.x*W,pt.y+Ft.y*W,pt.z+Ft.z*W)}t.add(new D(A,n))}}}const o=this.isSoftwareGl?1200:3800,l=new Float32Array(o*3),u=new Float32Array(o*3),d=new Float32Array(o),r=new Float32Array(o);for(let c=0;c<o;c++){const p=e[c%Math.max(1,e.length)],g=G(c*5+1),m=g<.5?.5*Math.pow(g*2,1.5):1-.5*Math.pow((1-g)*2,1.5);p.getPoint(m,pt);const w=.32+1.1*Math.sin(m*Math.PI),f=(G(c*5+2)+G(c*5+3)-1)*w*1.8,v=(G(c*5+4)+G(c*7+1)-1)*w*1.8,b=(G(c*7+2)+G(c*7+3)-1)*w*1.8;l[c*3]=pt.x+f,l[c*3+1]=pt.y+v,l[c*3+2]=pt.z+b;const M=1-Math.sin(m*Math.PI);re(q.lerp(9200,4100,M*.85+G(c*3+4)*.15),R),u[c*3]=R.r,u[c*3+1]=R.g,u[c*3+2]=R.b,d[c]=.55+Math.pow(G(c*9+1),2.4)*2.2,r[c]=G(c*9+2)}const i=new ct;i.setAttribute("position",new B(l,3)),i.setAttribute("color",new B(u,3)),i.setAttribute("aScale",new B(d,1)),i.setAttribute("aSeed",new B(r,1)),t.add(new Ht(i,Pa(.95)));const h=new Ct;return t.add(h),this.registerMarkerAnchor({id:"marker_major_filament",label:"Cosmic Filament Wall",sublabel:"105 Mly · Dark Matter Bridge to Superclusters · 10^+24.0 m",node:h,layerBandId:"cosmic_web",minLog:23.8,maxLog:25.5,targetLogMeters:24,colorCss:"#67e8f9",physicalRadiusWorldAtOneToOne:.14}),c=>{t.rotation.y-=c*.032}}populateFilamentLayer(t){const a=[new X(-18,-4.5,-8),new X(-8,-1.2,-2.5),new X(0,0,0),new X(9.5,2.1,4),new X(20,5.2,9.5)],s=new oa(a),e=za(.55),n=this.isSoftwareGl?14:28;for(let c=0;c<3;c++){const p=new de(1,1,1,n),g=p.attributes.position,m=c*Math.PI/3;for(let w=0;w<=n;w++){const f=w/n;s.getPoint(f,pt),s.getTangent(f,je),Ft.crossVectors(je,ia),Ft.lengthSq()<.001&&Ft.set(1,0,0),Ft.normalize().applyAxisAngle(je,m);const v=2.4*(1.15-.45*Math.sin(f*Math.PI));g.setXYZ(w*2,pt.x-Ft.x*v,pt.y-Ft.y*v,pt.z-Ft.z*v),g.setXYZ(w*2+1,pt.x+Ft.x*v,pt.y+Ft.y*v,pt.z+Ft.z*v)}t.add(new D(p,e))}const o=this.isSoftwareGl?900:2600,l=new Float32Array(o*3),u=new Float32Array(o*3),d=new Float32Array(o),r=new Float32Array(o);for(let c=0;c<o;c++){const p=G(c*7+1);s.getPoint(p,pt);const g=Math.pow(G(c*7+2),1.6)*3.4,m=G(c*7+3)*Math.PI*2;l[c*3]=pt.x+g*Math.cos(m),l[c*3+1]=pt.y+g*Math.sin(m)*.75,l[c*3+2]=pt.z+(G(c*7+4)-.5)*1.5,re(q.lerp(8800,4200,G(c*7+5)),R),u[c*3]=R.r,u[c*3+1]=R.g,u[c*3+2]=R.b,d[c]=.6+G(c*7+6)*1.8,r[c]=G(c*7+7)}const i=new ct;i.setAttribute("position",new B(l,3)),i.setAttribute("color",new B(u,3)),i.setAttribute("aScale",new B(d,1)),i.setAttribute("aSeed",new B(r,1)),t.add(new Ht(i,Pa(.94)));const h=new Ct;return t.add(h),this.registerMarkerAnchor({id:"marker_laniakea_supercluster",label:"Laniakea Supercluster",sublabel:"Gravitational Basin · 100,000 Galaxies Flow to Great Attractor · 10^+23.0 m",node:h,layerBandId:"filament",minLog:22.8,maxLog:24.3,targetLogMeters:23,colorCss:"#fbbf24",physicalRadiusWorldAtOneToOne:.16}),c=>{t.rotation.y+=c*.034}}populateSuperclusterLayer(t,a){const s=this.isSoftwareGl?48:110,e=this.isSoftwareGl?24:46,n=s*e,o=new Float32Array(n*3),l=new Float32Array(n*3),u=new Float32Array(n),d=new Float32Array(n);let r=0;for(let p=0;p<s;p++){const g=Math.acos(2*G(p*11+1)-1),m=G(p*11+2)*Math.PI*2,w=14+G(p*11+3)*9,f=(G(p*11+4)-.5)*1.9,v=(G(p*11+5)-.5)*2.4;for(let b=0;b<e;b++){const M=b/(e-1),S=w*Math.pow(1-M*.96,.85),A=m+f*M,P=(.18+(1-M)*.45)*(G(r*3+1)-.5);o[r*3]=S*Math.sin(g)*Math.cos(A)+P,o[r*3+1]=S*Math.cos(g)*.52+Math.sin(M*4.2+v)*1.1+P,o[r*3+2]=S*Math.sin(g)*Math.sin(A)+P,re(q.lerp(8200,4100,Math.pow(M,.7)),R),l[r*3]=R.r,l[r*3+1]=R.g,l[r*3+2]=R.b,u[r]=.45+Math.pow(M,1.5)*1.65,d[r]=.35+M*.65,r++}}const i=new ct;i.setAttribute("position",new B(o,3)),i.setAttribute("color",new B(l,3)),i.setAttribute("aScale",new B(u,1)),i.setAttribute("aLuminosity",new B(d,1)),t.add(new Ht(i,le({baseSize:12.5,diffractionStrength:.22,opacity:.94})));const h=new ne(new ie({map:a,color:16639626,opacity:.55,blending:Gt,depthWrite:!1}));h.scale.setScalar(9.5),t.add(h);const c=new Ct;return c.position.set(4.2,.8,2.6),t.add(c),this.registerMarkerAnchor({id:"marker_virgo_cluster",label:"Virgo Galaxy Cluster",sublabel:"2,000 Bound Galaxies in Hot X-Ray Plasma · 10^+22.2 m",node:c,layerBandId:"supercluster",minLog:21.8,maxLog:23.4,targetLogMeters:22.2,colorCss:"#f472b6",physicalRadiusWorldAtOneToOne:.25}),p=>{t.rotation.y+=p*.04}}populateClusterLayer(t,a){const s=new D(new de(36,36),Ga({seedOffset:7.8,hubblePaletteMix:.35,opacity:.48,isInnerCore:!0}));s.rotation.x=-Math.PI/2.2,t.add(s);const e=this.isSoftwareGl?700:2200,n=new Float32Array(e*3),o=new Float32Array(e*3),l=new Float32Array(e),u=new Float32Array(e);for(let i=0;i<e;i++){const h=G(i*9+1),c=16.5*(h/Math.sqrt(1+h*14*(h*14))*14),p=Math.acos(2*G(i*9+2)-1),g=G(i*9+3)*Math.PI*2;n[i*3]=c*Math.sin(p)*Math.cos(g),n[i*3+1]=c*Math.cos(p)*.58,n[i*3+2]=c*Math.sin(p)*Math.sin(g);const m=q.clamp(1-c/12,0,1);re(q.lerp(8600,3900,m*.8+G(i*9+4)*.2),R),o[i*3]=R.r,o[i*3+1]=R.g,o[i*3+2]=R.b,l[i]=.65+m*1.5+G(i*9+5)*1.2,u[i]=.4+m*.6}const d=new ct;d.setAttribute("position",new B(n,3)),d.setAttribute("color",new B(o,3)),d.setAttribute("aScale",new B(l,1)),d.setAttribute("aLuminosity",new B(u,1)),t.add(new Ht(d,Pa(.95)));const r=new Ct;return r.position.set(-2.8,-.6,3.4),t.add(r),this.registerMarkerAnchor({id:"marker_milky_way_disc",label:"Milky Way Galaxy Disc",sublabel:"105,700 ly Stellar Disc & Central Sgr A* Core · 10^+21.0 m",node:r,layerBandId:"cluster",minLog:20.8,maxLog:22.6,targetLogMeters:21,colorCss:"#60a5fa",physicalRadiusWorldAtOneToOne:.12}),i=>{t.rotation.y-=i*.045}}populateGalaxyLayer(t,a){const s=new H;s.rotation.x=.58,s.rotation.z=-.22,t.add(s),this.spiralGalaxyTiltGroup=s;const e=new H;s.add(e),this.spiralGalaxySpinGroup=e,this.spiralGalaxyDiscMat=yo({arms:2,opacity:.95,morphology:this.galaxyMorphology});const n=new D(new de(42,42),this.spiralGalaxyDiscMat);n.rotation.x=-Math.PI/2,e.add(n),this.spiralGalaxyDiscMesh=n;const o=new Ct;o.position.set(0,0,0),e.add(o);const l=this.createSinglePointGlint(16772565,18,.95);e.add(l),this.registerMarkerAnchor({id:"marker_smbh_sagittarius_a",label:"Sagittarius A* SMBH",sublabel:"4.15M Solar Masses · Galactic Core · 10^+21.0 m",node:o,layerBandId:"galaxy",minLog:19.6,maxLog:22.2,targetLogMeters:21,colorCss:"#fde68a",physicalRadiusWorldAtOneToOne:.002});const u=Math.cos(Te)*na,d=-Math.sin(Te)*na,r=this.isSoftwareGl?1400:4400,i=new Float32Array(r*3),h=new Float32Array(r*3),c=new Float32Array(r),p=new Float32Array(r);for(let F=0;F<r;F++){const L=F%16===0,V=!L&&F%11===0;if(L){const U=3+Math.pow(G(F*7+1),1.4)*18.5,I=Math.acos(2*G(F*7+2)-1),E=G(F*7+3)*Math.PI*2;i[F*3]=U*Math.sin(I)*Math.cos(E),i[F*3+1]=U*Math.cos(I)*.65,i[F*3+2]=U*Math.sin(I)*Math.sin(E),re(4300,R),c[F]=.85,p[F]=.6}else if(V){const U=G(F*7+1)-.5,I=na+U*4.4,E=Te+U*.62+(G(F*7+2)-.5)*.16,J=(G(F*7+4)-.5)*.45;i[F*3]=Math.cos(E)*I,i[F*3+1]=J,i[F*3+2]=-Math.sin(E)*I,re(11500+G(F*3+1)*14500,R),c[F]=.65+G(F*3+2)*1.05,p[F]=.6+G(F*3+3)*.35}else{const U=Math.max(.02,Math.pow(G(F*7+1),.78)),I=U*19.5,J=F%2*Math.PI+2.4*Math.log(Math.max(.035,U)),at=(.22+U*.52)*(G(F*7+2)+G(F*7+3)-1),et=J+at,tt=(G(F*7+4)-.5)*(1.5/(1+I*.25));i[F*3]=Math.cos(et)*I,i[F*3+1]=tt,i[F*3+2]=-Math.sin(et)*I,I<3.4?(re(4400+G(F*3+1)*1200,R),c[F]=.8+G(F*3+2)*1.1,p[F]=.85):F%9===0?(R.setRGB(.98,.24,.46),c[F]=1.25+G(F*3+2)*1.2,p[F]=.92):(re(10500+G(F*3+1)*14e3,R),c[F]=.5+G(F*3+2)*1.15,p[F]=.5+G(F*3+3)*.45)}h[F*3]=R.r,h[F*3+1]=R.g,h[F*3+2]=R.b}const g=new ct;g.setAttribute("position",new B(i,3)),g.setAttribute("color",new B(h,3)),g.setAttribute("aScale",new B(c,1)),g.setAttribute("aLuminosity",new B(p,1)),e.add(new Ht(g,le({baseSize:11.5,diffractionStrength:.38,opacity:.95})));const m=Te+Math.PI*.5-.26,w=Math.cos(m),f=-Math.sin(m),v=Math.cos(Te),b=-Math.sin(Te),M=this.isSoftwareGl?750:2600,S=new Float32Array(M*3),A=new Float32Array(M*3),P=new Float32Array(M),C=new Float32Array(M);for(let F=0;F<M;F++){const L=F%3===0,V=L?(G(F*11+1)-.5)*1.15:(G(F*11+1)-.5)*6.4,U=L?(G(F*11+2)+G(F*11+3)-1)*.42:(G(F*11+2)+G(F*11+3)-1)*1.05,I=L?(G(F*11+4)-.5)*.22:(G(F*11+4)-.5)*.46,E=V*V*.055;if(S[F*3]=u+w*V+v*(U-E),S[F*3+1]=I,S[F*3+2]=d+f*V+b*(U-E),F%7===0)R.setRGB(.96,.22,.44),P[F]=L?.95+G(F*7+5)*.95:1.15+G(F*7+5)*1.05,C[F]=.88;else{const J=F%4===0?4800+G(F*7+5)*3200:12e3+G(F*7+5)*18e3;re(J,R),P[F]=(L?.55:.45)+G(F*7+6)*1.15,C[F]=.48+G(F*7+7)*.52}A[F*3]=R.r,A[F*3+1]=R.g,A[F*3+2]=R.b}const T=new ct;T.setAttribute("position",new B(S,3)),T.setAttribute("color",new B(A,3)),T.setAttribute("aScale",new B(P,1)),T.setAttribute("aLuminosity",new B(C,1)),e.add(new Ht(T,le({baseSize:10.5,minPixelSize:1.4,maxPixelSize:22,diffractionStrength:.44,opacity:.94}))),this.spiralGalaxyArmRibbons=[];const _=this.isSoftwareGl?3:6;for(let F=0;F<_;F++){const V=(_>1?F/(_-1)-.5:0)*.85,U=(G(F*13+3)-.5)*.24,I=(F-_/2)*.032,E=new D(new de(.95,.34),Ga({seedOffset:12.4+F*3.1,hubblePaletteMix:.22,opacity:.62,isInnerCore:F%2===0}));E.position.set(u+w*V+v*U,I,d+f*V+b*U),E.rotation.y=m+(F%2===0?.25:-.25),E.rotation.x=(F-_/2)*.14,e.add(E),this.spiralGalaxyArmRibbons.push(E)}const W=new ne(new ie({map:a,color:16772565,opacity:.36,blending:Gt,depthWrite:!1}));W.scale.set(9.5,6.2,1),e.add(W),this.spiralGalaxyBulgeHalo=W;const j=new Ct;j.position.set(u,0,d),e.add(j);const Y=this.createSinglePointGlint(3718648,19,.88);Y.position.set(u,0,d),e.add(Y),this.registerMarkerAnchor({id:"marker_orion_capy_spur",label:"CapySol System · Orion Spur",sublabel:"CapyWay Galaxy · 26,000 ly from Core · 10^+19.4 m",node:j,layerBandId:"galaxy",minLog:18.6,maxLog:23,targetLogMeters:19.4,colorCss:"#60a5fa",physicalRadiusWorldAtOneToOne:.008});const z=new Ct;z.position.set(u+w*.035,.004,d+f*.035),e.add(z);const N=this.createSinglePointGlint(16007006,15,.5);return N.position.copy(z.position),e.add(N),this.registerMarkerAnchor({id:"marker_h2_nebula_core",label:"H-II Star-Forming Nebula",sublabel:"Giant Molecular Cloud & Pillars · 10^+17.2 m",node:z,layerBandId:"galaxy",minLog:16.8,maxLog:20,targetLogMeters:17.2,colorCss:"#f43f5e",physicalRadiusWorldAtOneToOne:.024}),F=>{const L=.045*(1-.84*this.lastGalaxyFocusBlend);e.rotation.y+=F*L}}populateSpiralArmsLayer(t,a){return()=>{}}populateNebulaLayer(t,a){const s=[[0,0,0,1.1,!1],[.42,.78,.18,2.7,!1],[-.52,-.68,.35,4.3,!1],[.88,.15,-.44,6.1,!0],[-.22,1.32,.52,8.4,!0]],e=this.isSoftwareGl?3:s.length;for(let f=0;f<e;f++){const[v,b,M,S,A]=s[f],P=A?28:42,C=new D(new de(P,P),Ga({seedOffset:S,hubblePaletteMix:.35,opacity:A?.68:.76,isInnerCore:A}));C.rotation.set(v,b,M),C.renderOrder=f,t.add(C)}const n=[{x:-5.4,y:-1.2,z:-1.4,w:11.5,h:25.5,tiltZ:-.2,seed:1.3},{x:.2,y:.4,z:0,w:12.8,h:28.5,tiltZ:-.1,seed:3.7},{x:5.8,y:-2.8,z:1.5,w:9.8,h:20.5,tiltZ:-.24,seed:6.1}];for(let f=0;f<n.length;f++){const v=n[f],b=new H;b.position.set(v.x,v.y,v.z),b.rotation.z=v.tiltZ;const M=gs({seed:v.seed,hubblePaletteMix:.5,opacity:.78}),S=new D(new de(v.w,v.h),M);if(S.renderOrder=2+f*2,b.add(S),!this.isSoftwareGl){const A=gs({seed:v.seed+.85,hubblePaletteMix:.5,opacity:.56}),P=new D(new de(v.w*.92,v.h),A);P.rotation.y=Math.PI*.38,P.renderOrder=3+f*2,b.add(P)}t.add(b)}const o=this.isSoftwareGl?180:520,l=new Float32Array(o*3),u=new Float32Array(o*3),d=new Float32Array(o),r=new Float32Array(o);for(let f=0;f<o;f++){const v=f<7,b=v?Math.pow(G(f*5+1),1.2)*2.6:2.2+Math.pow(G(f*5+1),.9)*18,M=Math.acos(2*G(f*5+2)-1),S=G(f*5+3)*Math.PI*2;l[f*3]=b*Math.sin(M)*Math.cos(S),l[f*3+1]=b*Math.cos(M),l[f*3+2]=b*Math.sin(M)*Math.sin(S);const A=v?28e3:4200+G(f*5+4)*2e4;re(A,R),u[f*3]=R.r,u[f*3+1]=R.g,u[f*3+2]=R.b,d[f]=v?2.4+(f===0?1.1:0):.55+G(f*5+5)*1.4,r[f]=v?1:.35+G(f*7+1)*.6}const i=new ct;i.setAttribute("position",new B(l,3)),i.setAttribute("color",new B(u,3)),i.setAttribute("aScale",new B(d,1)),i.setAttribute("aLuminosity",new B(r,1));const h=new Ht(i,le({baseSize:16,maxPixelSize:42,diffractionStrength:.72,opacity:.98}));h.renderOrder=10,t.add(h);const c=new H;c.rotation.z=.26;const p=new ne(new ie({map:a,color:3718648,opacity:.65,blending:Gt,depthWrite:!1}));p.position.set(0,3.2,.5),p.scale.set(1.2,6.8,1);const g=p.clone();g.position.set(0,-3.2,.5),c.add(p,g);const m=this.createSinglePointGlint(16776171,15,.85);c.add(m),t.add(c);const w=new Ct;return t.add(w),this.registerMarkerAnchor({id:"marker_nascent_solar_system",label:"G2V Solar System",sublabel:"Protostellar Disk & Heliopause · 10^+12.95 m",node:w,layerBandId:"nebulas",minLog:12.5,maxLog:17.5,targetLogMeters:12.95,colorCss:"#facc15",physicalRadiusWorldAtOneToOne:.005}),f=>{t.rotation.y+=f*.022}}populateSolarSystemLayer(t,a){const s=new H;s.rotation.x=.34,t.add(s),this.solarFocusContainer=s;const e=new H;s.add(e),this.solarEclipticGroup=e,this.capyEarthPlanet=null;const n=new Z(1,this.isSoftwareGl?24:40,24),o=vo();o.uniforms.uAlphaRatio.value=this.fineStructureRatio,this.solarSunMat=o,this.solarSunMesh=new D(n,o),e.add(this.solarSunMesh);const l=this.createSinglePointGlint(16775149,22,.85);this.sunStarBeacon=l,e.add(l),this.solarCoronaSprite=new ne(new ie({map:a,color:16639626,opacity:.85,blending:Gt,depthWrite:!1})),e.add(this.solarCoronaSprite);const u=new Ct;e.add(u),this.registerMarkerAnchor({id:"marker_sun_g2v",label:"CapySol Star (G2V)",sublabel:"1.39M km · Heart of CapySol System",node:u,layerBandId:"stellar_systems",minLog:10.2,maxLog:15.2,targetLogMeters:9.14,colorCss:"#facc15",physicalRadiusWorldAtOneToOne:.0034});const d=[{id:"mercury",name:"Mercury",sub:"0.39 AU · 4,879 km",aAu:.387,rAu:2439.7/1495978707e-1,ecc:.205,incDeg:7,speed:1.65,colorHex:11051678,colorCss:"#d6d3d1",ringed:!1,targetLog:7.85},{id:"venus",name:"Venus",sub:"0.72 AU · 12,104 km",aAu:.723,rAu:6051.8/1495978707e-1,ecc:.007,incDeg:3.4,speed:1.15,colorHex:16639626,colorCss:"#fde68a",ringed:!1,targetLog:7.85},{id:"capy_earth",name:"CapyWorld Planet",sub:"1.00 AU · 12,742 km · Habitable",aAu:1,rAu:6371/1495978707e-1,ecc:.017,incDeg:0,speed:.85,colorHex:3718648,colorCss:"#34d399",ringed:!1,targetLog:7.11},{id:"mars",name:"Mars",sub:"1.52 AU · 6,779 km",aAu:1.524,rAu:3389.5/1495978707e-1,ecc:.093,incDeg:1.85,speed:.58,colorHex:16347926,colorCss:"#fb923c",ringed:!1,targetLog:7.85},{id:"jupiter",name:"Jovian Giant",sub:"5.20 AU · 142,984 km",aAu:5.203,rAu:71492/1495978707e-1,ecc:.049,incDeg:1.3,speed:.28,colorHex:16096779,colorCss:"#fbbf24",ringed:!1,targetLog:8.93},{id:"saturn",name:"Ringed Kronos",sub:"9.54 AU · 120,536 km",aAu:9.537,rAu:60268/1495978707e-1,ecc:.056,incDeg:2.49,speed:.17,colorHex:16707722,colorCss:"#fde047",ringed:!0,targetLog:8.93},{id:"uranus",name:"Uranus (Ice Giant)",sub:"19.2 AU · 51,118 km",aAu:19.19,rAu:25559/1495978707e-1,ecc:.046,incDeg:.77,speed:.095,colorHex:6809849,colorCss:"#67e8f9",ringed:!1,targetLog:8.93},{id:"neptune",name:"Neptune",sub:"30.1 AU · 49,528 km",aAu:30.07,rAu:24764/1495978707e-1,ecc:.009,incDeg:1.77,speed:.062,colorHex:3900150,colorCss:"#60a5fa",ringed:!1,targetLog:8.93}];this.solarPlanets=[];for(let C=0;C<d.length;C++){const T=d[C],_=new H;_.rotation.z=q.degToRad(T.incDeg),e.add(_);const{line:W,unitCoords:j}=this.createOrbitHairline(22*(T.aAu/30.07),T.ecc,T.id==="capy_earth"?3462041:4674921);_.add(W);const Y=new H;Y.rotation.y=C*.94+.45,_.add(Y);const z=T.id==="capy_earth"?Wa(Kt):T.id==="jupiter"||T.id==="saturn"?bo(Kt):Ha({sunDir:Kt,baseColorHex:T.colorHex,highlandColorHex:14870768}),N=new D(new Z(1,this.isSoftwareGl?18:28,20),z);if(T.id==="capy_earth"){this.capyEarthBodyMat=z;const V=new D(new Ne(1.38,2.25,48),Na({innerRadius:1.38,outerRadius:2.25,planetRadius:1,sunDir:Kt}));V.rotation.x=Math.PI*.43,V.visible=!1,N.add(V),this.capyEarthRingMesh=V}else if(T.ringed){const V=new D(new Ne(1.35,2.32,48),Na({innerRadius:1.35,outerRadius:2.32,planetRadius:1,sunDir:Kt}));V.rotation.x=Math.PI*.43,N.add(V)}const F=this.createSinglePointGlint(T.colorHex,T.aAu>=5?8.5:6.8,.18);N.add(F),Y.add(N);const L={name:T.name,semiMajorAu:T.aAu,radiusAu:T.rAu,eccentricity:T.ecc,inclinationRad:q.degToRad(T.incDeg),angularSpeed:T.speed,pivot:Y,bodyMesh:N,glintPoint:F,orbitLine:W,baseOrbitPoints:j,targetLogMeters:T.targetLog,colorCss:T.colorCss};this.solarPlanets.push(L),T.id==="capy_earth"&&(this.capyEarthPlanet=L),this.registerMarkerAnchor({id:`marker_planet_${T.id}`,label:T.name,sublabel:T.sub,node:N,layerBandId:"stellar_systems",minLog:10.6,maxLog:14.5,targetLogMeters:T.targetLog,colorCss:T.colorCss,physicalRadiusWorldAtOneToOne:22*(T.rAu/30.07)})}const r=this.isSoftwareGl?360:1200;this.solarBeltBaseAu=new Float32Array(r*3);const i=new Float32Array(r*3),h=new Float32Array(r*3),c=new Float32Array(r),p=new Float32Array(r);for(let C=0;C<r;C++){const T=C%5<3,_=T?30.5+Math.pow(G(C*5+1),1.3)*19.5:2.15+G(C*5+1)*1.1,W=G(C*5+2)*Math.PI*2,j=(G(C*5+3)-.5)*(T?.16:.09);this.solarBeltBaseAu[C*3]=_,this.solarBeltBaseAu[C*3+1]=W,this.solarBeltBaseAu[C*3+2]=j,R.setHex(T?12248829:14078929),h[C*3]=R.r,h[C*3+1]=R.g,h[C*3+2]=R.b,c[C]=.45+G(C*5+4)*.65,p[C]=T?.32:.42}const g=new ct;g.setAttribute("position",new B(i,3)),g.setAttribute("color",new B(h,3)),g.setAttribute("aScale",new B(c,1)),g.setAttribute("aLuminosity",new B(p,1)),this.solarBeltPoints=new Ht(g,le({baseSize:6.5,minPixelSize:1.4,maxPixelSize:5.5,diffractionStrength:0,opacity:.55})),e.add(this.solarBeltPoints);const m=new Ct;m.position.set(2.8*(22/30.07),0,0),e.add(m),this.registerMarkerAnchor({id:"marker_asteroid_belt",label:"Main Asteroid Belt",sublabel:"2.2–3.2 AU · Ceres & Silicates",node:m,layerBandId:"stellar_systems",minLog:10.4,maxLog:14.2,targetLogMeters:11.65,colorCss:"#d6d3d1",physicalRadiusWorldAtOneToOne:2.8*(22/30.07)});const w=new Ct;w.position.set(38*(22/30.07),0,0),e.add(w),this.registerMarkerAnchor({id:"marker_kuiper_belt",label:"Kuiper Belt & Scattered Disk",sublabel:"30–50 AU · Pluto & Icy Bodies",node:w,layerBandId:"stellar_systems",minLog:10.8,maxLog:14.8,targetLogMeters:12.95,colorCss:"#7dd3fc",physicalRadiusWorldAtOneToOne:38*(22/30.07)});const f=this.isSoftwareGl?450:1600,v=new Float32Array(f*3),b=new Float32Array(f*3),M=new Float32Array(f),S=new Float32Array(f);for(let C=0;C<f;C++){const T=60+Math.pow(G(C*7+1),.85)*80,_=Math.acos(2*G(C*7+2)-1),W=G(C*7+3)*Math.PI*2;v[C*3]=T*Math.sin(_)*Math.cos(W),v[C*3+1]=T*Math.cos(_),v[C*3+2]=T*Math.sin(_)*Math.sin(W);const j=T<90;R.setHex(j?13630206:14742270),b[C*3]=R.r,b[C*3+1]=R.g,b[C*3+2]=R.b,M[C]=.5+G(C*7+4)*.9,S[C]=.35+G(C*7+5)*.45}const A=new ct;A.setAttribute("position",new B(v,3)),A.setAttribute("color",new B(b,3)),A.setAttribute("aScale",new B(M,1)),A.setAttribute("aLuminosity",new B(S,1)),this.solarOortPoints=new Ht(A,le({baseSize:6.8,minPixelSize:1.2,maxPixelSize:4.8,diffractionStrength:0,opacity:.65})),t.add(this.solarOortPoints);const P=new Ct;return P.position.set(0,0,85),t.add(P),this.registerMarkerAnchor({id:"marker_oort_cloud",label:"Oort Cometary Cloud",sublabel:"2,000–100,000 AU · Spherical Reservoir",node:P,layerBandId:"stellar_systems",minLog:11.2,maxLog:15.2,targetLogMeters:12.95,colorCss:"#38bdf8",physicalRadiusWorldAtOneToOne:85}),this.applySolarSystemRescaler(1),(C,T,_,W)=>{Math.abs(_-this.lastGammaApplied)>.002&&this.applySolarSystemRescaler(_);const j=ts.find(z=>z.id===this.orbitTimeScaleId)||ts[4];let Y=0;this.orbitTimeScaleId!=="paused"&&Number.isFinite(j.earthOrbitDurationSec)&&j.earthOrbitDurationSec>0&&(Y=Math.PI*2/j.earthOrbitDurationSec);for(let z=0;z<this.solarPlanets.length;z++){const N=this.solarPlanets[z],F=Math.max(.2,N.semiMajorAu||1),L=Y*Math.pow(F,-1.5);N.pivot.rotation.y+=L*C,N.orbitLine.visible=W||_<.92}if(this.solarBeltPoints){const N=Y*Math.pow(2.8,-1.5);this.solarBeltPoints.rotation.y+=N*C}if(this.solarOortPoints&&(this.solarOortPoints.rotation.y+=C*.003,this.solarOortPoints.rotation.x+=C*.0015),this.solarCoronaSprite){const z=this.solarCoronaSprite.material;z.opacity=q.clamp(.72+.14*q.clamp(this.fineStructureRatio,.55,2.2),.45,.98)}}}applySolarSystemRescaler(t){this.lastGammaApplied=t;const a=22,s=30.07,e=.00465047/s,n=t>=.995?a*e:a*Math.pow(e,t)*.58;this.solarSunMesh&&this.solarSunMesh.scale.setScalar(Math.max(.0034,n)),this.solarCoronaSprite&&this.solarCoronaSprite.scale.setScalar(Math.max(2.6,n*5.2));for(let o=0;o<this.solarPlanets.length;o++){const l=this.solarPlanets[o],u=a*Math.pow(l.semiMajorAu/s,t),d=l.radiusAu/s,r=t>=.995?a*d:a*Math.pow(d,t)*.44;l.bodyMesh.position.set(u*(1-l.eccentricity),0,0),l.bodyMesh.scale.setScalar(Math.max(1e-5,r));const i=l.orbitLine.geometry.attributes.position,h=i.array,c=l.baseOrbitPoints;for(let p=0;p<h.length;p+=3)h[p]=c[p]*u,h[p+1]=0,h[p+2]=c[p+2]*u;i.needsUpdate=!0}if(this.solarBeltPoints&&this.solarBeltBaseAu){const o=this.solarBeltPoints.geometry.attributes.position,l=o.array,u=this.solarBeltBaseAu.length/3;for(let d=0;d<u;d++){const r=this.solarBeltBaseAu[d*3],i=this.solarBeltBaseAu[d*3+1],h=this.solarBeltBaseAu[d*3+2],c=a*Math.pow(r/s,t);l[d*3]=Math.cos(i)*c,l[d*3+1]=c*h,l[d*3+2]=Math.sin(i)*c}o.needsUpdate=!0}this.solarOortPoints&&this.solarOortPoints.scale.setScalar(Math.pow(1,t))}populatePlanetarySystemLayer(t){const a=new H;a.rotation.x=.41,t.add(a),this.planetarySystemGroup=a;const s=new H;s.rotation.z=q.degToRad(5.14),a.add(s);const{line:e}=this.createOrbitHairline(Ss,.055,9741240);s.add(e);const n=new H;s.add(n),this.planetaryMoonPivot=n;const o=Ha({sunDir:Kt,baseColorHex:9741240,highlandColorHex:15857145}),l=new D(new Z(Cs,this.isSoftwareGl?14:22,14),o);l.position.set(Ss*(1-.055),0,0),n.add(l),this.planetaryMoonMesh=l;const u=this.createSinglePointGlint(15857145,13.5,.46);l.add(u);const d=new H;d.rotation.y=1.85,a.add(d),this.planetaryMinimoonPivot=d;const{line:r}=this.createOrbitHairline(As,.02,16436245);a.add(r);const i=new D(new Z(Ps,this.isSoftwareGl?10:16,10),Ha({sunDir:Kt,baseColorHex:16436245,highlandColorHex:16707722}));i.position.set(As,0,0),d.add(i);const h=this.createSinglePointGlint(16436245,10.5,.36);i.add(h);const{line:c}=this.createOrbitHairline(21,0,3718648);a.add(c);const p=e.material,g=r.material,m=c.material,w=new Ct;return a.add(w),this.registerMarkerAnchor({id:"marker_capy_earth_globe",label:"Capy-Earth (Habitable)",sublabel:"12,742 km · Primary World",node:w,layerBandId:"planetary_system",minLog:6.8,maxLog:10.5,targetLogMeters:xs,colorCss:"#34d399",physicalRadiusWorldAtOneToOne:Ea*Math.pow(10,xs-8.85)}),this.registerMarkerAnchor({id:"marker_capy_moon",label:"Capy-Moon",sublabel:"3,474 km · 384,400 km Orbit",node:l,layerBandId:"planetary_system",minLog:7.2,maxLog:10.5,targetLogMeters:7.85,colorCss:"#94a3b8",physicalRadiusWorldAtOneToOne:Cs}),this.registerMarkerAnchor({id:"marker_planetary_ring_plane",label:"Ring Plane & Minimoon Yuzu-1",sublabel:"Ice & Silicate Ring System",node:i,layerBandId:"planetary_system",minLog:7.4,maxLog:10.2,targetLogMeters:8.85,colorCss:"#facc15",physicalRadiusWorldAtOneToOne:Ps}),(f,v,b,M)=>{n.rotation.y+=f*.018,d.rotation.y+=f*.045,e.visible=!0,r.visible=!0,c.visible=M,p&&(p.opacity=M?.56:.28),g&&(g.opacity=M?.52:.24),m&&(m.opacity=.34)}}createCurvedSurfacePatchGeometry(t,a,s,e){const n=e+1,o=n*n,l=new Float32Array(o*3),u=new Float32Array(o*3),d=new Float32Array(o*3),r=new Float32Array(o*2),i=new X(0,1,0).cross(t);i.lengthSq()<1e-6&&i.set(1,0,0).cross(t),i.normalize();const h=new X().crossVectors(t,i).normalize(),c=Math.tan(s),p=new X;let g=0,m=0;for(let v=0;v<n;v++){const b=v/e,M=(b*2-1)*c;for(let S=0;S<n;S++){const A=S/e,P=(A*2-1)*c;p.set(t.x,t.y,t.z).addScaledVector(i,P).addScaledVector(h,M).normalize(),l[g]=(p.x-t.x)*a,l[g+1]=(p.y-t.y)*a,l[g+2]=(p.z-t.z)*a,u[g]=p.x,u[g+1]=p.y,u[g+2]=p.z,d[g]=p.x,d[g+1]=p.y,d[g+2]=p.z,r[m]=A,r[m+1]=b,g+=3,m+=2}}const w=[];for(let v=0;v<e;v++)for(let b=0;b<e;b++){const M=v*n+b,S=M+1,A=M+n,P=A+1;w.push(M,S,A,S,P,A)}const f=new ct;return f.setAttribute("position",new B(l,3)),f.setAttribute("normal",new B(u,3)),f.setAttribute("aSphereDir",new B(d,3)),f.setAttribute("uv",new B(r,2)),f.setIndex(w),f.computeBoundingSphere(),f}populatePlanetGlobeLayer(t){var b;const a=new H;t.add(a),this.planetSurfaceAlignGroup=a;const s=new H;a.add(s),this.planetGlobeContainer=s;const e=Ea,n=Wa(Kt,{sanctuaryDir:Ce});this.planetGlobeMat=n;const o=new D(new Z(e,this.isSoftwareGl?32:64,this.isSoftwareGl?22:42),n);s.add(o),this.planetGlobeMesh=o;const l=Ms(Kt,{sanctuaryDir:Ce});this.planetCloudSphereMat=l;const u=new D(new Z(e*1.005,this.isSoftwareGl?28:52,this.isSoftwareGl?18:34),l);s.add(u),this.planetCloudMesh=u;const d=ys({sunDir:Kt,rayleighColor:new K(.2,.6,1),intensity:1.85});this.planetRayleighMat=d,this.atmosphereRayleighMat=d;const r=new D(new Z(e*1.018,this.isSoftwareGl?28:52,this.isSoftwareGl?18:34),d);s.add(r),this.planetRayleighMesh=r;const i=Na({innerRadius:e*1.65,outerRadius:e*2.85,planetRadius:e,sunDir:Kt}),h=new D(new Ne(e*1.65,e*2.85,this.isSoftwareGl?36:64),i);h.rotation.x=Math.PI*.5,h.visible=((b=this.pendingProceduralBiome)==null?void 0:b.ringSystemEnabled)??!1,s.add(h),this.planetaryRingMesh=h;const c=this.createSinglePointGlint(3718648,17.5,.72);c.visible=!1,s.add(c),this.planetOrbitalGlint=c;const p=new Ct;p.position.copy(Ce).multiplyScalar(e),s.add(p);const g=this.createSinglePointGlint(3462041,13,.35);g.position.copy(Ce).multiplyScalar(e*1.001),s.add(g),this.registerMarkerAnchor({id:"marker_sanctuary_landmass",label:"Capybara Sanctuary Archipelago",sublabel:"Home Surface Landmass · 22.5°N 42.0°E",node:p,layerBandId:"planet",minLog:4.8,maxLog:8.2,targetLogMeters:4.9,colorCss:"#34d399",physicalRadiusWorldAtOneToOne:.15});const m=new H;m.position.copy(Ce).multiplyScalar(e),a.add(m),this.planetSurfaceAnchorGroup=m,this.planetLodMats=[];const w=this.isSoftwareGl?36:68,f=(M,S,A,P)=>{const C=Wa(Kt,{useSphereDirAttr:!0,sanctuaryDir:Ce});C.polygonOffset=!0,C.polygonOffsetFactor=P,C.polygonOffsetUnits=P;const T=this.createCurvedSurfacePatchGeometry(Ce,M,S,A),_=new D(T,C);return _.visible=!1,m.add(_),this.planetLodMats.push(C),_};this.planetLod1Mesh=f(e,.4,w,-1),this.planetLod2Mesh=f(e,.075,w,-2),this.planetLod3Mesh=f(e,.014,this.isSoftwareGl?32:64,-3),this.planetCloudPatchMeshes=[],this.planetCloudPatchMats=[],this.atmosphereCloudMats=[];const v=[1.005,1.01];for(let M=0;M<v.length;M++){const S=Ms(Kt,{useSphereDirAttr:!0,sanctuaryDir:Ce,doubleSide:!0}),A=this.createCurvedSurfacePatchGeometry(Ce,e*v[M],.42,this.isSoftwareGl?24:44),P=new D(A,S);P.visible=!1,P.renderOrder=3+M,m.add(P),this.planetCloudPatchMeshes.push(P),this.planetCloudPatchMats.push(S),this.atmosphereCloudMats.push(S)}return M=>{h.visible&&(h.rotation.z+=M*.003)}}populateAtmosphereLayer(t){const a=new Ct;a.position.set(0,0,0),t.add(a),this.registerMarkerAnchor({id:"marker_sanctuary_archipelago",label:"Capybara Forest Archipelago",sublabel:"Atmospheric Entry · 6.3 m",node:a,layerBandId:"atmosphere",minLog:3.5,maxLog:6.5,targetLogMeters:.8,colorCss:"#34d399",physicalRadiusWorldAtOneToOne:.001});const s=this.isSoftwareGl?14:22,e=4,n=new Z(2.4,12,8),o=new O({color:16777215,emissive:14870768,emissiveIntensity:.28,roughness:.95,transparent:!0,opacity:.58,depthWrite:!1}),l=new kt(n,o,s*e);let u=0;for(let d=0;d<s;d++){const r=d/s*Math.PI*2+G(d*11+3)*.22,i=22+G(d*17+5)*28,h=Math.cos(r)*i,c=Math.sin(r)*i,g=c>12&&Math.abs(h)<16?h>=0?h+16:h-16:h,m=1.8+G(d*13+7)*5.2;for(let w=0;w<e;w++){const f=(w-1.5)*3.2+(G(u*5+1)-.5)*1.8,v=(G(u*9+2)-.5)*3,b=(w===1||w===2?.75:0)+(G(u*3+4)-.5)*.6,M=(w===1||w===2?1.95:1.35)+G(u*7+3)*.65,S=.44+G(u*13+6)*.22;$.position.set(g+f,m+b,c+v),$.scale.set(M,S,M*.85),$.rotation.set(0,r,0),$.updateMatrix(),l.setMatrixAt(u++,$.matrix)}}return l.instanceMatrix.needsUpdate=!0,l.computeBoundingSphere(),t.add(l),d=>{l.rotation.y+=d*.004}}populateLandMassesLayer(t){const a=this.isSoftwareGl?32:48,s=[0,2.8,6.2,10.5,16,22.5,30,39,50,64],e=[],n=[],o=[],l=new K(4694856),u=new K(2651190),d=new K(2054445),r=new K(5397608),i=new K(14412542),h=new K;for(let z=0;z<s.length;z++){const N=s[z];for(let F=0;F<a;F++){const L=F/a*Math.PI*2,V=Math.cos(L)*N,U=Math.sin(L)*N,I=Math.sin(L*5+.6)*.45+Math.cos(L*9-1.2)*.32+Math.sin(L*3+N*.09)*.23,E=Math.exp(-Math.pow((L-.68)*2.4,2));let J=-.8;if(N>9){const at=Math.min(1,(N-9)/38);J+=at*at*11.5*(.55+.55*Math.max(0,I))*(1-E*.72)}if(e.push(V,J,U),N<5.5?h.copy(l).lerp(u,N/5.5):J<3.6?h.copy(u).lerp(d,Math.min(1,(N-5.5)/22)):J<7.2?h.copy(d).lerp(r,Math.min(1,(J-3.6)/3.6)):h.copy(r).lerp(i,Math.min(1,(J-7.2)/3.2)),n.push(h.r,h.g,h.b),z<s.length-1){const at=(F+1)%a,et=z*a+F,tt=z*a+at,st=(z+1)*a+F,Q=(z+1)*a+at;o.push(et,tt,st,tt,Q,st)}}}const c=new ct;c.setAttribute("position",new ue(e,3)),c.setAttribute("color",new ue(n,3)),c.setIndex(o),c.computeVertexNormals();const p=new D(c,new O({vertexColors:!0,roughness:.9,metalness:0,side:Ot}));t.add(p);const g=this.isSoftwareGl?64:120,m=new ra(1.15,1),w=new O({color:2520372,roughness:.88}),f=new kt(m,w,g);for(let z=0;z<g;z++){const N=G(z*19+3)*Math.PI*2,F=5.2+Math.pow(G(z*23+7),.82)*20,L=Math.cos(N)*F,V=Math.sin(N)*F,U=F>9?Math.min(1,(F-9)/38):0,I=Math.sin(N*5+.6)*.45+Math.cos(N*9-1.2)*.32+Math.sin(N*3+F*.09)*.23,E=Math.exp(-Math.pow((N-.68)*2.4,2)),J=-.75+U*U*11.5*(.55+.55*Math.max(0,I))*(1-E*.72),at=.85+G(z*7+2)*1.15;$.position.set(L,J+.32*at,V),$.scale.set(at*1.2,at*.52,at*1.2),$.rotation.set(0,N,0),$.updateMatrix(),f.setMatrixAt(z,$.matrix),R.setHex(z%3===0?2984508:z%2===0?2256434:1725994),f.setColorAt(z,R)}f.instanceMatrix.needsUpdate=!0,f.instanceColor&&(f.instanceColor.needsUpdate=!0),f.computeBoundingSphere(),t.add(f);const v=[new X(38,-.58,30),new X(21,-.58,16.5),new X(9.5,-.58,6.8),new X(6.8,-.58,-1.8),new X(12.5,-.58,-14),new X(26,-.58,-32)],b=new oa(v),M=28,S=[],A=[];for(let z=0;z<=M;z++){const N=z/M,F=b.getPoint(N),L=b.getTangent(N),V=-L.z,U=L.x,I=1.65+Math.sin(N*Math.PI)*.85;if(S.push(F.x-V*I,F.y,F.z-U*I),S.push(F.x+V*I,F.y,F.z+U*I),z<M){const E=z*2;A.push(E,E+1,E+2,E+1,E+3,E+2)}}const P=new ct;P.setAttribute("position",new ue(S,3)),P.setIndex(A),P.computeVertexNormals();const C=new D(P,new O({color:3718648,emissive:223649,emissiveIntensity:.14,roughness:.2,metalness:.15,side:Ot}));t.add(C);const T=this.isSoftwareGl?10:16,_=3,W=new Z(1.85,12,8),j=new O({color:16777215,emissive:14870768,emissiveIntensity:.2,roughness:.95,transparent:!0,opacity:.48,depthWrite:!1}),Y=new kt(W,j,T*_);for(let z=0;z<T;z++){const N=z/T*Math.PI*2+G(z*7+3)*.24,F=38+G(z*11+5)*18,L=12.5+G(z*13+7)*4.5,V=Math.cos(N)*F,U=Math.sin(N)*F;for(let I=0;I<_;I++){const E=z*_+I,J=(I-1)*3.1+(G(E*5+1)-.5)*1.4,at=(G(E*9+2)-.5)*2.2,et=(I===1?.65:0)+(G(E*3+4)-.5)*.5,tt=(I===1?1.85:1.35)+G(E*17+3)*.55,st=.52+G(E*13+6)*.22;$.position.set(V+J,L+et,U+at),$.scale.set(tt,st,tt*.85),$.rotation.set(0,N,0),$.updateMatrix(),Y.setMatrixAt(E,$.matrix)}}return Y.instanceMatrix.needsUpdate=!0,Y.computeBoundingSphere(),t.add(Y),z=>{Y.rotation.y+=z*.006}}populateEcosystemsLayer(t){this.ecosystemMeadowMat=new O({color:2522425,roughness:.86}),this.ecosystemRiverMat=new O({color:3718648,emissive:223649,emissiveIntensity:.14,roughness:.2,metalness:.16,side:Ot});const a=this.isSoftwareGl?28:44,s=[0,3.5,7.5,13,21,32,46,62],e=[],n=[],o=[],l=new K(5023300),u=new K(2452530),d=new K(1789479),r=new K;for(let L=0;L<s.length;L++){const V=s[L];for(let U=0;U<a;U++){const I=U/a*Math.PI*2,E=Math.cos(I)*V,J=Math.sin(I)*V,at=V>18?(Math.sin(I*4+V*.08)*.5+.5)*Math.min(4.8,(V-18)*.11):0;if(e.push(E,at-.55,J),V<7.5?r.copy(l).lerp(u,V/7.5):r.copy(u).lerp(d,Math.min(1,(V-7.5)/36)),n.push(r.r,r.g,r.b),L<s.length-1){const et=(U+1)%a,tt=L*a+U,st=L*a+et,Q=(L+1)*a+U,gt=(L+1)*a+et;o.push(tt,st,Q,st,gt,Q)}}}const i=new ct;i.setAttribute("position",new ue(e,3)),i.setAttribute("color",new ue(n,3)),i.setIndex(o),i.computeVertexNormals();const h=new D(i,new O({vertexColors:!0,roughness:.9,side:Ot}));t.add(h);const c=[new X(24,-.45,22),new X(12.5,-.45,10.2),new X(6.2,-.45,3.8),new X(8.5,-.45,-5.5),new X(18,-.45,-20)],p=new oa(c),g=22,m=[],w=[];for(let L=0;L<=g;L++){const V=L/g,U=p.getPoint(V),I=p.getTangent(V),E=-I.z,J=I.x,at=1.45;if(m.push(U.x-E*at,U.y,U.z-J*at),m.push(U.x+E*at,U.y,U.z+J*at),L<g){const et=L*2;w.push(et,et+1,et+2,et+1,et+3,et+2)}}const f=new ct;f.setAttribute("position",new ue(m,3)),f.setIndex(w),f.computeVertexNormals(),t.add(new D(f,this.ecosystemRiverMat));const v=[new X(-14,-.46,20),new X(-4.5,-.46,8.2),new X(0,-.45,0),new X(-1.2,-.46,-12),new X(2.5,-.46,-24)],b=new oa(v),M=[],S=[];for(let L=0;L<=20;L++){const V=L/20,U=b.getPoint(V),I=b.getTangent(V),E=-I.z,J=I.x,at=.65;if(M.push(U.x-E*at,U.y,U.z-J*at),M.push(U.x+E*at,U.y,U.z+J*at),L<20){const et=L*2;S.push(et,et+1,et+2,et+1,et+3,et+2)}}const A=new ct;A.setAttribute("position",new ue(M,3)),A.setIndex(S),A.computeVertexNormals(),t.add(new D(A,new O({color:14071932,roughness:.92,side:Ot})));const P=new rt(.18,.3,1.5,6),C=new O({color:7029286,roughness:.92}),T=new ra(1.35,1),_=new ce(1.1,2.6,7),W=this.isSoftwareGl?68:140,j=this.isSoftwareGl?56:110,Y=new kt(P,C,W),z=new kt(T,this.ecosystemMeadowMat,W),N=new kt(P,C,j),F=new kt(_,this.ecosystemMeadowMat,j);for(let L=0;L<W;L++){const V=G(L*17+1)*Math.PI*2,U=5.2+Math.pow(G(L*19+3),.85)*32,I=Math.cos(V)*U,E=Math.sin(V)*U,J=I>4.5&&I<16&&E>-4&&E<14?2.8:0,at=I+J,et=.72+G(L*7+5)*.72,tt=-.5+(U>18?Math.min(3,(U-18)*.06):0);$.position.set(at,tt+.7*et,E),$.scale.set(et,et,et),$.rotation.set(0,V,0),$.updateMatrix(),Y.setMatrixAt(L,$.matrix),$.position.set(at,tt+2*et,E),$.scale.set(et*1.15,et*.86,et*1.15),$.updateMatrix(),z.setMatrixAt(L,$.matrix),R.setHex(L%4===0?5023300:L%3===0?3050300:2322226),z.setColorAt(L,R)}for(let L=0;L<j;L++){const V=G(L*23+11)*Math.PI*2,U=8.5+G(L*29+7)*36,I=Math.cos(V)*U,E=Math.sin(V)*U,J=.8+G(L*13+4)*.75,at=-.5+(U>18?Math.min(3.5,(U-18)*.08):0);$.position.set(I,at+.65*J,E),$.scale.set(J*.9,J,J*.9),$.rotation.set(0,V,0),$.updateMatrix(),N.setMatrixAt(L,$.matrix),$.position.set(I,at+2.2*J,E),$.scale.set(J,J*1.15,J),$.updateMatrix(),F.setMatrixAt(L,$.matrix),R.setHex(L%3===0?1467700:1988145),F.setColorAt(L,R)}return Y.instanceMatrix.needsUpdate=!0,z.instanceMatrix.needsUpdate=!0,N.instanceMatrix.needsUpdate=!0,F.instanceMatrix.needsUpdate=!0,z.instanceColor&&(z.instanceColor.needsUpdate=!0),F.instanceColor&&(F.instanceColor.needsUpdate=!0),Y.computeBoundingSphere(),z.computeBoundingSphere(),N.computeBoundingSphere(),F.computeBoundingSphere(),t.add(Y,z,N,F),()=>{}}populateForestCanopyMotesLayer(t,a){const s=new H;s.position.y=-.82,t.add(s);const e=new D(new ja(21.5,36),new O({color:3897922,roughness:.92,metalness:0}));e.rotation.x=-Math.PI/2,e.position.y=-.02,s.add(e);const n=new D(new Ne(18.5,46,40),new O({color:2383154,roughness:.95,metalness:0}));n.rotation.x=-Math.PI/2,n.position.y=-.05,s.add(n);const o=new rt(.42,.72,1,7),l=new O({color:7029286,roughness:.94}),u=new ra(2.35,1),d=new ce(1.9,4.4,7),r=new O({color:2785079,roughness:.84}),i=this.isSoftwareGl?24:44,h=this.isSoftwareGl?18:34,c=new kt(o,l,i),p=new kt(u,r,i),g=new kt(o,l,h),m=new kt(d,r,h);for(let M=0;M<i;M++){const S=M/i*Math.PI*2+G(M*11+3)*.25,A=16.5+G(M*17+5)*24,P=Math.cos(S)*A,C=Math.sin(S)*A,T=C>2.5&&Math.abs(P)<14.5?P>=0?P+14.5:P-14.5:P,_=.85+G(M*7+2)*.55,W=6.2*_;$.position.set(T,W*.5,C),$.scale.set(_,W,_),$.rotation.set(0,S,0),$.updateMatrix(),c.setMatrixAt(M,$.matrix),$.position.set(T,W+.65*_,C),$.scale.set(_*1.15,_*.78,_*1.15),$.updateMatrix(),p.setMatrixAt(M,$.matrix),R.setHex(M%3===0?3905090:M%2===0?2520372:1924651),p.setColorAt(M,R)}for(let M=0;M<h;M++){const S=M/h*Math.PI*2+G(M*23+7)*.3,A=19+G(M*29+11)*26,P=Math.cos(S)*A,C=Math.sin(S)*A,T=C>2.5&&Math.abs(P)<15.5?P>=0?P+15.5:P-15.5:P,_=.9+G(M*13+4)*.65,W=5.4*_;$.position.set(T,W*.5,C),$.scale.set(_*.85,W,_*.85),$.rotation.set(0,S,0),$.updateMatrix(),g.setMatrixAt(M,$.matrix),$.position.set(T,W+1.4*_,C),$.scale.set(_,_*1.15,_),$.updateMatrix(),m.setMatrixAt(M,$.matrix),R.setHex(M%2===0?1467700:1988145),m.setColorAt(M,R)}c.instanceMatrix.needsUpdate=!0,p.instanceMatrix.needsUpdate=!0,g.instanceMatrix.needsUpdate=!0,m.instanceMatrix.needsUpdate=!0,p.instanceColor&&(p.instanceColor.needsUpdate=!0),m.instanceColor&&(m.instanceColor.needsUpdate=!0),c.computeBoundingSphere(),p.computeBoundingSphere(),g.computeBoundingSphere(),m.computeBoundingSphere(),s.add(c,p,g,m);const w=this.isSoftwareGl?28:64,f=new Float32Array(w*3);for(let M=0;M<w;M++)f[M*3]=(G(M*3+1)-.5)*18,f[M*3+1]=G(M*3+2)*6.5,f[M*3+2]=(G(M*3+3)-.5)*18;const v=new ct;v.setAttribute("position",new B(f,3));const b=new Ht(v,new eo({map:a,color:16707722,size:.32,opacity:.55,blending:Gt,depthWrite:!1}));return s.add(b),M=>{b.rotation.y+=M*.06}}populateLeafAndFurMicroLayer(t,a,s){let e=!1;return zs(async()=>{const{buildForestMicroDiorama:n}=await import("./ForestMicroDioramaBuilder-VrWrIgm5.js");return{buildForestMicroDiorama:n}},__vite__mapDeps([0,1,2]),import.meta.url).then(({buildForestMicroDiorama:n})=>{if(e||!a.parent)return;e=!0;const o=n(a,s,this.isSoftwareGl,this.activeForestSpecimenId);this.forestDiorama=o,t.materials=this.collectLayerMaterials(a),o.setActiveSpecimen(this.activeForestSpecimenId)}),(n,o)=>{var l;(l=this.forestDiorama)==null||l.tick(n,o)}}populateBiologicalCellsLayer(t){const a=new O({color:1096065,emissive:413243,emissiveIntensity:.42,roughness:.32,opacity:.55}),s=5.6,e=[[0,0],[9.9,0],[-9.9,0],[4.95,8.55],[-4.95,8.55],[4.95,-8.55],[-4.95,-8.55]];for(let d=0;d<e.length;d++){const[r,i]=e[d],h=new D(new rt(s,s,3.8,6,1,!0),a);h.position.set(r,0,i),t.add(h)}const n=new O({color:8490232,emissive:4405450,emissiveIntensity:.55,roughness:.28,transparent:!0}),o=new D(new Z(2.2,24,24),n);this.cellNucleusMesh=o,this.cellNucleusMat=n,t.add(o);const l=new H,u=new O({color:2278750,emissive:1332013,emissiveIntensity:.48,roughness:.28});for(let d=0;d<16;d++){const r=d/16*Math.PI*2,i=new D(new Z(.56,14,14),u);i.scale.set(1.55,.58,.95),i.position.set(Math.cos(r)*3.9,Math.sin(r*2)*.45,Math.sin(r)*3.9),i.rotation.y=-r,l.add(i)}return t.add(l),t.rotation.x=.58,this.registerMarkerAnchor({id:"marker_cell_dna_chromatin",label:"Chromatin DNA Helix",sublabel:"3.4 nm Pitch · Inside Nucleus",node:o,layerBandId:"biological_cells",minLog:-8,maxLog:-3.6,targetLogMeters:-8.47,colorCss:"#2dd4bf",physicalRadiusWorldAtOneToOne:.002}),d=>{l.rotation.y+=d*.3}}ensureChromatinBridgeBuilt(){if(this.chromatinBridgeGroup)return;const t=new H;t.name="scale_bridge_chromatin_nucleosome",t.visible=!1,t.matrixWorldAutoUpdate=!1,t.rotation.z=.24,ua(t),this.rootGroup.add(t),this.chromatinBridgeGroup=t,this.chromatinBridgeMats.length=0,this.glowCoolTex||(this.glowCoolTex=this.createSoftRadialTexture("rgba(235,248,255,1)","rgba(56,189,248,0.38)"),this.glowCoolTex.userData.sharedAsset=!0);const a=this.glowCoolTex,s=new ie({map:a,color:3718648,opacity:.42,transparent:!0,blending:Gt,depthWrite:!1}),e=new ne(s);e.scale.setScalar(24),t.add(e),this.chromatinBridgeMats.push({mat:s,baseOpacity:.42,defaultDepthWrite:!1});const n=this.isSoftwareGl?28:44,o=26,l=5.4,u=4.5,d=new rt(.72,.72,.48,12),r=new O({color:6514417,emissive:3616931,emissiveIntensity:.52,roughness:.28,transparent:!0,opacity:.96}),i=new kt(d,r,n),h=[];for(let w=0;w<n;w++){const f=w/(n-1),v=f*Math.PI*2*u,b=(f-.5)*o,M=l*(.88+.14*Math.sin(f*Math.PI*3)),S=Math.cos(v)*M,A=Math.sin(v)*M;h.push(new X(S,b,A)),$.position.set(S,b,A),$.rotation.set(.35,-v,Math.PI*.5+.22),$.scale.setScalar(.92+.16*Math.sin(w*1.7)),$.updateMatrix(),i.setMatrixAt(w,$.matrix),R.setHex(w%3===0?8490232:w%2===0?3718648:3003583),i.setColorAt(w,R)}i.instanceMatrix.needsUpdate=!0,i.instanceColor&&(i.instanceColor.needsUpdate=!0),i.computeBoundingSphere(),t.add(i),this.chromatinBridgeMats.push({mat:r,baseOpacity:.96,defaultDepthWrite:!0});const c=new oa(h),p=new ao(c,this.isSoftwareGl?64:112,.2,8,!1),g=new O({color:3003583,emissive:889992,emissiveIntensity:.62,roughness:.24,transparent:!0,opacity:.92}),m=new D(p,g);t.add(m),this.chromatinBridgeMats.push({mat:g,baseOpacity:.92,defaultDepthWrite:!0})}populateDnaHelixLayer(t,a){const s=new H;s.rotation.z=.28,t.add(s);const e=new ne(new ie({map:a,color:3003583,opacity:.44,blending:Gt,depthWrite:!1}));e.scale.setScalar(26),t.add(e);const n=this.isSoftwareGl?28:44,o=38,l=5.4,u=new O({color:3718648,emissive:223649,emissiveIntensity:.45,roughness:.24,transparent:!0}),d=new O({color:16020150,emissive:10295117,emissiveIntensity:.45,roughness:.24,transparent:!0}),i=[3462041,16498468,6333946,16007006].map(p=>new O({color:p,emissive:p,emissiveIntensity:.34,roughness:.32,transparent:!0})),h=new Z(.72,12,12),c=new rt(.22,.22,l*.92,8);for(let p=0;p<n;p++){const m=(p/(n-1)-.5)*o,w=p*(Math.PI*2/10.5),f=w+2.42,v=Math.cos(w)*l,b=Math.sin(w)*l,M=Math.cos(f)*l,S=Math.sin(f)*l,A=new D(h,u);A.position.set(v,m,b);const P=new D(h,d);P.position.set(M,m,S),s.add(A,P),pt.set(M-v,0,S-b);const C=pt.length();pt.normalize();const T=new D(c,i[p%4]);T.position.set(v+pt.x*C*.25,m,b+pt.z*C*.25),T.quaternion.setFromUnitVectors(ia,pt),T.scale.set(1,C*.48/(l*.92),1);const _=new D(c,i[(p+2)%4]);_.position.set(v+pt.x*C*.75,m,b+pt.z*C*.75),_.quaternion.copy(T.quaternion),_.scale.copy(T.scale),s.add(T,_)}return p=>{s.rotation.y+=p*.42}}populateAtomicOrbitalsLayer(t,a){this.atomicNuclearClusterGroup=new H;const s=new D(new Z(1,16,16),new pe({color:16478597}));this.atomicNuclearClusterGroup.add(s),t.add(this.atomicNuclearClusterGroup);const e=this.createSinglePointGlint(16007006,11,.45);t.add(e);const n=new Ct;t.add(n),this.registerMarkerAnchor({id:"marker_c12_nucleus",label:"Carbon-12 Nucleus",sublabel:"5.4 fm · 1/63,000 of Atom",node:n,layerBandId:"atomic_orbitals",minLog:-13.8,maxLog:-9,targetLogMeters:-14.27,colorCss:"#f43f5e",physicalRadiusWorldAtOneToOne:3e-4});const o=this.isSoftwareGl?1100:3800,l=new Float32Array(o*3),u=new Float32Array(o*3),d=new Float32Array(o),r=new Float32Array(o);for(let c=0;c<o;c++){const p=c%6;let g=0,m=0,w=0;if(p<2){const f=Math.pow(G(c*5+1),.65)*3.8,v=Math.acos(2*G(c*5+2)-1),b=G(c*5+3)*Math.PI*2;g=f*Math.sin(v)*Math.cos(b),m=f*Math.cos(v),w=f*Math.sin(v)*Math.sin(b),R.setRGB(.95,.88,.55)}else{const f=c%3,v=G(c*5+4)<.5?-1:1,b=4.2+Math.pow(G(c*5+1),.75)*14.2,M=(1.2+b*.28)*(G(c*5+2)+G(c*5+3)-1),S=(1.2+b*.28)*(G(c*7+1)+G(c*7+2)-1);f===0?(g=v*b,m=M,w=S,R.setRGB(.22,.74,.98)):f===1?(g=M,m=v*b,w=S,R.setRGB(.5,.55,.98)):(g=M,m=S,w=v*b,R.setRGB(.18,.84,.75))}l[c*3]=g,l[c*3+1]=m,l[c*3+2]=w,u[c*3]=R.r,u[c*3+1]=R.g,u[c*3+2]=R.b,d[c]=.85+G(c*3+3)*1.1,r[c]=.35+G(c*3+4)*.45}const i=new ct;i.setAttribute("position",new B(l,3)),i.setAttribute("color",new B(u,3)),i.setAttribute("aScale",new B(d,1)),i.setAttribute("aLuminosity",new B(r,1)),this.atomicCloudPoints=new Ht(i,le({baseSize:22,maxPixelSize:28,diffractionStrength:0,opacity:.9})),t.add(this.atomicCloudPoints);const h=new ne(new ie({map:a,color:3718648,opacity:.52,blending:Gt,depthWrite:!1}));return h.scale.setScalar(30),this.atomicOrbitalsWaveHalo=h,t.add(h),this.electronMarkers=[],(c,p,g)=>{const m=q.clamp(this.fineStructureRatio,.55,2.3),w=q.clamp(1/m,.45,2.2);if(t.rotation.y+=c*.14*m,this.atomicCloudPoints&&this.atomicCloudPoints.scale.setScalar(w),h.scale.setScalar(26*w),this.atomicNuclearClusterGroup){const f=19*Math.pow(15882343598621413e-21,g);this.atomicNuclearClusterGroup.scale.setScalar(Math.max(3e-4,f))}}}populateAtomicNucleusLayer(t,a){const s=new O({color:16007006,emissive:10424889,emissiveIntensity:.62,roughness:.18,metalness:.12}),e=new O({color:3718648,emissive:481669,emissiveIntensity:.62,roughness:.18,metalness:.12}),n=new Z(2.65,this.isSoftwareGl?18:28,20),o=(1+Math.sqrt(5))/2,l=[[0,1,o],[0,-1,o],[0,1,-o],[0,-1,-o],[1,o,0],[-1,o,0],[1,-o,0],[-1,-o,0],[o,0,1],[-o,0,1],[o,0,-1],[-o,0,-1]];this.nucleonMeshes=[];for(let r=0;r<l.length;r++){const i=new X(l[r][0],l[r][1],l[r][2]).multiplyScalar(2.52),h=new D(n,r%2===0?s:e);h.position.copy(i),t.add(h),this.nucleonMeshes.push({mesh:h,basePos:i,phase:r*.85})}const u=new ne(new ie({map:a,color:16478597,opacity:.45,blending:Gt,depthWrite:!1}));u.scale.setScalar(20),t.add(u);const d=new Ct;return t.add(d),this.registerMarkerAnchor({id:"marker_valence_quarks",label:"u-u-d Valence Quarks",sublabel:"10^-18 m · QCD Confinement",node:d,layerBandId:"atomic_nucleus",minLog:-17.5,maxLog:-13.8,targetLogMeters:-18,colorCss:"#c084fc",physicalRadiusWorldAtOneToOne:.004}),(r,i)=>{t.rotation.y+=r*.32;for(let h=0;h<this.nucleonMeshes.length;h++){const c=this.nucleonMeshes[h],p=1+Math.sin(i*9+c.phase)*.06;c.mesh.position.copy(c.basePos).multiplyScalar(p)}}}populateQuarksGluonsLayer(t,a){const s=this.createSinglePointGlint(12616956,16,.55);t.add(s);const e=new D(new Z(14,32,24),ys({sunDir:Kt,rayleighColor:new K(.55,.36,.96),intensity:.95}));t.add(e);const n=[{angle:0,hex:16007006},{angle:Math.PI*2/3,hex:2278750},{angle:Math.PI*4/3,hex:3718648}],o=za(.85);this.quarkMeshes=[];for(let l=0;l<n.length;l++){const u=n[l],d=new X(Math.cos(u.angle)*7.8,Math.sin(u.angle)*7.8,0),r=new D(new Z(1.15,20,20),new pe({color:16777215}));r.position.copy(d);const i=new ne(new ie({map:a,color:u.hex,opacity:.92,blending:Gt,depthWrite:!1}));i.scale.setScalar(8.2),r.add(i),t.add(r);const h=new D(new de(1.6,1,1,10),o);t.add(h),this.quarkMeshes.push({mesh:r,basePos:d,tube:h,phase:l*2.1})}return(l,u)=>{t.rotation.z+=l*.25,t.rotation.y+=l*.2;for(let d=0;d<this.quarkMeshes.length;d++){const r=this.quarkMeshes[d];r.mesh.position.set(r.basePos.x+Math.sin(u*6+r.phase)*1.1,r.basePos.y+Math.cos(u*5.4+r.phase)*1.1,Math.sin(u*6.8+r.phase)*1.2);const i=r.mesh.position.length();r.tube.position.copy(r.mesh.position).multiplyScalar(.5),pt.copy(r.mesh.position).normalize(),r.tube.quaternion.setFromUnitVectors(ia,pt),r.tube.scale.set(1+Math.sin(u*12+r.phase)*.2,i,1)}}}populateSingleElectronLayer(t,a){const s=this.createSinglePointGlint(14742270,28,.92);t.add(s);const e=new ne(new ie({map:a,color:2282478,opacity:.52,blending:Gt,depthWrite:!1}));e.scale.setScalar(13),this.singleElectronHalo=e,t.add(e);const n=this.isSoftwareGl?600:2200,o=new Float32Array(n*3),l=new Float32Array(n*3),u=new Float32Array(n),d=new Float32Array(n);for(let h=0;h<n;h++){const c=h/n*Math.PI*2,p=G(h*5+1)*Math.PI*2,g=2.4*Math.pow(G(h*5+2),.6),m=7.2;o[h*3]=(m+g*Math.cos(p))*Math.cos(c),o[h*3+1]=g*Math.sin(p)*1.4,o[h*3+2]=(m+g*Math.cos(p))*Math.sin(c),R.setHSL(.52+.08*Math.sin(c*2),.92,.68),l[h*3]=R.r,l[h*3+1]=R.g,l[h*3+2]=R.b,u[h]=.75+G(h*5+3)*1.1,d[h]=.55}const r=new ct;r.setAttribute("position",new B(o,3)),r.setAttribute("color",new B(l,3)),r.setAttribute("aScale",new B(u,1)),r.setAttribute("aLuminosity",new B(d,1));const i=new Ht(r,le({baseSize:16,maxPixelSize:24,diffractionStrength:0,opacity:.92}));return i.rotation.x=.35,this.singleElectronTorus=i,t.add(i),(h,c)=>{const p=q.clamp(this.fineStructureRatio,.55,2.3),g=q.clamp(1/Math.sqrt(p),.72,1.35);i.scale.setScalar(g),i.rotation.y+=h*1.4*p,e.scale.setScalar((10.5+Math.sin(c*5*p)*.8)*g)}}populateSinglePhotonLayer(t,a){const s=this.isSoftwareGl?64:128;this.photonElectricPositions=new Float32Array(s*3),this.photonMagneticPositions=new Float32Array(s*3);const e=new ct;e.setAttribute("position",new B(this.photonElectricPositions,3));const n=new ct;n.setAttribute("position",new B(this.photonMagneticPositions,3)),this.photonElectricLine=new _a(e,new La({color:16638023,transparent:!0,opacity:.95,blending:Gt})),this.photonMagneticLine=new _a(n,new La({color:3718648,transparent:!0,opacity:.95,blending:Gt})),t.add(this.photonElectricLine,this.photonMagneticLine),this.photonVectorGroup=new H;const o=28,l=new rt(.08,.08,1,6),u=new pe({color:16707722,transparent:!0,opacity:.88,blending:Gt,depthWrite:!1}),d=new pe({color:3718648,transparent:!0,opacity:.88,blending:Gt,depthWrite:!1});for(let h=0;h<o;h++){const c=h/(o-1)-.5,p=c*28,g=new D(l,u);g.position.set(p,0,0),g.userData.barNormX=c,g.userData.isElectric=!0;const m=new D(l,d);m.position.set(p,0,0),m.rotation.x=Math.PI/2,m.userData.barNormX=c,m.userData.isElectric=!1,this.photonVectorGroup.add(g,m)}t.add(this.photonVectorGroup);const r=this.createSinglePointGlint(16707722,24,.65);t.add(r);const i=new ne(new ie({map:a,color:16710083,transparent:!0,opacity:.92,blending:Gt,depthWrite:!1}));return i.scale.setScalar(12),this.singlePhotonCore=i,t.add(i),t.rotation.y=-.35,t.rotation.x=.22,this.updatePhotonWavePacket(0),(h,c)=>{this.updatePhotonWavePacket(c)}}updatePhotonWavePacket(t){if(!this.photonElectricPositions||!this.photonMagneticPositions||!this.photonElectricLine||!this.photonMagneticLine)return;const a=this.photonElectricPositions.length/3,s=q.clamp(this.fineStructureRatio,.55,2.3),e=26*q.clamp(.75+.25*s,.65,1.65),n=q.clamp(.82+.18*s,.7,1.35),o=-t*(8.5*(.8+.2*s));for(let l=0;l<a;l++){const u=l/(a-1)-.5,d=u*30,r=Math.exp(-u*u*14)*7.8*n,i=Math.sin(u*e+o)*r;this.photonElectricPositions[l*3]=d,this.photonElectricPositions[l*3+1]=i,this.photonElectricPositions[l*3+2]=0,this.photonMagneticPositions[l*3]=d,this.photonMagneticPositions[l*3+1]=0,this.photonMagneticPositions[l*3+2]=i}if(this.photonElectricLine.geometry.attributes.position.needsUpdate=!0,this.photonMagneticLine.geometry.attributes.position.needsUpdate=!0,this.photonVectorGroup){const l=this.photonVectorGroup.children;for(let u=0;u<l.length;u++){const d=l[u],r=d.userData.barNormX,i=Math.exp(-r*r*14)*7.8*n,h=Math.sin(r*e+o)*i,c=Math.max(.05,Math.abs(h));d.userData.isElectric?(d.position.y=h*.5,d.scale.set(1,c,1)):(d.position.z=h*.5,d.scale.set(1,c,1))}}}populatePlanckQuantumFoamLayer(t,a){const s=this.isSoftwareGl?20:36,e=new de(36,36,s,s);e.rotateX(-Math.PI/2),this.planckFoamGridGeo=e;const n=e.attributes.position.count;this.planckFoamBaseZ=new Float32Array(n*2);const o=new Float32Array(n*3);for(let r=0;r<n;r++){const i=e.attributes.position.getX(r),h=e.attributes.position.getZ(r);this.planckFoamBaseZ[r*2]=i,this.planckFoamBaseZ[r*2+1]=h;const c=Math.hypot(i,h),p=1-ft(7,17.5,c);o[r*3]=.52*p,o[r*3+1]=.56*p,o[r*3+2]=1*p}e.setAttribute("color",new B(o,3));const l=new D(e,new pe({vertexColors:!0,wireframe:!0,transparent:!0,opacity:.52,blending:Gt,depthWrite:!1}));l.position.y=-2.2,t.add(l);const u=this.createSinglePointGlint(15235577,20,.55);t.add(u);const d=new ne(new ie({map:a,color:14742270,transparent:!0,opacity:.88,blending:Gt,depthWrite:!1}));return d.scale.setScalar(9.5),t.add(d),(r,i)=>{if(!this.planckFoamGridGeo||!this.planckFoamBaseZ)return;const h=this.planckFoamGridGeo.attributes.position;for(let c=0;c<h.count;c++){const p=this.planckFoamBaseZ[c*2],g=this.planckFoamBaseZ[c*2+1],m=Math.sin(p*.55+i*4.2)*Math.cos(g*.55-i*3.7)*2.4+Math.sin((p+g)*.9+i*6.5)*.95;h.setY(c,m)}h.needsUpdate=!0}}buildWoodlandCapybaraGrove(){const t=new O({color:6044193,roughness:.9}),a=new O({color:1467700,roughness:.8}),s=[],e=18;for(let d=0;d<e;d++){const r=d/e*Math.PI*2+.19;if(Math.abs(Math.sin(r*2))>.84)continue;const i=27.5+d%3*1.9;s.push({x:Math.cos(r)*i,z:Math.sin(r)*i,s:.85+d%3*.22})}const n=new kt(new rt(.28,.42,2.6,7),t,s.length);n.userData.ignoreCameraFade=!0;const o=new kt(new ce(1.65,2.4,8),a,s.length*3);o.userData.ignoreCameraFade=!0;for(let d=0;d<s.length;d++){const r=s[d];$.position.set(r.x,1.3*r.s,r.z),$.rotation.set(0,d*.7,0),$.scale.setScalar(r.s),$.updateMatrix(),n.setMatrixAt(d,$.matrix);for(let i=0;i<3;i++){const h=r.s*(1-i*.22);$.position.set(r.x,(2.3+i*1.35)*r.s,r.z),$.scale.set(h,r.s,h),$.updateMatrix(),o.setMatrixAt(d*3+i,$.matrix)}}n.instanceMatrix.needsUpdate=!0,o.instanceMatrix.needsUpdate=!0,n.computeBoundingSphere(),o.computeBoundingSphere(),this.forestGroveGroup.add(n,o);const l=[{x:4.8,z:4.6,scale:.92,hat:"flower",skin:"classic",radius:1.1,speed:.55},{x:6.1,z:5.5,scale:.58,hat:"yuzu",skin:"golden",radius:.85,speed:.82},{x:-4.6,z:5.8,scale:.88,hat:"yuzu",skin:"cocoa",radius:1,speed:.48},{x:10.2,z:-6.2,scale:.95,hat:"none",skin:"classic",radius:1.25,speed:.52},{x:-6.2,z:-5.4,scale:.64,hat:"flower",skin:"sakura",radius:.9,speed:.74}],u=2;for(let d=0;d<l.length;d++){const r=l[d],i=yt.createCapybara(r.hat,r.scale,r.skin,[],u);i.traverse(h=>{h.userData.ignoreCameraFade=!0}),i.position.set(r.x,0,r.z),this.forestGroveGroup.add(i),this.woodlandCapys.push({capy:i,anchorX:r.x,anchorZ:r.z,orbitRadius:r.radius,speed:r.speed,phase:d*1.35})}}tickWoodlandCapys(t){if(!(!Number.isFinite(t)||t<=0)){this.woodlandElapsed+=t;for(let a=0;a<this.woodlandCapys.length;a++){const s=this.woodlandCapys[a],e=this.woodlandElapsed*s.speed+s.phase,n=s.anchorX+Math.cos(e)*s.orbitRadius,o=s.anchorZ+Math.sin(e)*s.orbitRadius,l=n-s.capy.position.x,u=o-s.capy.position.z;s.capy.position.x=n,s.capy.position.z=o,Math.abs(l)+Math.abs(u)>1e-4&&(s.capy.rotation.y=Math.atan2(l,u)),s.capy.position.y=Math.abs(Math.sin(e*3.2))*.04}}}updateForLogScale(t,a,s,e,n,o=1,l=!1,u="natural",d=!1,r=!1){var b,M,S,A,P,C,T,_,W,j,Y,z,N,F,L,V,U,I,E,J,at,et,tt;this.ensureLayersBuilt(),this.elapsed+=a;const i=q.clamp(o,.28,1),h=u==="hubble"?.92:.18;this.rootGroup.visible=!0,this.rootGroup.matrixWorldAutoUpdate=!0,this.rootGroup.position.copy(e);const c=ft(3.8,5.8,t)*(1-ft(27.2,29,t)),p=.46*ft(-15.2,-18.2,t);c>.01||p>.01?(this.celestialBackdropGroup.visible=!0,this.celestialBackdropGroup.matrixWorldAutoUpdate=!0,this.celestialBackdropGroup.position.copy(e),this.celestialStarPoints&&this.celestialStarMat&&(this.celestialStarPoints.visible=c>.01,this.celestialStarMat.opacity=c),this.quantumFieldPoints&&this.quantumFieldMat&&(this.quantumFieldPoints.visible=p>.01,this.quantumFieldMat.opacity=p,this.quantumFieldPoints.rotation.y+=a*.035)):(this.celestialBackdropGroup.visible=!1,this.celestialBackdropGroup.matrixWorldAutoUpdate=!1);let g=0,m=this.layers.length-1;for(let st=0;st<this.layers.length-1;st++){const Q=this.layers[st].spec.logMeters,gt=this.layers[st+1].spec.logMeters;if(t<=Q&&t>=gt){g=st,m=st+1;break}}if(t>this.layers[0].spec.logMeters)n.setHex(this.layers[0].spec.skyHex);else if(t<this.layers[this.layers.length-1].spec.logMeters)n.setHex(this.layers[this.layers.length-1].spec.skyHex);else{const st=this.layers[g].spec,Q=this.layers[m].spec,gt=Math.max(.001,st.logMeters-Q.logMeters),Dt=q.clamp((st.logMeters-t)/gt,0,1),Ut=Dt*Dt*(3-2*Dt);R.setHex(st.skyHex),Gs.setHex(Q.skyHex),n.copy(R).lerp(Gs,Ut)}let w=this.layers[0],f=1/0;for(let st=0;st<this.layers.length;st++){const Q=this.layers[st],gt=Q.spec.logMeters,Dt=Math.abs(gt-t);Dt<f&&(f=Dt,w=Q);let Ut=gt-t,ee=1;t<=-20&&s!=="auto"&&(s==="electron"&&Q.spec.id==="single_electron"?Ut=q.clamp(Ut,-.35,.35):s==="photon"&&Q.spec.id==="single_photon"?Ut=q.clamp(Ut,-.35,.35):(s==="electron"&&Q.spec.id==="single_photon"||s==="photon"&&Q.spec.id==="single_electron")&&(ee=.14));const ht=Q.spec.id,Ae=ht==="multiverse",Ee=ht==="big_bang",Je=ht==="universe",Le=ht==="observable",Ie=ht==="galaxy",Mt=ht==="stellar_systems",xt=ht==="nebulas",St=ht==="planetary_system",Wt=ht==="planet",Lt=ht==="atmosphere",Xt=ht==="land_masses",Yt=ht==="ecosystems",It=ht==="capybara_forest",Vt=ht==="leaf_fur_micro",Jt=ht==="biological_cells",ae=ht==="dna_molecules",Pe=ht==="atomic_orbitals",ye=ht==="atomic_nucleus",ve=ht==="quarks_gluons",be=ht==="single_electron",se=ht==="single_photon",Re=ht==="planck_quantum_foam";if(r&&(Lt||Xt||Yt||It||Vt)){Q.group.visible&&(Q.group.visible=!1),Q.group.matrixWorldAutoUpdate=!1;continue}let Bt=Ut*i;if(Vt&&t>-2)if(t<=.8){const nt=(.8-t)/2.8;Bt=q.lerp(-.18,0,nt)}else Bt=-.18-(t-.8)*i;let ut=1.65;Ae?ut=2.6:Ee?ut=2.2:Je?ut=2.6:Le?ut=2.8:Ie?ut=3.55:Mt?ut=4.45:xt?ut=2.05:St?ut=1.65:Wt?ut=r?6.5:3.35:Lt?ut=r?1.45:.65:Xt?ut=1.15:Yt?ut=1.25:It||Vt||Jt?ut=2:ae?ut=1.6:Pe?ut=3.8:ye?ut=1.65:ve||be?ut=1.45:se&&(ut=1.25);let bt=-2.45;if(Ee?bt=-3:Je||Le?bt=-2.6:Mt?bt=-4.6:St?bt=-2.6:Wt?bt=-3.45:Lt?bt=r?-1.25:-.75:Xt?bt=-.95:Yt?bt=-1.05:It?bt=-1:Vt?bt=-2.85:Jt?bt=-1.65:ae?bt=-1.75:Pe?bt=-2.8:ye||ve?bt=-4.8:(be||se||Re)&&(bt=-5.8),Bt>ut||Bt<bt){Q.group.visible&&(Q.group.visible=!1),Q.group.matrixWorldAutoUpdate=!1;continue}let dt=1;const xe=Us(ht,t,i,r,d);if(xe>=0)dt=xe;else if(Ie)Bt<0?dt=ft(bt,-.32,Bt):dt=1-ft(3.15,ut,Bt);else if(Bt<0)dt=ft(bt,-.32,Bt);else{const mt=ye||ve||be||se?.22:ut>2.2?ut*.48:.35;dt=1-ft(mt,ut,Bt)}if(dt*=ee,dt<=.008){Q.group.visible=!1,Q.group.matrixWorldAutoUpdate=!1;continue}Q.populated||this.populateScaleLayer(Q);const ta=Math.pow(10,Bt);Q.group.visible=!0,Q.group.matrixWorldAutoUpdate=!0,Q.group.scale.setScalar(ta);const ke=((b=this.pendingProceduralBiome)==null?void 0:b.cloudDensity)!==void 0?this.pendingProceduralBiome.cloudDensity:1;for(let nt=0;nt<Q.materials.length;nt++){const mt=Q.materials[nt];if(Wt){mt.shaderTimeUniform&&(mt.shaderTimeUniform.value=this.elapsed),mt.shaderHubbleUniform&&(mt.shaderHubbleUniform.value=h);continue}const Nt=this.atmosphereCloudMats.includes(mt.mat),Tt=Math.min(1,mt.baseOpacity*dt*(Nt?ke:1));mt.shaderOpacityUniform?mt.shaderOpacityUniform.value=Tt:mt.mat.opacity=Tt,mt.shaderTimeUniform&&(mt.shaderTimeUniform.value=this.elapsed),mt.shaderHubbleUniform&&(mt.shaderHubbleUniform.value=h),mt.mat.depthWrite=dt>.14?mt.defaultDepthWrite:!1}if(Jt&&this.cellNucleusMesh&&this.cellNucleusMat){const nt=dt*Hs(t);this.cellNucleusMesh.visible=nt>.01,this.cellNucleusMat.opacity=nt,this.cellNucleusMat.depthWrite=nt>.14}if(Ae&&this.multiverseHomeBubbleMesh&&this.multiverseHomeBubbleMat){const nt=dt*ft(29.15,29.75,t);this.multiverseHomeBubbleMesh.visible=nt>.01,(M=this.multiverseHomeBubbleMat.uniforms)!=null&&M.uOpacity?this.multiverseHomeBubbleMat.uniforms.uOpacity.value=.94*nt:this.multiverseHomeBubbleMat.opacity=.94*nt}if(Q.tickFn&&Q.tickFn(a,this.elapsed,i,l),Ie&&this.spiralGalaxySpinGroup){const nt=no(t);this.lastGalaxyFocusBlend=nt.galaxyFocusBlend;const mt=this.spiralGalaxySpinGroup.rotation.y,Nt=Math.cos(mt),Tt=Math.sin(mt),me=nt.armOffsetX*Nt+nt.armOffsetZ*Tt,$t=-nt.armOffsetX*Tt+nt.armOffsetZ*Nt;this.spiralGalaxySpinGroup.position.set(me,nt.armOffsetY,$t);const Ge=dt*ft(17.95,19.45,t);if(this.spiralGalaxyDiscMesh&&this.spiralGalaxyDiscMat&&(this.spiralGalaxyDiscMesh.visible=Ge>.01,(S=this.spiralGalaxyDiscMat.uniforms)!=null&&S.uOpacity&&(this.spiralGalaxyDiscMat.uniforms.uOpacity.value=.95*Ge)),this.spiralGalaxyBulgeHalo){const fe=this.spiralGalaxyBulgeHalo.material,jt=Ge*ft(18.6,20.2,t);fe.opacity=.36*jt,this.spiralGalaxyBulgeHalo.visible=jt>.01}const Ue=q.lerp(.34,1,ft(20.85,19.55,t)),ea=ft(17.7,18.85,t);for(let fe=0;fe<this.spiralGalaxyArmRibbons.length;fe++){const jt=this.spiralGalaxyArmRibbons[fe],De=.62*dt*Ue*ea;jt.visible=De>.008;const te=jt.material;(A=te.uniforms)!=null&&A.uOpacity&&(te.uniforms.uOpacity.value=De)}}if(Q.spec.id==="stellar_systems"&&this.solarEclipticGroup&&this.capyEarthPlanet){let nt=0;if(t>=3.2&&t<=14.5){const Tt=Math.hypot(this.capyEarthPlanet.bodyMesh.position.x,this.capyEarthPlanet.bodyMesh.position.z),me=((P=this.solarFocusContainer)==null?void 0:P.rotation.x)??.34,$t=oo(t,Tt,this.capyEarthPlanet.pivot.rotation.y,me);nt=$t.focusBlend,this.solarEclipticGroup.position.set($t.eclipticOffsetX,$t.eclipticOffsetY,$t.eclipticOffsetZ),$t.focusBlend>.05&&Kt.set($t.sunDirX,$t.sunDirY,$t.sunDirZ).normalize()}else this.solarEclipticGroup.position.set(0,0,0);const mt=nt<.25&&t>=11.2;for(let Tt=0;Tt<this.solarPlanets.length;Tt++)this.solarPlanets[Tt].glintPoint.visible=mt;const Nt=(1-ft(1.4,3.6,Bt))*(1-nt*.9);if(this.solarCoronaSprite){const Tt=q.clamp(.72+.14*q.clamp(this.fineStructureRatio,.55,2.2),.45,.98)*q.clamp(Nt,0,1)*dt;this.solarCoronaSprite.visible=Tt>.015;const me=this.solarCoronaSprite.material;me.opacity=Tt}this.sunStarBeacon&&(this.sunStarBeacon.visible=Nt>.02)}if(Q.spec.id==="planet"&&this.planetGlobeContainer&&this.planetSurfaceAlignGroup){const nt=io(t,Ea),mt=nt.surfaceFocusBlend;this.planetGlobeContainer.position.set(nt.planetOffsetX,nt.planetOffsetY,nt.planetOffsetZ),this.planetSurfaceAnchorGroup&&this.planetSurfaceAnchorGroup.position.set(nt.surfaceTargetX*(1-mt),nt.surfaceTargetY*(1-mt),nt.surfaceTargetZ*(1-mt)),this.planetSurfaceAlignGroup.quaternion.slerpQuaternions(So,Co,mt);const Nt=ft(6.8,3,t),Tt=ft(4.75,3.55,t),me=this.isSoftwareGl?3.65:4.7,$t=this.isSoftwareGl?4.3:5.2,Ge=dt*ft(me,$t,t);this.planetGlobeMesh&&this.planetGlobeMat&&(this.planetGlobeMesh.visible=Ge>.01,(C=this.planetGlobeMat.uniforms)!=null&&C.uOpacity&&(this.planetGlobeMat.uniforms.uOpacity.value=Ge),(T=this.planetGlobeMat.uniforms)!=null&&T.uDetailScale&&(this.planetGlobeMat.uniforms.uDetailScale.value=this.isSoftwareGl?0:Nt),this.planetGlobeMat.depthWrite=Ge>.18&&t>1.85);const Ue=this.isSoftwareGl?4.1:4.75,ea=this.isSoftwareGl?4.75:5.25,fe=Math.min(1,.86*ke*dt*ft(Ue,ea,t));this.planetCloudMesh&&this.planetCloudSphereMat&&(this.planetCloudMesh.visible=fe>.01,(_=this.planetCloudSphereMat.uniforms)!=null&&_.uOpacity&&(this.planetCloudSphereMat.uniforms.uOpacity.value=fe),(W=this.planetCloudSphereMat.uniforms)!=null&&W.uDetailScale&&(this.planetCloudSphereMat.uniforms.uDetailScale.value=this.isSoftwareGl?0:Nt),(j=this.planetCloudSphereMat.uniforms)!=null&&j.uCloudClear&&(this.planetCloudSphereMat.uniforms.uCloudClear.value=Tt));const jt=dt*ft(4.65,5.45,t);if(this.planetRayleighMesh&&this.planetRayleighMat&&(this.planetRayleighMesh.visible=jt>.01,(Y=this.planetRayleighMat.uniforms)!=null&&Y.uOpacity&&(this.planetRayleighMat.uniforms.uOpacity.value=jt)),this.planetaryRingMesh){const wt=((z=this.pendingProceduralBiome)==null?void 0:z.ringSystemEnabled)??!1,Rt=ft(5.4,6.4,t);this.planetaryRingMesh.visible=wt&&Rt>.01;const Pt=this.planetaryRingMesh.material;(N=Pt==null?void 0:Pt.uniforms)!=null&&N.uOpacity&&(Pt.uniforms.uOpacity.value=dt*Rt)}if(this.planetOrbitalGlint){const wt=dt*ft(7.95,8.65,t);this.planetOrbitalGlint.visible=wt>.01;const Rt=this.planetOrbitalGlint.material;(F=Rt==null?void 0:Rt.uniforms)!=null&&F.uOpacity&&(Rt.uniforms.uOpacity.value=.95*wt)}const De=this.isSoftwareGl?0:r?dt*ft(5.25,4.75,t)*ft(3.85,4.25,t):dt*ft(5.2,4.65,t)*ft(3.85,4.4,t),te=this.isSoftwareGl||!r?0:dt*ft(4.25,3.85,t)*ft(3.05,3.4,t),Ve=this.isSoftwareGl||!r?0:dt*ft(3.5,3.05,t)*ft(2.15,2.75,t),k=this.planetLodMats[0];this.planetLod1Mesh&&k&&(this.planetLod1Mesh.visible=De>.01,(L=k.uniforms)!=null&&L.uOpacity&&(k.uniforms.uOpacity.value=De),(V=k.uniforms)!=null&&V.uDetailScale&&(k.uniforms.uDetailScale.value=Nt),k.depthWrite=De>.18&&t>2.85);const lt=this.planetLodMats[1];this.planetLod2Mesh&&lt&&(this.planetLod2Mesh.visible=te>.01,(U=lt.uniforms)!=null&&U.uOpacity&&(lt.uniforms.uOpacity.value=te),(I=lt.uniforms)!=null&&I.uDetailScale&&(lt.uniforms.uDetailScale.value=Nt),lt.depthWrite=te>.18&&t>2.85);const At=this.planetLodMats[2];this.planetLod3Mesh&&At&&(this.planetLod3Mesh.visible=Ve>.01,(E=At.uniforms)!=null&&E.uOpacity&&(At.uniforms.uOpacity.value=Ve),(J=At.uniforms)!=null&&J.uDetailScale&&(At.uniforms.uDetailScale.value=Nt),At.depthWrite=Ve>.18&&t>2.85);const oe=this.isSoftwareGl?0:Math.min(1,.78*ke*dt*ft(5.05,4.55,t)*ft(3.65,4.2,t));for(let wt=0;wt<this.planetCloudPatchMeshes.length;wt++){const Rt=this.planetCloudPatchMeshes[wt],Pt=this.planetCloudPatchMats[wt];Rt.visible=oe>.01,(at=Pt==null?void 0:Pt.uniforms)!=null&&at.uOpacity&&(Pt.uniforms.uOpacity.value=oe*(wt===0?1:.68)),(et=Pt==null?void 0:Pt.uniforms)!=null&&et.uDetailScale&&(Pt.uniforms.uDetailScale.value=Nt),(tt=Pt==null?void 0:Pt.uniforms)!=null&&tt.uCloudClear&&(Pt.uniforms.uCloudClear.value=Tt)}}}const v=Ns(t,i);if(v>.008){if(this.ensureChromatinBridgeBuilt(),this.chromatinBridgeGroup){const st=(Es-t)*i;this.chromatinBridgeGroup.visible=!0,this.chromatinBridgeGroup.matrixWorldAutoUpdate=!0,this.chromatinBridgeGroup.scale.setScalar(Math.pow(10,st)),this.chromatinBridgeGroup.rotation.y+=a*.24;for(let Q=0;Q<this.chromatinBridgeMats.length;Q++){const gt=this.chromatinBridgeMats[Q];gt.mat.opacity=Math.min(1,gt.baseOpacity*v),gt.mat.depthWrite=v>.14?gt.defaultDepthWrite:!1}}}else this.chromatinBridgeGroup&&this.chromatinBridgeGroup.visible&&(this.chromatinBridgeGroup.visible=!1,this.chromatinBridgeGroup.matrixWorldAutoUpdate=!1);return w.spec}projectVisibleMarkers(t,a,s,e,n){if(this.activeProjectedMarkers.length=0,!n||!this.rootGroup.visible||a<=0||s<=0)return this.activeProjectedMarkers;this.rootGroup.updateMatrixWorld(!0),t.updateMatrixWorld();let o=0;for(let l=0;l<this.markerAnchors.length&&o<bs;l++){const u=this.markerAnchors[l];if(e<u.minLog||e>u.maxLog)continue;let d=!0,r=u.node;for(;r;){if(!r.visible){d=!1;break}r=r.parent}if(!d||(u.node.getWorldPosition(Ua),Fe.copy(Ua).project(t),Fe.z<-1||Fe.z>1||Fe.x<-.96||Fe.x>.96||Fe.y<-.92||Fe.y>.86))continue;const i=(Fe.x*.5+.5)*a,h=(-Fe.y*.5+.5)*s;let c=!1;for(let w=0;w<o;w++){const f=this.projectedMarkerPool[w];if(Math.hypot(f.screenX-i,f.screenY-h)<34){c=!0;break}}if(c)continue;const p=Math.max(.1,t.position.distanceTo(Ua)),g=u.physicalRadiusWorldAtOneToOne/p*s,m=this.projectedMarkerPool[o];m.id=u.id,m.label=u.label,m.sublabel=u.sublabel,m.screenX=Math.round(i),m.screenY=Math.round(h),m.colorCss=u.colorCss,m.targetLogMeters=u.targetLogMeters,m.isSubPixel=g<4,this.activeProjectedMarkers.push(m),o++}return this.activeProjectedMarkers}hide(){this.rootGroup.visible=!1,this.rootGroup.matrixWorldAutoUpdate=!1,this.celestialBackdropGroup.visible=!1,this.celestialBackdropGroup.matrixWorldAutoUpdate=!1}setOrbitTimeScale(t){this.orbitTimeScaleId=t}getOrbitTimeScale(){return this.orbitTimeScaleId}getBandById(t){return Ma.find(a=>a.id===t)||Ma[0]}applyProceduralConfig(t){var a,s,e,n,o;if(this.pendingProceduralBiome={...this.pendingProceduralBiome,...t},typeof t.bigBangSpeed=="number"&&(this.bigBangSpeedScale=Math.max(.2,Math.min(4,t.bigBangSpeed))),typeof t.fineStructureInverse=="number"&&Number.isFinite(t.fineStructureInverse)&&(this.fineStructureInverse=Math.max(60,Math.min(220,t.fineStructureInverse)),this.fineStructureRatio=137.036/this.fineStructureInverse,(s=(a=this.solarSunMat)==null?void 0:a.uniforms)!=null&&s.uAlphaRatio&&(this.solarSunMat.uniforms.uAlphaRatio.value=this.fineStructureRatio)),this.capyEarthRingMesh&&typeof t.ringSystemEnabled=="boolean"&&(this.capyEarthRingMesh.visible=t.ringSystemEnabled),this.planetaryRingMesh&&typeof t.ringSystemEnabled=="boolean"&&(this.planetaryRingMesh.visible=t.ringSystemEnabled),this.atmosphereRayleighMat&&typeof t.atmosphereColorHex=="number"){const l=(e=this.atmosphereRayleighMat.uniforms)==null?void 0:e.uRayleighColor;l&&l.value instanceof K&&l.value.setHex(t.atmosphereColorHex)}for(const l of[this.capyEarthBodyMat,this.planetGlobeMat,...this.planetLodMats])l!=null&&l.uniforms&&(typeof t.oceanColorHex=="number"&&((n=l.uniforms.uOceanColor)==null?void 0:n.value)instanceof K&&l.uniforms.uOceanColor.value.setHex(t.oceanColorHex),typeof t.landColorHex=="number"&&((o=l.uniforms.uLandColor)==null?void 0:o.value)instanceof K&&l.uniforms.uLandColor.value.setHex(t.landColorHex));this.ecosystemMeadowMat&&typeof t.grassPrimaryHex=="number"&&this.ecosystemMeadowMat.color.setHex(t.grassPrimaryHex),this.ecosystemRiverMat&&typeof t.waterColorHex=="number"&&this.ecosystemRiverMat.color.setHex(t.waterColorHex)}dispose(){this.markerAnchors.length=0,this.activeProjectedMarkers.length=0,this.woodlandCapys.length=0,this.solarPlanets.length=0,this.planetLodMats.length=0,this.planetCloudPatchMeshes.length=0,this.planetCloudPatchMats.length=0,this.celestialBackdropMats.length=0,this.chromatinBridgeMats.length=0,this.chromatinBridgeGroup=null,this.cellNucleusMesh=null,this.cellNucleusMat=null,this.layers.length=0,qe(this.forestGroveGroup),qe(this.celestialBackdropGroup),qe(this.rootGroup),this.glowWarmTex&&(this.glowWarmTex.userData.sharedAsset=!1,this.glowWarmTex.dispose(),this.glowWarmTex=null),this.glowCoolTex&&(this.glowCoolTex.userData.sharedAsset=!1,this.glowCoolTex.dispose(),this.glowCoolTex=null),this.layersBuilt=!1,this.groveBuilt=!1}}export{Fo as A,To as B,yt as C,Yo as D,Eo as E,qo as F,jo as G,Wo as H,No as I,qa as J,Ka as K,ko as L,it as P,Me as R,tn as S,Uo as a,_o as b,Lo as c,zo as d,Ho as e,ua as f,Bo as g,ro as h,Rs as i,ga as j,qe as k,Jo as l,Vo as m,Xo as n,Qa as o,$o as p,Zo as q,Ko as r,Oo as s,Io as t,Qo as u,ps as v,ms as w,ds as x,Ro as y,go as z};
