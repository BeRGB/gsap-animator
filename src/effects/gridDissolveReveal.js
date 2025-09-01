// src/effects/gridDissolveReveal.js
// BelA maska preko sekcije -> mreža kvadrata (CSS grid) fade-out otkriva sadržaj
// GSAP ScrollTrigger podržano (scrub/once), random ili razni redosledi

const _gsap = (typeof window !== "undefined" && window.gsap) ? window.gsap : null;

export function initGridDissolveReveal({
  selector = ".grid-dissolve",
  gsap: gsapParam = null,
  ScrollTrigger: ScrollTriggerParam = null,
  onReady = null,
} = {}) {
  const els = Array.from(document.querySelectorAll(selector));
  els.forEach(el => setupOne(el, gsapParam, ScrollTriggerParam, onReady));
}

function setupOne(container, gsapParam, ScrollTriggerParam, onReady) {
  const {
    rows: rowsAttr,
    cols: colsAttr,
    color: colorAttr,
    radius: radiusAttr,
    gap: gapAttr,
    duration: durAttr,
    stagger: staggerAttr,
    mode: modeAttr,          // "random" | "row" | "col" | "diag" | "center"
    start: startAttr,
    end: endAttr,
    scrub: scrubAttr,
    once: onceAttr,
    ease: easeAttr,
  } = container.dataset;

  // Defaults
  const rows    = clampInt(rowsAttr, 18);
  const cols    = clampInt(colsAttr, 32);
  const color   = colorAttr || "#fff";
  const radius  = clampNum(radiusAttr, 0);           // px
  const gap     = clampNum(gapAttr, 0);              // px
  const duration= clampNum(durAttr, 0.6);
  const stagger = clampNum(staggerAttr, 0.01);
  const mode    = (modeAttr || "random").toLowerCase();
  const start   = startAttr || "top 80%";
  const end     = endAttr || "bottom 50%";
  const scrub   = scrubAttr === "true";
  const once    = onceAttr === "false" ? false : true;
  const ease    = easeAttr || "power2.out";

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "grid-dissolve__overlay";
  overlay.style.cssText = `
    position:absolute; inset:0; pointer-events:none;
    display:grid; grid-template-rows:repeat(${rows}, 1fr);
    grid-template-columns:repeat(${cols}, 1fr);
    gap:${gap}px; contain:strict; will-change:opacity, transform;
    z-index:1;
  `;

  // Ensure container styles
  const cs = getComputedStyle(container);
  if (cs.position === "static") container.style.position = "relative";
  container.appendChild(overlay);

  // Build cells
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "grid-dissolve__cell";
      cell.style.cssText = `
        background:${color};
        border-radius:${radius}px;
        opacity:1; will-change:opacity;
      `;
      // Store coords
      cell.dataset.r = r;
      cell.dataset.c = c;
      overlay.appendChild(cell);
      cells.push(cell);
    }
  }

  // Build stagger order
  const indexOrder = orderIndices(rows, cols, mode);
  const orderedCells = indexOrder.map(i => cells[i]);

  const gsapRef = gsapParam || _safeGsap();
  if (!gsapRef) return;

  const tl = gsapRef.timeline({ paused: true });
  tl.to(orderedCells, {
    opacity: 0,
    ease,
    duration,
    stagger: stagger,
  });

  // ScrollTrigger binding
  const ST = ScrollTriggerParam || gsapRef.ScrollTrigger || gsapRef.plugins?.ScrollTrigger;
  if (ST) {
    ST.create({
      trigger: container,
      start, end, scrub, once,
      onEnter:      () => { if (!scrub) tl.play(); },
      onEnterBack:  () => { if (!scrub) tl.play(); },
      onLeaveBack:  () => { if (!scrub && !once) tl.reverse(); },
      onUpdate: (self) => { if (scrub) tl.progress(self.progress); },
    });
  }

  // Public API
  container.__gridDissolve = {
    play: () => tl.play(),
    reverse: () => tl.reverse(),
    reset: () => gsapRef.set(cells, { opacity: 1 }),
    destroy: () => { overlay.remove(); },
  };

  onReady && onReady(container.__gridDissolve);
}

// ===== Helpers =====
function orderIndices(rows, cols, mode) {
  // build [0..rows*cols-1]
  const total = rows * cols;
  const idx = new Array(total).fill(0).map((_, i) => i);

  if (mode === "random") {
    // Fisher–Yates
    for (let i = total - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }

  if (mode === "row") {
    return idx; // prirodni redosled po DOM-u je po redovima
  }

  if (mode === "col") {
    // po kolonama
    const out = [];
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) out.push(r * cols + c);
    return out;
  }

  if (mode === "diag") {
    // anti-diagonal waves (r+c)
    return idx.slice().sort((a, b) => {
      const ar = (a / cols) | 0, ac = a % cols;
      const br = (b / cols) | 0, bc = b % cols;
      return (ar + ac) - (br + bc);
    });
  }

  if (mode === "center") {
    // od centra ka ivicama
    const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
    return idx.slice().sort((a, b) => {
      const ar = (a / cols) | 0, ac = a % cols;
      const br = (b / cols) | 0, bc = b % cols;
      const da = (ac - cx) ** 2 + (ar - cy) ** 2;
      const db = (bc - cx) ** 2 + (br - cy) ** 2;
      return da - db;
    });
  }

  return idx;
}

function clampNum(v, f) { const n = Number(v); return Number.isFinite(n) ? n : f; }
function clampInt(v, f) { return Math.max(1, Math.round(clampNum(v, f))); }
function _safeGsap() { return (typeof window !== "undefined" && window.gsap) ? window.gsap : null; }
