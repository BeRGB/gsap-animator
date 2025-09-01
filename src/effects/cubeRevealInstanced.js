// src/effects/cubeRevealInstanced.js
// Instanced + Orthographic camera + GSAP
// Flow: full image (bg) -> fade out -> cube reveal -> fade in full image
// CRISP options: data-crisp="ui|photo", data-dpr="device|1|2|3"
// Responsive and pixel-accurate grid: no zooming blur

import * as THREE from "three";

const _gsap = typeof window !== "undefined" && window.gsap ? window.gsap : null;

export function initCubeRevealInstanced({
  selector = ".cube-reveal",
  onReady = null,
  gsap: gsapParam = null,
  ScrollTrigger: ScrollTriggerParam = null,
} = {}) {
  const els = Array.from(document.querySelectorAll(selector));
  els.forEach((el) => setup(el, onReady, gsapParam, ScrollTriggerParam));
}

function setup(container, onReady, gsapParam, ScrollTriggerParam) {
  const {
    imgSrc, rows: rowsAttr, cols: colsAttr,
    gap: gapAttr, overlap: overlapAttr, padpx: padpxAttr,
    rotateAxis: rotateAxisAttr, stagger: staggerAttr,
    start: startAttr, end: endAttr, scrub: scrubAttr, once: onceAttr,
    fit: fitAttr, alignX: alignXAttr, alignY: alignYAttr,
    crisp: crispAttr,              // "ui" | "photo" (default photo)
    dpr: dprAttr,                  // "device" | "1" | "2" | "3"
  } = container.dataset;

  const rows = clampInt(rowsAttr, 56);
  const cols = clampInt(colsAttr, 100);
  const gap = clampNum(gapAttr, 0);
  const overlap = clampNum(overlapAttr, 0.01);
  const padpx = clampInt(padpxAttr, 2);
  const rotateAxis = (rotateAxisAttr === "x" || rotateAxisAttr === "y") ? rotateAxisAttr : "y";
  const stagger = clampNum(staggerAttr, 0.006);
  const start = startAttr || "top 80%";
  const end = endAttr || "bottom 50%";
  const scrub = scrubAttr === "true";
  const once = (onceAttr === "false") ? false : true;
  const fitMode = (fitAttr === "contain") ? "contain" : "cover";
  const alignX = clampNum(alignXAttr, 50) / 100;
  const alignY = clampNum(alignYAttr, 50) / 100;
  const crispMode = (crispAttr === "ui") ? "ui" : "photo";

  if (!imgSrc) {
    console.warn("[cubeRevealInstanced] Missing data-img-src on element:", container);
    return;
  }

  // --- Renderer / DPR
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const wantDpr = dprAttr === "device" || !dprAttr ? (window.devicePixelRatio || 1) : Number(dprAttr);
  renderer.setPixelRatio(Math.min(Math.max(wantDpr, 1), 3)); // clamp 1..3
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  // (opciono) sprečava browser blur ako neko kasnije skaluje canvas:
  renderer.domElement.style.imageRendering = crispMode === "ui" ? "pixelated" : "auto";

  container.style.aspectRatio ||= "16/9";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Ortho kamera = tačan prikaz kontejnera, bez perspektive/blura
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.set(0, 0, 5);

  // Učitavanje teksture sa pravim filterima
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(imgSrc, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true; // UV računamo bez invertovanja
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

    if (crispMode === "ui") {
      // Najoštrije za UI/diagram (bez mipmapa, nearest mag)
      tex.generateMipmaps = false;
      tex.minFilter = THREE.NearestFilter;  // nema downsample blur-a
      tex.magFilter = THREE.NearestFilter;  // nema upsample blur-a
      tex.anisotropy = 0;
    } else {
      // Fotografije: lepša interpolacija + anisotropy
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 0;
    }
    tex.needsUpdate = true;

    const texW = tex.image?.width || 2048;
    const texH = tex.image?.height || 2048;

    // --- Instanced quad (1x1), skaliramo ga po instance
    const base = new THREE.PlaneGeometry(1, 1, 1, 1);
    const geom = new THREE.InstancedBufferGeometry();
    geom.index = base.index;
    geom.attributes.position = base.attributes.position;
    geom.attributes.uv = base.attributes.uv;
    geom.attributes.normal = base.attributes.normal;

    const count = rows * cols;
    const offsets = new Float32Array(count * 3);
    const scales  = new Float32Array(count * 2);
    const angles  = new Float32Array(count);
    const cells   = new Float32Array(count * 2);

    const axisVec = (rotateAxis === "y") ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
    const initialAngle = (rotateAxis === "y") ? Math.PI : -Math.PI;

    const aOffset = new THREE.InstancedBufferAttribute(offsets, 3);
    const aScale  = new THREE.InstancedBufferAttribute(scales, 2);
    const aAngle  = new THREE.InstancedBufferAttribute(angles, 1);
    const aCell   = new THREE.InstancedBufferAttribute(cells, 2);
    geom.setAttribute("aOffset", aOffset);
    geom.setAttribute("aScale",  aScale);
    geom.setAttribute("aAngle",  aAngle);
    geom.setAttribute("aCell",   aCell);

    // Shader (UV bez invertovanja, globalni cover/contain + align)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: tex },
        uAxis: { value: axisVec },
        uCols: { value: cols },
        uRows: { value: rows },
        uOverlap: { value: overlap },
        uUScale: { value: 1 }, uVScale: { value: 1 },
        uUOfs: { value: 0 },   uVOfs: { value: 0 },
      },
      vertexShader: `
        attribute vec3 aOffset;
        attribute vec2 aScale;
        attribute float aAngle;
        attribute vec2 aCell;
        uniform vec3 uAxis;
        uniform float uOverlap;
        uniform float uCols, uRows;
        uniform float uUScale, uVScale, uUOfs, uVOfs;
        varying vec2 vUv;

        vec3 rot(vec3 p, vec3 ax, float a){
          ax = normalize(ax); float s=sin(a), c=cos(a);
          return p*c + cross(ax,p)*s + ax*dot(ax,p)*(1.0-c);
        }
        void main(){
          vec3 pos = position;
          pos.x *= aScale.x * (1.0 + uOverlap);
          pos.y *= aScale.y * (1.0 + uOverlap);
          pos = rot(pos, uAxis, aAngle);
          pos += aOffset;

          vec2 uvLocal = uv; // 0..1
          // bez flipovanja redova
          vec2 uvGlobal = vec2(
  (aCell.x + uvLocal.x) / uCols,
  (uRows - 1.0 - aCell.y + uvLocal.y) / uRows
);
          vUv = uvGlobal * vec2(uUScale, uVScale) + vec2(uUOfs, uVOfs);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex;
        varying vec2 vUv;
        void main(){
          vec4 texel = texture2D(uTex, vUv);
          if(!gl_FrontFacing) gl_FragColor = vec4(1.0);
          else gl_FragColor = texel;
        }
      `,
      side: THREE.DoubleSide,
      transparent: false,
    });

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    // Full image (pre i posle efekta) – koristi iste filtere kao tekstura
    const bgMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1 });
    const bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bgPlane.position.z = 0.001;
    scene.add(bgPlane);

    function layout(w, h){
      const aspect = w / h;
      camera.left = -aspect; camera.right = aspect; camera.top = 1; camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);

      const viewW = 2 * aspect, viewH = 2;
      const tileW = (viewW - (cols - 1) * gap) / cols;
      const tileH = (viewH - (rows - 1) * gap) / rows;

      let idx = 0;
      for (let r=0; r<rows; r++){
        for (let c=0; c<cols; c++, idx++){
          offsets[idx*3+0] = -viewW/2 + tileW/2 + c * (tileW + gap);
          offsets[idx*3+1] =  viewH/2 - tileH/2 - r * (tileH + gap);
          offsets[idx*3+2] = 0.0;
          scales[idx*2+0]  = tileW;
          scales[idx*2+1]  = tileH;
          cells[idx*2+0]   = c;
          cells[idx*2+1]   = r;
          angles[idx]      = initialAngle; // reset on resize
        }
      }
      aOffset.needsUpdate = aScale.needsUpdate = aCell.needsUpdate = aAngle.needsUpdate = true;

      // Full image plane span view
      bgPlane.scale.set(aspect, 1, 1);

      // Global UV cover/contain + align
      const imgAspect = texW / texH;
      let scaleU = 1.0, scaleV = 1.0;
      if (fitMode === "cover") {
        if (aspect > imgAspect) { scaleV = imgAspect / aspect; } else { scaleU = aspect / imgAspect; }
      } else {
        if (aspect > imgAspect) { scaleU = aspect / imgAspect; } else { scaleV = imgAspect / aspect; }
      }
      const ofsU = (1.0 - scaleU) * alignX;
      const ofsV = (1.0 - scaleV) * alignY;

      // Texel padding – smanjuje bleed na ivicama pločica
      const padU = padpx / texW, padV = padpx / texH;

      mat.uniforms.uUScale.value = Math.max(0, scaleU - 2*padU);
      mat.uniforms.uVScale.value = Math.max(0, scaleV - 2*padV);
      mat.uniforms.uUOfs.value   = ofsU + padU;
      mat.uniforms.uVOfs.value   = ofsV + padV;
    }

    function resize(){
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      layout(w, h);
    }
    const ro = new ResizeObserver(resize); ro.observe(container); resize();

    let rafId = 0; (function loop(){ rafId = requestAnimationFrame(loop); renderer.render(scene, camera); })();

    // GSAP timeline: bg -> out, cubes rotate, bg -> in
    const gsapRef = gsapParam || _gsap;
    const tl = gsapRef?.timeline({ paused: true });
    if (tl) {
      tl.to(bgMat, { opacity: 0, duration: 0.2, ease: "power1.out" }, 0);

      const proxies = new Array(count); for (let i=0;i<count;i++) proxies[i] = { v: angles[i] };
      for (let r=0;r<rows;r++){
        for (let c=0;c<cols;c++){
          const idx = r*cols + c, delay = (r + c) * stagger;
          tl.to(proxies[idx], {
            v: 0, duration: 0.65, ease: "power2.out",
            onUpdate:()=>{ angles[idx]=proxies[idx].v; aAngle.needsUpdate = true; }
          }, delay);
        }
      }
      const totalDelay = (rows - 1 + cols - 1) * stagger + 0.65;
      tl.to(bgMat, { opacity: 1, duration: 0.25, ease: "power1.out" }, totalDelay);

      const ST = ScrollTriggerParam || gsapRef.ScrollTrigger || gsapRef.plugins?.ScrollTrigger;
      ST?.create({
        trigger: container, start, end, scrub, once,
        onEnter:()=>{ if(!scrub) tl.play(); },
        onEnterBack:()=>{ if(!scrub) tl.play(); },
        onLeaveBack:()=>{ if(!scrub && !once) tl.reverse(); },
        onUpdate:(self)=>{ if(scrub) tl.progress(self.progress); },
      });
    }

    container.__cubeRevealInstanced = {
      play: ()=>tl&&tl.play(),
      reverse: ()=>tl&&tl.reverse(),
      destroy: ()=>{
        cancelAnimationFrame(rafId); ro.disconnect();
        geom.dispose(); mat.dispose(); tex.dispose(); renderer.dispose();
        container.removeChild(renderer.domElement);
      },
    };

    onReady && onReady(container.__cubeRevealInstanced);
  });
}

// Helpers
function clampNum(v,f){ if(v==null||v==='') return f; const n=Number(v); return Number.isFinite(n)?n:f; }
function clampInt(v,f){ return Math.max(1, Math.round(clampNum(v,f))); }
