import * as THREE from "three";
import { vert, frag } from "./shader.js";
import { readDataset, loadTexture, channelsToMix } from "./utils.js";

function setupStage(el, maxW, bg) {
  const stage = el.closest("[data-rgb-stage]") || el.parentElement;
  if (stage) {
    stage.style.maxWidth = (maxW || 1400) + "px";
    stage.style.background = bg || "#0b0b10";
    stage.style.position = stage.style.position || "relative";
    stage.style.overflow = stage.style.overflow || "clip";
    stage.style.isolation = stage.style.isolation || "isolate";
  }
  return stage;
}

/* --- helper: parse anchor "top left", "center", "bottom right" -> [ax, ay] (0..1) --- */
function parseAnchor(str = "center") {
  const s = String(str).toLowerCase().trim().split(/\s+/);
  let ax = 0.5, ay = 0.5;
  for (const k of s) {
    if (k === "left")  ax = 0.0;
    if (k === "right") ax = 1.0;
    if (k === "top")   ay = 0.0;
    if (k === "bottom")ay = 1.0;
    if (k === "center") { /* leave 0.5 */ }
  }
  return [ax, ay];
}

export function initRgbSplit(root = document) {
  const nodes = Array.from(root.querySelectorAll('[data-effect="rgb-split"]'));
  nodes.forEach((node) => createRgbInstance(node));
}

async function createRgbInstance(canvas) {
  const cfg = readDataset(canvas);
  setupStage(canvas, cfg.maxW, cfg.bg);

  // NEW: layout params (with dataset fallback)
  const fit = (cfg.fit || canvas.dataset.rgbFit || "cover").toLowerCase();            // "cover"|"contain"
  const minH = +(cfg.minh ?? canvas.dataset.rgbMinh ?? 0) || 0;                       // px
  const [anchorX, anchorY] = parseAnchor(cfg.position || canvas.dataset.rgbPosition || "center");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(cfg.dpr, window.devicePixelRatio || 1));
  renderer.setClearColor(new THREE.Color(cfg.bg || canvas.dataset.rgbBg || "#0b0b10"));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const tex = await loadTexture(
    cfg.img || canvas.getAttribute("data-img-src") || "",
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1600&auto=format&fit=crop"
  );

  // Clamp ivice da nema crnih linija kod contain/anchor
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  let texW = 1024, texH = 1024;
  if (tex?.image?.width && tex?.image?.height) {
    texW = tex.image.width;
    texH = tex.image.height;
  }

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mix = channelsToMix(cfg.channels);

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTex:          { value: tex },
      uTexSize:      { value: new THREE.Vector2(texW, texH) },         // NEW
      uCanvasSize:   { value: new THREE.Vector2(1, 1) },               // NEW
      uFitMode:      { value: fit === "contain" ? 1 : 0 },             // 0=cover, 1=contain (NEW)
      uAnchor:       { value: new THREE.Vector2(anchorX, anchorY) },   // (0..1, 0..1) (NEW)

      uRes:          { value: new THREE.Vector2(1, 1) },               // (zadržano, ako koristiš dalje)
      uMouse:        { value: new THREE.Vector2(0.5, 0.5) },
      uTime:         { value: 0 },
      uIntensity:    { value: cfg.intensity },
      uFalloffStart: { value: cfg.falloff },
      uNoiseFreq:    { value: cfg.noiseFreq },
      uNoiseSpeed:   { value: cfg.noiseSpeed },
      uMix:          { value: new THREE.Vector3(...mix) },
    },
    transparent: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // pointer smoothing
  let mx = 0.5, my = 0.5;
  let smx = 0.5, smy = 0.5;

  function mapPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    mx = Math.min(1, Math.max(0, x));
    my = 1.0 - Math.min(1, Math.max(0, y)); // flip Y
  }
  const onMove = (e) => mapPointer(e.clientX, e.clientY);
  const onTouch = (e) => { const t = e.touches?.[0]; if (t) mapPointer(t.clientX, t.clientY); };
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("touchmove", onTouch, { passive: true });

  function resize() {
    const stage = canvas.closest("[data-rgb-stage]") || canvas.parentElement;
    const w = stage?.clientWidth || canvas.clientWidth || 1;

    // NEW: visina = max(minH, w / (texW/texH))  — zadržava dobar odnos, ali garantuje minH
    const imgAspect = texW / texH;
    const hByAspect = Math.round(w / (imgAspect || 1));
    const h = Math.max(1, Math.max(minH, hByAspect));

    if (stage) stage.style.height = h + "px";
    canvas.style.height = h + "px";

    renderer.setPixelRatio(Math.min(cfg.dpr, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);

    // NEW: šaljemo realne dimenzije canvasa šejderu (za cover/contain + anchor)
    material.uniforms.uCanvasSize.value.set(w, h);

    // (zadržano ako koristiš negde dalje u post-procesu)
    material.uniforms.uRes.value.set(w, h);
  }
  addEventListener("resize", resize, { passive: true });
  // ako parent menja dimenzije (layout shifts)
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.closest("[data-rgb-stage]") || canvas.parentElement);
  resize();

  const clock = new THREE.Clock();
  function tick(){
    const t = clock.getElapsedTime();
    smx += (mx - smx) * cfg.smoothing;
    smy += (my - smy) * cfg.smoothing;
    material.uniforms.uTime.value = t;
    material.uniforms.uMouse.value.set(smx, smy);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  // javni helper (po potrebi)
  canvas.__rgbSetImage = async function setImage(url){
    const newTex = await loadTexture(url, null);
    if (newTex?.image?.width && newTex?.image?.height) {
      newTex.wrapS = THREE.ClampToEdgeWrapping;
      newTex.wrapT = THREE.ClampToEdgeWrapping;
      newTex.minFilter = THREE.LinearFilter;
      newTex.magFilter = THREE.LinearFilter;

      texW = newTex.image.width;
      texH = newTex.image.height;
      material.uniforms.uTexSize.value.set(texW, texH);
    }
    material.uniforms.uTex.value = newTex;
    resize();
  };
}
