// src/animations/fade.js
export default function fade(opts, { gsap, ScrollTrigger }) {
  const { el, triggerEl = el } = opts;

  // ---------- TRIGGER RESOLVER ----------
  function resolveTriggerElement() {
    const raw = (el.dataset.animTrigger || "").trim();
    if (!raw) return triggerEl;

    // podrži ".class", "#id" ili "class"
    let selector = raw;
    if (!(selector.startsWith(".") || selector.startsWith("#"))) {
      selector = "." + selector.replace(/^\.+/, "");
    }

    // probaj globalno
    try {
      const found = document.querySelector(selector);
      if (found instanceof Element) return found;
    } catch (_) {}

    // probaj u najbližem scope-u
    const scope = el.closest("[data-anim-scope]") || document;
    try {
      const foundInScope = scope.querySelector(selector);
      if (foundInScope instanceof Element) return foundInScope;
    } catch (_) {}

    // fallback: sam element
    return el;
  }
  const triggerElFinal = resolveTriggerElement();

  // ---------- OPCIJE IZ DATA- ATRIBUTA ----------
  const x = el.dataset.animX ? parseFloat(el.dataset.animX) : 0;
  const y = el.dataset.animY ? parseFloat(el.dataset.animY) : 30;

  const fromScale = 1;
  const toScale = 1;
  const fromOpacity = 0;
  const toOpacity = 1;

  const duration = el.dataset.animDuration ? parseFloat(el.dataset.animDuration) : 0.9;
  const delay = el.dataset.animDelay ? parseFloat(el.dataset.animDelay) : 0;
  const ease = el.dataset.animEase || "power2.out";

  const mode = el.dataset.mode || "scroll";
  const start = el.dataset.animStart || "top 85%";
  const end = el.dataset.animEnd || "bottom 60%";
  const scrub = el.dataset.animScrub === "true" || false;
  const once = el.dataset.animOnce !== "false"; // default: true
  const markers = el.dataset.animMarkers === "true" || false;

  const split = el.dataset.animSplit || null; // "lines" | "words" | "chars"
  const childSelector = el.dataset.childSelector || null;
  // NOTE: u HTML-u koristiš data-anim-stagger-children → čitamo baš to ime
  const staggerChildren = el.dataset.animStaggerChildren
    ? parseFloat(el.dataset.animStaggerChildren)
    : 0.12;

  const lineTolerance = el.dataset.animLineTolerance
    ? parseInt(el.dataset.animLineTolerance, 10)
    : 3;
  const leftResetTolerance = 12;
  const resplitOnResize = true;

  // ---------- SPLIT HELPERS ----------
  const makeSpan = (txt) => {
    const s = document.createElement("span");
    if (txt != null) s.textContent = txt;
    s.style.display = "inline-block";
    s.style.whiteSpace = "pre";
    return s;
  };

  const splitChars = (node) => {
    const text = node.textContent ?? "";
    node.textContent = "";
    return Array.from(text).map((ch) => {
      const span = makeSpan(ch);
      node.appendChild(span);
      return span;
    });
  };

  const splitWords = (node) => {
    const text = node.textContent ?? "";
    node.textContent = "";
    const targets = [];
    const parts = text.split(/(\s+)/);
    parts.forEach((part) => {
      const span = makeSpan(part);
      node.appendChild(span);
      if (!/^\s+$/.test(part)) targets.push(span);
    });
    return targets;
  };

  function splitLinesStable(node) {
    const originalText = node.textContent ?? "";
    if (!originalText) return [node];

    const rig = document.createElement("div");
    const cs = getComputedStyle(node);
    const copyKeys = [
      "fontFamily","fontSize","fontWeight","fontStyle","fontVariant","lineHeight",
      "letterSpacing","textTransform","textIndent","wordSpacing","textRendering",
      "direction","textAlign","paddingTop","paddingRight","paddingBottom","paddingLeft",
      "borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth",
      "boxSizing"
    ];
    rig.style.position = "absolute";
    rig.style.left = "-99999px";
    rig.style.visibility = "hidden";
    rig.style.whiteSpace = "normal";
    rig.style.wordBreak = "keep-all";
    rig.style.display = "block";
    rig.style.width = node.getBoundingClientRect().width + "px";
    copyKeys.forEach((k) => (rig.style[k] = cs[k]));
    document.body.appendChild(rig);

    const tokens = [];
    originalText.split(/(\s+)/).forEach((part) => {
      const isSpace = /^\s+$/.test(part);
      const w = document.createElement("span");
      w.textContent = part;
      w.style.display = "inline-block";
      w.style.whiteSpace = isSpace ? "pre" : "nowrap";
      rig.appendChild(w);
      tokens.push(w);
    });

    const lines = [];
    let current = [];
    let currentMidY = null;
    let prevLeft = null;

    tokens.forEach((w) => {
      const r = w.getClientRects()[0] || w.getBoundingClientRect();
      const midY = (r.top + r.bottom) / 2;
      const left = r.left;
      const isSpace = /^\s+$/.test(w.textContent || "");

      if (currentMidY === null) {
        currentMidY = midY;
        prevLeft = left;
        current.push(w);
        return;
      }

      const yClose = Math.abs(midY - currentMidY) <= lineTolerance;
      const leftReset = prevLeft != null && left + leftResetTolerance < prevLeft;

      if ((yClose && !leftReset) || isSpace) {
        current.push(w);
      } else {
        if (current.length) lines.push(current);
        current = [w];
        currentMidY = midY;
      }
      prevLeft = left;
    });
    if (current.length) lines.push(current);

    node.textContent = "";
    const lineSpans = [];
    lines.forEach((group) => {
      const line = document.createElement("span");
      line.className = "split-line";
      line.style.display = "inline-block";
      line.style.whiteSpace = "pre";

      let firstNonSpaceMet = false;
      group.forEach((w, idx) => {
        const txt = w.textContent ?? "";
        if (/^\s+$/.test(txt)) {
          const prev = group[idx - 1]?.textContent ?? "";
          const next = group[idx + 1]?.textContent ?? "";
          if (!/^\s+$/.test(prev) && !/^\s+$/.test(next) && firstNonSpaceMet) {
            line.appendChild(makeSpan(" "));
          }
        } else {
          firstNonSpaceMet = true;
          line.appendChild(makeSpan(txt));
        }
      });

      node.appendChild(line);
      lineSpans.push(line);
    });

    rig.remove();
    return lineSpans;
  }

  // ---------- RESOLVE TARGETS ----------
  const originalHTML = el.innerHTML;
  let targets = (() => {
    if (split === "lines") return splitLinesStable(el);
    if (split === "words") return splitWords(el);
    if (split === "chars") return splitChars(el);
    if (childSelector) return el.querySelectorAll(childSelector);
    return [el];
  })();

  // ---------- PRIME INITIAL STATE ----------
  gsap.set(targets, {
    autoAlpha: fromOpacity,
    x,
    y,
    scale: fromScale,
    force3D: true,
    willChange: "transform, opacity"
  });

  // ---------- UVEK PROSLEDI BEZBEDAN SCROLLER (nikad window) ----------
  const SAFE_SCROLLER =
    el.ownerDocument?.scrollingElement ||
    document.scrollingElement ||
    document.documentElement;

  // ---------- TWEEN ----------
  let tween;
  const make = () =>
    gsap.fromTo(
      targets,
      { autoAlpha: fromOpacity, x, y, scale: fromScale },
      {
        autoAlpha: toOpacity,
        x: 0,
        y: 0,
        scale: toScale,
        duration,
        delay,
        ease,
        stagger: staggerChildren || 0,
        immediateRender: false,
        clearProps: "willChange",
        scrollTrigger:
          mode === "scroll"
            ? {
                trigger: triggerElFinal instanceof Element ? triggerElFinal : el,
                scroller: SAFE_SCROLLER, // <- ključ: uvek Element, nikad window
                start,
                end,
                scrub,
                markers,
                toggleActions: once ? "play none none none" : "play none none reverse"
              }
            : undefined
      }
    );

  tween = make();

  // ---------- RESPLIT NA RESIZE (ako je split aktivan) ----------
  if (resplitOnResize && split) {
    const resplit = () => {
      if (tween?.scrollTrigger) tween.scrollTrigger.kill();
      if (tween) { gsap.killTweensOf(targets); tween.kill?.(); }

      el.innerHTML = originalHTML;
      targets = (() => {
        if (split === "lines") return splitLinesStable(el);
        if (split === "words") return splitWords(el);
        if (split === "chars") return splitChars(el);
        if (childSelector) return el.querySelectorAll(childSelector);
        return [el];
      })();

      gsap.set(targets, {
        autoAlpha: fromOpacity,
        x,
        y,
        scale: fromScale,
        force3D: true,
        willChange: "transform, opacity"
      });

      tween = make();
      ScrollTrigger.refresh();
    };

    const ro = new ResizeObserver(() => {
      if (resplit._raf) cancelAnimationFrame(resplit._raf);
      resplit._raf = requestAnimationFrame(resplit);
    });
    const scope = el.closest("[data-anim-scope]") || el.parentElement || el;
    if (scope instanceof Element) {
      ro.observe(scope);
      el.__fadeLineRO = ro;
    }
  }

  return tween;
}
