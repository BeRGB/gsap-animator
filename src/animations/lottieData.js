// src/animations/lottieData.js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (!gsap.core.globals().ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
}

/* ---------------- lazy-load lottie-web (za .json) ---------------- */
let _lottiePromise = null;
async function getLottie() {
  if (!_lottiePromise) {
    _lottiePromise = import('lottie-web').then((m) => m.default || m);
  }
  return _lottiePromise;
}

/* ---------------- lazy-load <lottie-player> (za .lottie) ---------------- */
let _playerLoaded = false;
function ensureLottiePlayerScript() {
  if (_playerLoaded) return;
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
  s.async = true;
  document.head.appendChild(s);
  _playerLoaded = true;
}

/* ---------------- helpers ---------------- */
const toBool = (v, def = true) => {
  if (v === undefined) return def;
  const s = String(v).toLowerCase();
  if (s === '' || s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return def;
};
const toNum = (v, def = 0) => (v === undefined ? def : Number(v));
const get = (ds, key, fallback) => (ds[key] !== undefined ? ds[key] : fallback);
const isJson = (p) => /\.json(\?|#|$)/i.test(p);
const isDotLottie = (p) => /\.lottie(\?|#|$)/i.test(p);

function raf(n = 1) {
  return new Promise((res) => {
    const tick = () => (n-- <= 0 ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
}

/** Sačekaj da element dobije nenultu veličinu (sprečava race) */
function waitForNonZeroSize(el, { timeout = 3000 } = {}) {
  return new Promise((resolve) => {
    const ok = () => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    if (ok()) return resolve(true);

    let done = false;
    const ro = new ResizeObserver(() => {
      if (done) return;
      if (ok()) {
        done = true;
        ro.disconnect();
        resolve(true);
      }
    });
    ro.observe(el);

    setTimeout(() => {
      if (done) return;
      done = true;
      ro.disconnect();
      if (!ok()) console.warn('[lottie-data] Container still 0x0 after timeout — proceeding anyway.');
      resolve(false);
    }, timeout);
  });
}

/** Učitaj JSON kao tekst pa JSON.parse (izbegava XHR/responseType probleme) */
async function loadAnimationData(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  const txt = await res.text();
  return JSON.parse(txt);
}

/** Responsive box helper (width:100% + optional max + aspect) */
function applyResponsiveBox(el, ds) {
  // uvek fluidna širina
  el.style.width = '100%';
  // max širina ako je zadat data-max ili data-max-width
  const max = ds.max || ds.maxWidth;
  if (max) el.style.maxWidth = max;

  // aspekt ako je zadat (npr 16/9, 3/2, 1/1)
  const ar = ds.aspect || ds.ratio;
  if (ar) el.style.aspectRatio = ar;

  // sakrij overflow da SVG lepo stane i kod 'cover'
  el.style.overflow = el.style.overflow || 'hidden';
}

/** Mapiranje data-fit => preserveAspectRatio (osim ako ima data-preserve) */
function resolvePreserve(ds) {
  const explicit = ds.preserve;
  if (explicit) return explicit;
  const fit = (ds.fit || '').toLowerCase(); // contain | cover
  if (fit === 'cover') return 'xMidYMid slice';
  if (fit === 'contain') return 'xMidYMid meet';
  return null; // Lottie default
}

/** Nakon DOMLoaded: nateraj SVG da puni kontejner i reflow na resize */
function finalizeSvgFillAndResize(el, anim) {
  const trySet = () => {
    const svg = el.querySelector('svg');
    if (!svg) return false;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.width = '100%';
    svg.style.height = '100%';
    return true;
  };
  // probaj odmah i sledeći frame (nekad kasni mount)
  if (!trySet()) {
    requestAnimationFrame(trySet);
  }

  // resize observer → anim.resize()
  const ro = new ResizeObserver(() => {
    try { anim.resize?.(); } catch {}
  });
  ro.observe(el);
  // sačuvaj da kasnije (destroy) možemo da odspojimo
  el._lottieRO = ro;
}

/* ---------------- core: JSON (.json) putevi ---------------- */
async function createImmediateJSON(el, opts) {
  await waitForNonZeroSize(el);
  const lottie = await getLottie();
  const data = await loadAnimationData(opts.path);

  const rendererSettings = {};
  if (opts.preserve) rendererSettings.preserveAspectRatio = opts.preserve;

  const anim = lottie.loadAnimation({
    container: el,
    renderer: opts.renderer,
    loop: opts.loop,
    autoplay: opts.autoplay,
    animationData: data,
    rendererSettings,
  });

  anim.addEventListener('DOMLoaded', async () => {
    finalizeSvgFillAndResize(el, anim);
    await raf(1);
    ScrollTrigger.refresh();
  });

  return anim;
}

async function createScrollJSON(el, opts) {
  await waitForNonZeroSize(el);
  const lottie = await getLottie();
  const data = await loadAnimationData(opts.path);

  const rendererSettings = {};
  if (opts.preserve) rendererSettings.preserveAspectRatio = opts.preserve;

  const anim = lottie.loadAnimation({
    container: el,
    renderer: opts.renderer,
    loop: false,
    autoplay: false,
    animationData: data,
    rendererSettings,
  });

  anim.addEventListener('data_failed', () => {
    console.error('[lottie-data] Lottie data_failed for', opts.path);
  });

  anim.addEventListener('DOMLoaded', async () => {
    finalizeSvgFillAndResize(el, anim);

    const totalFrames = Math.floor(anim.getDuration(true));
    await raf(1);

    ScrollTrigger.create({
      trigger: opts.trigger || el,
      start: opts.start,
      end: opts.end,
      scrub: toNum(opts.scrub, 1),
      pin: toBool(opts.pin, false),
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const f = Math.round(self.progress * totalFrames);
        anim.goToAndStop(f, true);
      },
      onLeave: () => anim.goToAndStop(totalFrames, true),
      onLeaveBack: () => anim.goToAndStop(0, true),
      onRefresh: () => {
        const st = ScrollTrigger.getById?.(el) || null;
        const p = st ? st.progress : null;
        if (typeof p === 'number') {
          anim.goToAndStop(Math.round(p * totalFrames), true);
        }
      },
    });

    await raf(1);
    ScrollTrigger.refresh();
  });

  return anim;
}

/* ---------------- core: .lottie putevi (web komponenta) ---------------- */
function createImmediateDotLottie(el, opts) {
  ensureLottiePlayerScript();
  el.innerHTML = '';
  const player = document.createElement('lottie-player');
  player.setAttribute('src', opts.path);
  player.setAttribute('background', 'transparent');
  player.setAttribute('style', 'width:100%;height:100%;display:block;');
  if (toBool(opts.loop, true)) player.setAttribute('loop', '');
  if (toBool(opts.autoplay, true)) player.setAttribute('autoplay', '');
  el.appendChild(player);
  el._lottiePlayer = player;

  raf(1).then(() => ScrollTrigger.refresh());
  return player;
}

function createScrollDotLottie(el, opts) {
  console.error('[lottie-data] Scroll mode nije podržan za .lottie fajl. Koristi JSON za scrub.');
  return createImmediateDotLottie(el, opts);
}

/* ---------------- init/destroy ---------------- */
export async function initLottieData(root = document) {
  const nodes = [...root.querySelectorAll('[data-lottie], [data-lottie-path]')];
  if (!nodes.length) return;

  for (const el of nodes) {
    if (el._lottieInstance || el._lottiePlayer) continue;

    try {
      const ds = el.dataset;
      const path = ds.lottie || ds.lottiePath;
      if (!path) continue;

      // Responsive + max-width uvek prvo:
      applyResponsiveBox(el, ds);

      // Dimenzije iz data-* (opciono, ali NE gasimo responsive width)
      const w = ds.width || ds.w;
      const h = ds.height || ds.h;
      if (h) el.style.height = h;            // dozvoljeno ako baš želiš fiksnu visinu
      if (w) el.style.maxWidth = w;          // tretiramo data-width kao maxWidth (da ostane responsive)

      // Mapiraj fit→preserve ako nije već zadat
      const preserve = resolvePreserve(ds);

      // Unutrašnji wrap za vizuelni scale (bez izmene layout-a)
      const scale = ds.scale;
      const origin = ds.origin || 'center center';
      let hostEl = el;
      if (scale) {
        const wrap = document.createElement('div');
        wrap.style.width = '100%';
        wrap.style.height = '100%';
        wrap.style.transform = `scale(${scale})`;
        wrap.style.transformOrigin = origin;
        el.innerHTML = '';
        el.appendChild(wrap);
        hostEl = wrap;
      }

      const mode = get(ds, 'mode', 'immediate'); // immediate | scroll

      // .lottie → lottie-player
      if (isDotLottie(path)) {
        const baseOpts = {
          path,
          loop: toBool(ds.loop, mode === 'immediate'),
          autoplay: toBool(ds.autoplay, mode === 'immediate'),
        };
        const inst =
          mode === 'scroll'
            ? createScrollDotLottie(hostEl, baseOpts)
            : createImmediateDotLottie(hostEl, baseOpts);
        el._lottieInstance = inst; // radi uniformno destroy
        continue;
      }

      // .json → lottie-web (sa animationData)
      if (isJson(path)) {
        const renderer = get(ds, 'renderer', 'svg');
        const baseOpts = {
          path,
          renderer,
          loop: toBool(ds.loop, mode === 'immediate'),
          autoplay: toBool(ds.autoplay, mode === 'immediate'),
          start: get(ds, 'start', 'top 80%'),
          end: get(ds, 'end', 'bottom 20%'),
          scrub: get(ds, 'scrub', '1'),
          pin: get(ds, 'pin', undefined),
          trigger: ds.trigger ? document.querySelector(ds.trigger) : null,
          preserve: get(ds, 'preserve', preserve), // koristi data-preserve ili data-fit
        };

        await getLottie();

        const anim =
          mode === 'scroll'
            ? await createScrollJSON(hostEl, baseOpts)
            : await createImmediateJSON(hostEl, baseOpts);

        el._lottieInstance = anim;
        continue;
      }

      console.error('[lottie-data] Nepodržana ekstenzija fajla:', path);
    } catch (err) {
      console.error('[lottie-data] init error:', err);
    }
  }
}

/** Uništi instance i prateće ScrollTrigger-e (npr. kod SPA rute/HMR). */
export function destroyLottieData(root = document) {
  const nodes = [...root.querySelectorAll('[data-lottie], [data-lottie-path]')];

  nodes.forEach((el) => {
    if (el._lottieInstance && typeof el._lottieInstance.destroy === 'function') {
      try { el._lottieInstance.destroy(); } catch {}
      el._lottieInstance = null;
    }
    if (el._lottiePlayer) {
      try {
        el._lottiePlayer.pause?.();
        el._lottiePlayer.remove();
      } catch {}
      el._lottiePlayer = null;
    }
    if (el._lottieRO) {
      try { el._lottieRO.disconnect(); } catch {}
      el._lottieRO = null;
    }
  });

  ScrollTrigger.getAll().forEach((st) => {
    const trg = st.trigger;
    if (trg && (root === document ? true : root.contains(trg))) st.kill();
  });
  ScrollTrigger.refresh();
}
