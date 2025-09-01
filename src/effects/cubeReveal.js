// src/effects/cubeReveal.js
import * as THREE from "three";

const _gsap = typeof window !== "undefined" && window.gsap ? window.gsap : null;

export function initCubeReveal({
  selector = ".cube-reveal",
  onReady = null,
  gsap: gsapParam = null,
  ScrollTrigger: ScrollTriggerParam = null,
} = {}) {
  const els = Array.from(document.querySelectorAll(selector));
  els.forEach((el) => setupOne(el, onReady, gsapParam, ScrollTriggerParam));
}

function setupOne(container, onReady, gsapParam, ScrollTriggerParam) {
  const {
    imgSrc, rows: rowsAttr, cols: colsAttr,
    cubeSize: cubeSizeAttr, gap: gapAttr,
    overlap: overlapAttr, padpx: padpxAttr,
    rotateAxis: rotateAxisAttr, stagger: staggerAttr,
    depth: depthAttr, fov: fovAttr,
    start: startAttr, end: endAttr,
    scrub: scrubAttr, once: onceAttr,
  } = container.dataset;

  const rows = clampInt(rowsAttr, 12);
  const cols = clampInt(colsAttr, 18);
  const cubeSize = clampNum(cubeSizeAttr, 0.5);
  const gap = clampNum(gapAttr, 0);
  const overlap = clampNum(overlapAttr, 0.02);
  const padpx = clampInt(padpxAttr, 1);
  const rotateAxis = (rotateAxisAttr === "x" || rotateAxisAttr === "y") ? rotateAxisAttr : "y";
  const stagger = clampNum(staggerAttr, 0.012);
  const cameraZ = clampNum(depthAttr, 2.2);
  const fov = clampNum(fovAttr, 45);
  const start = startAttr || "top 80%";
  const end = endAttr || "bottom 50%";
  const scrub = scrubAttr === "true";
  const once = onceAttr === "false" ? false : true;

  if (!imgSrc) {
    console.warn("[cubeReveal] Missing data-img-src on element:", container);
    return;
  }

  // Scene & renderer
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.style.aspectRatio ||= "16/9";
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 100);
  camera.position.z = cameraZ;

  const gridGroup = new THREE.Group();
  scene.add(gridGroup);

  new THREE.TextureLoader().load(imgSrc, (baseTexture) => {
    baseTexture.colorSpace = THREE.SRGBColorSpace;
    baseTexture.flipY = false;
    baseTexture.wrapS = baseTexture.wrapT = THREE.ClampToEdgeWrapping;
    baseTexture.generateMipmaps = true;
    baseTexture.minFilter = THREE.LinearMipmapLinearFilter;
    baseTexture.magFilter = THREE.LinearFilter;
    baseTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 0);

    const texW = baseTexture.image?.width || 2048;
    const texH = baseTexture.image?.height || 2048;
    const padU = padpx / texW;
    const padV = padpx / texH;

    const totalW = cols * cubeSize + (cols - 1) * gap;
    const totalH = rows * cubeSize + (rows - 1) * gap;
    const startX = -totalW / 2 + cubeSize / 2;
    const startY = totalH / 2 - cubeSize / 2;

    const geom = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize * 0.25);
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const uRange = 1 / cols, vRange = 1 / rows;
        const u0 = c * uRange, vTop = 1 - (r + 1) * vRange;

        const tileTex = baseTexture.clone();
        tileTex.needsUpdate = true;
        tileTex.flipY = false;
        tileTex.wrapS = tileTex.wrapT = THREE.ClampToEdgeWrapping;
        tileTex.repeat.set(uRange - 2 * padU, vRange - 2 * padV);
        tileTex.offset.set(u0 + padU, vTop + padV);

        const frontMat = new THREE.MeshBasicMaterial({ map: tileTex });
        const cube = new THREE.Mesh(geom, [whiteMat, whiteMat, whiteMat, whiteMat, frontMat, whiteMat]);
        cube.position.set(startX + c * (cubeSize + gap), startY - r * (cubeSize + gap), 0.0005);

        if (overlap > 0) cube.scale.setScalar(1 + overlap);
        if (rotateAxis === "y") cube.rotation.y = Math.PI;
        else cube.rotation.x = -Math.PI;

        gridGroup.add(cube);
        tiles.push({ cube, r, c });
      }
    }

    function resize() {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(container); resize();

    let rafId = 0; (function renderLoop(){ rafId=requestAnimationFrame(renderLoop); renderer.render(scene,camera); })();

    const gsapRef = gsapParam || _gsap;
    const tl = gsapRef?.timeline({ paused: true });

    if (tl) {
      tiles.forEach(({ cube, r, c }) => {
        const delay = (r + c) * stagger;
        if (rotateAxis === "y") tl.to(cube.rotation, { y: 0, duration: .65, ease:"power2.out" }, delay);
        else tl.to(cube.rotation, { x: 0, duration: .65, ease:"power2.out" }, delay);
      });

      const ScrollTrigger = ScrollTriggerParam || gsapRef.ScrollTrigger;
      ScrollTrigger?.create({
        trigger: container, start, end, scrub, once,
        onEnter:()=>{ if(!scrub) tl.play(); },
        onEnterBack:()=>{ if(!scrub) tl.play(); },
        onLeaveBack:()=>{ if(!scrub && !once) tl.reverse(); },
        onUpdate:self=>{ if(scrub) tl.progress(self.progress); }
      });
    }
  });
}

function clampNum(v,f){const n=Number(v);return Number.isFinite(n)?n:f;}
function clampInt(v,f){return Math.max(1,Math.round(clampNum(v,f)));}
