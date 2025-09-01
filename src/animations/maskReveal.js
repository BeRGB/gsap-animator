// src/animations/imageMaskReveal.js
// Overlay sa JEDNOM mask slikom (PNG/SVG) koji na scroll otkriva target ispod.
// Engine: "css" (mask-image, alpha/luminance) ili "blend" (mix-blend-mode: destination-out).
//
// [data-image-mask] ATRIBUTI:
//
// Obavezno:
//   data-target="#selector"
//   data-mask-src="/mask.png"      // stavi u /public (Vite): npr. /mask.png
//
// Kontrola:
//   data-from="left|right|top|bottom"   (default: left)
//   data-duration="1"                   (default: 1)
//   data-ease="power2.out"              (default: power2.out)
//   data-scrub="false|true|0.6"         (default: false)
//   data-once="true|false"              (default: true)
//   data-start="top 85%"                (default: top 85%)
//   data-end="bottom 60%"               (default: bottom 60%)
//   data-trigger="#selector"            (opciono; default target)
//
// Maska i izgled:
//   data-engine="auto|css|blend"        (default: auto)
//   data-mask-mode="alpha|luminance"    (default: alpha; samo za css engine)
//   data-mask-size="cover|contain|120% auto"  (ako ne koristiš scale)
//   data-mask-scale="1"                 (default: 1; ako ne koristiš mask-size)
//   data-mask-offset="120%"             (koliko ulazi maska pre otkrivanja; default 120%)
//   data-overlay-color="#9a9a9a"        (default: #9a9a9a)
//   data-overlay-opacity="1"            (0..1; default: 1)
//   data-z="3"                          (z-index overlay-a; default 3)
//
// Asset saveti:
//  - CSS/alpha: rupe = TRANSPARENT pikseli u PNG/SVG; pozadina = OPAQUE (alpha=1).
//  - CSS/luminance: CRNO = rupa, BELO = ostaje (Safari može biti nestabilan; alpha je sigurniji).
//  - BLEND engine: „pojede“ gde je mask slika NEPROZIRNA (npr. crni ševroni na transparentnom bg).
//
// Autor: GPT helper

export function initImageMaskReveal(opts = {}, { gsap, ScrollTrigger }) {
  const overlays = Array.from(document.querySelectorAll("[data-image-mask]"));
  if (!overlays.length) return;

  const parseBool = (v, def = false) => {
    if (v == null || v === "") return def;
    if (!isNaN(v)) return Number(v);
    return String(v) === "true";
  };

  const findTarget = (overlay) => {
    const sel = overlay.dataset.target?.trim();
    let t = sel ? document.querySelector(sel) : null;
    if (!t) t = overlay.previousElementSibling; // često overlay stoji odmah posle targeta
    if (!t && overlay.parentElement) {
      t = overlay.parentElement.querySelector("img, picture img, video, .content, .mask-target");
    }
    return t;
  };

  const positionOverlayToTarget = (overlay, target) => {
    const parent = target.parentElement || overlay.parentElement;
    if (!parent) return;

    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    if (overlay.parentElement !== parent) parent.appendChild(overlay);

    // važno za blend engine da se „pojedanje“ zadrži u okviru parenta
    parent.style.isolation = parent.style.isolation || "isolate";

    Object.assign(overlay.style, {
      position: "absolute",
      pointerEvents: "none",
      left: target.offsetLeft + "px",
      top:  target.offsetTop + "px",
      width:  target.offsetWidth + "px",
      height: target.offsetHeight + "px",
    });
  };

  const cssMaskApplied = (el) => {
    const cs = getComputedStyle(el);
    const mi = (cs.maskImage && cs.maskImage !== "none") ? cs.maskImage : (cs.webkitMaskImage || "none");
    return mi !== "none";
  };

  overlays.forEach((overlay) => {
    if (overlay.dataset.imrInitialized === "1") return;

    const target = findTarget(overlay);
    if (!target) {
      console.warn("[imageMaskReveal] data-target nije pronađen:", overlay.dataset.target, overlay);
      return;
    }

    positionOverlayToTarget(overlay, target);

    // realign na promene
    const roAlign = new ResizeObserver(() => positionOverlayToTarget(overlay, target));
    roAlign.observe(target);
    if (target.parentElement) roAlign.observe(target.parentElement);
    if (target.tagName === "IMG" && !target.complete) {
      target.addEventListener("load", () => positionOverlayToTarget(overlay, target), { once: true });
    }

    // parametri
    const from      = overlay.dataset.from || "left";
    const duration  = parseFloat(overlay.dataset.duration || "1");
    const ease      = overlay.dataset.ease || "power2.out";
    const scrub     = parseBool(overlay.dataset.scrub, false);
    const once      = parseBool(overlay.dataset.once, true);
    const start     = overlay.dataset.start || "top 85%";
    const end       = overlay.dataset.end || "bottom 60%";
    const markers   = parseBool(overlay.dataset.markers, false);
    const triggerEl = overlay.dataset.trigger ? document.querySelector(overlay.dataset.trigger) : target;

    const overlayColor   = overlay.dataset.overlayColor || "#9a9a9a";
    const overlayOpacity = Math.max(0, Math.min(1, parseFloat(overlay.dataset.overlayOpacity ?? "1")));
    const zIndex         = overlay.dataset.z || "3";

    const engine    = overlay.dataset.engine || "auto"; // auto | css | blend
    const maskSrc   = overlay.dataset.maskSrc;
    const maskMode  = overlay.dataset.maskMode || "alpha"; // alpha | luminance (css)
    const maskScale = parseFloat(overlay.dataset.maskScale || "1");
    const maskSize  = overlay.dataset.maskSize;            // npr. "cover" ili "120% auto"
    const maskOffset= overlay.dataset.maskOffset || "120%";

    if (!maskSrc) {
      console.warn("[imageMaskReveal] data-mask-src je obavezan.", overlay);
      return;
    }

    overlay.dataset.imrInitialized = "1";
    overlay.innerHTML = ""; // čist overlay
    overlay.style.zIndex = zIndex;
    overlay.style.backgroundColor = overlayColor;
    overlay.style.opacity = String(overlayOpacity);
    overlay.style.overflow = "hidden";

    const axis = (from === "left" || from === "right") ? "x" : "y";
    const fromPos = (from === "left" || from === "top") ? "-" + maskOffset : maskOffset;

    // ========== Pokušaj CSS engine-a ==========
    let usedEngine = "css";
    if (engine !== "blend") {
      // postavi css masku
      overlay.style.WebkitMaskImage = `url("${maskSrc}")`;
      overlay.style.maskImage = `url("${maskSrc}")`;
      overlay.style.WebkitMaskRepeat = "no-repeat";
      overlay.style.maskRepeat = "no-repeat";
      overlay.style.maskMode = maskMode; // luminance | alpha

      if (maskSize) {
        overlay.style.WebkitMaskSize = maskSize;
        overlay.style.maskSize = maskSize;
      } else {
        overlay.style.WebkitMaskSize = `${maskScale * 100}% auto`;
        overlay.style.maskSize = `${maskScale * 100}% auto`;
      }

      // početna pozicija maske
      gsap.set(overlay, {
        WebkitMaskPosition: axis === "x" ? `${fromPos} 50%` : `50% ${fromPos}`,
        maskPosition:       axis === "x" ? `${fromPos} 50%` : `50% ${fromPos}`,
      });

      // ako je tražen CSS ili auto
      if (engine === "css" || engine === "auto") {
        // proveri da li je zaista primenjena
        if (!cssMaskApplied(overlay) || engine === "blend") {
          usedEngine = "blend";
        }
      }
    } else {
      usedEngine = "blend";
    }

    // ========== Blend fallback (destination-out) ==========
    let animTarget = overlay; // element koji animiramo
    if (usedEngine === "blend") {
      // resetuj css mask
      overlay.style.WebkitMaskImage = "";
      overlay.style.maskImage = "";

      // child koji „jede“ overlay
      const eraser = document.createElement("img");
      eraser.src = maskSrc;
      eraser.alt = "";
      Object.assign(eraser.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        mixBlendMode: "destination-out", // KLJUČNO
        pointerEvents: "none",
        willChange: "transform",
      });

      // dimenzije maske
      if (maskSize) {
        // "cover" / "contain" / "120% auto" -> prostije sa width/height:
        if (maskSize === "cover") {
          eraser.style.width = "100%";
          eraser.style.height = "100%";
          eraser.style.objectFit = "cover";
        } else if (maskSize === "contain") {
          eraser.style.width = "100%";
          eraser.style.height = "100%";
          eraser.style.objectFit = "contain";
        } else {
          // npr "120% auto"
          eraser.style.width = maskSize.split(" ")[0];
          eraser.style.height = (maskSize.split(" ")[1] || "auto");
        }
      } else {
        eraser.style.width = `${maskScale * 100}%`;
        eraser.style.height = "auto";
      }

      overlay.appendChild(eraser);
      animTarget = eraser;

      // početna pozicija: pomeramo eraser ka spolja
      const axisProp = (axis === "x") ? "x" : "y";
      const fromVal = fromPos; // string "120%" itd.
      gsap.set(animTarget, { [axisProp]: fromVal });
    }

    // ========== Animacija (zajedničko) ==========
    const tl = gsap.timeline({ defaults: { duration, ease }, paused: true });

    if (usedEngine === "css") {
      const toPos = "0%";
      tl.to(overlay, {
        WebkitMaskPosition: axis === "x" ? `${toPos} 50%` : `50% ${toPos}`,
        maskPosition:       axis === "x" ? `${toPos} 50%` : `50% ${toPos}`,
      });
    } else {
      const axisProp = (axis === "x") ? "x" : "y";
      tl.to(animTarget, { [axisProp]: "0%" });
    }

    const st = ScrollTrigger.create({
      trigger: triggerEl || overlay,
      start, end, scrub, markers,
      onEnter: () => {
        tl.play();
        if (once && !scrub) tl.eventCallback("onComplete", () => { st && st.kill(); });
      },
      onEnterBack: () => { if (!once) tl.play(); },
      onLeaveBack: () => { if (!once) tl.reverse(); },
      invalidateOnRefresh: true,
    });

    // Re-align on resize
    const roDim = new ResizeObserver(() => positionOverlayToTarget(overlay, target));
    roDim.observe(overlay);
  });
}
