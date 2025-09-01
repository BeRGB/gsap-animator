// src/animations/scrambleText.js
// ------------------------------
// Komplet: scrambleText + initScrambleFromData
// Safe trigger resolving (nikad window), lokalni scope preferiran,
// auto refresh posle load-a i nakon mogućih layout promena.

export default function scrambleText(opts, { gsap, ScrollTrigger }) {
  const {
    el,
    triggerEl = el,

    // režim
    mode = "scroll", // "scroll" | "immediate"

    // fade
    fromOpacity = 0,
    toOpacity = 1,

    // vremena
    duration = 1.0,
    delay = 0,
    ease = "power2.out",

    // ScrollTrigger
    start = "top 85%",
    end = "bottom 60%",
    scrub = false,
    once = true,
    markers = false,
    deferUntilScroll = false,

    // podešavanja scrambla
    charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    charStagger = 0.03, // s
    jitter = 0.2,       // 0..1
    preserveWhitespace = true,
    onlyLetters = false,

    // varijanta prikaza
    variant = "scramble", // "scramble" | "reveal" | "mix" | "scramble+reveal"
    trailRandom = 1,

    // opcioni unutrašnji target
    target = null,
    targetSelector = null
  } = opts;

  const targetSel = target || targetSelector;
  const node = targetSel ? el.querySelector(targetSel) : el;
  if (!node) return;

  const original = (node.textContent ?? "").normalize();
  const chars = Array.from(original);
  const N = chars.length;

  const isWordChar = (c) => /[A-Za-z0-9ćčžšđĆČŽŠĐ]/.test(c);
  const shouldScramble = (c) => {
    if (preserveWhitespace && /\s/.test(c)) return false;
    if (onlyLetters && !isWordChar(c)) return false;
    return true;
  };
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  // pragovi po znaku
  const thresholds = chars.map((_, i) => {
    const base = Math.min(1, (i * (charStagger || 0)) / Math.max(0.0001, duration));
    const j = (Math.random() * 2 - 1) * (jitter || 0) * 0.2;
    return clamp01(base + j);
  });

  const pickRand = (upperLike) => {
    const pool = charset && charset.length ? charset : "█▓▒░#@%&*";
    let ch = pool[Math.floor(Math.random() * pool.length)];
    if (upperLike && /[A-Za-z]/.test(ch)) {
      ch = Math.random() < 0.5 ? ch.toUpperCase() : ch.toLowerCase();
    }
    return ch;
  };

  // rendereri
  function renderScramble(progress) {
    const out = chars.map((c, i) => {
      if (!shouldScramble(c)) return c;
      const threshold = thresholds[i];
      if (progress >= threshold) return c;
      const looksUpper = c.toUpperCase() === c && /[A-Za-z]/.test(c);
      return pickRand(looksUpper);
    });
    node.textContent = out.join("");
  }

  function renderReveal(progress) {
    let last = -1;
    for (let i = 0; i < N; i++) { if (progress >= thresholds[i]) last = i; else break; }
    node.textContent = last < 0 ? "" : chars.slice(0, last + 1).join("");
  }

  function renderMix(progress) {
    let last = -1;
    for (let i = 0; i < N; i++) { if (progress >= thresholds[i]) last = i; else break; }
    let out = last < 0 ? "" : chars.slice(0, last + 1).join("");
    const remain = N - (last + 1);
    const trail = Math.min(Math.max(0, trailRandom | 0), remain);
    for (let k = 0; k < trail; k++) {
      const idx = last + 1 + k;
      const tpl = chars[idx];
      if (!shouldScramble(tpl)) { out += tpl; continue; }
      const looksUpper = tpl.toUpperCase() === tpl && /[A-Za-z]/.test(tpl);
      out += pickRand(looksUpper);
    }
    node.textContent = out;
  }

  const key = (variant || "").toLowerCase();
  const renderer =
    key === "reveal" ? renderReveal :
    (key === "mix" || key === "scramble+reveal") ? renderMix :
    renderScramble;

  // početno stanje
  if (key === "scramble") renderScramble(0);
  else node.textContent = "";
  gsap.set(node, { autoAlpha: fromOpacity });

  const state = { p: 0 };
  const makeTween = () =>
    gsap.to(state, {
      p: 1,
      duration,
      delay,
      ease,
      immediateRender: false,
      onUpdate: () => renderer(state.p),
      onStart: () => renderer(state.p),
      onComplete: () => renderer(1),
      scrollTrigger:
        mode === "scroll"
          ? {
              trigger: triggerEl,
              start,
              end,
              scrub,
              markers,
              invalidateOnRefresh: true, 
              ...(scrub ? {} : {
                toggleActions: once ? "play none none none" : "play none none reverse",
              }),
              once: scrub ? false : !!once,
              onEnter: () =>
                gsap.to(node, { autoAlpha: toOpacity, duration: 0.3, overwrite: "auto" }),
              onLeaveBack: () => {
                if (!once && !scrub) {
                  state.p = 0;
                  if (key === "scramble") renderScramble(0);
                  else node.textContent = "";
                  gsap.set(node, { autoAlpha: fromOpacity });
                }
              }
            }
          : undefined
    });

  if (mode === "immediate") {
    gsap.to(node, { autoAlpha: toOpacity, duration: 0.3 });
    makeTween().play();
    return;
  }

  if (deferUntilScroll && window.scrollY === 0) {
    if (key === "scramble") renderScramble(0); else node.textContent = "";
    window.addEventListener(
      "scroll",
      () => { makeTween(); ScrollTrigger.refresh(); },
      { passive: true, once: true }
    );
    return;
  }

  makeTween();

  el.__scramblePlay = () => {
    state.p = 0;
    if (key === "scramble") renderScramble(0); else node.textContent = "";
    gsap.to(node, { autoAlpha: toOpacity, duration: 0.3 });
    gsap.to(state, { p: 1, duration, ease, onUpdate: () => renderer(state.p) });
  };

  el.__scrambleReset = () => {
    state.p = 0;
    if (key === "scramble") renderScramble(0); else node.textContent = "";
    gsap.set(node, { autoAlpha: fromOpacity });
  };
}

/* ============================
   Init iz data-* atributa
============================ */

// helper – uvek vrati VALIDAN Element (nikad window/null)
function asEl(x) { return x && x.nodeType === 1 ? x : null; }

// safe resolver: lokalni scope → global → fallback na el
function resolveTrigger(el, sel, root) {
  if (!sel) return el;
  const scope =
    el.closest("[data-anim-scope]") ||
    el.closest(".stage") ||
    el.closest("section") ||
    root || document;
  const cand = scope.querySelector(sel) || (root || document).querySelector(sel);
  return asEl(cand) || el;
}

// promene koje verovatno menjaju layout → refresh
function setupAutoRefresh(ScrollTrigger) {
  const refresh = () => ScrollTrigger.refresh();

  // posle kompletnog load-a (uklj. slike)
  window.addEventListener("load", () => {
    // mali delay da smoother/canvas završe merenja
    setTimeout(refresh, 50);
  }, { once: true });

  // kada se fontovi učitaju (ako browser podržava)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(refresh, 50)).catch(() => {});
  }

  // globalni osmatrač za promene veličine na canvas/img/video
  const ro = new ResizeObserver(() => setTimeout(refresh, 16));
  document.querySelectorAll("canvas,img,video,[data-rgb-stage]").forEach((n) => {
    try { ro.observe(n); } catch (_) {}
  });
}

export function initScrambleFromData({ root = document, gsap, ScrollTrigger } = {}) {
  if (!gsap || !ScrollTrigger) return;

  const $all = root.querySelectorAll(
    '[data-anim="reveal"],[data-anim="scramble"],[data-anim="scramble+reveal"],[data-anim="mix"],[data-anim="scrambleReveal"]'
  );

  $all.forEach((el) => {
    const ds = el.dataset;

    const n = (v, d) => (v == null ? d : isNaN(+v) ? d : +v);
    const b = (v, d) => (v == null ? d : String(v).toLowerCase() === "true");
    const s = (v, d) => (v == null || v === "" ? d : v);

    // *** SIGURAN trigger ***
    const triggerEl = resolveTrigger(el, ds.animTrigger, root);

    const variant =
      (ds.anim || ds.animVariant || ds.animReveal || "scramble").toLowerCase();

    const opts = {
      el,
      triggerEl,
      mode: s(ds.animMode, "scroll"),
      fromOpacity: n(ds.animFromOpacity, 0),
      toOpacity: n(ds.animToOpacity, 1),
      duration: n(ds.animDuration, 1.0),
      delay: n(ds.animDelay, 0),
      ease: s(ds.animEase, "power2.out"),
      start: s(ds.animStart, "top 85%"),
      end: s(ds.animEnd, "bottom 60%"),
      scrub: b(ds.animScrub, false),
      once: b(ds.animOnce, true),
      markers: b(ds.animMarkers, false),
      deferUntilScroll: b(ds.animDefer, false),
      charset: s(ds.animCharset, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
      charStagger: n(ds.animCharStagger, 0.03),
      jitter: n(ds.animJitter, 0.2),
      preserveWhitespace: ds.animPreserveWhitespace ? b(ds.animPreserveWhitespace, true) : true,
      onlyLetters: ds.animOnlyLetters ? b(ds.animOnlyLetters, false) : false,
      variant,
      trailRandom: n(ds.animTrailRandom, 1),
      targetSelector: s(ds.animTarget, null),
    };

    // DEBUG (ako želiš da vidiš šta se dešava):
    // if (ds.animTrigger) console.log("[scramble] trigger", ds.animTrigger, "→", triggerEl);

    scrambleText(opts, { gsap, ScrollTrigger });
  });

  setupAutoRefresh(ScrollTrigger);
}
