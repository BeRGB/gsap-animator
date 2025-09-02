/* ==== PRELOADER UTILS =========================================== */
import './style.css';

function withBase(p) {
  if (!p) return p;
  if (/^(https?:)?\/\//i.test(p)) return p;           // ostavi apsolutne
  const BASE = import.meta.env?.BASE_URL ?? '/';      // npr. "/gsap-animator/"
  return (BASE.replace(/\/+$/, '/') + String(p).replace(/^\/+/, ''));
}

// Dodaj BASE u data-rgb-img vrednosti pre nego što ih koristimo/učitamo
function prefixDataRgbImg(root = document) {
  root.querySelectorAll('[data-rgb-img]').forEach(el => {
    const v = el.getAttribute('data-rgb-img');
    if (!v || /^(https?:)?\/\//i.test(v)) return;
    el.setAttribute('data-rgb-img', withBase(v.replace(/^\/+/, '')));
  });
  // markiraj da je već prefiksirano (da boot ne duplira)
  document.documentElement.setAttribute('data-rgb-prefixed', '1');
}

function collectAssetUrls(root = document) {
  const urls = new Set();

  // <img src>
  root.querySelectorAll('img[src]').forEach(img => {
    const v = img.getAttribute('src');
    if (v) urls.add(withBase(v));
  });

  // data-rgb-img (posle prefixDataRgbImg već su prefiksirane)
  root.querySelectorAll('[data-rgb-img]').forEach(el => {
    const v = el.getAttribute('data-rgb-img');
    if (v) urls.add(v);
  });

  // Lottie (json ili .lottie)
  root.querySelectorAll('[data-lottie], [data-lottie-path]').forEach(el => {
    const v = el.dataset.lottie || el.dataset.lottiePath;
    if (v) urls.add(withBase(v));
  });

  return [...urls];
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, url });
    img.onerror = () => resolve({ ok: false, url });
    img.decoding = 'async';
    img.src = url;
  });
}

async function preloadUrl(url) {
  // .json / .lottie → fetch; ostalo → Image()
  if (/\.(json|lottie)(\?|#|$)/i.test(url)) {
    try {
      const res = await fetch(url, { credentials: 'same-origin', cache: 'force-cache' });
      await res.arrayBuffer(); // zagrej cache
      return { ok: res.ok, url };
    } catch {
      return { ok: false, url };
    }
  }
  return loadImage(url);
}

async function runPreloader(root = document) {
  const wrap  = document.getElementById('app-preloader');
  const fill  = wrap?.querySelector('.ap-fill');
  const label = wrap?.querySelector('.ap-label');

  // 1) prefiksiraj rgb-img, pa pokupi sve URL-ove
  prefixDataRgbImg(root);
  const urls = collectAssetUrls(root);

  if (!urls.length) {
    wrap?.classList.add('ap-done');
    return;
  }

  let done = 0;
  const update = () => {
    done += 1;
    const pct = Math.round((done / urls.length) * 100);
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
  };

  // 4-po-4 zbog mreže/CPU
  const chunk = 4;
  for (let i = 0; i < urls.length; i += chunk) {
    const slice = urls.slice(i, i + chunk);
    const results = await Promise.allSettled(slice.map(preloadUrl));
    results.forEach(update);
  }

  await new Promise(r => setTimeout(r, 120)); // mali “100%” odmor
  wrap?.classList.add('ap-done');
}
/* ==== KRAJ PRELOADER UTILS ===================================== */


/* ===================== TVOJ KOD ================================ */
// main.js
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initRgbSplit } from "./effects/rgbSplitCanvas/index.js";
import { initAnimations } from "./animator.js";
import { initLottieData, destroyLottieData } from "./animations/lottieData";
import { initScrollGradientMask } from "./effects/scrollGradientMask.js";
import { initImageMaskReveal } from "./animations/maskReveal.js";
// import { initCubeReveal } from "./effects/cubeReveal.js";
import { initCubeRevealInstanced } from "./effects/cubeRevealInstanced.js";
import { initGridDissolveReveal } from "./effects/gridDissolveReveal.js";
// import { initResponsiveTables } from "./utils/responsiveTables.js";

gsap.registerPlugin(ScrollTrigger);

try {
  const defs = ScrollTrigger.defaults();
  if (defs && defs.scroller === window) {
    ScrollTrigger.defaults({ scroller: null });
  }
} catch (_) {}

/* ===== Merge reveal (leva/desna + steps) ===== */
function initMergeReveal({ gsap, ScrollTrigger, smoother }) {
  const scroller = smoother ? smoother.container : undefined;

  const sections = document.querySelectorAll('[data-slide][data-mode="merge"]');
  if (!sections.length) return;

  sections.forEach((sec) => {
    const left  = sec.querySelector('[data-merge-left]');
    const right = sec.querySelector('[data-merge-right]');
    const steps = sec.querySelectorAll('.merge-step');

    if (!left || !right) {
      console.warn("[merge] Missing left/right inside", sec);
      return;
    }

    gsap.set(left,  { x: "-12vw", autoAlpha: 0, force3D: true });
    gsap.set(right, { x:  "12vw", autoAlpha: 0, force3D: true });
    if (steps.length) gsap.set(steps, { y: -5, autoAlpha: 0 });

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      scrollTrigger: {
        trigger: sec,
        start: "top 80%",
        end: "bottom 55%",
        toggleActions: "play none none reverse",
        scroller,
        markers: false,
        invalidateOnRefresh: true,
      },
    });

    tl.to(left,  { x: 0, autoAlpha: 1, duration: 0.9 }, 0)
      .to(right, { x: 0, autoAlpha: 1, duration: 0.9 }, 0);

    if (steps.length) {
      tl.to(steps, {
        y: 0,
        autoAlpha: 1,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.22,
      }, ">+=0.08");
    }
  });
}

/* (opciono) Auto-wrap svih .spectra-table u .table-scroll */
function ensureTableScrollWrap(root = document) {
  root.querySelectorAll('.spectra-table').forEach((tbl) => {
    if (tbl.parentElement && tbl.parentElement.classList.contains('table-scroll')) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-scroll';
    tbl.parentNode.insertBefore(wrap, tbl);
    wrap.appendChild(tbl);
  });
}

const boot = async () => {
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (e) {
    console.warn("Font readiness check failed", e);
  }

  // ScrollSmoother dinamički (Club/Trial), sa fallback-om na CDN
  let ScrollSmootherMod = null;
  try {
    ScrollSmootherMod = (await import('gsap/ScrollSmoother')).ScrollSmoother;
    if (ScrollSmootherMod && (!gsap.core.globals().ScrollSmoother)) {
      gsap.registerPlugin(ScrollSmootherMod);
    }
  } catch (_) {
    try {
      const m = await import('https://esm.sh/gsap@3/ScrollSmoother?bundle');
      ScrollSmootherMod = m.default || m.ScrollSmoother || null;
      if (ScrollSmootherMod && (!gsap.core.globals().ScrollSmoother)) {
        gsap.registerPlugin(ScrollSmootherMod);
      }
    } catch {}
  }

  const smoother = ScrollSmootherMod ? ScrollSmootherMod.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: 0,   // 0 = off; 1.0–1.2 za glatko
    effects: true
  }) : null;

  // Nested scroll fix (.table-scroll)
  if (smoother && typeof smoother.ignore === "function") {
    smoother.ignore(".table-scroll");
  } else {
    try { ScrollTrigger.normalizeScroll({ allowNestedScroll: true }); }
    catch { /* no-op */ }
    document.querySelectorAll(".table-scroll").forEach((el) => {
      el.style.touchAction = "auto";
      el.style.webkitOverflowScrolling = "touch";
    });
  }

  // ensureTableScrollWrap(); // uključi ako ne obmotaš HTML ručno

  // Prefiksiraj rgb-img samo ako preloader nije već odradio
  function fixRgbImgBase(root = document) {
    const BASE = import.meta.env?.BASE_URL ?? '/';
    root.querySelectorAll('[data-rgb-img]').forEach(el => {
      let v = el.getAttribute('data-rgb-img') || '';
      if (!v || /^https?:\/\//i.test(v)) return;
      v = v.replace(/^\/+/, '');
      el.setAttribute('data-rgb-img', BASE + v);
    });
  }
  if (!document.documentElement.hasAttribute('data-rgb-prefixed')) {
    fixRgbImgBase();
  }

  // Init efekata/animacija
  initRgbSplit();
  // initResponsiveTables();
  initAnimations({ gsap, ScrollTrigger, smoother });

  await initLottieData(document);

  // initCubeReveal({ gsap, ScrollTrigger });
  initCubeRevealInstanced({ gsap, ScrollTrigger });
  initScrollGradientMask();
  initGridDissolveReveal({ gsap, ScrollTrigger });

  requestAnimationFrame(() => {
    initImageMaskReveal({}, { gsap, ScrollTrigger });
    initMergeReveal({ gsap, ScrollTrigger, smoother });
    ScrollTrigger.refresh();
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());

  // HMR cleanup (Vite)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      try { destroyLottieData(document); } catch {}
      try { smoother?.kill(); } catch {}
      ScrollTrigger.getAll().forEach((st) => st.kill());
      gsap.globalTimeline.clear();
    });
  }
};

// === Pokretanje: prvo PRELOADER, pa boot ==========================
async function start() {
  try {
    if (document.fonts?.ready) { await document.fonts.ready; }
  } catch {}
  await runPreloader(document);
  await boot();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
