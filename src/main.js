// main.js
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { initRgbSplit } from "/src/effects/rgbSplitCanvas/index.js";
import { initAnimations } from "/src/animator.js";
import { initLottieData, destroyLottieData } from "/src/animations/lottieData";
import { initScrollGradientMask } from "/src/effects/scrollGradientMask.js";
import { initImageMaskReveal } from "/src/animations/maskReveal.js";
// import { initCubeReveal } from "/src/effects/cubeReveal.js";
import { initCubeRevealInstanced } from "/src/effects/cubeRevealInstanced.js";
import { initGridDissolveReveal } from "/src/effects/gridDissolveReveal.js";
// import { initResponsiveTables } from "/src/utils/responsiveTables.js";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

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

  const smoother = ScrollSmoother.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: 0,   // 0 = bez smoothinga; 1.0–1.2 za glatko
    effects: true,
  });

  // === Nested scroll fix (da .table-scroll radi na iOS/Android) ===
  if (smoother && typeof smoother.ignore === "function") {
    smoother.ignore(".table-scroll");
  } else {
    try {
      ScrollTrigger.normalizeScroll({
        allowNestedScroll: true
      });
    } catch (e) {
      console.info("NormalizeScroll not available; continuing with CSS/touchAction fallback.");
    }
    document.querySelectorAll(".table-scroll").forEach((el) => {
      el.style.touchAction = "auto";
      el.style.webkitOverflowScrolling = "touch";
    });
  }
  // === END fix ===

  // ensureTableScrollWrap(); // uključi ako ne obmotaš HTML ručno

  initRgbSplit();
  // initResponsiveTables(); // nije potrebno u H-scroll varijanti
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
