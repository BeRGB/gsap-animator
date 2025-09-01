// src/animator.js
import fade from "./animations/fade";
import scramble from "./animations/scrambleText";


const registry = { fade, scramble };


function coerce(val) {
  if (val === "true") return true;
  if (val === "false") return false;
  if (val == null || val === "") return val;
  const n = Number(val);
  return Number.isNaN(n) ? val : n;
}

// Pretvara data-anim-foo, data-anim-from-scale ... u camelCase ključeve
function parseDatasetAnim(el) {
  const conf = {};
  for (const [k, v] of Object.entries(el.dataset)) {
    if (!k.startsWith("anim") || k === "anim") continue;
    const key = k
      .replace(/^anim/, "")
      .replace(/^[A-Z]/, (m) => m.toLowerCase())
      .replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
    const normalized =
      key.indexOf("-") >= 0
        ? key
            .split("-")
            .map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p))
            .join("")
        : key;
    conf[normalized] = coerce(v);
  }
  return conf;
}

function parseAnim(el) {
  const raw = el.getAttribute("data-anim");
  if (!raw) return null;

  let conf = {};
  try {
    if (raw.trim().startsWith("{")) conf = JSON.parse(raw);
    else conf.type = raw.trim();
  } catch (e) {
    console.warn("Bad JSON in data-anim:", raw, e);
    return null;
  }

  // dopuni iz data-anim-*
  Object.assign(conf, parseDatasetAnim(el));

  // scope & trigger
  const scope = el.closest("[data-anim-scope]") || el.parentElement || el;
  let triggerEl = el;
  const trigSel = conf.trigger || conf.triggerSelector;
  if (trigSel) {
    const found = scope.querySelector(trigSel);
    if (found) triggerEl = found;
  }

  return { el, scope, triggerEl, ...conf };
}

export function initAnimations(ctx) {
  const nodes = Array.from(document.querySelectorAll("[data-anim]"));
  nodes.forEach((el) => {
    const conf = parseAnim(el);
    if (!conf || !conf.type) return;
    const fn = registry[conf.type];
    if (!fn) {
      console.warn(`Unknown data-anim type: ${conf.type}`, el);
      return;
    }
    fn(conf, ctx);
  });

  ctx.ScrollTrigger.refresh();
}